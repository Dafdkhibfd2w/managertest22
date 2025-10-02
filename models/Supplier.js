const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({

  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  name:  { type: String, required: true, unique: true },
  phone: { type: String, default: '' },

  // 0=א', 1=ב', 2=ג', 3=ד', 4=ה'  (אפשר להרחיב ל-5/6)
  days:  { type: [Number], default: [] },

  items: [{
    name: { type: String, required: true },
    unit: { type: String, default: '' }
  }],
  createdBy: { type: String, default: "system" },
  active: { type: Boolean, default: true }
}, { timestamps: true });

SupplierSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Supplier', SupplierSchema);
