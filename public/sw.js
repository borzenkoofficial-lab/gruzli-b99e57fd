// Gruzli Service Worker — DEPRECATED
// All push notifications are handled by Progressier's service worker (progressier.js).
// This SW exists only to self-unregister for older clients that may have it installed,
// otherwise we get duplicate push notifications (one from this SW + one from Progressier).

self.addEventListener("install", function () {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    (async function () {
      try {
        // Clean any caches we created in older versions
        const keys = await caches.keys();
        await Promise.all(keys.filter(function (k) { return k.indexOf("gruzli-") === 0; }).map(function (k) { return caches.delete(k); }));
      } catch (e) {}
      try {
        // Self-unregister so Progressier's SW becomes the only push handler
        await self.registration.unregister();
        const allClients = await self.clients.matchAll({ includeUncontrolled: true });
        allClients.forEach(function (c) { try { c.navigate(c.url); } catch (e) {} });
      } catch (e) {}
    })()
  );
});

// No push / fetch / notificationclick handlers on purpose — Progressier handles everything.
