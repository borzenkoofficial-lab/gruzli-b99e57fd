// Gruzli Push Service Worker
// Минимальный SW: только Web Push, без кэширования и offline-логики.
// Это безопасно для preview — мы НЕ перехватываем fetch/navigation.

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Получение push-уведомления от сервера
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_e) {
    data = { title: "Gruzli", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "Gruzli";
  const options = {
    body: data.body || "",
    icon: data.icon || "/favicon.jpeg",
    badge: data.badge || "/favicon.jpeg",
    tag: data.tag || undefined,
    renotify: !!data.tag,
    data: {
      url: data.url || "/",
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Клик по уведомлению — открыть/сфокусировать вкладку приложения
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // Если вкладка с приложением открыта — фокус и навигация на нужный URL
      for (const client of allClients) {
        try {
          const url = new URL(client.url);
          const target = new URL(targetUrl, self.location.origin);
          if (url.origin === target.origin) {
            await client.focus();
            if ("navigate" in client) {
              try { await client.navigate(target.toString()); } catch (_e) {}
            }
            return;
          }
        } catch (_e) {}
      }

      // Иначе открыть новую вкладку
      await self.clients.openWindow(targetUrl);
    })(),
  );
});

// Обновление подписки (например, после ротации ключей у пуш-сервиса)
self.addEventListener("pushsubscriptionchange", (event) => {
  // Тут можно было бы автоматически переподписаться, но публичный VAPID-ключ
  // должен прийти от приложения. Просто чистим — клиент переподпишется
  // при следующем заходе через usePushNotifications.
});
