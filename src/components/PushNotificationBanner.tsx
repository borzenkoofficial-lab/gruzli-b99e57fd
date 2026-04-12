import { Bell, X } from "lucide-react";
import { useState } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const PushNotificationBanner = () => {
  const { permissionState, isSubscribed, loading, requestPermission } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if unsupported, already subscribed, denied, or dismissed
  if (permissionState === "unsupported" || isSubscribed || permissionState === "denied" || dismissed) {
    return null;
  }

  // If permission granted but not yet subscribed, still show (will auto-subscribe)
  if (permissionState === "granted" && isSubscribed) {
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
          <button
            onClick={requestPermission}
            disabled={loading}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-foreground text-primary-foreground tap-scale disabled:opacity-50"
          >
            {loading ? "Подключение..." : "Разрешить уведомления"}
          </button>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground p-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PushNotificationBanner;
