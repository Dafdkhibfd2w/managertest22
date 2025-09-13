// ===== API base (התאם אם צריך)
const API = {
  shiftOne: (date) => `/api/shifts?date=${encodeURIComponent(date)}`,
  shiftUpsert: `/api/shifts`,
  finalize: `/finalize-shift`,
  list: (from, to) => `/api/shifts/list?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
};

// ===== Fetch helper עם טיפול שגיאות וטיים-אאוט
async function apiFetch(url, opts = {}, timeoutMs = 15000){
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(url, { ...opts, signal: ctrl.signal, headers: { 'Content-Type':'application/json', ...(opts.headers||{}) } });
    if(!res.ok){
      const text = await res.text().catch(()=> '');
      throw new Error(`HTTP ${res.status} ${res.statusText} ${text}`);
    }
    const ct = res.headers.get('content-type')||'';
    return ct.includes('application/json') ? res.json() : res.text();
  } finally { clearTimeout(t); }
}

// ===== Toasts
const toastsEl = document.getElementById('toasts');
function toast(msg, type=''){ if(!toastsEl) return;
  const el = document.createElement('div');
  el.className = `toast${type ? ' '+type : ''}`;
  el.textContent = msg;
  toastsEl.appendChild(el);
  setTimeout(()=>{ el.style.opacity = '0'; setTimeout(()=> el.remove(), 300) }, 3000);
}

// ===== Drawer
const drawer = document.getElementById('drawer');
const openDrawer = document.getElementById('openDrawer');
const closeDrawer = document.getElementById('closeDrawer');
openDrawer && openDrawer.addEventListener('click', ()=> drawer.classList.add('open'));
closeDrawer && closeDrawer.addEventListener('click', ()=> drawer.classList.remove('open'));
drawer && drawer.addEventListener('click', (e)=>{ if(e.target === drawer) drawer.classList.remove('open') });

// ===== Boot loader control
const boot = document.getElementById('boot-loader');
function showBoot(){ boot && boot.classList.add('active'); }
function hideBoot(){ boot && boot.classList.remove('active'); }

// ===== Utility
const $$ = (sel, root=document)=> Array.from(root.querySelectorAll(sel));
const $ = (sel, root=document)=> root.querySelector(sel);

function fmtDate(d){ return new Date(d).toLocaleDateString('he-IL') }
function csv(rows){
  return rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
}

// ===== PWA install
let deferredPrompt;
const installBtn = document.getElementById('installPWA');
window.addEventListener('beforeinstallprompt', (e)=>{ e.preventDefault(); deferredPrompt = e; installBtn?.classList.add('pulse') });
installBtn?.addEventListener('click', async ()=>{
  if(!deferredPrompt){ toast('כבר מותקן או לא נתמך', 'warn'); return; }
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  toast(outcome === 'accepted' ? 'הותקן למסך הבית' : 'ההתקנה בוטלה');
  deferredPrompt = null;
});

// ===== Service worker
if('serviceWorker' in navigator){ navigator.serviceWorker.register('/sw.js').catch(()=>{}) }

{ API, apiFetch, toast };
