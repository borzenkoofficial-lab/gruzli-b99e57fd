import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getNotificationSettings } from "@/hooks/useNotificationSettings";
import { pushNotification } from "@/screens/NotificationsScreen";
import { playNewJob, playMessageReceived, playStatusUpdate, playSuccess } from "@/lib/sounds";
import type { Tables } from "@/integrations/supabase/types";
import { getActiveConversationId } from "@/lib/chatPresence";

function vibrate() {
  const { vibration } = getNotificationSettings();
  if (!vibration) return;
  try {
    navigator.vibrate?.([200, 100, 200, 100, 300]);
  } catch {}
}

async function showForegroundNotification(title: string, body: string, tag: string, url?: string) {
  if (typeof window === "undefined") return;
  if (document.visibilityState !== "visible") return;
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

  const options = {
    body,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    tag,
    renotify: true,
    requireInteraction: true,
    data: { url },
  };

  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {}

  try {
    new Notification(title, options);
  } catch {}
}

interface UseRealtimeNotificationsOptions {
  onNewJob?: (job: Tables<"jobs">) => void;
}

export function useRealtimeNotifications(options?: UseRealtimeNotificationsOptions) {
  const { user, role } = useAuth();
  const userIdRef = useRef(user?.id);
  const roleRef = useRef(role);
  const onNewJobRef = useRef(options?.onNewJob);

  useEffect(() => {
    userIdRef.current = user?.id;
    roleRef.current = role;
  }, [user, role]);

  useEffect(() => {
    onNewJobRef.current = options?.onNewJob;
  }, [options?.onNewJob]);

  const handleNewJob = useCallback((payload: any) => {
    if (roleRef.current !== "worker") return;
    const job = payload.new as Tables<"jobs">;
    if (!job) return;

    playNewJob();
    vibrate();

    pushNotification({
      type: "job",
      title: "Новый заказ",
      body: `${job.title} · ${job.hourly_rate}₽/ч · ${job.address || ""}`,
    });

    const { overlay } = getNotificationSettings();
    if (overlay) {
      onNewJobRef.current?.(job);
    } else {
      // Show toast only when overlay is disabled
      toast("🆕 Новый заказ", {
        description: `${job.title} · ${job.hourly_rate}₽/ч`,
        duration: 6000,
      });
    }
  }, []);

  const handleNewMessage = useCallback((payload: any) => {
    const msg = payload.new;
    if (!msg) return;
    if (msg.sender_id === userIdRef.current) return;

    const isCurrentConversationOpen = getActiveConversationId() === msg.conversation_id;

    playMessageReceived();
    vibrate();

    if (!isCurrentConversationOpen) {
      toast("💬 Новое сообщение", {
        description: msg.text || "Медиа-сообщение",
        duration: 5000,
      });

      void showForegroundNotification(
        "Новое сообщение",
        msg.text || "Медиа-сообщение",
        `message-${msg.conversation_id}`,
        `/?openChat=${msg.conversation_id}`,
      );
    }

    pushNotification({
      type: "message",
      title: "Новое сообщение",
      body: msg.text || "Медиа-сообщение",
    });
  }, []);

  const handleResponseUpdate = useCallback((payload: any) => {
    const resp = payload.new;
    const old = payload.old;
    if (!resp) return;

    // Worker: notify when dispatcher accepted their response
    if (resp.worker_id === userIdRef.current && resp.status === "accepted") {
      playSuccess();
      vibrate();

      toast("🎉 Вас выбрали!", {
        description: "Диспетчер принял вас на заказ. Подтвердите участие.",
        duration: 8000,
      });

      pushNotification({
        type: "response",
        title: "Вас выбрали на заказ!",
        body: "Перейдите в «Мои заказы» чтобы подтвердить участие",
      });
      return;
    }

    // Dispatcher: notify when worker changes their status
    if (roleRef.current === "dispatcher" || roleRef.current === "admin") {
      if (resp.worker_status && resp.worker_status !== old?.worker_status) {
        const STATUS_LABELS: Record<string, string> = {
          confirmed: "✅ Подтвердил заказ",
          ready: "✅ Готов к работе",
          en_route: "🚗 Выехал на объект",
          late: "⚠️ Опаздывает",
          arrived: "📍 На месте",
          completed: "🎉 Завершил работу",
        };

        playStatusUpdate();
        vibrate();

        const label = STATUS_LABELS[resp.worker_status] || resp.worker_status;
        toast(label, {
          description: "Обновление статуса грузчика",
          duration: 5000,
        });

        pushNotification({
          type: "response",
          title: label,
          body: "Обновление статуса грузчика на заказе",
        });
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("realtime-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "jobs" }, handleNewJob)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, handleNewMessage)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "job_responses" }, handleResponseUpdate)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleNewJob, handleNewMessage, handleResponseUpdate]);
}
