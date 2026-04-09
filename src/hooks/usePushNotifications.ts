import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = "BI5F9dD_T6dwKDSbEkEK8RGitL31Fo_N1ZgDBU-_eJX5Q7KnlQdDPAVW5pKs9rz6U7M5FPeUOTViZnyWBaIlstk";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const subscribe = async () => {
      try {
        // Wait for service worker
        const registration = await navigator.serviceWorker.ready;

        // Check existing subscription
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
          // Request permission
          const permission = await Notification.requestPermission();
          if (permission !== "granted") return;

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
        }

        const key = subscription.getKey("p256dh");
        const auth = subscription.getKey("auth");

        if (!key || !auth) return;

        const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
        const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

        // Save to DB (upsert by endpoint)
        await supabase.from("push_subscriptions").upsert(
          {
            user_id: user.id,
            endpoint: subscription.endpoint,
            p256dh: p256dh,
            auth: authKey,
          },
          { onConflict: "user_id,endpoint" }
        );
      } catch (err) {
        console.error("Push subscription failed:", err);
      }
    };

    // Small delay to let SW register
    const timer = setTimeout(subscribe, 2000);
    return () => clearTimeout(timer);
  }, [user]);
}
