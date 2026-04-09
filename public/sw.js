// Gruzli Service Worker — push notifications only

self.addEventListener("push", function (event) {
  let data = { title: "Gruzli", body: "Новое уведомление" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: "/favicon.jpeg",
    badge: "/favicon.jpeg",
    vibrate: [100, 50, 100],
    data: data,
    tag: data.type || "default",
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const data = event.notification.data || {};
  let url = "/";

  if (data.type === "new_message" && data.conversation_id) {
    url = `/chat/${data.conversation_id}`;
  } else if (data.type === "new_job" && data.job_id) {
    url = `/job/${data.job_id}`;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
