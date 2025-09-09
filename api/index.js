const app = require('../server');

module.exports = (req, res) => {
  // מסיר /api מתחילת הנתיב, כדי שהראוטים שלך /save-shift, /orders וכו' יתאימו
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  return app(req, res);
};