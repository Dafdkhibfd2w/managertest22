// ===== refs
const loadForm      = document.getElementById("loadForm");
const updateForm    = document.getElementById("updateForm");
const shiftSection  = document.getElementById("shiftSection");
const saveBtn       = document.getElementById("saveUpdates");
const finalizeBtn   = document.getElementById("finalizeBtn");
const saveStatus    = document.getElementById("saveStatus");
const leadChip      = document.getElementById("leadChip");
const statusEl      = document.getElementById("status");

// finalize modal refs
const finalizeModal   = document.getElementById("finalizeModal");
const finalizeSummary = document.getElementById("finalizeSummary");
const confirmFinalize = document.getElementById("confirmFinalize");
const cancelFinalize  = document.getElementById("cancelFinalize");

// ===== consts
const categories = [
  { name: "משימות יומיות", key: "daily" },
  { name: "משימות שבועיות", key: "weekly" },
  { name: "משימות חודשיות", key: "monthly" }
];

let shiftData = null;
let activeCategory = "daily";

/* =========================
   עזרים – גלובליים
   ========================= */
function upsertLocalExecution(category, task, worker) {
  if (!shiftData) return;
  if (!shiftData.executions) shiftData.executions = { daily: [], weekly: [], monthly: [] };
  if (!Array.isArray(shiftData.executions[category])) shiftData.executions[category] = [];

  const list = shiftData.executions[category];
  const hit = list.find(e => e.task === task);
  if (hit) {
    if (worker !== undefined) hit.worker = worker;
  } else {
    list.push({ task, worker: worker || "" });
  }
}

function getExecForTask(shift, category, task) {
  const list = shift?.executions?.[category];
  if (!Array.isArray(list)) return null;
  return list.find(e => e.task === task) || null;
}

/* =========================
   עדכון סטטוס
   ========================= */
function updateStatus(shift) {
  statusEl.classList.remove("default", "open", "closed");

  if (!shift) {
    statusEl.innerHTML = `<span class="dot"></span>סטטוס: —`;
    statusEl.classList.add("default");
    statusEl.style.display = "inline-flex";
    return;
  }

  if (shift.closed) {
    statusEl.innerHTML = `<span class="dot"></span>סטטוס: סגור`;
    statusEl.classList.add("closed");
  } else {
    statusEl.innerHTML = `<span class="dot"></span>סטטוס: פתוח`;
    statusEl.classList.add("open");
  }
  statusEl.style.display = "inline-flex";
}

/* =========================
   טעינת משמרת
   ========================= */
loadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = new FormData(loadForm).get("date");

  const res = await fetch(`/api/get-shift?date=${date}`);
  const shift = await res.json();

  if (!shift) {
    updateForm.innerHTML = "לא נמצאה משמרת עבור התאריך הזה.";
    shiftSection.style.display = "block";
    saveBtn.style.display = "none";
    finalizeBtn.style.display = "none";
    leadChip.textContent = "אחמ״ש: —";
    updateStatus(null);
    leadChip.style.display = "inline-flex";
    return;
  }

  // נירמול צוות
  if (typeof shift.team === "string") {
    shift.team = shift.team.split(",").map((name) => name.trim()).filter(Boolean);
  }

  // אחמ״ש
  let leadName = shift.manager;
  if (!leadName) {
    if (Array.isArray(shift.team) && shift.team.length) leadName = shift.team[0];
    else if (typeof shift.team === "string") leadName = shift.team.split(",")[0]?.trim();
  }
  leadChip.innerHTML = `<span class="dot"></span>אחמ״ש: ${leadName || "—"}`;
  leadChip.style.display = "inline-flex";

  // סטטוס
  updateStatus(shift);

  // הערות אחמ״ש
  const noteBox = document.getElementById("managerNoteSection");
  const noteText = document.getElementById("managerNote");
  if (shift.notes && shift.notes.trim()) {
    noteText.textContent = shift.notes;
    noteBox.style.display = "block";
  } else {
    noteText.textContent = "אין הערת אחמ\"ש";
    noteBox.style.display = "block";
  }

  // שמור נתונים לרינדור
  shiftData = shift;
  updateForm.dataset.date = date;

  renderTabs();
  renderCategory("daily");

  shiftSection.style.display = "block";
  saveBtn.style.display = "inline-block";
  finalizeBtn.style.display = "inline-block";
});

