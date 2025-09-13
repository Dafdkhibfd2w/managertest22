const { toast, $, $$ } = require('./core.js');

const state = {
  date: '',
  manager: '',
  team: [],
  tasks: { daily: [], weekly: [], monthly: [] },
  executions: { daily: [], weekly: [], monthly: [] },
  closed: false
};

function parseTeam(val){ return val.split(',').map(s=>s.trim()).filter(Boolean) }

function renderTasks(){
  ['daily','weekly','monthly'].forEach(key=>{
    const list = $(`#list-${key}`);
    list.innerHTML = '';
    (state.tasks[key]||[]).forEach((task, idx)=>{
      const li = document.createElement('li');
      li.className = 'task-item';
      li.innerHTML = `
        <input type="checkbox" aria-label="סמן ביצוע" data-key="${key}" data-idx="${idx}">
        <div>
          <div>${task}</div>
          <div class="tag">${key==='daily'?'יומית':key==='weekly'?'שבועית':'חודשית'}</div>
        </div>
        <div>
          <button class="icon-btn" data-del="${key}:${idx}" title="מחק"><span class="i i-close"></span></button>
        </div>
      `;
      list.appendChild(li);
    });
  });
}

function renderExecutions(){
  const box = $('#executions');
  box.innerHTML = '';
  ['daily','weekly','monthly'].forEach(key=>{
    (state.executions[key]||[]).forEach((ex, i)=>{
      const li = document.createElement('li');
      li.className = 'exec';
      li.innerHTML = `
        <div><b>${ex.task}</b><div class="meta">${ex.worker||'—'} • ${ex.time||''} • ${key}</div></div>
        <button class="icon-btn" data-del-ex="${key}:${i}" title="מחק"><span class="i i-close"></span></button>
      `;
      box.appendChild(li);
    });
  });
}

function addTask(key, inputId){
  const val = $(inputId).value.trim();
  if(!val) return;
  state.tasks[key] = state.tasks[key] || [];
  state.tasks[key].push(val);
  $(inputId).value = '';
  renderTasks();
}

function collectForm(){
  state.date = $('#shiftDate').value;
  state.manager = $('#manager').value.trim();
  state.team   = parseTeam($('#team').value);
}

async function loadOrCreate(){
  try{
    collectForm();
    if(!state.date) return toast('בחר תאריך','warn');
    // load
    const data = await apiFetch(API.shiftOne(state.date)).catch(()=> null);
    if(data){
      Object.assign(state, {
        date: data.date,
        manager: data.manager||'',
        team: data.team||[],
        tasks: data.tasks||{daily:[],weekly:[],monthly:[]},
        executions: data.executions||{daily:[],weekly:[],monthly:[]},
        closed: !!data.closed
      });
      $('#manager').value = state.manager;
      $('#team').value = state.team.join(', ');
      toast('נטען ממשמרת קיימת','success');
    } else {
      state.tasks = { daily:[], weekly:[], monthly:[] };
      state.executions = { daily:[], weekly:[], monthly:[] };
      state.closed = false;
      toast('נוצרה משמרת חדשה (טיוטה מקומית)','success');
    }
    renderTasks(); renderExecutions();
  } catch(err){
    toast('בעיה בטעינה','error');
  }
}

async function save(){
  try{
    collectForm();
    const payload = { date: state.date, manager: state.manager, team: state.team, tasks: state.tasks, executions: state.executions, closed: state.closed };
    await apiFetch(API.shiftUpsert, { method:'POST', body: JSON.stringify(payload) });
    toast('נשמר בהצלחה','success');
  } catch(err){
    toast('שמירה נכשלה','error');
  }
}

function toggleTab(target){
  $$('.tab').forEach(b=> b.classList.toggle('active', b.dataset.tab === target));
  $$('.tab-panel').forEach(p=> p.classList.toggle('active', p.id === `panel-${target}`));
}

$('#loadShift')?.addEventListener('click', (e)=>{ e.preventDefault(); loadOrCreate() });
$('#saveShift')?.addEventListener('click', (e)=>{ e.preventDefault(); save() });
$$('.tab').forEach(b=> b.addEventListener('click', ()=> toggleTab(b.dataset.tab)));

document.addEventListener('click', (e)=>{
  // מחיקת משימה
  const del = e.target.closest('[data-del]');
  if(del){
    const [key, idx] = del.dataset.del.split(':');
    state.tasks[key].splice(+idx,1);
    renderTasks();
  }
  // הוסף משימה
  const add = e.target.closest('[data-add]');
  if(add){
    const key = add.dataset.add;
    addTask(key, `#add${key.charAt(0).toUpperCase()+key.slice(1)}`);
  }
  // מחיקת ביצוע
  const delEx = e.target.closest('[data-del-ex]');
  if(delEx){
    const [key, i] = delEx.dataset.delEx.split(':');
    state.executions[key].splice(+i,1);
    renderExecutions();
  }
});

// סימון ביצוע מהצ'קבוקס → נכנס ל-executions
document.addEventListener('change', (e)=>{
  if(e.target.matches('input[type="checkbox"][data-key]')){
    const key = e.target.dataset.key;
    const idx = +e.target.dataset.idx;
    if(e.target.checked){
      const t = state.tasks[key][idx];
      state.executions[key].push({ task: t, worker:'', time: new Date().toLocaleTimeString('he-IL', { hour:'2-digit', minute:'2-digit' }) });
      renderExecutions();
      e.target.checked = false; // לא נשאיר מסומן
    }
  }
});

// Finalize modal
const finalizeModal = document.getElementById('finalizeModal');
const finalizeOpen  = document.getElementById('finalizeOpen');
const confirmFinalize = document.getElementById('confirmFinalize');

finalizeOpen?.addEventListener('click', ()=>{
  if(!state.date) return toast('בחר תאריך לפני סיום','warn');
  $('#finalizeSummary').innerHTML = `
    <div><b>תאריך:</b> ${state.date}</div>
    <div><b>מנהל:</b> ${state.manager||'—'}</div>
    <div><b>צוות:</b> ${state.team.join(', ')||'—'}</div>
    <div><b>סה״כ ביצועים:</b> ${
      ['daily','weekly','monthly'].reduce((n,k)=> n + (state.executions[k]?.length||0), 0)
    }</div>`;
  finalizeModal.classList.add('show');
});

finalizeModal?.addEventListener('click', (e)=>{
  if(e.target.matches('[data-close]') || e.target === finalizeModal) finalizeModal.classList.remove('show');
});

confirmFinalize?.addEventListener('click', async ()=>{
  try{
    const payload = { date: state.date, manager: state.manager, team: state.team, executions: state.executions };
    await apiFetch(API.finalize, { method:'POST', body: JSON.stringify(payload) });
    state.closed = true;
    toast('המשמרת נסגרה בהצלחה','success');
    finalizeModal.classList.remove('show');
  } catch(err){
    toast('סגירה נכשלה','error');
  }
});
