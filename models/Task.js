const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  category: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
  name: { type: String, required: true },
});

TaskSchema.plugin(tenantPlugin);
module.exports = mongoose.model("Task", TaskSchema);
