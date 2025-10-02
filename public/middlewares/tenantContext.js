const { AsyncLocalStorage } = require('async_hooks');
const als = new AsyncLocalStorage();

function setTenantContext(tenantId){
  als.enterWith({ tenantId: tenantId ? String(tenantId) : null });
}
function getTenantId(){
  const s = als.getStore();
  return (s && s.tenantId) ? s.tenantId : null;
}

module.exports = { setTenantContext, getTenantId };