const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['user','manager','admin'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
  avatarUrl: { type: String, default: "" }
});

module.exports = mongoose.model('User', userSchema);
