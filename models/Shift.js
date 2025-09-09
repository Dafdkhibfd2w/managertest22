const mongoose = require("mongoose");

const ExecutionSchema = new mongoose.Schema({
  task: String,
  worker: String,
  time: String
}, { _id: false });

const ShiftSchema = new mongoose.Schema({
  date: { type: String, required: true, unique: true }, // YYYY-MM-DD
  manager: { type: String, default: "" },
  team: [String],
  tasks: {
    daily: [String],
    weekly: [String],
    monthly: [String],
  },
  executions: {
    daily: [ExecutionSchema],
    weekly: [ExecutionSchema],
    monthly: [ExecutionSchema],
  },
  notes: { type: String, default: "" },
  runtimeNotes: [{
    id: String,
    text: String,
    author: String,
    time: Date,
  }],
  closed: { type: Boolean, default: false },
  closedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model("Shift", ShiftSchema);
