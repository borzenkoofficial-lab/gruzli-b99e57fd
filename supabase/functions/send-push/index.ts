import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { z } from "npm:zod@3.25.76";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RequestSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("new_job"),
    job_id: z.string().uuid().optional(),
    title: z.string().min(1),
    hourly_rate: z.union([z.number(), z.string()]),
    address: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("new_message"),
    conversation_id: z.string().uuid(),
    sender_id: z.string().uuid(),
    text: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("worker_status_change"),
    job_id: z.string().uuid(),
    worker_id: z.string().uuid(),
    worker_status: z.string().min(1),
  }),
]);

const APP_URL = "https://gruzli.lovable.app";

// ---- Web Push via VAPID ----

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function base64UrlEncode(data: Uint8Array): string {
  let binary = "";
  for (const byte of data) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidKeys() {
  const publicKeyB64 = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKeyB64 = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKeyB64 || !privateKeyB64) return null;

  const rawPrivateKey = urlBase64ToUint8Array(privateKeyB64);
  const rawPublicKey = urlBase64ToUint8Array(publicKeyB64);

  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    rawPrivateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  ).catch(() => null);

  // If PKCS8 import fails, try JWK-based approach
  if (!privateKey) {
    // Try raw key import via JWK
    const jwk = {
      kty: "EC",
      crv: "P-256",
      x: base64UrlEncode(rawPublicKey.slice(1, 33)),
      y: base64UrlEncode(rawPublicKey.slice(33, 65)),
      d: base64UrlEncode(rawPrivateKey),
    };
    try {
      const pk = await crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
      );
      return { privateKey: pk, publicKey: rawPublicKey };
    } catch (e) {
      console.error("VAPID key import failed:", e);
      return null;
    }
  }

  return { privateKey, publicKey: rawPublicKey };
}