/* =========================
   UI – טאבים + רינדור קטגוריה
   ========================= */
function renderTabs() {
  let tabsHTML = `<div class="task-tabs">`;
  categories.forEach((cat) => {
    tabsHTML += `<div class="task-tab ${cat.key === activeCategory ? "active" : ""}" onclick="renderCategory('${cat.key}')">${cat.name}</div>`;
  });
  tabsHTML += `</div>`;
  updateForm.innerHTML = tabsHTML;
}

window.renderCategory = function(categoryKey) {
  activeCategory = categoryKey;
  renderTabs();

  const list = shiftData?.tasks?.[categoryKey] || [];
  if (!list.length) {
    updateForm.innerHTML += `<p>אין משימות בקטגוריה הזו.</p>`;
    return;
  }

  const teamArray = Array.isArray(shiftData.team)
    ? shiftData.team
    : typeof shiftData.team === "string"
      ? shiftData.team.split(",").map(n => n.trim()).filter(Boolean)
      : [];

  list.forEach((task, index) => {
    const exec = getExecForTask(shiftData, categoryKey, task);

    const teamOptions = teamArray.map(n =>
      `<option value="${n}" ${exec?.worker === n ? "selected" : ""}>${n}</option>`
    ).join("");

    const taskId = `${categoryKey}-${index}`;
    updateForm.innerHTML += `
      <div class="task-block accordion" id="task-${taskId}">
        <div class="task-header" onclick="toggleTask('${taskId}')">
          ${task}
        </div>
        <div class="task-body" data-category="${categoryKey}" data-task="${task}">
          <label>בוצע על ידי:
            <select class="fld-worker">
              <option value="">בחר עובד</option>
              ${teamOptions}
            </select>
          </label>
          <button type="button" class="save-single" onclick="saveSingleTask(this)">שמור</button>
        </div>
      </div>
    `;

    // האזנה לשינויים
    const bodyEl = document.getElementById(`task-${taskId}`).querySelector('.task-body');
    const sel = bodyEl.querySelector('.fld-worker');
    sel.addEventListener('change', () => {
      upsertLocalExecution(categoryKey, task, sel.value.trim());
      bodyEl.classList.add('dirty');
    });
  });
};

function toggleTask(id) {
  const block = document.getElementById(`task-${id}`);
  block.classList.toggle("open");
}

/* =========================
   שמירת משימה בודדת
   ========================= */
async function saveSingleTask(btn) {
  const body = btn.closest(".task-body");
  const category = body.dataset.category;
  const task = body.dataset.task;
  const worker = body.querySelector(".fld-worker").value.trim();
  const date   = updateForm.dataset.date;

  upsertLocalExecution(category, task, worker);

  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = "שומר...";

  try {
    const res = await fetch("/api/update-single-task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, category, task, worker })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "שגיאת שרת");

    btn.textContent = result.message || "נשמר ✔";
    body.classList.remove('dirty');
  } catch (err) {
    console.error(err);
    btn.textContent = "שגיאה";
    alert(err.message || "שמירה נכשלה");
  } finally {
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 1200);
  }
}

/* =========================
   שמירה כוללת
   ========================= */
