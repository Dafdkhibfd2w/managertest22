const jwt = require("jsonwebtoken");
const SECRET = process.env.JWT_SECRET || "supersecret";

function requireAuth(role) {
  return (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
      return res.redirect("/login"); // 🛑 אין טוקן → שולח ללוגין
    }

    try {
      const decoded = jwt.verify(token, SECRET);
      req.user = decoded;

      // אם יש בדיקת role ספציפי
      if (role && req.user.role !== role) {
        return res.status(403).sendFile(path.join(__dirname, "views", "unauthorized.html"));
      }

      next();
    } catch (e) {
      console.error("❌ invalid token:", e.message);
      res.clearCookie("token");
      res.redirect("/login");
    }
  };
}

module.exports = { requireAuth };
