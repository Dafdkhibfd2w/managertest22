const mongoose = require('mongoose');

const SupplierSchema = new mongoose.Schema({
  name:  { type: String, required: true, unique: true },
  phone: { type: String, default: '' },

  // 0=א', 1=ב', 2=ג', 3=ד', 4=ה'  (אפשר להרחיב ל-5/6)
  days:  { type: [Number], default: [] },

  items: [{
    name: { type: String, required: true },
    unit: { type: String, default: '' }
  }],

  active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Supplier', SupplierSchema);
