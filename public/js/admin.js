let allShifts = [];
function escapeHtml(s) {
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

function chip(text) {
  return `<div class="chip"><span class="dot"></span>${text}</div>`;
}

function renderShifts(shifts) {
  const container = document.getElementById("shiftsContainer");
  container.innerHTML = "";
  container.style.display = "grid"; // <<< חובה אם התחלת ב-none


shifts.forEach(shift => {
  const dayName = getDayName(shift.date);
  const teamArr = normalizeTeam(shift.team);
  const leadName = shift.manager ?? (teamArr[0] || "");
  const closed = shift.closed ? "סגור" : "פתוח";

  const card = document.createElement("div");
  card.className = "shift-card";
  card.innerHTML = 
`
    <div class="shift-date">
${shift.date}${dayName ? ` (${dayName})` : ""}
    </div>
    <div class="shift-details">
      <p>צוות: ${teamArr.length ? teamArr.join(", ") : "—"}</p>
      <p>אחמ״ש: ${leadName || "—"}</p>
    </div>
    <div class="status">סטטוס: ${closed}</div>
    <div class="actions">
      <button style="padding: 8px 14px;border: none;border-radius: 8px;background: var(--accent);cursor: pointer;font-weight: 600;transition: 0.2s;" class="edit-btn" type="button" data-date="${shift.date}">הצג / ערוך</button>
    </div>`;
  container.appendChild(card);
});
}


async function loadShifts() {
  const loading = document.getElementById("loadingShifts");
  const container = document.getElementById("shiftsContainer");

  try {
    loading.style.display = "block";
    container.style.display = "none";

    const res = await fetch("/get-all-shifts", { credentials: "include" });
    allShifts = await res.json();

    loading.style.display = "none";
    container.style.display = "block";

    renderShifts(allShifts);

  } catch (err) {
    loading.innerHTML = `<p style="color:red;">שגיאה בטעינת משמרות</p>`;
    console.error("Load error:", err);
  }
}

function filterShifts() {
  const date = document.getElementById("filterDate").value;
  if (!date) return renderShifts(allShifts);
  renderShifts(allShifts.filter(s => s.date === date));
}
function renderAdminEditRows(shift) {
  const wrap = document.getElementById("editRows");
  wrap.innerHTML = "";

  const teamArr = normalizeTeam(shift.team);
  const tasks = shift.tasks || { daily: [], weekly: [], monthly: [] };
  const execs = shift.executions || { daily: [], weekly: [], monthly: [] };

  const CATS = [
    { key: "daily", title: "משימות יומיות" },
    { key: "weekly", title: "משימות שבועיות" },
    { key: "monthly", title: "משימות חודשיות" },
  ];

  CATS.forEach(cat => {
    const list = Array.isArray(tasks[cat.key]) ? tasks[cat.key] : [];
    if (!list.length) return;

    // כותרת קטגוריה
    const title = document.createElement("h3");
    title.className = "cat-title";
    title.textContent = cat.title;
    wrap.appendChild(title);

    list.forEach((task, i) => {
      const ex = (execs[cat.key] || []).find(e => e.task === task) || {};

      const card = document.createElement("div");
      card.className = "task-card";

      card.innerHTML = `
        <div class="name">${task}</div>
        <div>
          <select name="worker-${cat.key}-${i}">
            <option value="">בחר עובד</option>
            ${teamArr.map(n => `<option value="${n}" ${ex.worker === n ? "selected" : ""}>${n}</option>`).join("")}
          </select>
        </div>

        <input type="hidden" name="task-${cat.key}-${i}" value="${task}">
      `;

      wrap.appendChild(card);
    });
  });
}

function searchByName() {
  const name = document.getElementById("searchName").value.trim();
  if (!name) return renderShifts(allShifts);
  const filtered = allShifts.filter(s => normalizeTeam(s.team).some(m => m.includes(name)));
  renderShifts(filtered);
}

function resetFilters() {
  document.getElementById("filterDate").value = "";
  document.getElementById("searchName").value = "";
  renderShifts(allShifts);
}

async function openEdit(date) {
  const res = await fetch(`/get-shift?date=${date}`, { credentials: "include" });
  const shift = await res.json();
  if (!shift) return;

  document.getElementById("editDate").value = shift.date;
  document.getElementById("editManager").value = shift.manager || "";
  document.getElementById("editTeam").value = normalizeTeam(shift.team).join(", ");
  document.getElementById("editNotes").value = shift.notes || "";

  // 🟢 משימות
  renderAdminEditRows(shift);

  // 🟢 הערות במהלך המשמרת
  if (!Array.isArray(shift.runtimeNotes)) shift.runtimeNotes = [];
  renderAdminRuntimeNotes(shift);

  const modal = document.getElementById("editModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");

  modal.onclick = (e) => { if (e.target === modal) closeEdit(); };
  document.addEventListener("keydown", escCloseOnce);
}

function renderAdminRuntimeNotes(shift) {
  const listEl = document.getElementById("runtimeNotesListAdmin");
  if (!listEl) return;

  const arr = Array.isArray(shift?.runtimeNotes) ? shift.runtimeNotes : [];
  listEl.innerHTML = arr.length
    ? arr.map(n => `
        <li class="exec-row">
          <span class="task-name">${escapeHtml(n.text)}</span>
          <span class="who-time">
            <small>${escapeHtml(n.author || "אחמ״ש")}</small>
            <small>${new Date(n.time).toLocaleString("he-IL")}</small>
          </span>
        </li>
      `).join("")
    : '<li class="exec-row"><span class="task-name">אין הערות</span></li>';
}

function closeEdit() {
  document.getElementById("editModal").style.display = "none";
}

async function saveEdit() {
  const date    = document.getElementById("editDate").value;
  const manager = document.getElementById("editManager").value.trim();
  const teamStr = document.getElementById("editTeam").value.trim();
  const notes   = document.getElementById("editNotes").value.trim();

  // 1) שמירת צוות / הערות כלליות
  await fetch("/admin-update-shift", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "CSRF-Token": await getCsrf() },
    body: JSON.stringify({ date, manager, team: teamStr, notes })
  });

  // 2) איסוף ביצועי משימות
  const form = document.getElementById("editForm");
  const data = new FormData(form);
  const executions = { daily: [], weekly: [], monthly: [] };
  const byIdx = {};

  for (const [k, v] of data.entries()) {
    const m = k.match(/(task|worker|time)-(daily|weekly|monthly)-(\d+)/);
    if (!m) continue;
    const [, field, cat, i] = m;
    byIdx[cat] = byIdx[cat] || {};
    byIdx[cat][i] = byIdx[cat][i] || { task: "", worker: "", time: "" };
    if (field === "task")   byIdx[cat][i].task = v;
    if (field === "worker") byIdx[cat][i].worker = v;
    if (field === "time")   byIdx[cat][i].time = v;
  }

  ["daily","weekly","monthly"].forEach(cat => {
    if (!byIdx[cat]) return;
    executions[cat] = Object.values(byIdx[cat]);
  });

  // 3) שליחה לשרת
  const res = await fetch("/update-shift", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", "CSRF-Token": await getCsrf() },
    body: JSON.stringify({ date, executions })
  });

  const result = await res.json();
  const status = document.getElementById("editStatus");
  // status.textContent = result?.message || (res.ok ? "נשמר בהצלחה ✅" : "שגיאה בשמירה");
  showToast(result?.message || (res.ok ? "נשמר בהצלחה ✅" : "שגיאה בשמירה"));

  await loadShifts();
  closeEdit();
}


