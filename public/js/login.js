// /public/js/login.js
(() => {
  // מונע ריצה כפולה אם הקובץ נטען שוב בטעות
  if (window.__LOGIN_INIT__) return;
  window.__LOGIN_INIT__ = true;

  const $  = (s, el=document) => el.querySelector(s);
  const $$ = (s, el=document) => Array.from(el.querySelectorAll(s));

  // שים לב: אין פה שום const בשם הזה מחוץ ל־IIFE
  const loginForm    = $('#loginForm');
  const registerForm = $('#registerForm');

  // שדות (ייתכן שלא כל הדפים מכילים את כולם, אז משתמשים ב-?.)
  const nameEl   = $('#nameInput');
  const emailEl  = $('#emailInput');
  const passEl   = $('#passwordInput');

  // שליחת טופס התחברות
  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = (emailEl?.value || '').trim().toLowerCase();
    const password = (passEl?.value || '').trim();

    // ... הקריאה ל־/auth/login (עם credentials: "include" אם צריך)
  });

  // שליחת טופס הרשמה
  registerForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name  = (nameEl?.value || '').trim();
    const email = (emailEl?.value || '').trim().toLowerCase();
    const password = (passEl?.value || '').trim();

    // ... הקריאה ל־/auth/register
  });

  // כל פונקציות עזר/Toast/CSRF וכו' — בתוך ה-IIFE בלבד
})();
