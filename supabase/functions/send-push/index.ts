import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = "mailto:support@gruzli.app";
const VAPID_PUBLIC_REPAIRED = VAPID_PUBLIC === "BAFIgs6_EbZXaym4QUAl-10E5i4yh6gkoJh8VZ9jfgeS-6nkAYAs1AcN3WPy081bsDHAbDAq9nCUKRWmPGz3MY"
  ? "BAFIgs6_EbZXaym4QUAl-10E5i4yh6gkoJh8VZ9jfgeS-6nkAYAs1AcN3W-Py081bsDHAbDAq9nCUKRWmPGz3MY"
  : VAPID_PUBLIC;

if (VAPID_PUBLIC_REPAIRED && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_REPAIRED, VAPID_PRIVATE);
}

async function sendPushToUsers(supabase: any, userIds: string[], payload: { title: string; body: string; url: string; tag?: string }) {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return { sent: 0, failed: 0 };

  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", uniqueIds);

  if (!subs?.length) return { sent: 0, failed: 0 };

  let sent = 0, failed = 0;
  await Promise.all(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any,
        JSON.stringify({ title: payload.title, body: payload.body, url: payload.url, tag: payload.tag, icon: "/favicon.jpeg" }),
        { TTL: 86400 }
      );
      sent++;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", s.id);
      }
      failed++;
    }
  }));
  return { sent, failed };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let sent = 0, failed = 0;
    const APP_URL = "https://gruzli.lovable.app";

    if (body.type === "new_message") {
      const { data: sender } = await supabase.from("profiles").select("full_name").eq("user_id", body.sender_id).single();
      const { data: parts } = await supabase.from("conversation_participants").select("user_id").eq("conversation_id", body.conversation_id).neq("user_id", body.sender_id);
      const recipientIds = (parts || []).map((p: any) => p.user_id);
      const r = await sendPushToUsers(supabase, recipientIds, {
        title: `💬 ${sender?.full_name || "Новое сообщение"}`,
        body: body.text || "Медиа-сообщение",
        url: `${APP_URL}/?openChat=${body.conversation_id}`,
        tag: `chat-${body.conversation_id}`,
      });
      sent = r.sent; failed = r.failed;

    } else if (body.type === "new_job") {
      const { data: workers } = await supabase.from("user_roles").select("user_id").eq("role", "worker");
      const workerIds = (workers || []).map((w: any) => w.user_id);
      const r = await sendPushToUsers(supabase, workerIds, {
        title: `🆕 Новый заказ: ${body.title}`,
        body: `${body.hourly_rate}₽/ч · ${body.address || "Адрес не указан"}`,
        url: APP_URL,
        tag: `job-${body.job_id}`,
      });
      sent = r.sent; failed = r.failed;

    } else if (body.type === "worker_status_change") {
      const { data: job } = await supabase.from("jobs").select("dispatcher_id, title").eq("id", body.job_id).single();
      const { data: worker } = await supabase.from("profiles").select("full_name").eq("user_id", body.worker_id).single();
      if (job) {
        const statusLabels: Record<string, string> = {
          confirmed: "✅ Подтвердил заказ", ready: "✅ Готов к работе",
          en_route: "🚗 Выехал", arrived: "📍 На месте",
          finishing: "⏹ Завершите работу", completed: "🎉 Завершил работу",
        };
        const r = await sendPushToUsers(supabase, [body.worker_status === "finishing" ? body.worker_id : job.dispatcher_id], {
          title: statusLabels[body.worker_status] || body.worker_status,
          body: `${worker?.full_name || "Грузчик"} · ${job.title}`,
          url: APP_URL,
          tag: `status-${body.job_id}`,
        });
        sent = r.sent; failed = r.failed;
      }
    }

    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
