import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const NOTIFICATION_SOUND_FREQ = 880;
const NOTIFICATION_SOUND_DURATION = 0.15;

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.connect(gain);
    gain.connect(ctx.destination);

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(NOTIFICATION_SOUND_FREQ, ctx.currentTime);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + NOTIFICATION_SOUND_DURATION);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + NOTIFICATION_SOUND_DURATION);

    // Second beep
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.18);
    gain2.gain.setValueAtTime(0.3, ctx.currentTime + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18 + NOTIFICATION_SOUND_DURATION);
    osc2.start(ctx.currentTime + 0.18);
    osc2.stop(ctx.currentTime + 0.18 + NOTIFICATION_SOUND_DURATION);

    setTimeout(() => ctx.close(), 1000);
  } catch (e) {
    // Audio not available
  }
}

export function useRealtimeNotifications() {
  const { user, role } = useAuth();
  const userIdRef = useRef(user?.id);
  const roleRef = useRef(role);

  useEffect(() => {
    userIdRef.current = user?.id;
    roleRef.current = role;
  }, [user, role]);

  const handleNewJob = useCallback((payload: any) => {
    // Only notify workers about new jobs
    if (roleRef.current !== "worker") return;

    const job = payload.new;
    if (!job) return;

    playNotificationSound();
    toast("🆕 Новый заказ", {
      description: `${job.title} · ${job.hourly_rate}₽/ч`,
      duration: 6000,
    });
  }, []);

  const handleNewMessage = useCallback((payload: any) => {
    const msg = payload.new;
    if (!msg) return;

    // Don't notify about own messages
    if (msg.sender_id === userIdRef.current) return;

    playNotificationSound();
    toast("💬 Новое сообщение", {
      description: msg.text || "Медиа-сообщение",
      duration: 5000,
    });
  }, []);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("realtime-notifications")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jobs" },
        handleNewJob
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        handleNewMessage
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, handleNewJob, handleNewMessage]);
}
