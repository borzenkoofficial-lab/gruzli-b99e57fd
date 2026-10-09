import { useEffect, useRef } from "react";
import { onlineManager, type QueryClient } from "@tanstack/react-query";

/**
 * Revalidates active stale queries when the installed app returns to the
 * foreground. TanStack Query's onlineManager already handles browser
 * online/offline events and reconnect refetches; this hook handles resume only.
 *
 * Supabase remains the source of truth. No business mutations are queued here.
 */
export function useNetworkLifecycle(queryClient: QueryClient) {
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const refreshActiveQueries = () => {
      const now = Date.now();

      // Mobile browsers may emit several lifecycle events when resuming.
      if (now - lastRefreshRef.current < 1500) return;
      lastRefreshRef.current = now;

      void queryClient.refetchQueries({
        type: "active",
        stale: true,
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState !== "visible" || !navigator.onLine) return;

      // If the browser's connection state changed while the app was suspended,
      // setting this to online lets React Query run its normal reconnect logic.
      // Do not also force-refetch in that case: it would duplicate that work.
      const wasOffline = !onlineManager.isOnline();
      onlineManager.setOnline(true);
      if (wasOffline) return;

      refreshActiveQueries();
    };

    // Keep React Query aligned with the browser's initial transport state.
    onlineManager.setOnline(navigator.onLine);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [queryClient]);
}
