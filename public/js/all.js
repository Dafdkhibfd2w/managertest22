function showToast(message, type = "info") {
  // צור קונטיינר אם לא קיים
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // אייקונים לפי סוג
  const icons = {
    success: "fa-check-circle",
    error: "fa-times-circle",
    warning: "fa-exclamation-triangle",
    info: "fa-info-circle"
  };

  // צור טוסט
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // הסרה אוטומטית אחרי 4 שניות
  setTimeout(() => {
    toast.remove();
    if (container.children.length === 0) container.remove();
  }, 4000);
}

document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector("#scheduleTable");
  if (!table) return;

  const headers = Array.from(table.querySelectorAll("thead th"))
    .map(th => th.innerText.trim());

  const rows = table.querySelectorAll("tbody tr");
  rows.forEach(row => {
    Array.from(row.children).forEach((td, i) => {
      if (headers[i]) {
        td.setAttribute("data-label", headers[i]);
      }
    });
  });
});

let allShifts = [];
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}
// 🟢 טוען CSRF Token פעם אחת בתחילת הטעינה
async function getCsrf() {
  const res = await fetch("/csrf-token", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}

function normalizeTeam(team) {
  if (Array.isArray(team)) return team;
  if (typeof team === "string") return team.split(",").map(s => s.trim()).filter(Boolean);
  return [];
}

function getDayName(dateStr) {
  const days = ["ראשון","שני","שלישי","רביעי","חמישי","שישי","שבת"];
  const d = new Date(dateStr);
  return isNaN(d) ? "" : days[d.getDay()];
}



async function loadWeekRange(){
  const res = await fetch("/shift-submissions/next", { credentials: "include" });
  const data = await res.json();
if (data.ok && data.weekStart && data.weekEnd) {
  const start = new Date(data.weekStart).toLocaleDateString("he-IL");
  const end   = new Date(data.weekEnd).toLocaleDateString("he-IL");
  document.getElementById("weekRange").textContent = `שבוע הבא: ${start} – ${end}`;
} else {
  document.getElementById("weekRange").textContent = "אין נתונים";
}
}
loadWeekRange();
    document.getElementById("submitShiftsForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const shifts = {};
  const notes = {};
  ["sun","mon","tue","wed","thu","fri"].forEach(day=>{
    shifts[day] = fd.getAll(day+"[]");
    notes[day] = fd.get("note_"+day) || "";
  });

const res = await fetch("/shift-submissions", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "CSRF-Token": await getCsrf() },
    body: JSON.stringify({ shifts, notes })
});
const data = await res.json();
  showToast(data.message || (data.ok ? "✅ הסידור נשלח!" : "❌ שגיאה בשליחה"));
  
});
async function loadMySubmission() {
  try {
    const res = await fetch("/shift-submissions/my", { credentials: "include" });
    const data = await res.json();
    if (!data.ok || !data.submission) return;

    const sub = data.submission;

    // מילוי צ׳קבוקסים לפי ההגשה
    for (const day of ["sun","mon","tue","wed","thu","fri"]) {
      if (sub.shifts && sub.shifts[day]) {
        sub.shifts[day].forEach(shift => {
          const selector = `input[name="${day}[]"][value="${shift}"]`;
          const el = document.querySelector(selector);
          if (el) el.checked = true;
        });
      }

      // מילוי הערות
      if (sub.notes && sub.notes[day]) {
        const noteEl = document.querySelector(`textarea[name="note_${day}"]`);
        if (noteEl) noteEl.value = sub.notes[day];
      }
    }
  } catch (err) {
    console.error("loadMySubmission error", err);
  }
}

// להריץ בטעינה
document.addEventListener("DOMContentLoaded", loadMySubmission);
const daysHebs = {
  sun:'ראשון',
  mon:'שני',
  tue:'שלישי',
  wed:'רביעי',
  thu:'חמישי',
  fri:'שישי'
};

 async function loadSchedule() {
 try {
   const res = await fetch("/schedule-preview", { credentials: "include" });
   const data = await res.json();
     if (!data.ok) {
     document.getElementById("scheduleBody").innerHTML =
           `<tr><td colspan="3">❌ ${data.message || "שגיאה בטעינה"}</td></tr>`;
          return;
    }
    if (data.explanation) {
    document.querySelector(".ai-explanation").style.display = "block";
    document.getElementById("aiExplanation").textContent = data.explanation;
}
    const sch = data.schedule;
    let rows = "";
if (sch.employees) {
  rows = sch.employees.map(e => `
    <tr>
      <td class="morning">${e.shifts?.includes("morning") ? `${e.name} (${e.role})` : "אין"}</td>
      <td class="mid">${e.shifts?.includes("mid") ? `${e.name} (${e.role})` : "אין"}</td>
      <td class="evening">${e.shifts?.includes("evening") ? `${e.name} (${e.role})` : "אין"}</td>
    </tr>
  `).join("");
} else {
  rows = Object.entries(sch).map(([day, shifts]) => {
    const morning = (shifts.morning || []).join(", ") || "אין";
    const mid     = (shifts.mid || []).join(", ") || "אין";
    const evening = (shifts.evening || []).join(", ") || "אין";
    return `
      <tr>
        <td>${daysHebs[day] || day}</td>
        <td class="morning" data-label='בוקר: '>${morning}</td>
        <td class="mid" data-label='אמצע: '>${mid}</td>
        <td class="evening" data-label='ערב: '>${evening}</td>
      </tr>
    `;
  }).join("");
}

document.getElementById("scheduleBody").innerHTML = rows;
      } catch (err) {
        console.error(err);
        document.getElementById("scheduleBody").innerHTML =
          `<tr><td colspan="3">❌ שגיאה בטעינת נתונים</td></tr>`;
      }
    }
loadSchedule();


const loadManageForm  = document.getElementById("loadManageForm");
const updateForm    = document.getElementById("updateForm");
const shiftSection  = document.getElementById("shiftSection");
const savemanage       = document.getElementById("saveUpdates");
const finalizeBtn   = document.getElementById("finalizeBtn");
const saveStatus    = document.getElementById("saveStatus");
const leadChip      = document.getElementById("leadChip");
const statusEl      = document.getElementById("status");
const finalizeModal   = document.getElementById("finalizeModal");
const finalizeSummary = document.getElementById("finalizeSummary");
const confirmFinalize = document.getElementById("confirmFinalize");
const cancelFinalize  = document.getElementById("cancelFinalize");
const createdByChip = document.getElementById("createdByChip");
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
// טופס טעינת משמרת לפי תאריך
loadManageForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const date = new FormData(loadManageForm).get("date");

  // 🟢 איפוס כל האלמנטים והמצב לפני כל טעינה חדשה
  shiftData = null;
  updateForm.dataset.date = "";
