import { useEffect, useRef, useCallback } from "react";
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
    }, userIdRef.current);

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
    const isAppVisible = typeof document !== "undefined" && document.visibilityState === "visible";

    playMessageReceived();
    vibrate();

    if (!isCurrentConversationOpen) {
      toast("💬 Новое сообщение", {
        description: msg.text || "Медиа-сообщение",
        duration: 5000,
      });

      // Native push only when app is hidden — avoids duplicate toast + push
      if (!isAppVisible) {
        void showForegroundNotification(
          "Новое сообщение",
          msg.text || "Медиа-сообщение",
          `message-${msg.conversation_id}`,
          `/?openChat=${msg.conversation_id}`,
        );
      }
    }

    pushNotification({
      type: "message",
      title: "Новое сообщение",
      body: msg.text || "Медиа-сообщение",
    }, userIdRef.current);
  }, []);

  const handleResponseUpdate = useCallback((payload: any) => {
    const resp = payload.new;
    const old = payload.old;
    if (!resp) return;

    // Worker: notify when dispatcher accepted their response
    if (
      resp.worker_id === userIdRef.current &&
      resp.status === "accepted" &&
      old?.status !== "accepted"
    ) {
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
      }, userIdRef.current);
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
        }, userIdRef.current);
      }
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    let disposed = false;
    let retryTimer: number | undefined;
    let retryAttempt = 0;
    let activeSocket: WebSocket | null = null;
    const connect = () => {
      if (disposed) return;
      const socket = new WebSocket(`${protocol}//${window.location.host}/api/realtime`);
      activeSocket = socket;
      socket.onopen = () => { retryAttempt = 0; };
      socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(String(event.data));
        if (payload.type === "job:created" && payload.job) {
          handleNewJob({ new: payload.job });
        } else if (payload.type === "message:new" && payload.message) {
          handleNewMessage({ new: { ...payload.message, conversation_id: payload.conversationId } });
          window.dispatchEvent(new CustomEvent("gruzli:message", { detail: payload }));
        } else if (payload.type === "presence:update" && payload.userId) {
          window.dispatchEvent(new CustomEvent("gruzli:presence", { detail: payload }));
        } else if (payload.type === "response:updated") {
          handleResponseUpdate({
            new: { worker_id: userIdRef.current, status: payload.status, worker_status: payload.workerStatus },
            old: { status: "pending", worker_status: null },
          });
          if (payload.status === "rejected") {
            toast("Отклик отклонён", { description: "Диспетчер выбрал другого исполнителя.", duration: 5000 });
          }
        } else if (payload.type === "response:created" && (roleRef.current === "dispatcher" || roleRef.current === "admin")) {
          toast("Новый отклик на заявку", {
            description: payload.response?.message || "Исполнитель откликнулся на ваш заказ.",
            duration: 6000,
          });
          pushNotification({
            type: "response",
            title: "Новый отклик",
            body: payload.response?.message || "Исполнитель откликнулся на заявку",
          }, userIdRef.current);
        } else if (payload.type === "response:withdrawn" && (roleRef.current === "dispatcher" || roleRef.current === "admin")) {
          toast("Исполнитель отозвал отклик", { duration: 5000 });
        } else if (payload.type === "job:updated") {
          toast("Статус заявки изменён", { description: "Обновите карточку заявки для просмотра деталей.", duration: 4000 });
        }
      } catch (error) {
        console.error("[realtime-notifications] Invalid event:", error);
      }
      };
      socket.onerror = () => console.warn("[realtime-notifications] WebSocket unavailable; screens should use API polling.");
      socket.onclose = () => {
        if (disposed) return;
        const delay = Math.min(30_000, 1_000 * (2 ** Math.min(retryAttempt, 5)));
        retryAttempt += 1;
        retryTimer = window.setTimeout(connect, delay);
      };
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      activeSocket?.close();
    };
  }, [user?.id, handleNewJob, handleNewMessage, handleResponseUpdate]);
}
