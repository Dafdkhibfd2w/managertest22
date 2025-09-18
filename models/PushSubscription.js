// models/PushSubscription.js
const mongoose = require("mongoose");

const PushSubscriptionSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: String,
    auth: String
  }
}, { timestamps: true });

module.exports = mongoose.model("PushSubscription", PushSubscriptionSchema);