updateForm.querySelectorAll(":scope > :not(#categories)").forEach(el => el.remove());
  document.getElementById("runtimeNotesList").innerHTML = "";
  document.getElementById("managerNote").textContent = "";
  leadChip.style.display = "none";
  statusEl.style.display = "none";
  createdByChip.style.display = "none";

  // שליפת משמרת מהשרת
  const res = await fetch(`/get-shift?date=${date}`, { credentials: "include" });
  const shift = await res.json();

  // 🟥 אם לא נמצאה משמרת
  if (!shift) {
document.getElementById("categories").innerHTML = "<p>לא נמצאה משמרת עבור התאריך הזה.</p>";

    shiftSection.style.display = "block";
    savemanage.style.display = "none";
    finalizeBtn.style.display = "none";
    leadChip.textContent = "אחמ״ש: —";
    updateStatus(null);
    leadChip.style.display = "inline-flex";
  document.getElementById("runtimeNotesSection").style.display = "none";
  document.getElementById("runtimeNotesList").innerHTML = "";
  document.getElementById("managerNoteSection").style.display = "none";
    return;
  }

  // 🟢 נירמול הצוות (אם מגיע כמחרוזת -> הופך למערך)
  if (typeof shift.team === "string") {
    shift.team = shift.team.split(",").map((name) => name.trim()).filter(Boolean);
  }
document.getElementById("runtimeNotesSection").style.display = "block";
document.getElementById("managerNoteSection").style.display = "block";
  // 🟢 אחמ״ש – אם לא מוגדר נלקח מהצוות
  let leadName = shift.manager;
  if (!leadName) {
    if (Array.isArray(shift.team) && shift.team.length) leadName = shift.team[0];
    else if (typeof shift.team === "string") leadName = shift.team.split(",")[0]?.trim();
  }
  leadChip.innerHTML = `<span class="dot"></span>אחמ״ש: ${leadName || "—"}`;
  leadChip.style.display = "inline-flex";

  // 🟢 סטטוס משמרת
  updateStatus(shift);

  // 🟢 מי יצר את המשמרת
  if (shift.createdBy) {
    createdByChip.innerHTML = `<span class="dot"></span>נוצר ע״י: ${shift.createdBy}`;
  } else {
    createdByChip.innerHTML = `<span class="dot"></span>נוצר ע״י: —`;
  }
  createdByChip.style.display = "inline-flex";

  // 🟢 הערות אחמ״ש
  const noteBox = document.getElementById("managerNoteSection");
  const noteText = document.getElementById("managerNote");
  if (shift.notes && shift.notes.trim()) {
    noteText.textContent = shift.notes;
    noteBox.style.display = "block";
  } else {
    noteText.textContent = "אין הערת אחמ\"ש";
    noteBox.style.display = "block";
  }

  // 🟢 שמירת הנתונים ברמה הגלובלית
  shiftData = shift;
  updateForm.dataset.date = date;

  // 🟢 רינדור הערות בזמן אמת
  renderRuntimeNotes(
    document.getElementById("runtimeNotesList"),
    shift.runtimeNotes || []
  );

  // 🟢 רינדור טאבים וקטגוריות
  renderTabs();
  // renderCategory("daily"); // במידת הצורך

  // 🟢 הצגת אזור המשמרת והכפתורים
  shiftSection.style.display = "block";
  savemanage.style.display = "inline-block";
  finalizeBtn.style.display = "inline-block";
});


/* =========================
   UI – טאבים + רינדור קטגוריה
   ========================= */
function renderTabs() {
  const categoriesDiv = document.getElementById("categories");
  if (!categoriesDiv) {
    console.warn("❌ #categories לא נמצא בזמן הקריאה ל-renderTabs");
    return;
  }

  categoriesDiv.innerHTML = categories.map(cat => `
    <div class="category-block" id="cat-${cat.key}">
      <div class="category-header" data-key="${cat.key}">
        ${cat.name}
      </div>
      <div class="tasks-container" id="tasks-${cat.key}"></div>
    </div>
  `).join("");

  document.querySelectorAll(".category-header").forEach(header => {
    header.addEventListener("click", () => {
      const key = header.dataset.key;
      renderCategory(key);
    });
  });
}

