import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type OpenChatFn = (conversationId: string, title: string) => void;

const FREE_WEEKLY_LIMIT = 3;

export function useRespondToJob(onOpenChat?: OpenChatFn) {
  const { user, profile } = useAuth();

  const respondAndOpenChat = useCallback(
    async (job: Tables<"jobs">) => {
      if (!user) {
        toast.error("Войдите в аккаунт");
        return false;
      }

      // The dispatcher-first workflow only allows responses to assigned jobs.
      // Check before the RPC so a rejected attempt cannot leave an orphan response.
      if (!job.dispatcher_id) {
        toast.error("Сейчас заявка ожидает выбора диспетчера.");
        return false;
      }

      // Check weekly completed jobs limit for non-premium workers.
      if (!profile?.is_premium) {
        const { data: weeklyCount, error: weeklyCountError } = await supabase.rpc("get_weekly_completed_jobs", { _user_id: user.id });
        if (weeklyCountError || weeklyCount === null || weeklyCount === undefined) {
          console.error("Failed to check weekly worker limit", weeklyCountError);
          toast.error("Не удалось проверить лимит заказов. Попробуйте ещё раз.");
          return false;
        }
        if (weeklyCount >= FREE_WEEKLY_LIMIT) {
          toast.error(`Лимит ${FREE_WEEKLY_LIMIT} выполненных заказов в неделю. Оформите Premium для безлимита!`, { duration: 5000 });
          return false;
        }
      }

      // 1. Create application only through the server-side worker workflow.
      // This prevents a worker from bypassing the dispatcher-first model with a direct table insert.
      const responseMessage = `Здравствуйте! Откликнулся на заказ «${job.title}». Готов обсудить детали и условия.`;
      const { data: createdResponse, error: respError } = await supabase.rpc("worker_submit_response", {
        _job_id: job.id,
        _message: responseMessage,
      });
      const isNewResponse = !respError;

      if (respError) {
        if (respError.code === "23505") {
          toast.info("Вы уже откликнулись, открываем чат...");
        } else if (respError.message?.includes("job_not_available")) {
          toast.error("Заказ уже недоступен для отклика.");
          return false;
        } else {
          toast.error("Не удалось отправить отклик. " + (respError.message || "Попробуйте ещё раз."));
          return false;
        }
      }

      // 2. Find or create conversation with the assigned dispatcher.
      const { data: dispProfile } = await supabase
        .from("profiles_public" as any)
        .select("full_name")
        .eq("user_id", job.dispatcher_id)
        .single();

      const { data: conversationId, error: convError } = await supabase.rpc("create_direct_conversation", {
        _other_user_id: job.dispatcher_id,
        _title: (dispProfile as any)?.full_name || job.title,
      });

      if (convError || !conversationId) {
        toast.error("Не удалось создать чат");
        return false;
      }

      // Only create the initial message and notification for a newly inserted response.
      // Keep chat/notification behavior separate from the transactional response creation.
      if (isNewResponse) {
        const { error: messageError } = await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: responseMessage,
          message_type: "text",
        });
        if (messageError) {
          toast.error("Отклик сохранён, но сообщение не отправлено. Откройте чат и отправьте его повторно.");
        }

        supabase.functions.invoke("notify-email", {
          body: {
            type: "new_job_response",
            job_id: job.id,
            worker_id: user.id,
            message: responseMessage,
          },
        }).catch(() => {});
      }

      // 3. Open chat
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success("Отклик отправлен ✓ Чат с диспетчером открыт");
      onOpenChat?.(conversationId, job.title || "Чат");
      return true;
    },
    [user, profile, onOpenChat]
  );

  return { respondAndOpenChat };
}
