// Gruzli Web Push (own VAPID, no Progressier)
// Reads subscriptions from `push_subscriptions` table and sends Web Push
// notifications directly to the browser's push service using web-push.

import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import webpush from "npm:web-push@3.6.7";
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
  z.object({
    type: z.literal("response_accepted"),
    job_id: z.string().uuid(),
    worker_id: z.string().uuid(),
    job_title: z.string().min(1),
  }),
  z.object({
    type: z.literal("response_rejected"),
    job_title: z.string().min(1),
    worker_id: z.string().uuid(),
  }),
  z.object({
    type: z.literal("response_rejected_bulk"),
    job_title: z.string().min(1),
    worker_ids: z.array(z.string().uuid()).min(1),
  }),
]);

const APP_URL = "https://gruzli.lovable.app";

// ---- VAPID setup ----
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = "mailto:support@gruzli.app";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
  } catch (e) {
    console.error("Failed to set VAPID details:", e);
  }
} else {
  console.error("VAPID keys missing");
}

interface PushSub {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function sendToSubscriptions(
  supabase: any,
  subs: PushSub[],
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url,
    tag: payload.tag,
    icon: "/favicon.jpeg",
    badge: "/favicon.jpeg",
  });

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          } as any,
          payloadStr,
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        // 404/410 = подписка удалена/истекла — чистим из БД
        if (status === 404 || status === 410) {
          try {
            await supabase.from("push_subscriptions").delete().eq("id", s.id);
          } catch (_e) {}
        } else {
          console.error(`Push failed [${status}] ${s.endpoint.slice(0, 60)}…`, err?.body || err);
        }
        failed++;
      }
    }),
  );

  return { sent, failed };
}

async function sendPushToUsers(
  supabase: any,
  userIds: string[],
  payload: { title: string; body: string; url: string; tag?: string },
): Promise<{ sent: number; failed: number }> {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) return { sent: 0, failed: 0 };

  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, user_id, endpoint, p256dh, auth")
    .in("user_id", uniqueUserIds);

  if (error) {
    console.error("Failed to fetch subscriptions:", error);
    return { sent: 0, failed: uniqueUserIds.length };
  }

  if (!subs || subs.length === 0) return { sent: 0, failed: 0 };

  return sendToSubscriptions(supabase, subs as PushSub[], payload);
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

      const { data: workers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      const workerIds = (workers || []).map((w: any) => w.user_id);
      const tag = body.job_id ? `job-${body.job_id}` : "job";
      const result = await sendPushToUsers(supabase, workerIds, { title, body: messageBody, url, tag });
      sent += result.sent;
      failed += result.failed;
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

      const candidateIds = (participants || []).map((p: any) => p.user_id);

      // Skip users currently online (in-app toast covers them)
      const ONLINE_THRESHOLD_MS = 30 * 1000;
      const targetUserIds: string[] = [];
      if (candidateIds.length > 0) {
        const { data: recipientProfiles } = await supabase
          .from("profiles")
          .select("user_id, last_seen_at")
          .in("user_id", candidateIds);

        const lastSeenMap = new Map<string, string | null>(
          (recipientProfiles || []).map((p: any) => [p.user_id, p.last_seen_at]),
        );
        const now = Date.now();
        for (const uid of candidateIds) {
          const lastSeen = lastSeenMap.get(uid);
          if (lastSeen && now - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS) continue;
          targetUserIds.push(uid);
        }
      }

      const tag = `chat-${body.conversation_id}`;
      const result = await sendPushToUsers(supabase, targetUserIds, { title, body: messageBody, url, tag });
      sent += result.sent;
      failed += result.failed;
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
        const url = APP_URL;

        if (body.worker_status === "finishing") {
          const messageBody = `Заказ: ${jobData.title}. Завершите работу для подсчёта.`;
          const result = await sendPushToUsers(supabase, [body.worker_id], {
            title: "⏹ Завершите работу",
            body: messageBody,
            url,
            tag: `status-${body.job_id}-${body.worker_id}`,
          });
          sent += result.sent;
          failed += result.failed;
        } else {
          const messageBody = `${workerName} · ${jobData.title}`;
          const result = await sendPushToUsers(supabase, [jobData.dispatcher_id], {
            title: statusLabel,
            body: messageBody,
            url,
            tag: `status-${body.job_id}-${body.worker_id}`,
          });
          sent += result.sent;
          failed += result.failed;
        }
      }
    } else if (type === "response_accepted") {
      const result = await sendPushToUsers(supabase, [body.worker_id], {
        title: "🎉 Вас выбрали на заказ!",
        body: `${body.job_title} — открой заказ, чтобы подтвердить.`,
        url: `${APP_URL}/job/${body.job_id}`,
        tag: `accepted-${body.job_id}-${body.worker_id}`,
      });
      sent += result.sent;
      failed += result.failed;
    } else if (type === "response_rejected") {
      const result = await sendPushToUsers(supabase, [body.worker_id], {
        title: "Отклик не выбран",
        body: `«${body.job_title}» — диспетчер выбрал другого исполнителя.`,
        url: APP_URL,
        tag: `rejected-${body.worker_id}-${Date.now()}`,
      });
      sent += result.sent;
      failed += result.failed;
    } else if (type === "response_rejected_bulk") {
      const result = await sendPushToUsers(supabase, body.worker_ids, {
        title: "Набор закрыт",
        body: `«${body.job_title}» — все места уже заняты.`,
        url: APP_URL,
        tag: `bulk-reject-${Date.now()}`,
      });
      sent += result.sent;
      failed += result.failed;
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
