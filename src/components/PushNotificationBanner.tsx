import { Bell, X, Check } from "lucide-react";
import { useState, forwardRef } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { toast } from "@/hooks/use-toast";

const PushNotificationBanner = forwardRef<HTMLDivElement>((_props, _ref) => {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("push-banner-dismissed") === "true";
  });
  const { supported, permission, subscribed, busy, subscribe } = usePushNotifications();

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("push-banner-dismissed", "true");
  };

  const handleEnable = async () => {
    const ok = await subscribe();
    if (ok) {
      toast({ title: "Уведомления включены ✓", description: "Вы будете получать push о новых заказах и сообщениях." });
    } else if (permission === "denied") {
      toast({ title: "Уведомления заблокированы", description: "Разрешите их в настройках браузера." });
    } else {
      toast({ title: "Не удалось включить", description: "Попробуйте ещё раз." });
    }
  };

  if (dismissed || !supported || subscribed || permission === "denied") {
    return null;
  }

  return (
    <div className="mx-5 mt-2 mb-3 rounded-2xl overflow-hidden bg-card border border-border p-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center flex-shrink-0">
          <Bell size={18} className="text-primary-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Включите уведомления</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Получайте мгновенные уведомления о новых заказах и сообщениях
          </p>
          <div className="mt-2">
            <button
              onClick={handleEnable}
              disabled={busy}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-foreground text-primary-foreground tap-scale inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {subscribed ? <Check size={14} /> : <Bell size={14} />}
              {busy ? "Подождите..." : subscribed ? "Уведомления включены" : "Разрешить уведомления"}
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground p-1" aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>
    </div>
  );
});
PushNotificationBanner.displayName = "PushNotificationBanner";

export default PushNotificationBanner;