window.renderCategory = function(categoryKey) {
  const container = document.getElementById(`tasks-${categoryKey}`);

  // אם כבר פתוח – נסגור
  if (container.classList.contains("open")) {
    container.classList.remove("open");
    return;
  }

  // נסגור את כל השאר
  categories.forEach(cat => {
    document.getElementById(`tasks-${cat.key}`).classList.remove("open");
  });

  // נפתח את הנוכחי
  container.classList.add("open");
  container.innerHTML = "";

  const list = shiftData?.tasks?.[categoryKey] || [];
  if (!list.length) {
    container.innerHTML = `<p>אין משימות בקטגוריה הזו.</p>`;
    return;
  }

  const teamArray = Array.isArray(shiftData.team)
    ? shiftData.team
    : (typeof shiftData.team === "string"
        ? shiftData.team.split(",").map(n => n.trim()).filter(Boolean)
        : []);

  list.forEach((task, index) => {
    const exec = getExecForTask(shiftData, categoryKey, task);
    const teamOptions = teamArray.map(n =>
      `<option value="${n}" ${exec?.worker === n ? "selected" : ""}>${n}</option>`
    ).join("");

    const taskId = `${categoryKey}-${index}`;
container.innerHTML += `
  <div class="task-block" id="task-${taskId}">
    <div class="task-header">${task}</div>
    <div class="task-body" data-category="${categoryKey}" data-task="${task}">
      <label>בוצע על ידי:</label>
      <select class="fld-worker">
        <option value="">בחר עובד</option>
        ${teamOptions}
      </select>
      <button type="button" class="save-single" data-taskid="${taskId}">שמור</button>
    </div>
  </div>
`;

  });

  // חיבור מאזינים לכל הכפתורים שזה עתה נוצרו
  container.querySelectorAll(".save-single").forEach(btn => {
    btn.addEventListener("click", () => {
      saveSingleTask(btn); 
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
    const csrf = await getCsrf();
    const res = await fetch("/update-single-task", {
      method: "POST",
  credentials: "include",
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
      body: JSON.stringify({ date, category, task, worker })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "שגיאת שרת");

    // btn.textContent = result.message || "נשמר ✔";
    showToast("נשמר ✔", 'success');
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
savemanage.addEventListener("click", async () => {
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
const csrf = await getCsrf();
  const res = await fetch("/update-shift", {
    method: "POST",
      credentials: "include",
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
    body: JSON.stringify({ date, executions })
  });

  const result = await res.json();

  shiftData.executions = shiftData.executions || { daily:[], weekly:[], monthly:[] };
  ['daily','weekly','monthly'].forEach(cat => {
    (executions[cat] || []).forEach(e => upsertLocalExecution(cat, e.task, e.worker));
  });
  updateForm.querySelectorAll('.task-body.dirty').forEach(el => el.classList.remove('dirty'));

  // saveStatus.textContent = result.message || "נשמר.";
    showToast("נשמר ✔");
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
const csrf = await getCsrf();

    const res = await fetch("/finalize-shift", {
      method: "POST",
  credentials: "include",
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.message || "שגיאת שרת");

    showToast("המשמרת נסגרה בהצלחה.")
    // document.getElementById("finalizeStatus").textContent = result.message || "המשמרת נסגרה בהצלחה.";
    updateForm.querySelectorAll("select,input[type='time'],button.save-single").forEach(el => el.disabled = true);
    savemanage.disabled = true;
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
  const createdBy = shift.createdBy;
  const team = Array.isArray(shift.team) ? shift.team.join(", ") :
               (typeof shift.team === "string" ? shift.team : "—");

  const rows = [];
  categories.forEach(cat => {
    const tasks = shift?.tasks?.[cat.key] || [];
    if (!tasks.length) return;

    // כותרת קטגוריה
    rows.push(`<h3 class="task-category">${cat.name}</h3>`);
    rows.push(`<div class="task-list">`);

    // משימות
    tasks.forEach(task => {
      const ex = getExecForTask(shift, cat.key, task);
      const worker = ex?.worker || "—";
      const ok = worker !== "—";
      rows.push(`
        <div class="task-card ${ok ? "success" : "danger"}">
          <span class="task-name">${task}</span>
          <span class="by">בוצע על ידי: <b>${worker}</b></span>
        </div>
      `);
    });

    rows.push(`</div>`);
  });

  return `
    <div class="summary-info">
      <div><strong>תאריך:</strong> ${date}</div>
      <div><strong>אחמ״ש:</strong> ${manager}</div>
      <div><strong>נוצר על ידי:</strong> ${createdBy}</div>
      <div><strong>צוות:</strong> ${team}</div>
    </div>
    <div class="tasks-section">
      ${rows.join("") || "<em>אין משימות מוגדרות.</em>"}
      <div class="legend">
        <span>✅ משימה שמולאה עם עובד</span> | 
        <span>⚠️ משימה שחסרים לה פרטים</span>
      </div>
    </div>
  `;
}

/* =========================
   הערות בזמן אמת
   ========================= */
(function () {
function escapeHtml(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/[&<>"']/g, m => ({
    '&':'&amp;',
    '<':'&lt;',
    '>':'&gt;',
    '"':'&quot;',
    "'":'&#39;'
  }[m]));
}
window.renderRuntimeNotes = function(listEl, notes) {
  const arr = Array.isArray(notes) ? notes : [];

  if (!arr.length) {
    listEl.innerHTML = `
      <li class="exec-row">
        <span class="task-name">אין הערות</span>
      </li>
    `;
    return;
  }

  listEl.innerHTML = arr.map((n, i) => `
    <li class="exec-row" data-note-id="${n.id || ''}" data-index="${i}">
      <span class="task-name">${escapeHtml(n.text)}</span>
      <span class="who-time" style='margin-left: 30px;'>
        <small>${new Date(n.time).toLocaleString('he-IL')}</small>
      </span>
      <button class="note-del-btn" style='color: black' title="מחיקה">🗑️</button>
    </li>
  `).join('');
}



  async function fetchShiftByDate(date) {
    const res = await fetch(`/get-shift?date=${encodeURIComponent(date)}`, { credentials: "include" });
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
  try {
    const shift = await fetchShiftByDate(dateInput.value);
    console.log("SHIFT מהשרת:", shift);  // ⬅️ חשוב לראות
    renderRuntimeNotes(runtimeList, shift?.runtimeNotes);
  } catch (err) {
    console.error("שגיאה בטעינת הערות:", err);
    runtimeList.innerHTML = `
      <li class="exec-row">
        <span class="task-name">שגיאה בטעינת הערות</span>
      </li>
    `;
  }
}

    addBtn?.addEventListener('click', async () => {
  if (!dateInput?.value) return alert('בחר תאריך משמרת קודם');
  const text = (noteText?.value || '').trim();
  if (!text) return noteText.focus();
const csrf = await getCsrf();

  const res = await fetch('/add-runtime-note', {
    method: 'POST',
  credentials: "include",
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
    body: JSON.stringify({
      date: dateInput.value,
      text,
      author: managerInput?.value || 'אחמ״ש'
    })
  });

  const data = await res.json();
  if (!data.ok) return alert(data.message || 'שגיאה');

  noteText.value = '';
  showToast("הערה הוספה")
  await loadRuntimeNotes();
});

runtimeList?.addEventListener('click', async (e) => {
  const btn = e.target.closest('.note-del-btn');
  if (!btn) return;

  const li   = btn.closest('li.exec-row');
  const date = dateInput?.value;
  if (!li || !date) return;

  const noteId = li.getAttribute('data-note-id');
  const index  = li.getAttribute('data-index');

  if (!confirm('למחוק את ההערה?')) return;
const csrf = await getCsrf();

  const res = await fetch('/delete-runtime-note', {
    method: 'POST',
  credentials: "include",
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
    body: JSON.stringify({
      date,
      noteId: noteId || undefined,
      index: noteId ? undefined : Number(index)
    })
  });

  const data = await res.json();
  if (!data.ok) { alert(data.message || 'שגיאה במחיקה'); return; }
  showToast("הערה הוספה")
  await loadRuntimeNotes();
});

})})();




function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("he-IL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
}
async function uploadInvoice() {
  const fileInput = document.getElementById("fileInput");
  if (!fileInput.files.length) {
    alert("חייב לבחור קובץ!");
    return;
  }

  const formData = new FormData();
  formData.append("file", fileInput.files[0]);

  const res = await fetch("/upload-invoice", {
    method: "POST",
    body: formData,
     credentials: "include"
  });

  const data = await res.json();
  console.log(data);
}


    const uploadInvoicesForm = document.getElementById('uploadInvoicesForm');
    const uploadMsg  = document.getElementById('uploadMsg');
    const filterInvoicesForm = document.getElementById('filterInvoicesForm');
    const clearInvoicesBtn   = document.getElementById('clearInvoicesFilters');
    const tbodyInvoices      = document.querySelector('#tbl .tbodyInvoices');
    const prevBtnInv    = document.getElementById('prevBtnInv');
    const nextBtnInv    = document.getElementById('nextBtnInv');
    const pageInfoInv   = document.getElementById('pageInfoInv');

    let stateinv = { date:'', supplier:'', skip:0, limit:20, total:0 };

    // ===== פונקציית CSRF =====
    async function getCsrf() {
      const res = await fetch("/csrf-token", { credentials: "include" });
      const data = await res.json();
      return data.csrfToken;
    }

    // העלאה
    uploadInvoicesForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      // uploadMsg.textContent = 'מעלה...';
      showToast('מעלה...')
      const fd = new FormData(uploadInvoicesForm);
      try {
        const csrf = await getCsrf();
const res = await fetch('/upload-invoice', { 
  method:'POST',
  credentials:'include',
  headers:{ 
    
    "CSRF-Token": csrf
  },
  body: fd 
});
        const data = await res.json();
        showToast(data.message || (data.ok ? 'הועלה' : 'שגיאה'))
        if (data.ok) {
          uploadInvoicesForm.reset();
          fileName.textContent = 'לא נבחר קובץ';
          load();
        }
      } catch (err) {
        showToast('שגיאה בהעלאה', 'error');

      }
    });

    // סינון
    filterInvoicesForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(filterInvoicesForm);
      stateinv.date = fd.get('date') || '';
      stateinv.supplier = fd.get('supplier') || '';
      stateinv.skip = 0;
      load();
    });

    clearInvoicesBtn.addEventListener('click', () => {
      filterInvoicesForm.reset();
      stateinv = { ...stateinv, date:'', supplier:'', skip:0 };
      load();
    });

    // עימוד
    prevBtnInv.addEventListener('click', () => {
      if (stateinv.skip <= 0) return;
      stateinv.skip = Math.max(0, stateinv.skip - stateinv.limit);
      load();
    });
    nextBtnInv.addEventListener('click', () => {
      if (stateinv.skip + stateinv.limit >= stateinv.total) return;
      stateinv.skip += stateinv.limit;
      load();
    });

    async function load() {
      const params = new URLSearchParams();
      if (stateinv.date) params.set('date', stateinv.date);
      if (stateinv.supplier) params.set('supplier', stateinv.supplier);
      params.set('skip', stateinv.skip);
      params.set('limit', stateinv.limit);

      const csrf = await getCsrf();
      const res = await fetch('/invoices?' + params.toString(), { 
        credentials:'include',
        headers:{ "CSRF-Token": csrf }
      });
      const data = await res.json();
      stateinv.total = data.total || 0;
if (!res.ok) {
  tbodyInvoices.innerHTML = `<tr><td colspan="5">❌ שגיאה בטעינת חשבוניות</td></tr>`;
  return;
}
      tbodyInvoices.innerHTML = (data.items || []).map(r => `
  <tr>
    <td data-label="תאריך"><span>${escapeHtml(formatDate(r.shiftDate) || '')}</span></td>
    <td data-label="ספק"><span>${escapeHtml(r.supplier || '')}</span></td>
    <td data-label="חשבונית" style='color:white;'><a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">צפייה</a></td>
    <td data-label="העלה"><span>${escapeHtml(r.uploadedBy || 'system')}</span></td>
    <td data-label="פעולות">
      <button class="InvDelete" data-id="${r._id}">מחק</button>
    </td>
  </tr>
      `).join('');



      const page = Math.floor(stateinv.skip / stateinv.limit) + 1;
      const pages = Math.max(1, Math.ceil(stateinv.total / stateinv.limit));
      pageInfoInv.textContent = `עמוד ${page} מתוך ${pages} (סה״כ ${stateinv.total})`;

      prevBtnInv.disabled = stateinv.skip <= 0;
      nextBtnInv.disabled = stateinv.skip + stateinv.limit >= stateinv.total;
tbodyInvoices.querySelectorAll("a").forEach(a => {
  a.addEventListener("click", (e) => {
    e.preventDefault();   // מבטל את הניווט הרגיל שגרם לרענון
    e.stopPropagation();  // שלא יתנגש עם אירועים אחרים
    window.open(a.href, "_blank", "noopener"); // פותח בחלון חדש
  });
});

    }


    async function delInvoice(id) {
      if (!confirm('למחוק את החשבונית?')) return;
      const csrf = await getCsrf();
      const res = await fetch('/invoice/' + encodeURIComponent(id), { 
        method:'DELETE',
        credentials:'include',
        headers:{ "CSRF-Token": csrf }
      });
      const data = await res.json();
      // alert(data.message || (data.ok ? 'נמחק' : 'שגיאה'));

      
showToast(
  data.message || (data.ok ? "נמחק" : "שגיאה"),
  data.ok ? "success" : "error"
);      if (data.ok) load();
    }
