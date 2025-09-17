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
