import { useEffect, useRef } from "react";
import { onlineManager, type QueryClient } from "@tanstack/react-query";

/**
 * Revalidates active stale queries when the installed app returns to the
 * foreground. TanStack Query's onlineManager handles browser network events;
 * this hook handles resume without duplicating a recent reconnect refetch.
 *
 * Supabase remains the source of truth. No business mutations are queued here.
 */
export function useNetworkLifecycle(queryClient: QueryClient) {
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    let wasOnline = onlineManager.isOnline();
    let lastReconnectAt = Number.NEGATIVE_INFINITY;

    const unsubscribeOnline = onlineManager.subscribe((isOnline) => {
      if (isOnline && !wasOnline) {
        lastReconnectAt = Date.now();
      }
      wasOnline = isOnline;
    });

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

      // If the browser's connection state changed while suspended, let
      // TanStack Query's normal reconnect handler refetch active queries.
      const wasOffline = !onlineManager.isOnline();
      onlineManager.setOnline(true);
      if (wasOffline || Date.now() - lastReconnectAt < 1500) return;

      refreshActiveQueries();
    };

    // Keep React Query aligned with the browser's initial transport state.
    onlineManager.setOnline(navigator.onLine);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      unsubscribeOnline();
    };
  }, [queryClient]);
}
