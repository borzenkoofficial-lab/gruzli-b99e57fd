// Gruzli Service Worker — push notifications + offline caching

const CACHE_NAME = "gruzli-v1";
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/favicon.jpeg",
];

// Install — pre-cache shell
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (key) { return key !== CACHE_NAME; }).map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network-first for API, cache-first for assets
self.addEventListener("fetch", function (event) {
  const url = new URL(event.request.url);

  // Skip non-GET, chrome-extension, etc.
  if (event.request.method !== "GET") return;
  if (url.protocol !== "https:" && url.protocol !== "http:") return;

  // Never cache Supabase API calls
  if (url.hostname.includes("supabase.co")) return;
  // Never cache progressier
  if (url.hostname.includes("progressier")) return;

  // For navigation requests, try network first
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(function () {
        return caches.match("/index.html");
      })
    );
    return;
  }

  // For assets — stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var fetchPromise = fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});

// Push notifications
self.addEventListener("push", function (event) {
  var data = { title: "Gruzli", body: "Новое уведомление" };

  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    if (event.data) {
      data.body = event.data.text();
    }
  }

  var vibrationPatterns = {
    new_message: [80, 40, 80],
    new_job: [100, 60, 100, 60, 150],
    response: [120, 80, 200],
    default: [100, 50, 100],
  };

  var options = {
    body: data.body,
    icon: "/pwa-192x192.png",
    badge: "/pwa-192x192.png",
    vibrate: vibrationPatterns[data.type] || vibrationPatterns.default,
    data: data,
    tag: (data.type || "default") + "-" + Date.now(),
    renotify: true,
    silent: false,
    requireInteraction: true,
    urgency: "high",
    importance: "high",
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  var data = event.notification.data || {};
  var url = data.url || "/";

  if (data.type === "new_message" && data.conversation_id) {
    url = "/?openChat=" + data.conversation_id;
  } else if (data.type === "new_job" && data.job_id) {
    url = "/job/" + data.job_id;
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
