import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:support@gruzli.app";
if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

const APP_URL = "https://gruzli.lovable.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u, error: uErr } = await userClient.auth.getUser();
    if (uErr || !u.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: u.user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const title = String(body.title || "").trim();
    const message = String(body.body || "").trim();
    const url = String(body.url || APP_URL).trim() || APP_URL;
    const roles: string[] = Array.isArray(body.roles) ? body.roles : [];
    const userIds: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "Нужны заголовок и текст" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!roles.length && !userIds.length) {
      return new Response(JSON.stringify({ error: "Выберите аудиторию" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect target user_ids
    const targetSet = new Set<string>(userIds);
    if (roles.length) {
      const validRoles = roles.filter((r) => ["worker", "dispatcher", "admin"].includes(r));
      if (validRoles.length) {
        const { data: rows } = await admin
          .from("user_roles")
          .select("user_id")
          .in("role", validRoles);
        for (const r of rows || []) targetSet.add(r.user_id);
      }
    }

    const ids = Array.from(targetSet);
    if (!ids.length) {
      return new Response(JSON.stringify({ sent: 0, failed: 0, total: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch subscriptions in chunks of 200
    const allSubs: any[] = [];
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      const { data } = await admin
        .from("push_subscriptions")
        .select("id, endpoint, p256dh, auth")
        .in("user_id", chunk);
      if (data) allSubs.push(...data);
    }

    let sent = 0, failed = 0;
    const tag = `admin-${Date.now()}`;
    await Promise.all(
      allSubs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } } as any,
            JSON.stringify({
              title,
              body: message,
              url,
              tag,
              icon: "/pwa-192x192.png",
              badge: "/badge-96x96.png",
            }),
            { TTL: 86400 }
          );
          sent++;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          }
          failed++;
        }
      })
    );

    return new Response(
      JSON.stringify({ sent, failed, total: allSubs.length, recipients: ids.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
