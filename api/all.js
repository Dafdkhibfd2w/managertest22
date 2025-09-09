// api/[...all].js
const app = require('../server');

module.exports = (req, res) => {
  const before = req.url;
  // מסיר את הפרפיקס /api כדי שראוטים כמו /save-shift יתאימו ל-Express
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  console.log(`[VERCEL API] ${req.method} ${before} -> ${req.url}`);
  return app(req, res);
};
