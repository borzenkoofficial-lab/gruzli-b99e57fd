import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = "BIj2Dy6iTkuqUOQTCunr9R2io8rNuiolW1oNaXIceRCJ2V5e2ik_GxZHO8BmZwd6RfMXUvsnYX56oLIGqS5NKcs";

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
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermissionState("unsupported");
      return;
    }
    setPermissionState(Notification.permission);

    if (Notification.permission === "granted" && user) {
      checkExistingSubscription();
    }
  }, [user]);

  const checkExistingSubscription = useCallback(async () => {
    if (!user) return;
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          // Check if saved in DB
          const { data } = await supabase
            .from("push_subscriptions")
            .select("id")
            .eq("user_id", user.id)
            .eq("endpoint", sub.endpoint)
            .maybeSingle();
          if (data) {
            setIsSubscribed(true);
          } else {
            // Re-save
            await saveSubscription(sub);
          }
        }
      }
    } catch (err) {
      console.error("Check push sub:", err);
    }
  }, [user]);

  const saveSubscription = async (subscription: PushSubscription) => {
    if (!user) return;
    const key = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");
    if (!key || !auth) return;

    const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
    const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        endpoint: subscription.endpoint,
        p256dh,
        auth: authKey,
      },
      { onConflict: "user_id,endpoint" }
    );

    if (!error) {
      setIsSubscribed(true);
    } else {
      console.error("Save push sub:", error);
    }
  };

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window) || !user) return;
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission === "granted") {
        // Unsubscribe from old subscription first (to fix VAPID mismatch)
        const existingReg = await navigator.serviceWorker.getRegistration();
        if (existingReg) {
          const oldSub = await existingReg.pushManager.getSubscription();
          if (oldSub) {
            await oldSub.unsubscribe();
          }
        }

        // Register SW
        let registration = await navigator.serviceWorker.getRegistration("/progressier.js");
        if (!registration) {
          registration = await navigator.serviceWorker.register("/progressier.js", { scope: "/" });
          await navigator.serviceWorker.ready;
        }

        const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        });

        await saveSubscription(subscription);
      }
    } catch (err) {
      console.error("Push setup failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          // Delete from DB first
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", sub.endpoint);
          await sub.unsubscribe();
        }
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe failed:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { permissionState, isSubscribed, loading, requestPermission, unsubscribe };
}