document.querySelector(".tbodyInvoices").addEventListener("click", (e) => {
  const btn = e.target.closest(".InvDelete");
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    delInvoice(btn.dataset.id);
  }
});


    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[m])); }

    // קובץ
    const fileInput = document.getElementById('fileInput');
    const fileBtn = document.getElementById('fileBtn');
    const fileName = document.getElementById('fileName');
    fileBtn.addEventListener("click", () => {
      document.getElementById('fileInput').click();
    })
    fileInput.addEventListener('change', () => {
      fileName.textContent = fileInput.files.length ? fileInput.files[0].name : 'לא נבחר קובץ';
    });

    // טעינה ראשונית
    load();


        const addForm = document.getElementById('addForm');
    const addMsg      = document.getElementById('addMsg');
    const filterForm  = document.getElementById('filterForm');
    const clearBtn    = document.getElementById('clearFilters');
    const tbodys       = document.querySelector('#tblD tbody');
    const prevBtn     = document.getElementById('prevBtn');
    const nextBtn     = document.getElementById('nextBtn');
    const pageInfo    = document.getElementById('pageInfo');
    const sumShownEl  = document.getElementById('sumShown');
    const countShownEl= document.getElementById('countShown');

    let allItems = []; // מאגר מקומי לאחר הבאה מהשרת
    let state = { date:'', q:'', skip:0, limit:20 };

    function toArr(val){ return Array.isArray(val) ? val : String(val||'').split(',').map(x=>x.trim()).filter(Boolean); }
    function formatPrice(n){ return (Number(n)||0).toLocaleString('he-IL'); }

    // ===== Create =====
    addForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      showToast("שומר...")
      const fd = new FormData(addForm);
      const body = Object.fromEntries(fd.entries());
      try {
        const res = await fetch('/dispersals', {
          method:'POST',
          headers:{'Content-Type':'application/json',"CSRF-Token": await getCsrf()},
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (data.ok) {
          // addMsg.textContent = 'נשמר ✔';
          showToast('נשמר ✔')
          addForm.reset();
          await loadAll(); // רענון נתונים
          applyFiltersAndRender();
        } else {
          addMsg.textContent = data.message || 'שגיאה בשמירה';
        }
      } catch(err){
        addMsg.textContent = 'שגיאה בשמירה';
      } finally {
        setTimeout(()=> addMsg.textContent='', 1500);
      }
    });

    // ===== Filters =====
    filterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const fd = new FormData(filterForm);
      state.date = fd.get('date') || '';
      state.q    = fd.get('q') || '';
      state.skip = 0;
      applyFiltersAndRender();
    });

    clearBtn.addEventListener('click', () => {
      filterForm.reset();
      state = { ...state, date:'', q:'', skip:0 };
      applyFiltersAndRender();
    });

    // ===== Pagination =====
    prevBtn.addEventListener('click', () => {
      if (state.skip <= 0) return;
      state.skip = Math.max(0, state.skip - state.limit);
      render(currentFiltered);
    });
    nextBtn.addEventListener('click', () => {
      if (state.skip + state.limit >= currentFiltered.length) return;
      state.skip += state.limit;
      render(currentFiltered);
    });

    // ===== Data loading & Rendering =====
