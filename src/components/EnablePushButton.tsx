import { Bell, BellOff, Check, Loader2, X } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { savePushSubscriptionForUser } from "@/lib/pushSubscriptionLifecycle";

const DISMISSED_KEY = "push-banner-dismissed";

interface EnablePushButtonProps {
  variant?: "banner" | "compact";
  className?: string;
}

const EnablePushButton = ({ variant = "banner", className = "" }: EnablePushButtonProps) => {
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "true",
  );

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  const checkSubscribed = useCallback(async () => {
    if (!supported) return;
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      const { data: auth } = await supabase.auth.getUser();

      // Browser subscription alone is not enough: it must be associated with
      // the current account in Supabase before the control is shown as enabled.
      const synced = !!sub && !!auth.user
        ? await savePushSubscriptionForUser(auth.user.id, sub)
        : false;

      setSubscribed(synced);
      setPermission(Notification.permission);
    } catch {
      setSubscribed(false);
    }
  }, [supported]);

  useEffect(() => { checkSubscribed(); }, [checkSubscribed]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      toast.error("Войдите в аккаунт, чтобы получать уведомления");
      return false;
    }

    // Register SW
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    // Get VAPID public key
    const { data: keyData, error: keyErr } = await supabase.functions.invoke("vapid-public-key");
    if (keyErr || !keyData?.key) {
      toast.error("Не удалось получить ключ уведомлений");
      return false;
    }

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.key),
      });
    }

    const saved = await savePushSubscriptionForUser(auth.user.id, sub);
    if (!saved) {
      toast.error("Не удалось сохранить подписку");
      return false;
    }
    return true;
  }, [supported]);

  const handleEnable = async () => {
    if (!supported) return;
    setBusy(true);
    try {
      // Запрашиваем разрешение синхронно (для Safari)
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.error("Доступ к уведомлениям заблокирован", {
          description: "Откройте настройки сайта в браузере → Уведомления → Разрешить.",
          duration: 8000,
        });
        return;
      }
      const ok = await subscribe();
      if (ok) {
        setSubscribed(true);
        toast.success("Уведомления включены ✓");
      }
    } catch (err: any) {
      console.error("[push] enable failed:", err);
      toast.error("Не удалось включить уведомления", { description: err?.message });
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISSED_KEY, "true");
  };

  if (!supported || subscribed || dismissed) return null;

  if (variant === "compact") {
    return (
      <button
        onClick={handleEnable}
        disabled={busy}
        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-foreground text-primary-foreground text-xs font-bold tap-scale disabled:opacity-60 ${className}`}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : permission === "denied" ? <BellOff size={14} /> : <Bell size={14} />}
        {busy ? "Подождите..." : permission === "denied" ? "Разблокировать уведомления" : "Включить уведомления"}
      </button>
    );
  }

  return (
    <div className={`mx-5 mt-2 mb-3 rounded-2xl overflow-hidden bg-card border border-border p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
          {permission === "denied" ? (
            <BellOff size={18} className="text-primary-foreground" />
          ) : (
            <Bell size={18} className="text-primary-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">
            {permission === "denied" ? "Уведомления заблокированы" : "Включите уведомления"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {permission === "denied"
              ? "Откройте настройки сайта в браузере и разрешите уведомления, чтобы получать заявки и сообщения."
              : "Получайте мгновенные push о новых заявках и сообщениях — даже когда приложение закрыто."}
          </p>
          <div className="mt-2.5">
            <button
              onClick={handleEnable}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-foreground text-primary-foreground tap-scale inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {busy ? "Подождите..." : permission === "denied" ? "Я разрешил, проверить" : "Разрешить уведомления"}
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground p-1" aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default EnablePushButton;
