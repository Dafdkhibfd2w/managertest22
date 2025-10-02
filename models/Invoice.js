const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require('mongoose');

const InvoiceSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  shiftDate:   { type: Date, required: true }, // YYYY-MM-DD
  supplier:    { type: String, required: true }, // שם ספק
  url:         { type: String, required: true }, // secure_url מ-Cloudinary
  publicId:    { type: String, required: true }, // למחיקה ב-Cloudinary
  resourceType:{ type: String, required: true }, // image | raw (ל-PDF)
  format:      { type: String },
  bytes:       { type: Number },
  width:       { type: Number },
  height:      { type: Number },
  originalName:{ type: String },
  uploadedBy:  { type: String, default: 'אחמ״ש' },
}, { timestamps: true });

InvoiceSchema.index({ shiftDate: 1, supplier: 1, createdAt: -1 });

InvoiceSchema.plugin(tenantPlugin);
module.exports = mongoose.model('Invoice', InvoiceSchema);
