// ui-enhance.js
(() => {
  // מצב סטטוס קיים – מוסיף class לפי תוכן/דאטה
  const statusEl = document.getElementById('status');
  if (statusEl) {
    const txt = statusEl.textContent || '';
    statusEl.classList.remove('default','open','closed');
    if (/סגור|closed/i.test(txt)) statusEl.classList.add('closed');
    else if (/פתוח|open/i.test(txt)) statusEl.classList.add('open');
    else statusEl.classList.add('default');
  }

  // שפר כותרות אקורדיון – הוסף חץ קטן אם חסר
  document.querySelectorAll('.task-block .task-header').forEach(h => {
    if (!h.querySelector('.chev')) {
      const chev = document.createElement('span');
      chev.className = 'chev';
      chev.textContent = '▾';
      chev.style.opacity = .7;
      h.appendChild(chev);
    }
  });

  // קישוט קל לטאבים (נשען על קלאס קיים .task-tab)
  document.querySelectorAll('.task-tab').forEach(tab => {
    tab.addEventListener('mouseenter', () => tab.style.transform = 'translateY(-1px)');
    tab.addEventListener('mouseleave', () => tab.style.transform = 'translateY(0)');
  });

  // Toast API קטן (לא פוגע בכלום)
  window.showToast = function(msg, type='good'){
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.classList.remove('error','good');
    if (type) toast.classList.add(type);
    toast.textContent = msg;
    requestAnimationFrame(() => {
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2200);
    });
  };

  // חבר כפתורים קיימים אם יש (לא מחייב, לא משנה fetch)
  const finalizeBtn = document.getElementById('finalizeBtn');
  if (finalizeBtn) {
    finalizeBtn.addEventListener('click', () => {
      // רק פידבק ויזואלי – המודל כבר מנוהל אצלך בקוד
      showToast('פותח סיכום משמרת…','good');
    });
  }

  const saveBtn = document.getElementById('saveUpdates');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      // פידבק ויזואלי לפני ה־fetch שלך שרץ בקוד קיים
      showToast('שומר שינויים…','good');
    });
  }

  // פתיחה חלקה של אקורדיון גם בלחיצה על כל בלוק (אם אין לך כבר)
  document.addEventListener('click', (e) => {
    const header = e.target.closest('.task-header');
    if (!header) return;
    const block = header.closest('.task-block');
    if (block) {
      block.classList.toggle('open');
    }
  });
})();
