import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Bell, Briefcase, MessageSquare, UserCheck, Trash2 } from "lucide-react";

export interface AppNotification {
  id: string;
  type: "job" | "message" | "response" | "system";
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY = "app_notifications";

export function getStoredNotifications(): AppNotification[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

export function pushNotification(n: Omit<AppNotification, "id" | "timestamp" | "read">) {
  const list = getStoredNotifications();
  list.unshift({ ...n, id: crypto.randomUUID(), timestamp: Date.now(), read: false });
  // keep max 100
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
  window.dispatchEvent(new Event("notifications-updated"));
}

export function markAllRead() {
  const list = getStoredNotifications().map((n) => ({ ...n, read: true }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event("notifications-updated"));
}

export function clearNotifications() {
  localStorage.setItem(STORAGE_KEY, "[]");
  window.dispatchEvent(new Event("notifications-updated"));
}

export function getUnreadCount(): number {
  return getStoredNotifications().filter((n) => !n.read).length;
}

interface Props {
  onBack: () => void;
}

const iconMap = {
  job: Briefcase,
  message: MessageSquare,
  response: UserCheck,
  system: Bell,
};

const colorMap = {
  job: "text-primary",
  message: "text-blue-400",
  response: "text-green-400",
  system: "text-muted-foreground",
};

function timeAgo(ts: number) {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return `${Math.floor(diff / 86400)} д назад`;
}

const NotificationsScreen = ({ onBack }: Props) => {
  const [items, setItems] = useState<AppNotification[]>(getStoredNotifications);

  useEffect(() => {
    markAllRead();
    const handler = () => setItems(getStoredNotifications());
    window.addEventListener("notifications-updated", handler);
    return () => window.removeEventListener("notifications-updated", handler);
  }, []);

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 safe-top pb-3 flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center">
          <ArrowLeft size={18} className="text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground flex-1">Уведомления</h1>
        {items.length > 0 && (
          <button
            onClick={() => { clearNotifications(); setItems([]); }}
            className="w-10 h-10 rounded-2xl bg-card border border-border flex items-center justify-center"
          >
            <Trash2 size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* List */}
      <div className="px-4">
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-surface-1 border border-border flex items-center justify-center mb-4">
              <Bell size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">Нет уведомлений</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {items.map((n, i) => {
                const Icon = iconMap[n.type] || Bell;
                return (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ delay: i * 0.03 }}
                    className={`bg-card border border-border rounded-2xl p-4 flex items-start gap-3 ${!n.read ? "border-l-2 border-primary" : ""}`}
                  >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${n.type === "job" ? "bg-primary/10" : n.type === "message" ? "bg-blue-500/10" : n.type === "response" ? "bg-green-500/10" : "bg-muted"}`}>
                      <Icon size={16} className={colorMap[n.type]} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.timestamp)}</p>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsScreen;
