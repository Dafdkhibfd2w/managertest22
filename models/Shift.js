// models/Shift.js
const mongoose = require("mongoose");

const ExecutionSchema = new mongoose.Schema({
  task: String,
  worker: String,
  time: String,
  points: { type: Number, default: 0 }
}, { _id: false });

const ShiftSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  manager: { type: String, default: "" },
  team: [{
    name: String,
    points: { type: Number, default: 0 }
  }],
  tasks: {
    daily: [String],
    weekly: [String],
    monthly: [String],
  },
  executions: {
    daily: [ExecutionSchema],
    weekly: [ExecutionSchema],
    monthly: [ExecutionSchema]
  },
  closed: { type: Boolean, default: false },
  closedAt: { type: Date }
});

module.exports = mongoose.model("Shift", ShiftSchema);
