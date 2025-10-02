const mongoose = require("mongoose");

const TenantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  meta: { type: Object, default: {} },
}, { timestamps: true });

module.exports = mongoose.model("Tenant", TenantSchema);
