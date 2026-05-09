// Edge function: отправка push-уведомлений через push4site.com
// Вызывается из БД-триггеров (verify_jwt = false).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUSH4SITE_API_KEY = Deno.env.get("PUSH4SITE_API_KEY") ?? "";
const PUSH4SITE_SITE_ID = Deno.env.get("PUSH4SITE_SITE_ID") ?? "";

// Базовый endpoint push4site. Если в вашем кабинете указан другой URL — поправьте здесь.
const ENDPOINTS = [
  "https://push4site.com/api/Notification/Send",
  "https://api.push4site.com/api/Notification/Send",
];

interface PushPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
}

async function sendPush(p: PushPayload): Promise<{ ok: boolean; status: number; text: string; endpoint: string }> {
  let lastErr = { ok: false, status: 0, text: "no attempts", endpoint: "" };

  for (const endpoint of ENDPOINTS) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PUSH4SITE_API_KEY}`,
          apikey: PUSH4SITE_API_KEY,
        },
        body: JSON.stringify({
          siteId: PUSH4SITE_SITE_ID,
          site_id: PUSH4SITE_SITE_ID,
          apiKey: PUSH4SITE_API_KEY,
          title: p.title,
          message: p.body,
          body: p.body,
          text: p.body,
          url: p.url ?? "https://gruzli.lovable.app",
          link: p.url ?? "https://gruzli.lovable.app",
          icon: p.icon,
        }),
      });
      const text = await res.text();
      if (res.ok) return { ok: true, status: res.status, text, endpoint };
      lastErr = { ok: false, status: res.status, text, endpoint };
    } catch (e) {
      lastErr = { ok: false, status: 0, text: String(e), endpoint };
    }
  }
  return lastErr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PUSH4SITE_API_KEY || !PUSH4SITE_SITE_ID) {
      return new Response(
        JSON.stringify({ error: "PUSH4SITE_API_KEY/PUSH4SITE_SITE_ID not set" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const title: string = body.title || "Gruzli";
    const text: string = body.body || body.message || "";
    const url: string | undefined = body.url;

    if (!text) {
      return new Response(JSON.stringify({ error: "body/message required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await sendPush({ title, body: text, url });
    console.log("push4site result:", JSON.stringify(result));
    return new Response(JSON.stringify(result), {
      status: result.ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push4site error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
