// api/index.js
const app = require('../server');        // דורש את ה-app שמייצא server.js
module.exports = (req, res) => app(req, res);   // מעביר את הבקשה ל־Express
