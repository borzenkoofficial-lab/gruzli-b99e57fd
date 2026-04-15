import { Bell, X } from "lucide-react";
import { useState, useEffect, useRef, forwardRef } from "react";

const PushNotificationBanner = forwardRef<HTMLDivElement>((_props, _ref) => {
  const [dismissed, setDismissed] = useState(() => {
    return localStorage.getItem("push-banner-dismissed") === "true";
  });
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Ensure Progressier SDK button renders
    if (buttonRef.current && (window as any).progressier) {
      // Progressier auto-initializes buttons with the class
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem("push-banner-dismissed", "true");
  };

  if (dismissed) {
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
          <div ref={buttonRef} className="mt-2">
            <button
              className="progressier-subscribe-button px-4 py-2 rounded-xl text-xs font-bold bg-foreground text-primary-foreground tap-scale"
              data-icons="false"
              data-eligible="Разрешить уведомления"
              data-subscribed="Уведомления включены ✓"
              data-blocked="Уведомления заблокированы"
            />
          </div>
        </div>
        <button onClick={handleDismiss} className="text-muted-foreground p-1">
          <X size={16} />
        </button>
      </div>
    </div>
  );
});
PushNotificationBanner.displayName = "PushNotificationBanner";

export default PushNotificationBanner;
