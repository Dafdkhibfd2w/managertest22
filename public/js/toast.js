(function () {
  function pickIcon(type) {
    switch (type) {
      case "success": return "✅";
      case "info": return "ℹ️";
      case "warn": return "⚠️";
      case "error": return "⛔";
      default: return "🔔";
    }
  }

  window.showToast = function (msg, opts = {}) {
    const { type = "info", duration = 3000, icon = pickIcon(type) } = opts;
    const root = document.getElementById("toast-root");
    if (!root) {
      console.error("❌ חסר div עם id=toast-root ב־HTML!");
      return;
    }

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${icon}</span>
      <span style="flex:1">${msg}</span>
      <button style="background:none;border:0;color:#fff;cursor:pointer">✖</button>
    `;

    const close = () => {
      toast.classList.add("hide");
      setTimeout(() => toast.remove(), 300);
    };

    toast.querySelector("button").addEventListener("click", close);
    root.appendChild(toast);

    setTimeout(close, duration);
  };
})();
