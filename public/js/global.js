// === Toast core ===
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
      case 'info':    return '💡';
      case 'warn':    return '⚠️';
      case 'error':   return '⛔';
      default:        return '🔔';
    }
  }

  /**
   * showToast(message, options?)
   * @param {string|{title:string,desc?:string}} msg
   * @param {{type?:'success'|'info'|'warn'|'error',
   *          duration?:number, icon?:string, onClose?:Function}} opts
   */
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
    // סגירה בלחיצה על הטוסט עצמו (לא חובה – אפשר להסיר)
    toast.addEventListener('click', (e) => {
      if(e.target.classList.contains('close')) return;
      close();
    });

    root.appendChild(toast);

    const timer = setTimeout(close, duration);
    // אם העכבר מעל – עצור טיימר; החזר כשמסירים
    toast.addEventListener('mouseenter', () => clearTimeout(timer));
    toast.addEventListener('mouseleave', () => setTimeout(close, 800));

    return close; // מאפשר לסגור ידנית מבחוץ
  };
})();

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
  // const statusEl = document.getElementById("notifStatus");

  try {
    if (!("serviceWorker" in navigator)) {
      // statusEl.textContent = "❌ הדפדפן לא תומך ב-Service Worker";
      showToast('❌ הדפדפן לא תומך ב-Service Worke', { type:'error', icon:'🚫' });
      return;
    }

    // statusEl.textContent = "⏳ רושם Service Worker...";
 showToast('⏳ רושם Service Worker...', { type:'info', duration:4000 });
    const reg = await navigator.serviceWorker.register("/service-worker.js");

    // statusEl.textContent = "📩 מבקש הרשאה...";
 showToast('📩 מבקש הרשאה...', { type:'info', duration:4000 });
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      statusEl.textContent = "❌ המשתמש סירב להתראות";
      return;
    }

    // statusEl.textContent = "🔑 נרשם ל-Push...";
    // showToast('🔑 נרשם ל-Push...');
 showToast('🔑 נרשם ל-Push...', { type:'info', duration:4000 });
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
    showToast('✅ התראות הופעלו בהצלחה!');

    // statusEl.textContent = "✅ התראות הופעלו בהצלחה!";
  } catch (err) {
    console.error("שגיאה בהרשמה ל-Push:", err);
    showToast("❌ שגיאה: " + err.message, { type:'error', icon:'❌' });
    // statusEl.textContent = "❌ שגיאה: " + err.message;
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
