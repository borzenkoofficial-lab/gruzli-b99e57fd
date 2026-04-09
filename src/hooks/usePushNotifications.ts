import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const VAPID_PUBLIC_KEY = "BF3GJd-9r3YU0zf9pUTGScP_gV0PKdz3DjagtWOnEffDPUj4H2psPW1U4aERc1PxOFD-4lMd_OaR45a8YWFbwTY";

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

function isPreviewEnvironment() {
  const hostname = window.location.hostname;
  const isPreviewHost = hostname.includes("id-preview--") || hostname.includes("lovableproject.com");

  let isInIframe = false;
  try {
    isInIframe = window.self !== window.top;
  } catch {
    isInIframe = true;
  }

  return isPreviewHost || isInIframe;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permissionState, setPermissionState] = useState<NotificationPermission | "unsupported">("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const saveSubscription = useCallback(async (subscription: PushSubscription) => {
    if (!user) return false;

    const key = subscription.getKey("p256dh");
    const auth = subscription.getKey("auth");
    if (!key || !auth) return false;

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

    if (error) {
      console.error("Save push sub:", error);
      toast.error("Не удалось сохранить подписку на уведомления");
      return false;
    }

    setIsSubscribed(true);
    return true;
  }, [user]);

  const isSubscriptionMatchingKey = useCallback((sub: PushSubscription): boolean => {
    try {
      const key = sub.options?.applicationServerKey;
      if (!key) return false;
      const currentKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const subKey = new Uint8Array(key instanceof ArrayBuffer ? key : (key as any).buffer);
      if (currentKey.length !== subKey.length) return false;
      return currentKey.every((v, i) => v === subKey[i]);
    } catch {
      return false;
    }
  }, []);

  const checkExistingSubscription = useCallback(async () => {
    if (!user || !("serviceWorker" in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) return;

      const sub = await registration.pushManager.getSubscription();
      if (!sub) return;

      // If subscription was created with a different VAPID key, unsubscribe and let user re-enable
      if (!isSubscriptionMatchingKey(sub)) {
        console.log("Push sub VAPID mismatch, unsubscribing stale subscription");
        await sub.unsubscribe();
        return;
      }

      const { data } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", sub.endpoint)
        .maybeSingle();

      if (data) {
        setIsSubscribed(true);
        return;
      }

      await saveSubscription(sub);
    } catch (err) {
      console.error("Check push sub:", err);
    }
  }, [saveSubscription, isSubscriptionMatchingKey, user]);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermissionState("unsupported");
      return;
    }

    setPermissionState(Notification.permission);

    if (Notification.permission === "granted" && user) {
      checkExistingSubscription();
    }
  }, [checkExistingSubscription, user]);

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermissionState("unsupported");
      toast.error("Ваш браузер не поддерживает push-уведомления");
      return;
    }

    if (!user) return;

    if (isPreviewEnvironment()) {
      toast.info("Разрешение на уведомления нужно выдавать в опубликованной версии приложения, а не в превью");
      return;
    }

    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);

      if (permission !== "granted") {
        if (permission === "denied") {
          toast.error("Уведомления заблокированы. Разрешите их в настройках браузера для этого сайта");
        }
        return;
      }

      let registration = await navigator.serviceWorker.getRegistration("/");
      if (!registration) {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      }

      registration = await navigator.serviceWorker.ready;

      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        await saveSubscription(existingSubscription);
        toast.success("Уведомления включены");
        return;
      }

      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const applicationServerKeyBuffer = applicationServerKey.buffer.slice(
        applicationServerKey.byteOffset,
        applicationServerKey.byteOffset + applicationServerKey.byteLength
      ) as ArrayBuffer;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKeyBuffer,
      });

      const saved = await saveSubscription(subscription);
      if (saved) {
        toast.success("Уведомления включены");
      }
    } catch (err) {
      console.error("Push setup failed:", err);
      toast.error("Не удалось включить уведомления. Попробуйте ещё раз");
    } finally {
      setLoading(false);
    }
  }, [saveSubscription, user]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
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
