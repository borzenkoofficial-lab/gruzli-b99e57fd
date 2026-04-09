import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type OpenChatFn = (conversationId: string, title: string) => void;

export function useRespondToJob(onOpenChat?: OpenChatFn) {
  const { user } = useAuth();

  const respondAndOpenChat = useCallback(
    async (job: Tables<"jobs">) => {
      if (!user) {
        toast.error("Войдите в аккаунт");
        return false;
      }

      // 1. Create application (job_response)
      const { error: respError } = await supabase.from("job_responses").insert({
        job_id: job.id,
        worker_id: user.id,
        message: `Здравствуйте! Откликнулся на заказ «${job.title}». Готов обсудить детали и условия.`,
      });

      if (respError) {
        if (respError.code === "23505") {
          // Already responded — still open chat
          toast.info("Вы уже откликнулись, открываем чат...");
        } else {
          toast.error("Ошибка отклика: " + respError.message);
          return false;
        }
      }

      // 2. Find or create conversation with this dispatcher (reuse existing 1-on-1 chat)
      let conversationId: string | null = null;

      const { data: myConvs } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", user.id);

      if (myConvs) {
        for (const mc of myConvs) {
          // Check if dispatcher is in this conversation (any shared conversation)
          const { data: dispatcherIn } = await supabase
            .from("conversation_participants")
            .select("id")
            .eq("conversation_id", mc.conversation_id)
            .eq("user_id", job.dispatcher_id)
            .single();

          if (dispatcherIn) {
            // Verify it's not a group chat
            const { data: conv } = await supabase
              .from("conversations")
              .select("id, is_group")
              .eq("id", mc.conversation_id)
              .single();

            if (conv && !conv.is_group) {
              conversationId = conv.id;
              break;
            }
          }
        }
      }

      // Create new conversation if none found
      if (!conversationId) {
        conversationId = crypto.randomUUID();

        const { error: convError } = await supabase
          .from("conversations")
          .insert({ id: conversationId, job_id: job.id, title: job.title });

        if (convError) {
          toast.error("Не удалось создать чат");
          return false;
        }

        const { error: participantsError } = await supabase.from("conversation_participants").insert([
          { conversation_id: conversationId, user_id: user.id },
          { conversation_id: conversationId, user_id: job.dispatcher_id },
        ]);

        if (participantsError) {
          toast.error("Не удалось добавить участников чата");
          return false;
        }

        await supabase.from("messages").insert({
          conversation_id: conversationId,
          sender_id: user.id,
          text: `Здравствуйте! Откликнулся на ваш заказ «${job.title}». Готов обсудить детали и условия.`,
          message_type: "text",
        });
      }

      // 3. Open chat
      if (navigator.vibrate) navigator.vibrate(50);
      toast.success("Отклик отправлен ✓ Чат с диспетчером открыт");
      onOpenChat?.(conversationId, job.title || "Чат");
      return true;
    },
    [user, onOpenChat]
  );

  return { respondAndOpenChat };
}
