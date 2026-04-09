import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { getNotificationSettings } from "@/hooks/useNotificationSettings";
import { pushNotification } from "@/screens/NotificationsScreen";
import type { Tables } from "@/integrations/supabase/types";

function playNotificationSound() {
  const { sound } = getNotificationSettings();
  if (!sound) return;
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const freqs = [880, 1100, 1320];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      const start = ctx.currentTime + i * 0.18;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.35, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.15);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

function vibrate() {
  const { vibration } = getNotificationSettings();
  if (!vibration) return;
  try {
    navigator.vibrate?.([200, 100, 200, 100, 300]);
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

    playNotificationSound();
    vibrate();

    toast("🆕 Новый заказ", {
      description: `${job.title} · ${job.hourly_rate}₽/ч`,
      duration: 6000,
    });

    pushNotification({
      type: "job",
      title: "Новый заказ",
      body: `${job.title} · ${job.hourly_rate}₽/ч · ${job.address || ""}`,
    });

    const { overlay } = getNotificationSettings();
    if (overlay) {
      onNewJobRef.current?.(job);
    }
  }, []);

  const handleNewMessage = useCallback((payload: any) => {
    const msg = payload.new;
    if (!msg) return;
    if (msg.sender_id === userIdRef.current) return;

    playNotificationSound();
    vibrate();

    toast("💬 Новое сообщение", {
      description: msg.text || "Медиа-сообщение",
      duration: 5000,
    });

    pushNotification({
      type: "message",
      title: "Новое сообщение",
      body: msg.text || "Медиа-сообщение",
    });
  }, []);

  const handleResponseUpdate = useCallback((payload: any) => {
    const resp = payload.new;
    if (!resp) return;
    // Only notify the worker whose response was accepted
    if (resp.worker_id !== userIdRef.current) return;
    if (resp.status !== "accepted") return;

    playNotificationSound();
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
