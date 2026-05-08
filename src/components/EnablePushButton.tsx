import { Bell, BellOff, Check, Loader2, X } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";

const FIRST_PROMPT_KEY = "push-first-prompt-shown";
const DISMISSED_KEY = "push-banner-dismissed";

interface EnablePushButtonProps {
  variant?: "banner" | "compact";
  className?: string;
}

/**
 * Кнопка/баннер запроса разрешений на push-уведомления через push4site.com SDK.
 * Использует window.pushsender (загружается из https://lovable.push4site.com/sdk).
 */
const EnablePushButton = ({ variant = "banner", className = "" }: EnablePushButtonProps) => {
  const [busy, setBusy] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    typeof Notification !== "undefined" ? Notification.permission : "unsupported",
  );
  const [dismissed, setDismissed] = useState(
    () => typeof window !== "undefined" && localStorage.getItem(DISMISSED_KEY) === "true",
  );
  const [sdkReady, setSdkReady] = useState(false);

  const supported =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;

  // Ждём загрузки push4site SDK
  useEffect(() => {
    if (!supported) return;
    let tries = 0;
    const id = window.setInterval(() => {
      const ps = (window as any).pushsender;
      if (ps && typeof ps.initSubscription === "function") {
        setSdkReady(true);
        try {
          setSubscribed(!!ps.isSubscribed?.());
        } catch {
          /* noop */
        }
        window.clearInterval(id);
      } else if (++tries > 100) {
        window.clearInterval(id);
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [supported]);

  const refreshState = useCallback(() => {
    try {
      setPermission(Notification.permission);
      const ps = (window as any).pushsender;
      setSubscribed(!!ps?.isSubscribed?.());
    } catch {
      /* noop */
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!supported) return false;
    const ps = (window as any).pushsender;
    if (!ps || typeof ps.initSubscription !== "function") {
      toast.error("Сервис уведомлений ещё загружается, попробуйте через секунду.");
      return false;
    }
    setBusy(true);
    try {
      // ВАЖНО: initSubscription должен вызываться синхронно внутри user gesture.
      // Любой await ДО этого вызова сломает permission prompt в Safari.
      try {
        ps.initSubscription();
      } catch (err) {
        console.error("[push4site] initSubscription error:", err);
        // fallback: native API
        try {
          await Notification.requestPermission();
        } catch (e2) {
          console.error("[push4site] Notification.requestPermission failed:", e2);
        }
      }
      // Дадим SDK время отработать
      await new Promise((r) => setTimeout(r, 2000));
      refreshState();
      return typeof Notification !== "undefined" && Notification.permission === "granted";
    } finally {
      setBusy(false);
    }
  }, [supported, refreshState]);

  // Автозапрос при первом запуске (один раз)
  useEffect(() => {
    if (!supported || !sdkReady || subscribed || busy) return;
    if (permission !== "default") return;
    if (localStorage.getItem(FIRST_PROMPT_KEY) === "true") return;

    localStorage.setItem(FIRST_PROMPT_KEY, "true");
    const timer = setTimeout(async () => {
      const ok = await subscribe();
      if (ok) {
        toast.success("Уведомления включены ✓", {
          description: "Вы будете получать push о новых заявках и сообщениях.",
        });
      } else if (Notification.permission === "denied") {
        toast.error("Уведомления отклонены", {
          description:
            "Чтобы получать заявки в фоне, разрешите уведомления в настройках браузера для этого сайта.",
          duration: 8000,
        });
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [supported, sdkReady, permission, subscribed, busy, subscribe]);

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      toast.success("Уведомления включены ✓", {
        description: "Вы будете получать push о новых заявках и сообщениях.",
      });
    } else if (Notification.permission === "denied") {
      toast.error("Доступ к уведомлениям заблокирован", {
        description:
          "Откройте настройки сайта в браузере → Уведомления → Разрешить, и нажмите кнопку снова.",
        duration: 10000,
      });
    } else {
      toast("Не удалось включить уведомления", {
        description: "Попробуйте ещё раз через несколько секунд.",
      });
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
        {busy
          ? "Подождите..."
          : permission === "denied"
            ? "Разблокировать уведомления"
            : "Включить уведомления"}
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
