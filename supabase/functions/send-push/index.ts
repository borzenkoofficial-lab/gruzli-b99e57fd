import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// VAPID auth header for web push
async function generateVapidAuth(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  subject: string
) {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  };

  const enc = new TextEncoder();
  const b64url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

  const headerB64 = btoa(JSON.stringify(header))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const payloadB64 = btoa(JSON.stringify(payload))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const signingInput = enc.encode(`${headerB64}.${payloadB64}`);

  // Import private key
  const rawKey = Uint8Array.from(
    atob(vapidPrivateKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0)
  );

  const key = await crypto.subtle.importKey(
    "pkcs8",
    await buildPkcs8(rawKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    signingInput
  );

  // Convert DER signature to raw r||s
  const rawSig = derToRaw(new Uint8Array(signature));
  const token = `${headerB64}.${payloadB64}.${b64url(rawSig.buffer)}`;

  return {
    authorization: `vapid t=${token}, k=${vapidPublicKey}`,
  };
}

function derToRaw(der: Uint8Array): Uint8Array {
  // If it's already 64 bytes, it's raw format
  if (der.length === 64) return der;

  const raw = new Uint8Array(64);
  // DER format: 0x30 len 0x02 rlen r 0x02 slen s
  let offset = 2; // skip 0x30 len
  // skip first 0x02
  offset += 1;
  const rLen = der[offset++];
  const rStart = rLen > 32 ? offset + (rLen - 32) : offset;
  const rDest = rLen < 32 ? 32 - rLen : 0;
  raw.set(der.slice(rStart, rStart + Math.min(rLen, 32)), rDest);

  offset += rLen;
  offset += 1; // skip 0x02
  const sLen = der[offset++];
  const sStart = sLen > 32 ? offset + (sLen - 32) : offset;
  const sDest = sLen < 32 ? 64 - sLen : 32;
  raw.set(der.slice(sStart, sStart + Math.min(sLen, 32)), sDest);

  return raw;
}

async function buildPkcs8(rawPrivateKey: Uint8Array): Promise<ArrayBuffer> {
  // PKCS8 wrapper for EC P-256 private key
  const pkcs8Header = new Uint8Array([
    0x30, 0x41, 0x02, 0x01, 0x00, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48,
    0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03,
    0x01, 0x07, 0x04, 0x27, 0x30, 0x25, 0x02, 0x01, 0x01, 0x04, 0x20,
  ]);
  const result = new Uint8Array(pkcs8Header.length + rawPrivateKey.length);
  result.set(pkcs8Header);
  result.set(rawPrivateKey, pkcs8Header.length);
  return result.buffer;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
) {
  const vapidHeaders = await generateVapidAuth(
    subscription.endpoint,
    vapidPublicKey,
    vapidPrivateKey,
    "mailto:push@gruzli.app"
  );

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      ...vapidHeaders,
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body: payload,
  });

  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { type } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let title = "";
    let messageBody = "";
    let targetUserIds: string[] = [];

    if (type === "new_job") {
      // Notify all workers
      title = `🆕 Новый заказ: ${body.title}`;
      messageBody = `${body.hourly_rate}₽/ч · ${body.address || "Адрес не указан"}`;

      const { data: workers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      targetUserIds = (workers || []).map((w: any) => w.user_id);
    } else if (type === "new_message") {
      // Notify all participants except sender
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", body.conversation_id)
        .neq("user_id", body.sender_id);

      targetUserIds = (participants || []).map((p: any) => p.user_id);

      // Get sender name
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", body.sender_id)
        .single();

      title = `💬 ${senderProfile?.full_name || "Новое сообщение"}`;
      messageBody = body.text || "Медиа-сообщение";
    }

    if (targetUserIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get push subscriptions for target users
    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    const payload = JSON.stringify({ title, body: messageBody, type });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions || []) {
      try {
        const res = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          vapidPrivateKey
        );

        if (res.status === 201 || res.status === 200) {
          sent++;
        } else if (res.status === 410 || res.status === 404) {
          // Subscription expired, remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          failed++;
        } else {
          failed++;
          console.error(`Push failed for ${sub.endpoint}: ${res.status}`);
        }
      } catch (err) {
        failed++;
        console.error(`Push error: ${err}`);
      }
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
