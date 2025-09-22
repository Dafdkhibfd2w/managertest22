// Service Worker לפיתוח – לא שומר כלום ב־cache
self.addEventListener("install", () => {
  console.log("⚡ Dev SW installed – No caching.");
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  console.log("⚡ Dev SW activated – clearing old caches.");
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
  );
  self.clients.claim();
});

// תמיד מביא מהשרת – בלי cache
self.addEventListener("fetch", event => {
  event.respondWith(fetch(event.request));
});
