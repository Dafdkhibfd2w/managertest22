self.addEventListener("push", function (event) {
  const data = event.data?.json() || { title: "התראה חדשה", body: "" };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png"
    })
  );
});
