import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

// Публичный VAPID-ключ — безопасно хранить в коде (это публичная часть пары).
const VAPID_PUBLIC_KEY =
  "BABPacxr1ePNOM01u_i9iMtDbq6NopIUckdMfLB6IuqIEOykUNU-zP9aJIdtkg5Vm3PzSLw3u9imP3_a7vXAfaw";

const SW_PATH = "/push-sw.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function arrayBufferToBase64(buffer: ArrayBuffer | null): string {
  if (!buffer) return "";
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export type PushPermission = "default" | "granted" | "denied" | "unsupported";

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Изначальное состояние
  useEffect(() => {
    if (!supported) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PushPermission);

    (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
        const sub = await reg?.pushManager.getSubscription();
        setSubscribed(!!sub);
      } catch (_e) {
        // ignore
      }
    })();
  }, [supported]);

  const saveSubscription = useCallback(
    async (sub: PushSubscription) => {
      if (!user) return;
      const json = sub.toJSON();
      const endpoint = sub.endpoint;
      const p256dh = json.keys?.p256dh ?? arrayBufferToBase64(sub.getKey("p256dh"));
      const auth = json.keys?.auth ?? arrayBufferToBase64(sub.getKey("auth"));

      await supabase
        .from("push_subscriptions")
        .upsert(
          { user_id: user.id, endpoint, p256dh, auth },
          { onConflict: "user_id,endpoint" },
        );
    },
    [user],
  );

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    setBusy(true);
    try {
      // 1. Запросить разрешение
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);
      if (perm !== "granted") return false;

      // 2. Зарегистрировать SW
      const reg = await navigator.serviceWorker.register(SW_PATH);
      await navigator.serviceWorker.ready;

      // 3. Подписаться (или взять существующую)
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });
      }

      // 4. Сохранить в БД
      await saveSubscription(sub);
      setSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscribe error:", err);
      return false;
    } finally {
      setBusy(false);
    }
  }, [supported, saveSubscription]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        if (user) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("user_id", user.id)
            .eq("endpoint", endpoint);
        }
      }
      setSubscribed(false);
    } finally {
      setBusy(false);
    }
  }, [supported, user]);

  return { supported, permission, subscribed, busy, subscribe, unsubscribe };
}
