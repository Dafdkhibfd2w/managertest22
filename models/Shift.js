const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require("mongoose");

const ExecutionSchema = new mongoose.Schema({

  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
  task:   { type: String, required: true },
  worker: { type: String, default: "" },
  time:   { type: String, default: "" },
}, { _id: false });

const RuntimeNoteSchema = new mongoose.Schema({
  id:     { type: String, required: true },
  text:   { type: String, required: true },
  author: { type: String, default: "אחמ״ש" },
  time:   { type: Date, default: Date.now }
}, { _id: false });

const ShiftSchema = new mongoose.Schema({
  date:   { type: String, required: true, unique: true }, // YYYY-MM-DD
  manager:{ type: String, default: "" },

  // 👇 נשאר מערך של מחרוזות, לא נשבר לך הדאטה הישן
  team:   { type: [String], default: [] },

  // 👇 ניקוד לכל עובד – מפתחות זה שם העובד, ערך זה מספר נקודות
scores: {
  type: Map,
  of: Number,
  default: () => new Map()
},
  tasks: {
    daily:   { type: [String], default: [] },
    weekly:  { type: [String], default: [] },
    monthly: { type: [String], default: [] },
  },

  executions: {
    daily:   { type: [ExecutionSchema], default: [] },
    weekly:  { type: [ExecutionSchema], default: [] },
    monthly: { type: [ExecutionSchema], default: [] },
  },
createdBy: { type: String, default: "" },
  notes:         { type: String, default: "" },
  runtimeNotes:  { type: [RuntimeNoteSchema], default: [] },
  closed:        { type: Boolean, default: false },
  closedAt:      { type: Date, default: null },
  closedBy:  { type: String, default: "" }, // 🟢 מי סגר
}, { timestamps: true });

ExecutionSchema.plugin(tenantPlugin);
module.exports = mongoose.model("Shift", ShiftSchema);
