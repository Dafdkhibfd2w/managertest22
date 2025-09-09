// api/index.js
const app = require('../server');

module.exports = (req, res) => {
  const before = req.url;
  // מסירים את הפרפיקס /api כדי להתאים לראוטים ב-server.js
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  const after = req.url;
  console.log(`[VERCEL API] ${req.method} before="${before}" -> after="${after}"`);
  // כותרת עוזרת באבחון
  res.setHeader('x-debug-api-before', before);
  res.setHeader('x-debug-api-after', after);
  return app(req, res);
};
