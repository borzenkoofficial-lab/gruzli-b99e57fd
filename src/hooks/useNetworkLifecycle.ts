import { useEffect, useRef } from "react";
import { onlineManager, type QueryClient } from "@tanstack/react-query";

/**
 * Connects the existing React Query layer to the browser lifecycle.
 *
 * Supabase remains the source of truth. This hook only controls when cached
 * queries should be considered stale and revalidated; it does not queue
 * business mutations or invent offline success states.
 */
export function useNetworkLifecycle(queryClient: QueryClient) {
  const lastRefreshRef = useRef(0);

  useEffect(() => {
    const refreshActiveQueries = () => {
      const now = Date.now();

      // Network + visibility events can fire together. Avoid a burst of
      // identical refetches when a phone resumes from the background.
      if (now - lastRefreshRef.current < 1500) return;
      lastRefreshRef.current = now;

      void queryClient.refetchQueries({
        type: "active",
        stale: true,
      });
    };

    const handleOnline = () => {
      onlineManager.setOnline(true);
      refreshActiveQueries();
    };

    const handleOffline = () => {
      onlineManager.setOnline(false);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        onlineManager.setOnline(true);
        refreshActiveQueries();
      }
    };

    // Browser state is only a transport signal. It is not proof that
    // Supabase is reachable, so React Query still handles request failures.
    onlineManager.setOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [queryClient]);
}
