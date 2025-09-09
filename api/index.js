const app = require('../server');

module.exports = (req, res) => {
  // מסיר את /api מהנתיב כדי שראוטים כמו "/invoices" יתאימו
  if (req.url.startsWith('/api')) {
    req.url = req.url.replace(/^\/api/, '');
  }
  return app(req, res);
};