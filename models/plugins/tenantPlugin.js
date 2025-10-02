// models/plugins/tenantPlugin.js
const mongoose = require('mongoose');
const path = require('path');

// ❌ ישן (לא טוב): require(path.join("..","public","middlewares","tenantContext"))
// ✅ חדש (נכון):
const { getTenantId } = require(path.join(__dirname, '..', '..', 'public', 'middlewares', 'tenantContext'));

module.exports = function tenantPlugin(schema){
  // הוסף שדה tenant אם חסר
  if (!schema.path('tenant')){
    schema.add({
      tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true }
    });
  }

  function addTenantFilter(next){
    try {
      const t = getTenantId();
      if (t) {
        const q = this.getQuery();
        if (!('tenant' in q)) this.setQuery({ ...q, tenant: t });
      }
    } catch(e) { /* ignore */ }
    next();
  }

  [
    'find','findOne','count','countDocuments',
    'updateMany','updateOne','deleteMany','deleteOne',
    'findOneAndUpdate','findOneAndDelete','findOneAndRemove'
  ].forEach(h => schema.pre(h, addTenantFilter));

  schema.pre('save', function(next){
    const t = getTenantId();
    if (t && !this.tenant) this.tenant = t;
    next();
  });
};
