self.addEventListener("push", e => {
  let data = {};
  try {
    data = e.data.json();
  } catch {
    data = { title: "התראה חדשה", body: e.data.text() };
  }

  self.registration.showNotification(
    data.title || "התראה חדשה",
    {
      body: data.body || data.message || "",
      icon: "/icons/icon-192.png"
    }
  );
});