async function loadAll(){
  const res = await fetch('/dispersals', { credentials:'include' });
  const data = await res.json();
  console.log("👉 נתונים מהשרת:", data);
  allItems = data.items || data || []; // תלוי במבנה החוזר
}

    let currentFiltered = [];
    function applyFiltersAndRender(){
      // סינון בצד לקוח
      currentFiltered = allItems.filter(item => {
        const byDate = state.date ? (item.shiftDate === state.date) : true;
        const q = state.q.trim();
        const byQ = !q ? true : (
          (item.taxi && item.taxi.toLowerCase().includes(q.toLowerCase()))
          // (Array.isArray(item.people) && item.people.some(p => (p||'').toLowerCase().includes(q.toLowerCase())))
        );
        return byDate && byQ;
      });
      state.skip = 0;
      render(currentFiltered);
    }

function render(list){
  const start = state.skip;
  const end   = Math.min(list.length, start + state.limit);
  const page  = list.slice(start, end);

  // סיכום
  const sum = page.reduce((acc, x) => acc + Number(x.price||0), 0);
  sumShownEl.textContent   = formatPrice(sum);
  countShownEl.textContent = page.length;

  tbodys.innerHTML = page.map(d => `
<tr>
  <td data-label="תאריך" class="nowrap">${d.shiftDate || "-"}</td>
  <td data-label="מחיר" class="nowrap">${formatPrice(d.price)} ₪</td>
  <td data-label="מונית">${d.taxi || "-"}</td>
  <td data-label="שילם">${d.payer || "-"}</td>
  <td class="nowrap">
    <button class="secondary ss" data-id="${d._id}">מחק</button>
  </td>
</tr>
  `).join('');

  // הוספת מאזינים לכפתורי מחיקה
tbodys.querySelectorAll('.ss').forEach(btn => {
  btn.addEventListener('click', async () => {
    await delDisp(btn.dataset.id);
    showToast('הפיזור נמחק בהצלחה', 'success');
  });
});


  // עימוד
  const pageIdx  = Math.floor(state.skip / state.limit) + 1;
  const pages    = Math.max(1, Math.ceil(list.length / state.limit));
  pageInfo.textContent = `עמוד ${pageIdx} מתוך ${pages} (סה״כ ${list.length})`;

  prevBtn.disabled = state.skip <= 0;
  nextBtn.disabled = state.skip + state.limit >= list.length;
}


    async function delDisp(id){
      if (!confirm('למחוק את הרשומה?')) return;
      await fetch('/dispersals/' + encodeURIComponent(id), { method:'DELETE', headers: {"CSRF-Token": await getCsrf()} });
      await loadAll();
      applyFiltersAndRender();
    }

    // Init
    (async () => {
      await loadAll();
      applyFiltersAndRender();
    })();


    document.addEventListener("DOMContentLoaded", () => {
const dateInput = document.getElementById('dateInput');
    const loadOrdersForm  = document.getElementById('loadOrdersform');
    const saveBtn   = document.getElementById('saveBtn');
    const msg       = document.getElementById('msg');
    const wrap      = document.getElementById('suppliersWrap');

    let current = null;

    // ===== פונקציית CSRF =====
    async function getCsrf() {
      const res = await fetch("/csrf-token", { credentials: "include" });
      const data = await res.json();
      return data.csrfToken;
    }

    // טען/צור טופס ליום
    loadOrdersForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const date = dateInput.value;
      if (!date) return;
      // msg.textContent = 'טוען...';
        showToast('טוען ...')

      const csrf = await getCsrf();
      const res = await fetch('/orders?date=' + encodeURIComponent(date), {
        credentials: 'include',
        headers: { "CSRF-Token": csrf }
      });
      const data = await res.json();

      if (data.ok) {
        current = data.order;
        render();
        // msg.textContent = 'נטען ✔';
        showToast('נטען ✔')
      } else {
        // msg.textContent = data.message || 'שגיאה';
        showToast(data.message || 'שגיאה')
      }
      setTimeout(()=> msg.textContent='', 1500);
    });

    function weekdayFromYMD(ymd) {
      if (!ymd) return '';
      const [y, m, d] = ymd.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.toLocaleDateString('he-IL', { weekday: 'long' });
    }

    function updateWeekdayHint() {
      const ymd = dateInput.value;
      document.getElementById('weekdayHint').textContent =
        ymd ? `(${weekdayFromYMD(ymd)})` : '';
    }
    updateWeekdayHint();
    dateInput.addEventListener('change', updateWeekdayHint);

    // שמירה
    saveBtn.addEventListener('click', async () => {
      if (!current) return;
      collectFromUI();
      // msg.textContent = 'שומר...';
      showToast('שומר...')
      const csrf = await getCsrf();
      const res = await fetch('/orders', {
        method:'POST',
        credentials: 'include',
        headers:{ 
          'Content-Type':'application/json',
          "CSRF-Token": csrf
        },
        body: JSON.stringify({ 
          date: current.date, 
          blocks: current.blocks, 
          notes: current.notes || '' 
        })
      });
      const data = await res.json();
      // msg.textContent = data.ok ? 'נשמר ✔' : (data.message || 'שגיאה בשמירה');
      showToast(data.ok ? 'נשמר ✔' : (data.message || 'שגיאה בשמירה'))
      setTimeout(()=> msg.textContent='', 1500);
    });

