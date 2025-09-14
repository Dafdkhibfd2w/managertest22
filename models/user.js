// models/User.js
const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  role: { type: String, enum: ["worker", "manager", "admin"], default: "worker" }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
