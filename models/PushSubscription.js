// models/PushSubscription.js
const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require("mongoose");

const PushSubscriptionSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: String,
    auth: String
  }
}, { timestamps: true });

PushSubscriptionSchema.plugin(tenantPlugin);
module.exports = mongoose.model("PushSubscription", PushSubscriptionSchema);
