async function getCsrf() {
  const res = await fetch("/csrf-token", { credentials: "include" });
  const data = await res.json();
  return data.csrfToken;
}
const addForm = document.getElementById("addTaskForm");
function showSkeleton(elId, rows = 3) {
  const el = document.getElementById(elId);
  el.innerHTML = "";
  for (let i = 0; i < rows; i++) {
    el.innerHTML += `
      <tr class="skeleton-row">
        <td><div class="skeleton" style="width:120px;height:16px;"></div></td>
        <td class="actions">
          <div class="skeleton" style="width:60px;height:16px;display:inline-block;margin:0 4px;"></div>
          <div class="skeleton" style="width:60px;height:16px;display:inline-block;margin:0 4px;"></div>
        </td>
      </tr>
    `;
  }
}
  // טעינת משימות מהשרת
async function loadTasks() {
  // מציג שלדים
  showSkeleton("dailyTasks");
  showSkeleton("weeklyTasks");
  showSkeleton("monthlyTasks");

  try {
    const csrf = await getCsrf();
    const res = await fetch("/tasks", {headers: { "CSRF-Token": csrf }});
    const data = await res.json();
    renderTasks(data); // אחרי שהמידע חוזר מחליפים תוכן
  } catch (err) {
    console.error("❌ שגיאה בטעינת משימות:", err);
  }
}

  // הוספת משימה
  addForm.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(addForm);
    const csrf = await getCsrf();
    await fetch("/tasks", {
      method: "POST",
    headers: { "Content-Type": "application/json", "CSRF-Token": csrf },

      body: JSON.stringify(Object.fromEntries(fd))
    });
    addForm.reset();
    loadTasks();
  });

  // מחיקת משימה
  async function delTask(id) {
    if (!confirm("למחוק משימה?")) return;
    const csrf = await getCsrf();
    
    await fetch("/tasks/" + id, { method: "DELETE", headers: { "CSRF-Token": csrf }, });
    loadTasks();
  }

  // רינדור משימות לקטגוריות
  function renderTasks(tasks) {
    const daily = tasks.filter(t => t.category === "daily");
    const weekly = tasks.filter(t => t.category === "weekly");
    const monthly = tasks.filter(t => t.category === "monthly");

const renderRows = (arr, elId) => {
  document.getElementById(elId).innerHTML = arr.map(t => `
    <tr>
      <td>${t.name}</td>
      <td class="actions">
        <button 
          class="edit-btn" 
          data-id="${t._id}" 
          data-name="${t.name}" 
          data-cat="${t.category}">✏️</button>
        <button 
          class="delete-btn" 
          data-id="${t._id}">🗑️</button>
      </td>
    </tr>
  `).join("");
};


    renderRows(daily, "dailyTasks");
    renderRows(weekly, "weeklyTasks");
    renderRows(monthly, "monthlyTasks");
    bindTaskEvents();
  }
function bindTaskEvents() {
  document.querySelectorAll(".edit-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      editTask(btn.dataset.id, btn.dataset.name, btn.dataset.cat);
    });
  });

  document.querySelectorAll(".delete-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      delTask(btn.dataset.id);
    });
  });
}
async function editTask(id, oldName, oldCategory) {
  const newName = prompt("ערוך שם משימה:", oldName);
  if (!newName || newName.trim() === "" || newName === oldName) return;

  const newCategory = prompt("ערוך קטגוריה (daily/weekly/monthly):", oldCategory);
  if (!["daily","weekly","monthly"].includes(newCategory)) {
    alert("קטגוריה לא תקינה");
    return;
  }
const csrf = await getCsrf();
  await fetch(`/tasks/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "CSRF-Token": csrf },
    body: JSON.stringify({ name: newName.trim(), category: newCategory })
  });

  loadTasks();
}

  // טעינה ראשונית
  loadTasks();