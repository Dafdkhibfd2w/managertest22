(function(){
  window.showToast = function(msg, timeout=2500){
    let holder = document.querySelector('.toast');
    if(!holder){
      holder = document.createElement('div');
      holder.className = 'toast';
      holder.innerHTML = '<div class="inner"></div>';
      document.body.appendChild(holder);
    }
    holder.querySelector('.inner').textContent = msg;
    holder.classList.add('show');
    setTimeout(()=> holder.classList.remove('show'), timeout);
  };
})();

/* ShiftPro UI helpers: drawer, theme toggle, lucide init, toasts, skeletons */


// Drawer for mobile
const drawer = document.getElementById('mobileNav');
const burger = document.getElementById('burger');
const closeNav = document.getElementById('closeNav');
if (burger && drawer) burger.addEventListener('click', ()=> drawer.classList.add('open'));
if (closeNav && drawer) closeNav.addEventListener('click', ()=> drawer.classList.remove('open'));
document.addEventListener('keydown', e=>{ if(e.key==='Escape') drawer?.classList.remove('open') });


// Icon init (Lucide)
try { window.lucide && lucide.createIcons(); } catch {}


// Toasts
const toastsEl = document.getElementById('toasts') || (()=>{ const d=document.createElement('div'); d.id='toasts'; d.className='toasts'; document.body.appendChild(d); return d; })();
export function toast(msg, type=''){ const el=document.createElement('div'); el.className=`toast${type?' '+type:''}`; el.textContent=msg; toastsEl.appendChild(el); setTimeout(()=>{ el.style.opacity='0'; setTimeout(()=> el.remove(), 300) }, 3000) }


// Skeleton utilities
export function showSkeleton(container, rows=3){ if(!container) return; container.innerHTML = Array.from({length:rows}).map(()=>'<div class="skeleton shimmer" style="height:36px;margin:6px 0"></div>').join('') }
export function clearSkeleton(container){ if(!container) return; container.innerHTML='' }


// Theme (light/dark) – persists
const STORAGE_KEY = 'shiftpro.theme';
const body = document.body;
const saved = localStorage.getItem(STORAGE_KEY);
if (saved === 'dark') body.classList.add('theme-dark');


// Optional: connect a toggle button with id="themeToggle"
const themeToggle = document.getElementById('themeToggle');
if (themeToggle){
themeToggle.addEventListener('click', ()=>{
body.classList.toggle('theme-dark');
localStorage.setItem(STORAGE_KEY, body.classList.contains('theme-dark') ? 'dark' : 'light');
});
}


// Notifications mock toggle (if present)
const notifToggle = document.getElementById('notifToggle');
if (notifToggle) notifToggle.addEventListener('click', ()=> toast('התראות מושבתות/מופעלות (דמו)', 'warn'));