const mongoose = require('mongoose');

const ItemLineSchema = new mongoose.Schema({
  name:        { type: String, required: true }, // שם המוצר (לדוגמה "טבעות בצל")
  unit:        { type: String, default: '' },    // קרטון / ארגז...
  currentQty:  { type: Number, default: 0 },     // כמה יש כרגע
  toOrderQty:  { type: Number, default: 0 },     // כמה להזמין (אופציונלי)
  notes:       { type: String, default: '' }
}, { _id: false });

const SupplierBlockSchema = new mongoose.Schema({
  supplierId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplier:    { type: String, required: true }, // שומר גם שם לקריאה מהירה
  items:       [ItemLineSchema]
}, { _id: false });

const DailyOrderSchema = new mongoose.Schema({
  date:        { type: String, required: true, unique: true }, // YYYY-MM-DD
  blocks:      [SupplierBlockSchema],                          // קבוצות לפי ספק
  notes:       { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('DailyOrder', DailyOrderSchema);
