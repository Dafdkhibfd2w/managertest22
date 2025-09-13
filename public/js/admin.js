import { API, apiFetch, toast, $, $$, csv } from './core.js';

function setDefaultDates(){
  const to = new Date();
  const from = new Date(Date.now() - 7*86400e3);
  $('#fromDate').value = from.toISOString().slice(0,10);
  $('#toDate').value   = to.toISOString().slice(0,10);
}
setDefaultDates();

async function load(){
  try{
    const from = $('#fromDate').value, to = $('#toDate').value;
    const res = await apiFetch(API.list(from, to));
    const tb = $('#shiftsTable tbody'); tb.innerHTML = '';
    for(const row of res){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${row.date||'—'}</td>
        <td>${row.manager||'—'}</td>
        <td>${(row.team||[]).join(', ')||'—'}</td>
        <td><span class="status ${row.closed?'closed':'open'}">${row.closed?'סגור':'פתוח'}</span></td>
        <td>${row.closedAt ? new Date(row.closedAt).toLocaleString('he-IL') : '—'}</td>
        <td><a class="btn ghost" href="/manage.html?date=${encodeURIComponent(row.date)}">פתח</a></td>`;
      tb.appendChild(tr);
    }
    $('#openStatus').innerHTML = `סטטוס: <b>${res.some(r=>!r.closed)?'יש משמרת פתוחה':'כל המשמרות סגורות'}</b>`;
  } catch {
    toast('טעינת נתונים כשלה','error');
  }
}
$('#runFilter')?.addEventListener('click',(e)=>{ e.preventDefault(); load() });

$('#exportCSV')?.addEventListener('click',(e)=>{
  e.preventDefault();
  const rows = [['Date','Manager','Team','Closed','ClosedAt']];
  $('#shiftsTable tbody').querySelectorAll('tr').forEach(tr=>{
    const tds = tr.querySelectorAll('td');
    rows.push([tds[0]?.textContent, tds[1]?.textContent, tds[2]?.textContent, tds[3]?.textContent, tds[4]?.textContent]);
  });
  const blob = new Blob([csv(rows)], { type:'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shifts_${Date.now()}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
  toast('CSV הופק','success');
});

// אוטו-Load
load();
