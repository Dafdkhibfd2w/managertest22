self.addEventListener("push", function (event) {
  const data = event.data?.json() || { title: "התראה חדשה", body: "" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png"
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/") // אפשר לשנות ל־/home או כל דף שאתה רוצה
  );
});
const CACHE_NAME = "new-deli-v1";
const urlsToCache = ["/", "/css/style.css", "/js/global.js", "/icons/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
