// ================== ברירות מחדל למשימות ==================
const defaultTasks = {
  daily: [
    "ניקיון עמדות",
    "סידור קופה",
    "שטיפת רצפה",
    "בדיקת מלאי שתייה",
  ],
  weekly: [
    "ניקוי מקררים",
    "ספירת מלאי",
    "שטיפת חלונות",
  ],
  monthly: [
    "תחזוקת ציוד",
    "בדיקת כיבוי אש",
    "ניקוי יסודי של המטבח",
  ],
};

// ================== Render Checkboxes ==================
function renderCheckboxes(listId, tasks) {
  const container = document.getElementById(listId);
  if (!container) return;
  container.innerHTML = tasks
    .map(
      (t) => `
      <label class="task-item">
        <input type="checkbox" name="${listId}" value="${t}">
        <span>${t}</span>
      </label>
    `
    )
    .join("");
}

function getChecked(listId) {
  const boxes = document.querySelectorAll(`input[name="${listId}"]:checked`);
  return Array.from(boxes).map((b) => b.value.trim()).filter(Boolean);
}

// ================== Toggle Panels (Accordion) ==================
function setupPickerToggles() {
  document.querySelectorAll(".picker-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.key; // daily/weekly/monthly
      const panel = document.getElementById(`${key}Panel`);
      const expanded = btn.getAttribute("aria-expanded") === "true";
      btn.setAttribute("aria-expanded", String(!expanded));
      btn.querySelector(".chev").textContent = expanded ? "▾" : "▴";
      if (expanded) {
        panel.setAttribute("hidden", "");
      } else {
        panel.removeAttribute("hidden");
      }
    });
  });
}




// ================== Init ==================
document.addEventListener("DOMContentLoaded", () => {
  // רנדר צ׳קבוקסים
  renderCheckboxes("dailyList", defaultTasks.daily);
  renderCheckboxes("weeklyList", defaultTasks.weekly);
  renderCheckboxes("monthlyList", defaultTasks.monthly);

  // פתיחה/סגירה של תיבות
  setupPickerToggles();
});

// ================== Submit ==================
document.getElementById("shiftForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const formData = new FormData(e.target);

  const team = (formData.get("team") || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);

  const data = {
    date: formData.get("date"),
    team,
    
    manager: formData.get("manager") || "",
tasks: {
  daily: getChecked("dailyList"),
  weekly: getChecked("weeklyList"),
  monthly: getChecked("monthlyList"),
},
notes: formData.get("notes") || "",
  };

  const res = await fetch("/save-shift", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  const result = await res.json();
  document.getElementById("status").textContent = result.message || "נשמר";

  // איפוס עדין: אחרי reset נחזיר את ברירות המחדל מסומנות
  e.target.reset();
  renderCheckboxes("dailyList", defaultTasks.daily);
  renderCheckboxes("weeklyList", defaultTasks.weekly);
  renderCheckboxes("monthlyList", defaultTasks.monthly);
});
