import { Bell, X } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const PushNotificationBanner = () => {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  const isSupported = typeof Notification !== "undefined" && "serviceWorker" in navigator;
  const permission = isSupported ? Notification.permission : "denied";

  // Don't show if unsupported, already granted, denied, or dismissed
  if (!isSupported || permission !== "default" || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    const result = await Notification.requestPermission();
    if (result === "granted" && window.progressier && user?.email) {
      window.progressier.add({ email: user.email, id: user.id });
    }
  };

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
            onClick={handleEnable}
            className="mt-2 px-4 py-2 rounded-xl text-xs font-bold bg-foreground text-primary-foreground tap-scale"
          >
            Разрешить уведомления
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
