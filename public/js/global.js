
async function getCsrf() {
  const res = await fetch("/csrf-token", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}


// ===== ניווט בסיסי =====
const btn = document.getElementById("go-back");
if (btn) {
  btn.addEventListener("click", () => { window.location = '/' });
}

const burger = document.getElementById("burger");
const mobileNav = document.getElementById("mobileNav");
const closeNav = document.getElementById("closeNav");

if (burger && mobileNav && closeNav) {
  burger.addEventListener("click", (e) => {
    e.preventDefault(); // מונע מעבר דף
    mobileNav.classList.add("active");
  });

  closeNav.addEventListener("click", () => mobileNav.classList.remove("active"));

  window.addEventListener("click", (e) => {
    if (!mobileNav.contains(e.target) && !burger.contains(e.target)) {
      mobileNav.classList.remove("active");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const buttons = document.querySelectorAll(".nav-btn");
  const pages = document.querySelectorAll(".admin-pages section");

  function showPage(target) {
    // מנקה active
    buttons.forEach(b => b.classList.remove("active"));

    // מסמן active לכפתורים עם אותו data-page
    document.querySelectorAll(`.nav-btn[data-page="${target}"]`)
      .forEach(el => el.classList.add("active"));

    // מציג את העמוד הנכון
    pages.forEach(sec => {
      sec.classList.remove("active");
      if (sec.id === `page-${target}`) sec.classList.add("active");
    });
  }

  // === בחירת ברירת מחדל לפי path ===
  let hash = location.hash.replace("#", "");
  if (!hash) {
    const path = window.location.pathname;
    if (path.startsWith("/admin")) {
      hash = "shifts";   // ברירת מחדל ל-admin
    } else if (path.startsWith("/manager")) {
      hash = "manage";      // ברירת מחדל ל-manager
    }
    location.hash = hash;
  }
  showPage(hash);

  // back / forward
  window.addEventListener("hashchange", () => {
    const newHash = location.hash.replace("#", "") || "home";
    showPage(newHash);
  });

  // לחיצה על כפתורים
  buttons.forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      const target = btn.dataset.page;
      location.hash = target;
      showPage(target);
    });
  });
});




// ===== Push Notifications =====
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

let currentSubscription = null;

async function initPush() {
  try {
    if (!("serviceWorker" in navigator)) {
      showToast('❌ הדפדפן לא תומך ב-Service Worker', { type:'error' });
      return;
    }

    showToast('⏳ רושם Service Worker...', { type:'info', duration:4000 });
    const reg = await navigator.serviceWorker.register("/service-worker.js");

    showToast('📩 מבקש הרשאה...', { type:'info', duration:4000 });
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    showToast('🔑 נרשם ל-Push...', { type:'info', duration:4000 });
    currentSubscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(
        "BGEYruudNkeNhSyxPmrvHjnvUFnFe3Ca2KmA6IZU6UJU7_fJvVldk4qd90nNil_i_HRR6dY02I_j8oD6hS-4U0E"
      )
    });
console.log(currentSubscription)
    await fetch("/save-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json", "CSRF-Token": await getCsrf() },
      body: JSON.stringify(currentSubscription)
    });

    showToast('✅ התראות הופעלו בהצלחה!');
    updateBell(true);

  } catch (err) {
    console.error("שגיאה בהרשמה ל-Push:", err);
    showToast("❌ שגיאה: " + err.message, { type:'error' });
  }
}

async function unsubscribePush() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await sub.unsubscribe();
      currentSubscription = null;
      showToast("🔕 התראות כובו", { type:'warn' });
      updateBell(false);
    }
  } catch (err) {
    console.error("שגיאה בכיבוי:", err);
    showToast("❌ שגיאה בכיבוי התראות", { type:'error' });
  }
}

function updateBell(enabled) {
  const notifIcons = document.querySelectorAll('.notifIcon');
  notifIcons.forEach(icon => {
    icon.classList.remove("fa-bell", "fa-bell-slash");
    icon.classList.add(enabled ? "fa-bell" : "fa-bell-slash");

    // אפקט קטן
    icon.classList.add("active");
    setTimeout(() => icon.classList.remove("active"), 300);
  });
}


// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  const notifToggle = document.querySelectorAll(".notifToggle");
notifToggle.forEach(btn => {
btn.addEventListener("click", async () => {
  if (Notification.permission === "default") {
    // רק בפעם הראשונה זה יבקש הרשאה
    await initPush();
  } else if (Notification.permission === "granted") {
    if (currentSubscription) {
      // קיים מנוי → נכבה
      await unsubscribePush();
    } else {
      // אין מנוי אבל יש הרשאה → נרשום מחדש
      await initPush(); 
    }
  } else if (Notification.permission === "denied") {
    showToast("❌ חסמת התראות. כדי לאפשר שוב, עדכן בהגדרות הדפדפן.", { type: "error" });
  }
});
})
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    currentSubscription = sub;
    updateBell(!!sub); // true אם יש מנוי, אחרת false
  } catch (err) {
    console.error("שגיאה בבדיקת subscription:", err);
    updateBell(false);
  }
});

function showLoader() {
  if (document.getElementById("globalLoader")) {document.getElementById("globalLoader").style.display = "flex";};
  if (document.getElementById("pageContent")) {document.getElementById("pageContent").style.display = "none";};

}
  const cookies = document.cookie.split(";").reduce((acc, c) => {
    const [k,v] = c.trim().split("=");
    acc[k] = decodeURIComponent(v);
    return acc;
  }, {});
  
async function loadMe() {
  try {
const res = await fetch("/me", { credentials: "include" });
    if (!res.ok) {
if (res.status === 403) {
  window.location.href = "/unauthorized";
}
      throw new Error("Server error");
    }

    const data = await res.json();
    if (data.ok) {
      console.log("מחובר כ:", data.user._id, "תפקיד:", data.user.role);
    } else {
      if (!location.pathname.includes("/login") && !location.pathname.includes("/register")) {
        window.location.href = "/login";
      }
    }
  } catch (err) {
    console.error("שגיאה בבקשת /me:", err);
    if (!location.pathname.includes("/login") && !location.pathname.includes("/register")) {
      window.location.href = "/login";
    }
  }
}


loadMe();




async function loadUser() {
  try {
    const res = await fetch("/me", { credentials: "include" });
    const data = await res.json();
    if (data.ok && data.user) {
      if (document.getElementById("user")) {
      document.getElementById("user").textContent = `שלום ${data.user.username} (${data.user.role})`;
      }

    }
  } catch (err) {
    console.error("שגיאה בשליפת משתמש:", err);
  }
}

document.addEventListener("DOMContentLoaded", loadUser);
function hideLoader() {
  if (document.getElementById("globalLoader")) {document.getElementById("globalLoader").style.display = "none";}
  if (document.getElementById("pageContent")) {document.getElementById("pageContent").style.display = "block";}
}

// דוגמה: עטיפה סביב fetch
async function fetchWithLoader(url, opts) {
  try {
    showLoader();
    const res = await fetch(url, opts);
    return await res.json();
  } finally {
    hideLoader();
  }
}

// שימוש:
document.addEventListener("DOMContentLoaded", async () => {
  const data = await fetchWithLoader("/get-shift");
  // console.log("Loaded:", data);
});

 // הפעלה/כיבוי Dark/Light Mode

const toggleBtn = document.getElementById('themeToggle');
if (toggleBtn) {
  toggleBtn.textContent = "🌙 / ☀️";
  toggleBtn.style.position = "fixed";
  toggleBtn.style.bottom = "20px";
  toggleBtn.style.left = "20px";
  toggleBtn.style.zIndex = "10000";
   

}


// בדיקה אם יש מצב שמור
if (localStorage.getItem('theme') === 'light') {
  document.body.classList.add('light');
} else {
  document.body.classList.add('dark');
}

document.getElementById('themeToggle')?.addEventListener('click', () => {
  document.body.classList.toggle('light');
  document.body.classList.toggle('dark');

  localStorage.setItem(
    'theme',
    document.body.classList.contains('light') ? 'light' : 'dark'
  );
});


document.querySelectorAll(".notifToggle").forEach((btn, index) => {
  btn.addEventListener("click", () => {
    const bell = btn.querySelector(".notifIcon"); 
    if (!bell) return;

    bell.style.animation = "bellShake 0.6s ease";
    setTimeout(() => bell.style.animation = "", 600);
  });
});




