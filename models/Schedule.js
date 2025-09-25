const mongoose = require("mongoose");

const scheduleSchema = new mongoose.Schema({
  schedule: { type: Object, required: true },
  weekStart: { type: Date, required: true },
  weekEnd: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Schedule", scheduleSchema);