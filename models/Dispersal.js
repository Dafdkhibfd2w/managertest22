const mongoose = require('mongoose');

const DispersalSchema = new mongoose.Schema({
  shiftDate: { type: Date, required: true },   // YYYY-MM-DD
  price:     { type: Number, required: true },   // מחיר המונית
  taxi:      { type: String, default: '' },      // שם נהג/חברה
  people:    { type: [String], default: [] },    // מי נסעו
  payer:     { type: String, default: '' },      // מי שילם
  notes:     { type: String, default: '' }
}, { timestamps: true });

module.exports = mongoose.model('Dispersal', DispersalSchema);
