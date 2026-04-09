import { useState, useCallback } from "react";

export interface NotificationSettings {
  sound: boolean;
  vibration: boolean;
  overlay: boolean;
  pushJobs: boolean;
  pushMessages: boolean;
  pushResponses: boolean;
}

const STORAGE_KEY = "gruzli_notification_settings";

const defaults: NotificationSettings = {
  sound: true,
  vibration: true,
  overlay: true,
  pushJobs: true,
  pushMessages: true,
  pushResponses: true,
};

function load(): NotificationSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaults, ...JSON.parse(raw) };
  } catch {}
  return { ...defaults };
}

function save(s: NotificationSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function useNotificationSettings() {
  const [settings, setSettings] = useState<NotificationSettings>(load);

  const update = useCallback((key: keyof NotificationSettings, value: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      save(next);
      return next;
    });
  }, []);

  return { settings, update };
}

/** Read settings without hook (for use in callbacks) */
export function getNotificationSettings(): NotificationSettings {
  return load();
}
