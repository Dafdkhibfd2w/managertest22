const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  category: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
  name: { type: String, required: true },
});

module.exports = mongoose.model("Task", TaskSchema);