
async function getCsrf() {
  const res = await fetch("/csrf-token", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}
(function(){
  const ROOT_ID = 'toast-root';

  function ensureRoot(){
    let root = document.getElementById(ROOT_ID);
    if(!root){
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }
    return root;
  }

  function pickIcon(type){
    switch(type){
      case 'success': return '✅';
      case 'info':    return 'ℹ️';
      case 'warn':    return '⚠️';
      case 'error':   return '⛔';
      default:        return '🔔';
    }
  }

  window.showToast = function(msg, opts={}){
    const {
      type='success',
      duration=3000,
      icon=pickIcon(type),
      onClose
    } = opts;

    const root = ensureRoot();

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.setAttribute('role','status');
    toast.setAttribute('aria-live','polite');
    toast.style.position = 'relative';

    const title = typeof msg === 'string' ? msg : (msg.title || '');
    const desc  = typeof msg === 'string' ? ''  : (msg.desc  || '');

    toast.innerHTML = `
      <div class="icon">${icon}</div>
      <div class="content">
        <div class="title">${title}</div>
        ${desc ? `<div class="desc">${desc}</div>` : ``}
      </div>
      <button class="close" aria-label="סגירה">✕</button>
      <div class="bar"><i style="animation-duration:${duration}ms"></i></div>
    `;

    const close = () => {
      toast.style.animation = 'toastOut .2s ease both';
      setTimeout(() => {
        toast.remove();
        onClose && onClose();
      }, 180);
    };

    toast.querySelector('.close').addEventListener('click', close);

    toast.addEventListener('click', (e) => {
      if(e.target.classList.contains('close')) return;
      close();
    });

    root.appendChild(toast);

    let timer = setTimeout(close, duration);

    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => {
      timer = setTimeout(close, 800);
    });

    return close;
  };
})();

// ===== ניווט בסיסי =====
const btn = document.getElementById("go-back");
if (btn) {
  btn.addEventListener("click", () => { window.location = '/' });
}

const burger = document.getElementById("burger");
const mobileNav = document.getElementById("mobileNav");
const closeNav = document.getElementById("closeNav");

if (burger && mobileNav && closeNav) {
  burger.addEventListener("click", () => mobileNav.classList.add("active"));
  closeNav.addEventListener("click", () => mobileNav.classList.remove("active"));

  window.addEventListener("click", (e) => {
    if (!mobileNav.contains(e.target) && e.target !== burger) {
      mobileNav.classList.remove("active");
    }
  });
}


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
  const notifIcon = document.getElementById("notifIcon");
  if (!notifIcon) return;
  if (enabled) {
    notifIcon.classList.remove("fa-bell-slash");
    notifIcon.classList.add("fa-bell");
  } else {
    notifIcon.classList.remove("fa-bell");
    notifIcon.classList.add("fa-bell-slash");
  }
}


// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {

  const notifToggle = document.getElementById("notifToggle");

notifToggle?.addEventListener("click", async () => {
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

  // בדיקה ראשונית: אם כבר קיים subscription
  navigator.serviceWorker.getRegistration()
    .then(reg => reg?.pushManager.getSubscription())
    .then(sub => {
      if (sub) {
        currentSubscription = sub;
        updateBell(true);
      }
    });
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
    const res = await fetch("/me");
    const data = await res.json();
    if (data.ok) {
      console.log("מחובר כ:", data.user.id, "תפקיד:", data.user.role);
    } else {
      window.location.href = "/login";
    }
  } catch {
    window.location.href = "/login";
  }
}

loadMe();



  async function loadUser() {
  try {
    const res = await fetch("/user");
    const data = await res.json();
    if (data.ok && data.user) {
      if (document.getElementById("user")) {
      document.getElementById("user").textContent =
        `ברוכים הבאים ${data.user.name}`
      }
    }
  } catch (err) {
    console.error("שגיאה בשליפת משתמש:", err);
  }
}

loadUser();
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


  document.getElementById("notifToggle")?.addEventListener("click", () => {
    const bell = document.getElementById("notifIcon");
    bell.style.animation = "bellShake 0.6s ease";
    setTimeout(() => bell.style.animation = "", 600);
  });

//   document.addEventListener("DOMContentLoaded", async () => {
//   try {
//     const res = await fetch("/user");
//     const data = await res.json();
//     if (window.location.href === '/login') return;
//     if (!data.ok || !data.user) {
//       window.location.href = "/login"; // 🛑 לא מחובר → לוגין
//     }
//   } catch {
//     window.location.href = "/login";
//   }
// });
// כפתור Logout
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


document.querySelector(".gohome")?.addEventListener("click", () => {
    window.location.href = "/"; // אם אין היסטוריה
});