document.addEventListener("DOMContentLoaded", async () => {
  await loadShifts();

  document.getElementById("btnFilterDate")?.addEventListener("click", filterShifts);
  document.getElementById("btnSearchName")?.addEventListener("click", searchByName);
  document.getElementById("btnResetFilters")?.addEventListener("click", resetFilters);
  document.getElementById("btnSaveEdit")?.addEventListener("click", saveEdit);
  document.getElementById("btnCloseEdit")?.addEventListener("click", closeEdit);

  // שליחת התראה
  const notifForm = document.getElementById("notifForm");
  notifForm?.addEventListener("submit", async e => {
    e.preventDefault();
    const notifMessage = document.getElementById("notifMessage").value;
    const notifStatus = document.getElementById("notifStatus");
    // notifStatus.textContent = "⏳ שולח...";
    showToast('⏳ שולח...');

    const res = await fetch("/send-notification", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json", "CSRF-Token": await getCsrf() },
      body: JSON.stringify({ message: notifMessage })
    });

    const data = await res.json();
    // notifStatus.textContent = data.ok ? "✅ נשלח בהצלחה!" : "❌ שגיאה בשליחה";
    showToast(data.ok ? "נשלח בהצלחה!" : "שגיאה בשליחה");

  });
});


    document.addEventListener("DOMContentLoaded", () => {
      const buttons = document.querySelectorAll(".sidebar button, .bottom-nav .nav-item");
      const pages = document.querySelectorAll(".admin-pages section");

      buttons.forEach(btn => {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const target = btn.getAttribute("data-page");

          // עדכון אקטיב
          buttons.forEach(b => b.classList.remove("active"));
          btn.classList.add("active");

          // החלפת עמוד
          pages.forEach(sec => {
            sec.classList.remove("active");
            if (sec.id === `page-${target}`) sec.classList.add("active");
          });
        });
      });

      // דמו התראות
      document.getElementById("notifForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const msg = document.getElementById("notifMessage").value;
        document.getElementById("notifStatus").textContent = "✅ נשלחה הודעה: " + msg;
        document.getElementById("notifMessage").value = "";
      });
    });


    async function loadUsers() {
  const res = await fetch("/admin/users");
  const users = await res.json();

  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML = "";

  users.forEach(user => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td data-label="תמונה"><img src="${user.avatar || '/icons/icon-192.png'}" alt="avatar"></td>
      <td data-label="שם">${user.username}</td>
      <td>
        <select data-label="תפקיד" data-id="${user._id}" class="roleSelect">
          <option value="employee" ${user.role === "employee" ? "selected" : ""}>עובד</option>
          <option value="shiftManager" ${user.role === "shiftManager" ? "selected" : ""}>אחמ״ש</option>
          <option value="admin" ${user.role === "admin" ? "selected" : ""}>מנהל</option>
        </select>
      </td>
      <td>
 <button class="saveRoleBtn" data-id="${user._id}">שמור</button>

      </td>
    `;
    tbody.appendChild(tr);
  });
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
    alert("✅ עודכן בהצלחה!");
  } else {
    alert("❌ שגיאה בעדכון!");
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
        showToast('עודכן בהצלחה')
      } else {
        showToast('שגיאה בעדכון!', {type: 'error'})
      }
    });
  });
}

// קריאה אחרי loadUsers
loadUsers().then(attachRoleEvents);