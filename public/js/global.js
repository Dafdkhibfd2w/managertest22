const btn = document.getElementById("go-back");

if (btn) {
document.getElementById("go-back").addEventListener("click", () => {
  window.location = '/'
})
}



  const burger = document.getElementById("burger");
  const mobileNav = document.getElementById("mobileNav");
  const closeNav = document.getElementById("closeNav");

  burger.addEventListener("click", () => {
    mobileNav.classList.add("active");
  });

  closeNav.addEventListener("click", () => {
    mobileNav.classList.remove("active");
  });
  // סגירה בלחיצה מחוץ לתפריט
  window.addEventListener("click", (e) => {
    if (!mobileNav.contains(e.target) && e.target !== burger) {
      mobileNav.classList.remove("active");
    }
  });
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function initPush() {
  const statusEl = document.getElementById("notifStatus");

  try {
    if (!("serviceWorker" in navigator)) {
      statusEl.textContent = "❌ הדפדפן לא תומך ב-Service Worker";
      return;
    }

    statusEl.textContent = "⏳ רושם Service Worker...";
    const reg = await navigator.serviceWorker.register("/service-worker.js");

    statusEl.textContent = "📩 מבקש הרשאה...";
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      statusEl.textContent = "❌ המשתמש סירב להתראות";
      return;
    }

    statusEl.textContent = "🔑 נרשם ל-Push...";
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        "BGEYruudNkeNhSyxPmrvHjnvUFnFe3Ca2KmA6IZU6UJU7_fJvVldk4qd90nNil_i_HRR6dY02I_j8oD6hS-4U0E"
      )
    });

    await fetch("/save-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription)
    });

    statusEl.textContent = "✅ התראות הופעלו בהצלחה!";
  } catch (err) {
    console.error("שגיאה בהרשמה ל-Push:", err);
    statusEl.textContent = "❌ שגיאה: " + err.message;
  }
}
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons(); // יחליף את <i data-lucide="bell"> לאייקון אמיתי
});
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

  const notifToggle = document.getElementById("notifToggle");

  // בדיקה אם כבר יש הרשאה
  if (Notification.permission === "granted") {
    notifToggle.innerHTML = `<i data-lucide="bell"></i>`;
    notifToggle.classList.add("enabled");
    lucide.createIcons();
  }

  notifToggle?.addEventListener("click", async () => {
    try {
      if (Notification.permission !== "granted") {
        await initPush(); // הפונקציה שלך שמבצעת רישום ל-Push
      }

      if (Notification.permission === "granted") {
        notifToggle.innerHTML = `<i data-lucide="bell"></i>`;
        notifToggle.classList.add("enabled");
        lucide.createIcons();
      } else if (Notification.permission === "denied") {
        alert("חסמת התראות. כדי לאפשר שוב, עדכן בהגדרות הדפדפן.");
      }
    } catch (err) {
      console.error("שגיאה בהפעלת התראות:", err);
    }
  });
});
