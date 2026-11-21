export interface AppNotification {
  id: string;
  type: "job" | "message" | "response" | "system";
  title: string;
  body: string;
  timestamp: number;
  read: boolean;
}

const STORAGE_KEY_PREFIX = "app_notifications";
const getStorageKey = (userId?: string | null) => userId ? `${STORAGE_KEY_PREFIX}:${userId}` : null;

export function getStoredNotifications(userId?: string | null): AppNotification[] {
  const key = getStorageKey(userId);
  if (!key) return [];
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

export function pushNotification(
  n: Omit<AppNotification, "id" | "timestamp" | "read">,
  userId?: string | null,
) {
  const key = getStorageKey(userId);
  if (!key) return;
  const list = getStoredNotifications(userId);
  list.unshift({ ...n, id: crypto.randomUUID(), timestamp: Date.now(), read: false });
  localStorage.setItem(key, JSON.stringify(list.slice(0, 100)));
  window.dispatchEvent(new Event("notifications-updated"));
}

export function markAllRead(userId?: string | null) {
  const key = getStorageKey(userId);
  if (!key) return;
  const list = getStoredNotifications(userId).map((n) => ({ ...n, read: true }));
  localStorage.setItem(key, JSON.stringify(list));
  window.dispatchEvent(new Event("notifications-updated"));
}

export function clearNotifications(userId?: string | null) {
  const key = getStorageKey(userId);
  if (!key) return;
  localStorage.setItem(key, "[]");
  window.dispatchEvent(new Event("notifications-updated"));
}

export function getUnreadCount(userId?: string | null): number {
  return getStoredNotifications(userId).filter((n) => !n.read).length;
}
