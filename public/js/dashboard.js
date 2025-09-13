import { API, apiFetch, toast, $, $$, hideBoot } from './core.js';

(async function init(){
  try{
    // סימולציה: טען נתוני היום (תאריך מקומי)
    const today = new Date().toISOString().slice(0,10);
    const data = await apiFetch(API.shiftOne(today)).catch(()=> null);

    $('#kpi-today')?.classList.remove('skeleton','shimmer');
    $('#kpi-status')?.classList.remove('skeleton','shimmer');
    $('#kpi-team')?.classList.remove('skeleton','shimmer');
    $('#kpi-manager')?.classList.remove('skeleton','shimmer');

    if(!data){
      $('#kpi-today').textContent = '0';
      $('#kpi-status').textContent = 'אין משמרת';
      $('#kpi-team').textContent = '—';
      $('#kpi-manager').textContent = '—';
    } else {
      const tasksCount =
        (data.tasks?.daily?.length||0) +
        (data.tasks?.weekly?.length||0) +
        (data.tasks?.monthly?.length||0);
      $('#kpi-today').textContent = tasksCount;
      const closed = !!data.closed;
      $('#kpi-status').textContent = closed ? 'סגור' : 'פתוח';
      $('#kpi-status-chip')?.classList.remove('skeleton','shimmer');
      $('#kpi-status-chip').textContent = closed ? 'נסגר' : 'פתוח';
      $('#kpi-team').textContent = (data.team||[]).join(', ') || '—';
      $('#kpi-manager').textContent = data.manager || '—';
    }

    // פעילות: כאן תוכל להביא feed אמיתי
    const activity = $('#activity');
    activity.innerHTML = '';
    const items = [
      { t:'המשימה "ניקוי משטח" סומנה ע"י דני', ts: new Date() },
      { t:'עודכנה רשימת צוות', ts: new Date(Date.now()-3600e3) },
      { t:'נוספה משימה חדשה', ts: new Date(Date.now()-7200e3) },
    ];
    for(const it of items){
      const li = document.createElement('li');
      li.className = 'activity-item';
      li.innerHTML = `<div>${it.t}</div><div class="meta">${it.ts.toLocaleString('he-IL')}</div>`;
      activity.appendChild(li);
    }
  } catch(err){
    toast('שגיאה בטעינת הדשבורד','error');
  } finally {
    hideBoot();
  }
})();

$('#refreshDashboard')?.addEventListener('click', ()=> location.reload());
