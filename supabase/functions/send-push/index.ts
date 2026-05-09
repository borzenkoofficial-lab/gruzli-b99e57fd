// Send Web Push notifications via VAPID using web-push npm package on Deno
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@gruzli.app";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

function buildPayload(input: any) {
  const { type } = input || {};
  if (type === "new_message") {
    return {
      title: "Новое сообщение",
      body: input.text ? String(input.text).slice(0, 240) : "[медиа]",
      url: "/",
      data: { type, conversation_id: input.conversation_id },
    };
  }
  if (type === "new_job") {
    const parts = [input.address, input.hourly_rate ? `${input.hourly_rate}₽/ч` : null]
      .filter(Boolean)
      .join(" • ");
    return {
      title: `Новая заявка: ${input.title || "Без названия"}`.slice(0, 120),
      body: parts || "Открыта новая заявка",
      url: "/",
      data: { type, job_id: input.job_id },
    };
  }
  return {
    title: input?.title || "Уведомление",
    body: input?.body || "",
    url: input?.url || "/",
    data: input?.data || {},
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const input = await req.json().catch(() => ({}));
    const payload = buildPayload(input);

    // Try to read subscriptions from a `push_subscriptions` table if it exists.
    const { data: subs, error } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth");

    if (error) {
      console.warn("[send-push] subscriptions read failed:", error.message);
      return new Response(
        JSON.stringify({ ok: true, sent: 0, note: "no subscriptions table" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let sent = 0;
    let failed = 0;
    const json = JSON.stringify(payload);

    for (const s of subs || []) {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
        );
        sent++;
      } catch (err: any) {
        failed++;
        console.error("[send-push] send failed:", err?.statusCode, err?.body);
        // Clean up gone subscriptions
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[send-push] error:", e?.message || e);
    return new Response(JSON.stringify({ error: e?.message || "error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