function render(){
  wrap.innerHTML = '';
  if (!current.blocks || !current.blocks.length) {
    const empty = document.createElement('div');
    empty.className = 'card';
    empty.innerHTML = `<p style="text-align:center;color:#666">אין ספקים ליום זה</p>`;
    wrap.appendChild(empty);
    return;
  }

  (current.blocks || []).forEach((b, bi) => {
    const card = document.createElement('div');
    card.className = 'card supplier';
    card.innerHTML = `
      <h3 style="color: white;">${escapeHtml(b.supplier)}</h3>
      <div style="overflow:auto">
        <table>
          <thead>
            <tr>
              <th>מוצר</th>
              <th>כמה יש</th>
              <th>להזמין</th>
              <th>הערות</th>
            </tr>
          </thead>
          <tbody>
            ${b.items.map((it, ii) => `
              <tr>
<td data-label="מוצר">
  <div class="product-cell">
    <span class="product-unit">(${escapeHtml(it.unit || "")})</span>

    ${it.unit ? `<span class="product-unit">(${escapeHtml(it.unit)})</span>` : ""}
  </div>
</td>
                <td data-label="כמה יש">
                  <input type="number" class="qty" min="0" step="1" value="${num(it.currentQty)}"
                    data-bi="${bi}" data-ii="${ii}" data-field="currentQty">
                </td>
                <td data-label="להזמין">
                  <input type="number" class="qty" min="0" step="1" value="${num(it.toOrderQty)}"
                    data-bi="${bi}" data-ii="${ii}" data-field="toOrderQty">
                </td>
                <td data-label="הערות">
                  <input type="text" value="${escapeAttr(it.notes||'')}"
                    data-bi="${bi}" data-ii="${ii}" placeholder="לדוגמה:" data-field="notes" style="width:100%">
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    wrap.appendChild(card);
  });

  // מאזינים לשינויים
  wrap.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', onFieldChange);
  });
}


    function onFieldChange(e){
      const bi = +e.target.dataset.bi;
      const ii = +e.target.dataset.ii;
      const field = e.target.dataset.field;
      const v = e.target.type === 'number' ? Number(e.target.value || 0) : String(e.target.value || '');
      if (current?.blocks?.[bi]?.items?.[ii]) {
        current.blocks[bi].items[ii][field] = v;
      }
    }

    function collectFromUI(){
      // כרגע רק המוצרים מתעדכנים ישירות; הערות יום אם תפעיל אותן
    }

    function num(n){ return Number(n||0); }
    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

    // ברירת מחדל: טען היום
    const today = new Date().toISOString().slice(0,10);
    dateInput.value = today;

    });


    

async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  try {
    tbody.innerHTML = "";
    const res = await fetch("/admin/users");
    const users = await res.json();
    users.forEach(user => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td data-label="תמונה">
          <img src="${user.avatar || '/icons/icon-192.png'}" alt="avatar">
        </td>
        <td data-label="שם">${user.username}</td>
        <td data-label="תפקיד">
          <select data-id="${user._id}" class="roleSelect">
            <option value="user" ${user.role === "user" ? "selected" : ""}>משתמש</option>
            <option value="admin" ${user.role === "admin" ? "selected" : ""}>אחמ"ש</option>
            <option value="manager" ${user.role === "manager" ? "selected" : ""}>מנהל</option>
          </select>
        </td>
        <td>
          <button class="saveRoleBtn" data-id="${user._id}">שמור</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

  } catch (err) {
    showToast('שגיאה בטעינה', 'error')
    console.error("Load users error:", err);
  }
}


async function updateRole(userId) {
  const select = document.querySelector(`.roleSelect[data-id="${userId}"]`);
  const newRole = select.value;

  const res = await fetch("/admin/update-role", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role: newRole })
  });

  const data = await res.json();
  if (data.ok) {
    showToast('עודכן בהצלחה', 'success')
  } else {
    showToast('עודכן בהצלחה', 'error')

  }
}
async function attachRoleEvents() {
  const buttons = document.querySelectorAll(".saveRoleBtn");

  buttons.forEach(btn => {
    btn.addEventListener("click", async () => {
      const userId = btn.dataset.id;
      const select = document.querySelector(`.roleSelect[data-id="${userId}"]`);
      const newRole = select.value;

      const csrfToken = await getCsrf();

      const res = await fetch("/admin/update-role", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "CSRF-Token": csrfToken
        },
        body: JSON.stringify({ userId, role: newRole })
      });

      const data = await res.json();
      if (data.ok) {
        showToast('עודכן בהצלחה', 'success')
      } else {
        showToast('שגיאה בעדכון!', 'error')
      }
    });
  });
}

