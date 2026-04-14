import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { z } from "npm:zod@3.25.76";

// ---- Progressier Push (fallback) ----

async function sendProgressierPush(params: {
  recipientEmail?: string;
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

  if (params.recipientEmail) {
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

async function sendProgressierPushToUsers(
  supabase: any,
  userIds: string[],
  payload: { title: string; body: string; url: string }
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  for (const userId of uniqueUserIds) {
    try {
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const email = userData?.user?.email;

      if (!email) {
        failed++;
        continue;
      }

      const result = await sendProgressierPush({
        recipientEmail: email,
        title: payload.title,
        body: payload.body,
        url: payload.url,
      });

      if (result.ok) sent++;
      else failed++;
    } catch (err) {
      console.error(`Progressier push error for user ${userId}:`, err);
      failed++;
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

      const progResult = await sendProgressierPushToUsers(supabase, workerIds, {
        title,
        body: messageBody,
        url,
      });
      sent += progResult.sent;
      failed += progResult.failed;

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

      const progResult = await sendProgressierPushToUsers(supabase, targetUserIds, {
        title,
        body: messageBody,
        url,
      });
      sent += progResult.sent;
      failed += progResult.failed;

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
        const notifTitle = `${statusLabel}`;
        const url = APP_URL;

        if (body.worker_status === "finishing") {
          const messageBody = `Заказ: ${jobData.title}. Завершите работу для подсчёта.`;
          const pushPayload = { title: "⏹ Завершите работу", body: messageBody, url, type: "worker_status_change" };

          const nativeResult = await sendNativeWebPush(supabase, [body.worker_id], pushPayload);
          sent += nativeResult.sent;
          failed += nativeResult.failed;

          const progResult = await sendProgressierPushToUsers(supabase, [body.worker_id], {
            title: "⏹ Завершите работу",
            body: messageBody,
            url,
          });
          sent += progResult.sent;
          failed += progResult.failed;
        } else {
          const messageBody = `${workerName} · ${jobData.title}`;
          const pushPayload = { title: notifTitle, body: messageBody, url, type: "worker_status_change" };

          const nativeResult = await sendNativeWebPush(supabase, [jobData.dispatcher_id], pushPayload);
          sent += nativeResult.sent;
          failed += nativeResult.failed;

          const progResult = await sendProgressierPushToUsers(supabase, [jobData.dispatcher_id], {
            title: notifTitle,
            body: messageBody,
            url,
          });
          sent += progResult.sent;
          failed += progResult.failed;
        }
      }
    }

    // Also send email notifications where still needed.
    // New job alerts are intentionally push-only.
    try {
      if (type === "new_message") {
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
