const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({

  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  schedule: { type: Object, required: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

scheduleSchema.plugin(tenantPlugin);
module.exports = mongoose.model("Schedule", scheduleSchema);
