// Ensures the request has an authenticated user and an active tenant
const { verifyAccess } = require("../utils/jwt"); // adjust if your jwt utils live elsewhere
const User = require("../models/user");

async function requireTenant(req, res, next){
  try{
    // get token from Auth header or cookie
    let token = null;
    const auth = req.headers.authorization || "";
    if (auth.startsWith("Bearer ")) token = auth.slice(7);
    if (!token && req.cookies?.access) token = req.cookies.access;
    if (!token) return res.status(401).json({ ok:false, message:"חסרה הרשאה" });

    const payload = verifyAccess(token);
    const user = await User.findById(payload.uid);
    if(!user) return res.status(401).json({ ok:false, message:"משתמש לא קיים" });

    if(!user.activeTenant){
      return res.status(400).json({ ok:false, message:"לא נבחר עסק פעיל" });
    }

    req.user = { id: user._id.toString(), activeTenant: user.activeTenant.toString() };
    next();
  }catch(err){
    return res.status(401).json({ ok:false, message:"אסימון לא תקף" });
  }
}

module.exports = { requireTenant };
