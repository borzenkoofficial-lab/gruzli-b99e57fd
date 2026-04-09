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
]);

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

function toBase64Url(value: string) {
  return value.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendWebPush(
  subscription: PushSubscriptionRow,
  payload: string,
) {
  return await webpush.sendNotification(
    {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: toBase64Url(subscription.p256dh),
        auth: toBase64Url(subscription.auth),
      },
    },
    payload,
  );
}

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
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    webpush.setVapidDetails(
      "mailto:push@gruzli.app",
      vapidPublicKey,
      vapidPrivateKey,
    );

    let title = "";
    let messageBody = "";
    let targetUserIds: string[] = [];
    const notificationData: Record<string, string> = { type };

    if (type === "new_job") {
      title = `🆕 Новый заказ: ${body.title}`;
      messageBody = `${body.hourly_rate}₽/ч · ${body.address || "Адрес не указан"}`;
      if (body.job_id) {
        notificationData.job_id = body.job_id;
      }

      const { data: workers } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "worker");

      targetUserIds = (workers || []).map((w: any) => w.user_id);
    } else if (type === "new_message") {
      notificationData.conversation_id = body.conversation_id;

      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", body.conversation_id)
        .neq("user_id", body.sender_id);

      targetUserIds = (participants || []).map((p: any) => p.user_id);

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

    const { data: subscriptions } = await supabase
      .from("push_subscriptions")
      .select("*")
      .in("user_id", targetUserIds);

    const payload = JSON.stringify({
      title,
      body: messageBody,
      ...notificationData,
    });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions || []) {
      try {
        const res = await sendWebPush(sub as PushSubscriptionRow, payload);

        if (res.statusCode === 201 || res.statusCode === 200) {
          sent++;
        } else if (res.statusCode === 410 || res.statusCode === 404) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          failed++;
        } else {
          failed++;
          console.error(`Push failed for ${sub.endpoint}: ${res.statusCode}`);
        }
      } catch (err) {
        failed++;
        const statusCode = typeof err === "object" && err !== null && "statusCode" in err
          ? String((err as { statusCode?: number }).statusCode)
          : "unknown";
        const bodyText = typeof err === "object" && err !== null && "body" in err
          ? String((err as { body?: string }).body)
          : String(err);

        if (statusCode === "404" || statusCode === "410") {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
        }

        console.error(`Push error [${statusCode}]: ${bodyText}`);
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
