// ========== admin.js ==========
const loadForm = document.getElementById("loadForm");
const updateForm = document.getElementById("updateForm");
const shiftSection = document.getElementById("shiftSection");
const saveBtn = document.getElementById("saveUpdates");
const saveStatus = document.getElementById("saveStatus");
const searchInput = document.getElementById("searchInput");
const shiftsList = document.getElementById("shiftsList");

let shifts = [];

// ---------- טעינת משמרת לפי תאריך ----------
loadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const date = new FormData(loadForm).get("date");
  const res = await fetch(`/api/get-shift?date=${encodeURIComponent(date)}`);
  const shift = await res.json();

  // אם לא נמצאה משמרת – הצג הודעה ונקה רשימת הערות
  if (!shift) {
    updateForm.innerHTML = "לא נמצאה משמרת עבור התאריך הזה.";
    shiftSection.style.display = "block";
    saveBtn.style.display = "none";
    // נקה/הצג שאין הערות
    renderAdminRuntimeNotes({ runtimeNotes: [] });
    return;
  }

  // נירמול צוות
  if (typeof shift.team === "string") {
    shift.team = shift.team.split(",").map((name) => name.trim()).filter(Boolean);
  }
  if (!Array.isArray(shift.team)) shift.team = [];

  // ודאו שתמיד יש runtimeNotes מהשרת (גיבוי בצד לקוח ליתר ביטחון)
  if (!Array.isArray(shift.runtimeNotes)) shift.runtimeNotes = [];

  // בניית הטופס למשימות
  updateForm.innerHTML = "";
  const categories = [
    { name: "משימות יומיות", key: "daily" },
    { name: "משימות שבועיות", key: "weekly" },
    { name: "משימות חודשיות", key: "monthly" }
  ];

  categories.forEach(cat => {
    const list = shift.tasks?.[cat.key] || [];
    if (!list.length) return;

    updateForm.innerHTML += `<h3>${cat.name}</h3>`;

    list.forEach((task, index) => {
      const teamOptions = (shift.team || [])
        .map(name => `<option value="${name}">${name}</option>`)
        .join("");

      updateForm.innerHTML += `
        <div class="task-block">
          <p><strong>משימה:</strong> ${escapeHtml(task)}</p>
          <label>בוצע על ידי:
            <select name="worker-${cat.key}-${index}" required>
              <option value="">בחר עובד</option>
              ${teamOptions}
            </select>
          </label>
          <label>שעה:
            <input type="time" name="time-${cat.key}-${index}" required>
          </label>
          <hr>
        </div>
      `;
    });
  });

  // שמירת תאריך לעריכה
  updateForm.dataset.date = date;

  // <<< חשוב: אחרי שה־DOM נבנה וה־UL של ההערות קיים בעמוד >>>
  renderAdminRuntimeNotes(shift);

  // הצגת כלים
  saveBtn.style.display = "inline-block";
  shiftSection.style.display = "block";
});

// ---------- שמירת עדכוני ביצוע ----------
saveBtn.addEventListener("click", async () => {
  const formData = new FormData(updateForm);
  const date = updateForm.dataset.date;
  const updates = [];

  for (let [key, value] of formData.entries()) {
    const [field, cat, index] = key.split("-");
    const idx = `${cat}-${index}`;
    if (!updates[idx]) updates[idx] = {};
    updates[idx][field] = value;
  }

  const cleaned = Object.values(updates);
  const res = await fetch("/api/update-shift", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, updates: cleaned })
  });

  const result = await res.json();
  saveStatus.textContent = result.message || "נשמר";
});

// ---------- טעינת כל המשמרות לרשימה ----------
async function fetchAllShifts() {
  const res = await fetch("/api/all-shifts");
  shifts = await res.json();
  renderShifts(shifts);
}

function renderShifts(shiftsToRender) {
  shiftsList.innerHTML = "";
  shiftsToRender.forEach(shift => {
    const team = Array.isArray(shift.team)
      ? shift.team
      : typeof shift.team === 'string'
        ? shift.team.split(',').map(x => x.trim()).filter(Boolean)
        : [];

    const leadName =
      shift.manager ??
      (Array.isArray(shift.team) && shift.team.length ? shift.team[0] :
       (typeof shift.team === 'string' ? shift.team.split(',')[0]?.trim() : ''));

    const div = document.createElement("div");
    div.className = "shift-item";
    div.innerHTML = `
      <strong>תאריך:</strong> ${escapeHtml(shift.date || "")}<br>
      <strong>צוות:</strong> ${team.map(escapeHtml).join(', ')}<br>
      <strong>אחמ״ש:</strong> ${escapeHtml(leadName || '—')}
      <button onclick='viewShift(${JSON.stringify(shift.date)})'>צפה בפרטים</button>
    `;
    shiftsList.appendChild(div);
  });
}

function searchByName(name) {
  const filtered = shifts.filter(s => {
    const teamArray = Array.isArray(s.team)
      ? s.team
      : typeof s.team === "string"
        ? s.team.split(",").map(x => x.trim())
        : [];
    return teamArray.some(member => member.includes(name));
  });
  renderShifts(filtered);
}

function viewShift(date) {
  document.querySelector("input[name='date']").value = date;
  loadForm.dispatchEvent(new Event("submit"));
}

document.addEventListener("DOMContentLoaded", fetchAllShifts);
searchInput.addEventListener("input", e => searchByName(e.target.value));

// ---------- רנדר הערות Runtime ב־Admin ----------
(function(){
  function escape(s){ return String(s).replace(/[&<>"']/g, m=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[m])); }
  window.escapeHtml = window.escapeHtml || escape;

  window.renderAdminRuntimeNotes = function(shift) {
    const listEl = document.getElementById('runtimeNotesListAdmin');
    if (!listEl) return; // אם ה-UL עוד לא בעמוד

    const arr = Array.isArray(shift?.runtimeNotes) ? shift.runtimeNotes : [];
    listEl.innerHTML = arr.length
      ? arr.map(n => `
          <li class="exec-row">
            <span class="task-name">${escape(n.text)}</span>
            <span class="who-time">
              <small>${escape(n.author || 'אחמ״ש')}</small>
              <small>${new Date(n.time).toLocaleString('he-IL')}</small>
            </span>
          </li>
        `).join('')
      : '<li class="exec-row"><span class="task-name">אין הערות</span></li>';
  };
})();