// קריאה אחרי loadUsers
loadUsers().then(attachRoleEvents);

    const form = document.getElementById('supplierForm');
    const formTitle = document.getElementById('formTitle');
    const msg  = document.getElementById('msg');
    const tblBody = document.querySelector('#tblSu tbody');
    const itemsGrid = document.getElementById('itemsGrid');
    const addItemBtn = document.getElementById('addItem');
    const resetBtn = document.getElementById('resetForm');

    const nameEl = document.getElementById('name');
    const phoneEl = document.getElementById('phone');
    const dayEls = Array.from(document.querySelectorAll('.day'));

    let editingId = null;
    let currentList = [];

    function dayLabel(n){ return ['א׳','ב׳','ג׳','ד׳','ה׳','ו׳','ש׳'][n] || n; }

    function renderItems(items){
      itemsGrid.innerHTML = '';
      (items || []).forEach(it => addItemRow(it.name, it.unit));
      if (!items || !items.length) addItemRow('','');
    }

    function addItemRow(name = '', unit = '') {
      const row = document.createElement('div');
      row.className = 'item-row';
      row.innerHTML = `
        <input type="text" placeholder="שם מוצר" value="${escapeAttr(name)}">
        <input type="text" placeholder="יחידה" value="${escapeAttr(unit)}">
        <button type="button" class="secondary delBtn">מחק</button>
      `;
      row.querySelector('.delBtn').addEventListener('click', () => row.remove());
      itemsGrid.appendChild(row);
    }

    addItemBtn.addEventListener('click', () => addItemRow('',''));
    resetBtn.addEventListener('click', resetForm);

    function collectItems(){
      return Array.from(itemsGrid.querySelectorAll('.item-row')).map(r => {
        const [n, u] = r.querySelectorAll('input');
        return { name: n.value.trim(), unit: u.value.trim() };
      }).filter(x => x.name);
    }

    function collectDays(){ return dayEls.filter(el => el.checked).map(el => Number(el.value)); }
    function setDays(days){ dayEls.forEach(el => el.checked = Array.isArray(days) && days.includes(Number(el.value))); }

    function resetForm(){
      editingId = null;
      formTitle.textContent = 'הוסף ספק';
      nameEl.value = ''; phoneEl.value = '';
      setDays([]); renderItems([]); msg.textContent = '';
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const payload = {
        name: nameEl.value.trim(),
        phone: phoneEl.value.trim(),
        days: collectDays(),
        items: collectItems()
      };
      try {
        showToast('שומר...')
        let res;
        if (editingId) {
            const csrf = await getCsrf();
          res = await fetch('/suppliers/' + editingId, {
            method:'PUT',
            credentials: 'include', // 🔒 חשוב לאבטחה
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
            body: JSON.stringify(payload)
          });
        } else {
            const csrf = await getCsrf();

          res = await fetch('/suppliers', {
            method:'POST',
            credentials: 'include',
  headers: {
    'Content-Type':'application/json',
    "CSRF-Token": csrf
  },
            body: JSON.stringify(payload)
          });
        }
        const data = await res.json();
        if (data.ok) { showToast('נשמר ✔', 'success'); await loadSuppliers(); resetForm(); }
        else { msg.textContent = data.message || 'שגיאה בשמירה'; }
        setTimeout(()=> msg.textContent='', 1500);
      } catch { msg.textContent = 'שגיאה בשמירה'; }
    });

    async function loadSuppliers(){
      const res = await fetch('/suppliers', { credentials: 'include' });
      const data = await res.json();
      currentList = data.suppliers || [];
      renderTable();
    }

    function renderTable(){
      tblBody.innerHTML = currentList.map(s => `
        <tr>
          <td data-label="שם">${escapeHtml(s.name)}</td>
          <td data-label="טלפון">${escapeHtml(s.phone) || 'לא הוזן'}</td>
          <td data-label="ימים">${(s.days||[]).map(dayLabel).join(', ')}</td>
          <td data-label="מוצרים">${(s.items||[]).map(it => escapeHtml(it.name)).join(', ')}</td>
          <td data-label="הועלה">${escapeHtml(s.createdBy || 'לא ידוע')}</td>
          <td class="actions">
            <button class="secondary editBtn" data-id="${s._id}">ערוך</button>
            <button class="danger delBtn" data-id="${s._id}">מחק</button>
          </td>
        </tr>
      `).join('');
      // מאזינים אחרי הרינדור
      tblBody.querySelectorAll('.editBtn').forEach(btn=>{
        btn.addEventListener('click',()=>editSupplier(btn.dataset.id));
      });
      
      tblBody.querySelectorAll('.delBtn').forEach(btn=>{
        btn.addEventListener('click',()=>delSupplier(btn.dataset.id));
      });
    }
    async function editSupplier(id){
      const s = currentList.find(x => x._id === id);
      if (!s) return;
      editingId = id;
      formTitle.textContent = 'עריכת ספק';
      nameEl.value = s.name || ''; phoneEl.value = s.phone || '';
      setDays(s.days || []); renderItems(s.items || []);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function delSupplier(id){
      if (!confirm('למחוק ספק?')) return;
     await fetch(`/suppliers/${id}`, {
  method: 'DELETE',
  credentials: 'include',
  headers: {
    "CSRF-Token": await getCsrf()
  }
});

      await loadSuppliers();
    }

    function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }
    function escapeAttr(s){ return escapeHtml(s).replace(/"/g,'&quot;'); }

    // init
    resetForm(); loadSuppliers();


      const notifForm = document.getElementById("notifForm");
  notifForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const notifMessage = document.getElementById("notifMessage").value;
    const notifStatus = document.getElementById("notifStatus");
    showToast('⏳ שולח...');

    const res = await fetch("/send-notification", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "CSRF-Token": await getCsrf() },
      body: JSON.stringify({ message: notifMessage })
    });
    const data = await res.json();
    showToast(
(data.ok ? "נשלח בהצלחה!" : "שגיאה"),
  data.ok ? "success" : "error"
);
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
    const reg = await navigator.serviceWorker.register("/service-worker.js");

    showToast('📩 מבקש הרשאה...',);
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
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

    showToast('✅ התראות הופעלו בהצלחה!', 'success');
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
      showToast("🔕 התראות כובו", 'worn');
      updateBell(false);
    }
  } catch (err) {
    console.error("שגיאה בכיבוי:", err);
    showToast("❌ שגיאה בכיבוי התראות", 'error');
  }
}

