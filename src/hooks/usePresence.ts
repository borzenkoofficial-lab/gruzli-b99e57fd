import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Keeps last_seen_at fresh only while the app is visible and the browser is online.
 * Failed writes are retried on a later heartbeat or when the app becomes active again.
 */
export const usePresence = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    let heartbeat: ReturnType<typeof setInterval> | null = null;
    let disposed = false;
    let requestInFlight = false;
    let lastAttemptAt: number | null = null;

    const stopHeartbeat = () => {
      if (heartbeat !== null) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
    };

    const ping = async () => {
      const now = Date.now();
      if (
        disposed ||
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        requestInFlight ||
        (lastAttemptAt !== null && now - lastAttemptAt < 15_000)
      ) {
        return;
      }

      // Throttle attempts, not just successful writes, to avoid request bursts
      // when the backend is unavailable and visibility changes repeatedly.
      lastAttemptAt = now;
      requestInFlight = true;

      try {
        const { error } = await supabase
          .from("profiles")
          .update({ last_seen_at: new Date().toISOString() })
          .eq("user_id", user.id);

        if (error) {
          // Presence is best-effort; a later heartbeat will retry.
          return;
        }
      } catch {
        // Presence is best-effort: transient failures must not break the app.
      } finally {
        requestInFlight = false;
      }
    };

    const startHeartbeat = () => {
      if (
        disposed ||
        document.visibilityState !== "visible" ||
        !navigator.onLine
      ) {
        stopHeartbeat();
        return;
      }

      if (heartbeat === null) {
        heartbeat = setInterval(() => {
          void ping();
        }, 60_000);
      }

      void ping();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startHeartbeat();
      } else {
        stopHeartbeat();
      }
    };

    const handleOnline = () => startHeartbeat();
    const handleOffline = () => stopHeartbeat();

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    startHeartbeat();

    return () => {
      disposed = true;
      stopHeartbeat();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [user]);
};

/**
 * Format last_seen_at into a human-readable status string.
 */
export const formatLastSeen = (lastSeenAt: string | null): { text: string; isOnline: boolean } => {
  if (!lastSeenAt) return { text: "не в сети", isOnline: false };

  const now = Date.now();
  const seen = new Date(lastSeenAt).getTime();
  const diffMs = now - seen;
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 2) return { text: "онлайн", isOnline: true };
  if (diffMin < 60) return { text: `был(а) ${diffMin} мин. назад`, isOnline: false };

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return { text: `был(а) ${diffHours} ч. назад`, isOnline: false };

  const date = new Date(lastSeenAt);
  return {
    text: `был(а) ${date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}`,
    isOnline: false,
  };
};