saveBtn.addEventListener("click", async () => {
  const date = updateForm.dataset.date;
  const executions = { daily: [], weekly: [], monthly: [] };

  updateForm.querySelectorAll(".task-body").forEach(body => {
    const cat  = body.dataset.category;
    const task = body.dataset.task;
    const worker = body.querySelector(".fld-worker")?.value?.trim() || "";
    if (worker) executions[cat].push({ task, worker });
  });

  const totalChosen = executions.daily.length + executions.weekly.length + executions.monthly.length;
  if (totalChosen === 0) {
    saveStatus.textContent = "לא סומנו ביצועים לשמירה.";
    return;
  }

  const res = await fetch("/api/update-shift", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, executions })
  });

  const result = await res.json();

  shiftData.executions = shiftData.executions || { daily:[], weekly:[], monthly:[] };
  ['daily','weekly','monthly'].forEach(cat => {
    (executions[cat] || []).forEach(e => upsertLocalExecution(cat, e.task, e.worker));
  });
  updateForm.querySelectorAll('.task-body.dirty').forEach(el => el.classList.remove('dirty'));

  saveStatus.textContent = result.message || "נשמר.";
});

/* =========================
   סיום משמרת – סיכום ואישור אחמ״ש
   ========================= */
finalizeBtn?.addEventListener("click", () => {
  if (!shiftData) return;
  finalizeSummary.innerHTML = buildFinalizeSummaryHTML(shiftData);
  finalizeModal.style.display = "flex";
});

cancelFinalize?.addEventListener("click", () => {
  finalizeModal.style.display = "none";
  document.getElementById("finalizeStatus").textContent = "";
});

confirmFinalize?.addEventListener("click", async () => {
  if (!shiftData) return;
  const date = updateForm.dataset.date;
  const payload = {
    date,
    manager: shiftData.manager || "",
    team: Array.isArray(shiftData.team) ? shiftData.team : String(shiftData.team || "").split(",").map(s=>s.trim()).filter(Boolean),
    executions: shiftData.executions || { daily:[], weekly:[], monthly:[] }
  };

  const btn = confirmFinalize;
  const lbl = btn.textContent;
  btn.disabled = true; btn.textContent = "סוגר...";

  try {
    const res = await fetch("/api/finalize-shift", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "שגיאת שרת");

    document.getElementById("finalizeStatus").textContent = result.message || "המשמרת נסגרה בהצלחה.";
    updateForm.querySelectorAll("select,input[type='time'],button.save-single").forEach(el => el.disabled = true);
    saveBtn.disabled = true;
    updateStatus({ closed: true }); // עדכון סטטוס לסגור
  } catch (err) {
    document.getElementById("finalizeStatus").textContent = err.message || "סגירה נכשלה.";
  } finally {
    btn.disabled = false; btn.textContent = lbl;
  }
});

// בונה סיכום יפה
function buildFinalizeSummaryHTML(shift) {
  const managerNote = document.getElementById('managerNotes');
  if (managerNote) {
    if (shift.notes && shift.notes.trim()) {
      managerNote.innerHTML = `<div>${shift.notes.trim()}</div>`;
    } else {
      managerNote.textContent = 'אין הערות.';
    }
  }

  const date = updateForm.dataset.date || shift.date || "";
  const manager = shift.manager || "—";
  const team = Array.isArray(shift.team) ? shift.team.join(", ") :
               (typeof shift.team === "string" ? shift.team : "—");

  const rows = [];
  categories.forEach(cat => {
    const tasks = shift?.tasks?.[cat.key] || [];
    if (!tasks.length) return;

    rows.push(`<h3 style="margin-top:8px">${cat.name}</h3>`);
    rows.push(`<ul style="list-style:none;padding:0;margin:6px 0">`);

    tasks.forEach(task => {
      const ex = getExecForTask(shift, cat.key, task);
      const worker = ex?.worker || "—";
      const ok = worker !== "—";
      rows.push(`
        <li style="background: linear-gradient(180deg, #1f2937, #111827);border-radius:10px;padding:8px 10px;margin:6px 0">
          <strong>${task}</strong>
          <div style="font-size:14px;color:#2b5329">בוצע על ידי: <b>${worker}</b> ${ok ? "✅" : "❗"}</div>
        </li>
      `);
    });

    rows.push(`</ul>`);
  });

  return `
    <div class="section">
      <div><strong>תאריך:</strong> ${date}</div>
      <div><strong>אחמ״ש:</strong> ${manager}</div>
      <div><strong>צוות:</strong> ${team}</div>
    </div>
    <div class="section">
      ${rows.join("") || "<em>אין משימות מוגדרות.</em>"}
      <small class="muted">סימן ✅ מציין משימה שמולאה עם עובד; ❗ מציין שחסר פרטים.</small>
    </div>
  `;
}