function updateBell(enabled) {
  const notifIcons = document.querySelectorAll('.notifIcon');
  notifIcons.forEach(icon => {
    icon.classList.remove("fa-bell", "fa-bell-slash");
    icon.classList.add(enabled ? "fa-bell" : "fa-bell-slash");

    // אפקט קטן
    icon.classList.add("active");
    setTimeout(() => icon.classList.remove("active"), 300);
  });
}


// ===== Init =====
document.addEventListener("DOMContentLoaded", () => {
  const notifToggle = document.querySelectorAll(".notifToggle");
notifToggle.forEach(btn => {
btn.addEventListener("click", async () => {
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
    showToast("❌ חסמת התראות. כדי לאפשר שוב, עדכן בהגדרות הדפדפן.", 'error');
  }
});
})
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    currentSubscription = sub;
    updateBell(!!sub); // true אם יש מנוי, אחרת false
  } catch (err) {
    console.error("שגיאה בבדיקת subscription:", err);
    updateBell(false);
  }
});



  const daysOrder = ['sun','mon','tue','wed','thu','fri'];
  const daysHeb = {sun:'ראשון',mon:'שני',tue:'שלישי',wed:'רביעי',thu:'חמישי',fri:'שישי'};

  function setWeekText(startISO,endISO){
    const s = new Date(startISO).toLocaleDateString('he-IL');
    const e = new Date(endISO).toLocaleDateString('he-IL');
    document.getElementById('weekText').textContent = `שבוע הבא: ${s} – ${e}`;
  }

  function skPrefs(){
    const body = document.getElementById('prefsBody');
    body.innerHTML = '';
    for(let i=0;i<6;i++){
      body.innerHTML += `<tr>
        <td><div class="skeleton sk-line" style="width:120px"></div></td>
        <td><div class="skeleton sk-line" style="width:220px"></div></td>
        <td><div class="skeleton sk-line" style="width:160px"></div></td>
      </tr>`;
    }
  }

function renderPrefs(list){
  const body = document.getElementById('prefsBody');
  if(!list.length){ 
    body.innerHTML = `<div class="muted">אין הגשות עדיין</div>`; 
    return; 
  }

  body.innerHTML = list.map(row=>{
const avail = daysOrder.map(d=>{
  const a = (row.shifts?.[d]||[]).map(x=> {
    if (x === 'morning') return 'בוקר';
    if (x === 'mid') return 'אמצע';
    if (x === 'evening') return 'ערב';
    return x;
  }).join(' · ');
  return a ? `${daysHeb[d]}: ${a}` : '';
}).filter(Boolean).join(' / ');


    const notes = Object.entries(row.notes||{})
      .filter(([,v])=>v)
      .map(([d,v])=>`<li>${daysHeb[d]} – ${v}</li>`)
      .join('');

return `
  <div class="pref-card">
    <div class="username">👤 ${row.userId?.username || "—"}</div>
    <div class="field">
      <ul>${avail || '<li>—</li>'}</ul>
    </div>
    <div class="field">
      <strong>📝 הערות:</strong>
      <ul>${notes || '<li>—</li>'}</ul>
    </div>
  </div>
`;

  }).join('');
}


  function renderSchedule(sch){
    const box = document.getElementById('scheduleBox');
    box.innerHTML = '';
    daysOrder.forEach(d=>{
      const day = sch?.[daysHeb[d]] || sch?.[d] || {}; // תומך גם במפתחי עברית וגם באנגלית
      const morning = day?.בוקר || day?.morning || [];
      const evening = day?.ערב || day?.evening || [];
      box.innerHTML += `<div class="day">
        <h3>${daysHeb[d]}</h3>
        <div class="row"><div class="slot">בוקר</div><div class="names">${(morning||[]).map(n=>`<span class="pill">${n}</span>`).join('')||'<span class="muted">—</span>'}</div></div>
        <div class="row"><div class="slot">ערב</div><div class="names">${(evening||[]).map(n=>`<span class="pill">${n}</span>`).join('')||'<span class="muted">—</span>'}</div></div>
      </div>`
    });
  }

  async function loadPrefs(){
    try{
      document.getElementById('hint').textContent = 'טוען העדפות…';
      skPrefs();
      const r = await fetch('/preferences/next-week',{credentials:'include'});
      const j = await r.json();
      if(!j.ok) throw new Error(j.message||'שגיאה');
      setWeekText(j.weekStart,j.weekEnd);
      renderPrefs(j.submissions||[]);
      document.getElementById('hint').textContent = '';
      return j;
    }catch(e){
      document.getElementById('hint').textContent = '❌ שגיאה בטעינה';
      console.error(e);
      return {ok:false, submissions:[]};
    }
  }

  async function buildAI(){
    try{
      document.getElementById('btnBuild').disabled = true;
      document.getElementById('hint').textContent = 'מריץ AI…';
      const csrf = await getCsrf();
      const r = await fetch('/ai-schedule',{
        method:'POST', credentials:'include', headers:{'Content-Type':'application/json','CSRF-Token':csrf}, body: JSON.stringify({})
      });
      const j = await r.json();
      if(!j.ok){ throw new Error(j.message||'שגיאה בבניית הסידור'); }

      // יכול להגיע מחרוזת JSON או אובייקט
      let sch = j.schedule;
      if(typeof sch === 'string'){
        try{ sch = JSON.parse(sch); }catch{ /* נשאיר raw */ }
      }
      if(typeof sch === 'object'){
        renderSchedule(sch);
        document.getElementById('rawOut').textContent = JSON.stringify(sch,null,2);
      }else{
        document.getElementById('rawOut').textContent = String(j.schedule||'');
      }
      document.getElementById('hint').textContent = '✅ סידור נבנה';
    }catch(e){
      console.error(e);
      document.getElementById('hint').textContent = '❌ שגיאה בהפקה';
    }finally{
      document.getElementById('btnBuild').disabled = false;
    }
  }

  // events
  document.getElementById('btnRefresh').addEventListener('click', loadPrefs);
  document.getElementById('btnBuild').addEventListener('click', buildAI);

  // init
  loadPrefs();