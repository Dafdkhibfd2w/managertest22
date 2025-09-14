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

burger?.addEventListener("click", () => mobileNav.classList.add("active"));
closeNav?.addEventListener("click", () => mobileNav.classList.remove("active"));
window.addEventListener("click", (e) => {
  if (!mobileNav.contains(e.target) && e.target !== burger) {
    mobileNav.classList.remove("active");
  }
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

    await fetch("/save-subscription", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
  const notifToggle = document.getElementById("notifToggle");
  if (!notifToggle) return;
  notifToggle.innerHTML = enabled
    ? `<i data-lucide="bell"></i>`
    : `<i data-lucide="bell-off"></i>`;
  notifToggle.classList.toggle("enabled", enabled);
  lucide.createIcons();
}

// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();

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