/* =========================
   הערות בזמן אמת
   ========================= */
(function () {
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  function renderRuntimeNotes(listEl, notes) {
    const arr = Array.isArray(notes) ? notes : [];
    listEl.innerHTML = arr.length
      ? arr.map((n, i) => `
          <li class="exec-row" data-note-id="${n.id || ''}" data-index="${i}">
            <span class="task-name">${escapeHtml(n.text)}</span>
            <span class="who-time">
              <small>${new Date(n.time).toLocaleString('he-IL')}</small>
            </span>
            <button class="note-del-btn" style='color: black' title="מחיקה">🗑️</button>
          </li>
        `).join('')
      : '<li class="exec-row"><span class="task-name">אין הערות</span></li>';
  }

  async function fetchShiftByDate(date) {
    const res = await fetch(`/api/get-shift?date=${encodeURIComponent(date)}`);
    if (!res.ok) return null;
    return res.json();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const dateInput    = document.querySelector('input[name="date"], #date');
    const runtimeList  = document.getElementById('runtimeNotesList');
    const noteText     = document.getElementById('runtimeNoteText');
    const addBtn       = document.getElementById('addRuntimeNoteBtn');
    const managerInput = document.querySelector('input[name="manager"], #manager');

    async function loadRuntimeNotes() {
      if (!dateInput?.value || !runtimeList) return;
      const shift = await fetchShiftByDate(dateInput.value);
      renderRuntimeNotes(runtimeList, shift?.runtimeNotes);
    }

    // הוספת הערה
    addBtn?.addEventListener('click', async () => {
      if (!dateInput?.value) return alert('בחר תאריך משמרת קודם');
      const text = (noteText?.value || '').trim();
      if (!text) return noteText.focus();

      const res = await fetch('/api/add-runtime-note', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          date: dateInput.value,
          text,
          author: managerInput?.value || 'אחמ״ש'
        })
      });

      const data = await res.json();
      if (!data.ok) return alert(data.message || 'שגיאה');

      // הוספה ל־DOM
      const li = document.createElement('li');
      li.className = 'exec-row';
      li.innerHTML = `
        <span class="task-name">${text}</span>
        <span class="who-time"><small>${new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</small></span>
        <button class="note-del-btn" style="color:black" title="מחיקה">🗑️</button>
      `;
      li.querySelector('.note-del-btn').addEventListener('click', () => li.remove());
      runtimeList.appendChild(li);

      noteText.value = '';
      noteText.focus();
    });

    // מחיקת הערה
    runtimeList?.addEventListener('click', async (e) => {
      const btn = e.target.closest('.note-del-btn');
      if (!btn) return;

      const li   = btn.closest('li.exec-row');
      const date = dateInput?.value;
      if (!li || !date) return;

      const noteId = li.getAttribute('data-note-id');
      const index  = li.getAttribute('data-index');

      if (!confirm('למחוק את ההערה?')) return;

      const res = await fetch('/api/delete-runtime-note', {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({
          date,
          noteId: noteId || undefined,
          index: noteId ? undefined : Number(index)
        })
      });

      const data = await res.json();
      if (!data.ok) { alert(data.message || 'שגיאה במחיקה'); return; }
      renderRuntimeNotes(runtimeList, data.runtimeNotes);
    });

    dateInput?.addEventListener('change', loadRuntimeNotes);
    if (dateInput?.value) loadRuntimeNotes();
  });
})();
