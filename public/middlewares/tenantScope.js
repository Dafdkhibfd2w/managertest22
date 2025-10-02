// Helper to enforce tenant scoping in controllers
function scopeQuery(req, extra={}){
  return Object.assign({ tenant: req.user.activeTenant }, extra);
}
function scopeDoc(req, doc){
  if (!doc.tenant) doc.tenant = req.user.activeTenant;
  return doc;
}
module.exports = { scopeQuery, scopeDoc };
