import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Updates `last_seen_at` on the current user's profile every 30s
 * and on visibility change (hidden = offline, visible = online).
 */
export const usePresence = () => {
  const { user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;

    const ping = () => {
      supabase
        .from("profiles")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .then(() => {});
    };

    // Immediate ping
    ping();

    // Periodic ping every 30s
    intervalRef.current = setInterval(ping, 30_000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        ping();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", handleVisibility);
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
