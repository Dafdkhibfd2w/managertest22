const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require('mongoose');

const DispersalSchema = new mongoose.Schema({

  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  shiftDate: { type: Date, required: true },   // YYYY-MM-DD
  price:     { type: Number, required: true },   // מחיר המונית
  taxi:      { type: String, default: '' },      // שם נהג/חברה
  people:    { type: [String], default: [] },    // מי נסעו
  payer:     { type: String, default: '' },      // מי שילם
  notes:     { type: String, default: '' }
}, { timestamps: true });

DispersalSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Dispersal', DispersalSchema);