async function createVapidAuthHeader(endpoint: string, vapidKeys: { privateKey: CryptoKey; publicKey: Uint8Array }) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const subject = "mailto:support@gruzli.lovable.app";

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    vapidKeys.privateKey,
    encoder.encode(unsignedToken)
  );

  // Convert DER signature to raw r||s
  const sigArray = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigArray.length === 64) {
    rawSig = sigArray;
  } else {
    // DER decode
    const rLen = sigArray[3];
    const r = sigArray.slice(4, 4 + rLen);
    const sStart = 4 + rLen + 2;
    const s = sigArray.slice(sStart);
    const rPad = new Uint8Array(32);
    const sPad = new Uint8Array(32);
    rPad.set(r.length > 32 ? r.slice(r.length - 32) : r, 32 - Math.min(r.length, 32));
    sPad.set(s.length > 32 ? s.slice(s.length - 32) : s, 32 - Math.min(s.length, 32));
    rawSig = new Uint8Array(64);
    rawSig.set(rPad, 0);
    rawSig.set(sPad, 32);
  }

  const jwt = `${unsignedToken}.${base64UrlEncode(rawSig)}`;
  const publicKeyB64 = base64UrlEncode(vapidKeys.publicKey);

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyB64}`,
  };
}

async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKeyRaw = Uint8Array.from(atob(p256dhB64), c => c.charCodeAt(0));
  const clientAuthSecret = Uint8Array.from(atob(authB64), c => c.charCodeAt(0));

  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyRaw,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      localKeyPair.privateKey,
      256
    )
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const encoder = new TextEncoder();

  // IKM from auth secret
  const authInfo = encoder.encode("Content-Encoding: auth\0");
  const prkCombine = new Uint8Array(sharedSecret.length + 1 + authInfo.length);
  // HKDF extract + expand for auth
  const authHkdfKey = await crypto.subtle.importKey("raw", clientAuthSecret, { name: "HKDF" }, false, ["deriveBits"]);
  // Simplified: use HKDF with salt=authSecret, info, ikm=sharedSecret
  const ikmKey = await crypto.subtle.importKey("raw", sharedSecret, { name: "HKDF" }, false, ["deriveBits"]);
  
  // PRK = HKDF-Extract(salt=auth_secret, IKM=ecdh_secret)
  const prk = await crypto.subtle.importKey("raw", sharedSecret, "HKDF", false, ["deriveBits"]);

  // For simplicity, use a direct AES-GCM approach with derived key
  // Web Push uses aes128gcm content encoding
  
  // Build info for key derivation
  const keyInfoBuf = new Uint8Array([
    ...encoder.encode("WebPush: info\0"),
    ...clientPublicKeyRaw,
    ...localPublicKeyRaw,
  ]);

  // Use HMAC-based key derivation
  const hmacKey = await crypto.subtle.importKey(
    "raw", clientAuthSecret, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prkBytes = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, sharedSecret));

  const prkKey = await crypto.subtle.importKey(
    "raw", prkBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  // Derive content encryption key
  const cekInfo = new Uint8Array([
    ...encoder.encode("Content-Encoding: aes128gcm\0"),
    ...keyInfoBuf,
    1, // length byte for HKDF-Expand
  ]);
  
  // HKDF-Expand with salt
  const saltHmac = await crypto.subtle.importKey(
    "raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const prkSalted = new Uint8Array(await crypto.subtle.sign("HMAC", saltHmac, prkBytes));

  const prkSaltedKey = await crypto.subtle.importKey(
    "raw", prkSalted, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );

  const cekInfoFull = new Uint8Array([...encoder.encode("Content-Encoding: aes128gcm\0"), 1]);
  const keyMaterial = new Uint8Array(await crypto.subtle.sign("HMAC", prkSaltedKey, cekInfoFull));
  const contentKey = keyMaterial.slice(0, 16);

  const nonceInfo = new Uint8Array([...encoder.encode("Content-Encoding: nonce\0"), 1]);
  const nonceMaterial = new Uint8Array(await crypto.subtle.sign("HMAC", prkSaltedKey, nonceInfo));
  const nonce = nonceMaterial.slice(0, 12);

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  
  // Pad payload with delimiter
  const payloadBytes = encoder.encode(payload);
  const paddedPayload = new Uint8Array(payloadBytes.length + 1);
  paddedPayload.set(payloadBytes);
  paddedPayload[payloadBytes.length] = 2; // delimiter

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload)
  );

  // Build aes128gcm header: salt(16) + rs(4) + idlen(1) + keyid(65) + ciphertext
  const rs = new DataView(new ArrayBuffer(4));
  rs.setUint32(0, 4096);

  const header = new Uint8Array(16 + 4 + 1 + localPublicKeyRaw.length);
  header.set(salt, 0);
  header.set(new Uint8Array(rs.buffer), 16);
  header[20] = localPublicKeyRaw.length;
  header.set(localPublicKeyRaw, 21);

  const result = new Uint8Array(header.length + ciphertext.length);
  result.set(header);
  result.set(ciphertext, header.length);

  return { encrypted: result, salt, localPublicKey: localPublicKeyRaw };
}

async function sendWebPushNotification(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: object,
  vapidKeys: { privateKey: CryptoKey; publicKey: Uint8Array }
): Promise<boolean> {
  try {
    const payloadStr = JSON.stringify(payload);
    const { encrypted } = await encryptPayload(payloadStr, p256dh, auth);
    const vapidHeaders = await createVapidAuthHeader(endpoint, vapidKeys);

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...vapidHeaders,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Urgency: "high",
      },
      body: encrypted,
    });

    if (res.status === 201 || res.status === 200) return true;
    
    const text = await res.text();
    console.error(`Web push failed [${res.status}]: ${text}`);
    return false;
  } catch (err) {
    console.error("Web push send error:", err);
    return false;
  }
}

// ---- Progressier Push (existing) ----

async function sendProgressierPush(params: {
  recipientEmail?: string;
  broadcastAll?: boolean;
  title: string;
  body: string;
  url: string;
}) {
  const apiKey = Deno.env.get("PROGRESSIER_API_KEY");
  if (!apiKey) {
    console.error("PROGRESSIER_API_KEY not set");
    return { ok: false, error: "missing_api_key" };
  }

  const payload: Record<string, any> = {
    title: params.title,
    body: params.body,
    url: params.url,
  };

  if (params.broadcastAll) {
    payload.recipients = { all: true };
  } else if (params.recipientEmail) {
    payload.recipients = { email: params.recipientEmail };
  } else {
    return { ok: false, error: "no_recipient" };
  }

  try {
    const res = await fetch("https://progressier.app/jWxTg8Xf6DGKt3JsinXm/send", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`Progressier push failed [${res.status}]: ${text}`);
      return { ok: false, error: text };
    }
    return { ok: true };
  } catch (err) {
    console.error("Progressier fetch error:", err);
    return { ok: false, error: String(err) };
  }
}

// ---- Send native Web Push to specific user IDs ----

async function sendNativeWebPush(
  supabase: any,
  userIds: string[],
  payload: object
): Promise<{ sent: number; failed: number }> {
  const vapidKeys = await importVapidKeys();
  if (!vapidKeys) {
    console.error("VAPID keys not available, skipping native push");
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const userId of userIds) {
    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);

    if (!subs || subs.length === 0) continue;

    for (const sub of subs) {
      const ok = await sendWebPushNotification(
        sub.endpoint,
        sub.p256dh,
        sub.auth,
        payload,
        vapidKeys
      );
      if (ok) sent++;
      else {
        failed++;
        // If push endpoint is gone (410), clean up
        if (!ok) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", userId)
            .eq("endpoint", sub.endpoint);
        }
      }
    }
  }

  return { sent, failed };
}

// ---- Main handler ----

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const parsed = RequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = parsed.data;
    const { type } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let sent = 0;
    let failed = 0;

    if (type === "new_job") {
      const title = `🆕 Новый заказ: ${body.title}`;
      const messageBody = `${body.hourly_rate}₽/ч · ${body.address || "Адрес не указан"}`;
      const url = body.job_id ? `${APP_URL}/job/${body.job_id}` : APP_URL;

      const pushPayload = {
        title,
        body: messageBody,
        url,
        type: "new_job",
        job_id: body.job_id,
      };

      // Get all workers
      const { data: workers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      const workerIds = (workers || []).map((w: any) => w.user_id);

      // Send native Web Push to all workers
      const nativeResult = await sendNativeWebPush(supabase, workerIds, pushPayload);
      sent += nativeResult.sent;
      failed += nativeResult.failed;

      // Also try Progressier broadcast as fallback
      const progResult = await sendProgressierPush({
        broadcastAll: true,
        title,
        body: messageBody,
        url,
      });
      if (progResult.ok) sent++;
      else failed++;

    } else if (type === "new_message") {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", body.sender_id)
        .single();

      const senderName = senderProfile?.full_name || "Новое сообщение";
      const title = `💬 ${senderName}`;
      const messageBody = body.text || "Медиа-сообщение";
      const url = `${APP_URL}/?openChat=${body.conversation_id}`;

      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", body.conversation_id)
        .neq("user_id", body.sender_id);

      const targetUserIds = (participants || []).map((p: any) => p.user_id);

      const pushPayload = {
        title,
        body: messageBody,
        url,
        type: "new_message",
        conversation_id: body.conversation_id,
      };

      // Send native Web Push
      const nativeResult = await sendNativeWebPush(supabase, targetUserIds, pushPayload);
      sent += nativeResult.sent;
      failed += nativeResult.failed;

      // Also send via Progressier per user
      for (const userId of targetUserIds) {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          if (!userData?.user?.email) { failed++; continue; }

          const result = await sendProgressierPush({
            recipientEmail: userData.user.email,
            title,
            body: messageBody,
            url,
          });
          if (result.ok) sent++;
          else failed++;
        } catch (err) {
          console.error(`Push error for user ${userId}:`, err);
          failed++;
        }
      }

    } else if (type === "worker_status_change") {
      const STATUS_LABELS: Record<string, string> = {
        confirmed: "✅ Подтвердил заказ",
        ready: "✅ Готов к работе",
        en_route: "🚗 Выехал на объект",
        late: "⚠️ Опаздывает",
        arrived: "📍 На месте",
        finishing: "⏹ Диспетчер завершил заказ",
        completed: "🎉 Завершил работу",
      };

      const { data: workerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", body.worker_id)
        .single();

      const { data: jobData } = await supabase
        .from("jobs")
        .select("dispatcher_id, title")
        .eq("id", body.job_id)
        .single();

      if (jobData) {
        const workerName = workerProfile?.full_name || "Грузчик";
        const statusLabel = STATUS_LABELS[body.worker_status] || body.worker_status;
        const title = `${statusLabel}`;
        const url = APP_URL;

        if (body.worker_status === "finishing") {
          // "finishing" is set by dispatcher — notify the WORKER
          const messageBody = `Заказ: ${jobData.title}. Завершите работу для подсчёта.`;
          const pushPayload = { title: "⏹ Завершите работу", body: messageBody, url, type: "worker_status_change" };

          const nativeResult = await sendNativeWebPush(supabase, [body.worker_id], pushPayload);
          sent += nativeResult.sent;
          failed += nativeResult.failed;

          const { data: workerUser } = await supabase.auth.admin.getUserById(body.worker_id);
          if (workerUser?.user?.email) {
            const result = await sendProgressierPush({
              recipientEmail: workerUser.user.email,
              title: "⏹ Завершите работу",
              body: messageBody,
              url,
            });
            if (result.ok) sent++;
            else failed++;
          }
        } else {
          // Other statuses — notify the DISPATCHER
          const messageBody = `${workerName} · ${jobData.title}`;
          const pushPayload = { title, body: messageBody, url, type: "worker_status_change" };

          const nativeResult = await sendNativeWebPush(supabase, [jobData.dispatcher_id], pushPayload);
          sent += nativeResult.sent;
          failed += nativeResult.failed;

          const { data: dispatcherUser } = await supabase.auth.admin.getUserById(jobData.dispatcher_id);
          if (dispatcherUser?.user?.email) {
            const result = await sendProgressierPush({
              recipientEmail: dispatcherUser.user.email,
              title,
              body: messageBody,
              url,
            });
            if (result.ok) sent++;
            else failed++;
          } else {
            failed++;
          }
        }
      }
    }

    // Also send email notifications
    try {
      if (type === "new_job") {
        const { data: workers } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "worker");

        const targetUserIds = (workers || []).map((w: any) => w.user_id);
        await sendEmailNotifications(
          supabase,
          targetUserIds,
          "new-job-notification",
          {
            title: body.title,
            hourlyRate: String(body.hourly_rate),
            address: body.address || undefined,
          },
          `new-job-email-${body.job_id || Date.now()}`,
        );
      } else if (type === "new_message") {
        const { data: participants } = await supabase
          .from("conversation_participants")
          .select("user_id")
          .eq("conversation_id", body.conversation_id)
          .neq("user_id", body.sender_id);

        const targetUserIds = (participants || []).map((p: any) => p.user_id);
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", body.sender_id)
          .single();

        await sendEmailNotifications(
          supabase,
          targetUserIds,
          "new-message-notification",
          {
            senderName: senderProfile?.full_name || "Пользователь",
            messageText: body.text || "Медиа-сообщение",
          },
          `new-msg-email-${body.conversation_id}-${Date.now()}`,
        );
      }
    } catch (emailErr) {
      console.error("Email notification error (non-fatal):", emailErr);
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-push error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sendEmailNotifications(
  supabase: any,
  targetUserIds: string[],
  templateName: string,
  templateData: Record<string, any>,
  idempotencyPrefix: string,
) {
  if (targetUserIds.length === 0) return;

  for (const userId of targetUserIds) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      if (!userData?.user?.email) continue;

      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName,
          recipientEmail: userData.user.email,
          idempotencyKey: `${idempotencyPrefix}-${userId}`,
          templateData,
        },
      });
    } catch (err) {
      console.error(`Email send error for user ${userId}:`, err);
    }
  }
}