document.getElementById("logoutBtn")?.addEventListener("click", async (e) => {
  e.preventDefault();
  const res = await fetch("/logout", { method: "POST", headers: {"CSRF-TOKEN": await getCsrf()} });
  const data = await res.json();
  if (data.ok) {
    window.location.href = "/login";
  }
});
document.addEventListener("DOMContentLoaded", () => {
  // נרמל מסלול (מוריד / בסוף) ומטפל בשורש
  const normalize = p => {
    if (!p) return "/";
    p = p.replace(/\/+$/,"");
    return p === "" ? "/" : p;
  };
  const path = normalize(window.location.pathname);

  // פונקציה שמפעילה Active על קבוצת לינקים (header/bottom)
  function activate(containerSelector){
    const links = Array.from(document.querySelectorAll(containerSelector + " .nav-item"));
    if (!links.length) return;

    // ננקה Active קודם
    links.forEach(a => a.classList.remove("active"));

    let best = null, bestLen = -1;

    links.forEach(a => {
      const raw = a.getAttribute("href") || "/";
      const href = normalize(raw);

      // בית מסומן רק כשאנחנו בשורש
      if (href === "/") {
        if (path === "/") { best = a; bestLen = 1; }
        return;
      }

      // התאמה: שווה בדיוק או פריפיקס עם / (כדי ש-/pro לא יסמן /profile)
      if (path === href || path.startsWith(href + "/") || path.startsWith(href + "?")) {
        if (href.length > bestLen) { best = a; bestLen = href.length; }
      }
    });

    // אם לא נמצא כלום ועדיין אנחנו בשורש
    if (!best && path === "/") {
      best = links.find(a => normalize(a.getAttribute("href")) === "/");
    }

    if (best) best.classList.add("active");
  }

  // הפעלה לשני האיזורים (אם קיימים)
  activate(".brandbar");
  activate(".bottom-nav");
});


function fixNav() {
  if(document.querySelector(".bottom-nav")) {
    document.querySelector(".bottom-nav").style.bottom = '0px';
  }
}
window.addEventListener("resize", fixNav);
window.addEventListener("orientationchange", fixNav);
fixNav();



// ==========================
// מצב אופליין – NEW DELI
// ==========================

// בעת טעינת העמוד
// document.addEventListener("DOMContentLoaded", () => {
//   // הצגת מצב רשת ראשוני
//   if (!navigator.onLine) showOfflineBanner();

//   // מאזין לשינוי מצב הרשת
//   window.addEventListener("online", () => {
//     hideOfflineBanner();
//     syncData();
//   });
//   window.addEventListener("offline", () => {
//     showOfflineBanner();
//   });
// });

// // ==========================
// // פונקציה לשמירה מקומית אם אין אינטרנט
// // ==========================
// function saveShiftOffline(shift) {
//   let offlineData = JSON.parse(localStorage.getItem("offlineShifts")) || [];
//   offlineData.push(shift);
//   localStorage.setItem("offlineShifts", JSON.stringify(offlineData));
//   console.log("💾 נשמר מקומית (אין אינטרנט)", shift);
// }

// // ==========================
// // סנכרון לשרת כשחוזר אינטרנט
// // ==========================
// async function syncData() {
//   const offlineData = JSON.parse(localStorage.getItem("offlineShifts")) || [];
//   if (offlineData.length === 0) return;

//   for (const shift of offlineData) {
//     try {
//       await fetch("/api/shifts", {
//         method: "POST",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify(shift),
//       });
//       console.log("🚀 סונכרן לשרת:", shift);
//     } catch (err) {
//       console.error("❌ שגיאת סנכרון:", err);
//       return; // עצירה אם השרת לא זמין
//     }
//   }

//   // אם הצליח – מנקה מהאחסון המקומי
//   localStorage.removeItem("offlineShifts");
// }

// // ==========================
// // באנר UI
// // ==========================
// function showOfflineBanner() {
//   let banner = document.getElementById("offlineBanner");
//   if (!banner) {
//     banner = document.createElement("div");
//     banner.id = "offlineBanner";
//     banner.textContent = "⚠️ אין אינטרנט – הנתונים נשמרים מקומית";
//     banner.style.cssText = `
//       position: fixed;
//       top: 0;
//       left: 0;
//       right: 0;
//       background: #ff3b3b;
//       color: #fff;
//       text-align: center;
//       padding: 10px;
//       font-weight: bold;
//       z-index: 9999;
//     `;
//     document.body.appendChild(banner);
//   }
//   banner.style.display = "block";
// }

// function hideOfflineBanner() {
//   const banner = document.getElementById("offlineBanner");
//   if (banner) banner.style.display = "none";
// }



document.querySelectorAll('.gohome').forEach((btn) => {
  btn.addEventListener("click", () => {
    window.location.href = "/"; // אם אין היסטוריה

  })
})
