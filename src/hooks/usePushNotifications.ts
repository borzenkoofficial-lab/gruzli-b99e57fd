import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const VAPID_PUBLIC_KEY = "BLumHny4exuMmY-NILTr6mkDlPoBkfkdfvrFgSJpVtSQyDZ0tsNoKWaCLte0Oy-DeHH6fVs2wTY8fZRmg4niUNs";

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

  // Check current state
  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermissionState("unsupported");
      return;
    }
    setPermissionState(Notification.permission);
    
    // If already granted, try to subscribe automatically
    if (Notification.permission === "granted" && user) {
      registerAndSubscribe();
    }
  }, [user]);

  const registerAndSubscribe = useCallback(async () => {
    if (!user) return;
    
    try {
      // Register service worker explicitly
      let registration: ServiceWorkerRegistration;
      
      const existingReg = await navigator.serviceWorker.getRegistration("/progressier.js");
      if (existingReg) {
        registration = existingReg;
      } else {
        registration = await navigator.serviceWorker.register("/progressier.js", { scope: "/" });
        // Wait for it to be active
        await navigator.serviceWorker.ready;
      }

      // Check existing subscription
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        const appServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey.buffer as ArrayBuffer,
        });
      }

      const key = subscription.getKey("p256dh");
      const auth = subscription.getKey("auth");

      if (!key || !auth) {
        console.error("Push subscription missing keys");
        return;
      }

      const p256dh = btoa(String.fromCharCode(...new Uint8Array(key)));
      const authKey = btoa(String.fromCharCode(...new Uint8Array(auth)));

      // Save to DB
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.id,
          endpoint: subscription.endpoint,
          p256dh: p256dh,
          auth: authKey,
        },
        { onConflict: "user_id,endpoint" }
      );

      if (error) {
        console.error("Failed to save push subscription:", error);
      } else {
        setIsSubscribed(true);
        console.log("Push subscription saved successfully");
      }
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }, [user]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    
    const permission = await Notification.requestPermission();
    setPermissionState(permission);
    
    if (permission === "granted") {
      await registerAndSubscribe();
    }
  }, [registerAndSubscribe]);

  return { permissionState, isSubscribed, requestPermission };
}
