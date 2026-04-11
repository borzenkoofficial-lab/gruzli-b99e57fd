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

      // Broadcast to all subscribers
      const result = await sendProgressierPush({
        broadcastAll: true,
        title,
        body: messageBody,
        url,
      });

      if (result.ok) sent++;
      else failed++;
    } else if (type === "new_message") {
      // Get sender name
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", body.sender_id)
        .single();

      const senderName = senderProfile?.full_name || "Новое сообщение";
      const title = `💬 ${senderName}`;
      const messageBody = body.text || "Медиа-сообщение";
      const url = `${APP_URL}/?openChat=${body.conversation_id}`;

      // Get recipient user IDs (all participants except sender)
      const { data: participants } = await supabase
        .from("conversation_participants")
        .select("user_id")
        .eq("conversation_id", body.conversation_id)
        .neq("user_id", body.sender_id);

      const targetUserIds = (participants || []).map((p: any) => p.user_id);

      // Get emails for each recipient and send individual pushes
      for (const userId of targetUserIds) {
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(userId);
          if (!userData?.user?.email) {
            failed++;
            continue;
          }

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
        completed: "🎉 Завершил работу",
      };

      // Get worker name
      const { data: workerProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", body.worker_id)
        .single();

      // Get job info to find dispatcher
      const { data: jobData } = await supabase
        .from("jobs")
        .select("dispatcher_id, title")
        .eq("id", body.job_id)
        .single();

      if (jobData) {
        const workerName = workerProfile?.full_name || "Грузчик";
        const statusLabel = STATUS_LABELS[body.worker_status] || body.worker_status;
        const title = `${statusLabel}`;
        const messageBody = `${workerName} · ${jobData.title}`;
        const url = APP_URL;

        // Get dispatcher email
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
