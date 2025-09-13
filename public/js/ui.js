
(function(){
  const $ = (s, r=document)=>r.querySelector(s);
  const burger = $('.burger'); const drawer = $('.drawer');
  if (burger) burger.addEventListener('click', ()=>drawer && drawer.classList.toggle('open'));
  if (drawer) drawer.addEventListener('click',(e)=>{ if (e.target===drawer) drawer.classList.remove('open'); });
  window.addEventListener('load', ()=>{ const l = document.querySelector('.loader'); if (l) l.style.display='none'; });
  document.querySelectorAll('[data-skeleton]').forEach(el=>{ setTimeout(()=>el.classList.remove('skeleton'), 600); });
})();
