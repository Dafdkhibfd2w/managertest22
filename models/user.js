const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  username: { type: String, unique: true, sparse: true }, // אופציונלי
  email:    { type: String, unique: true, sparse: true }, // חובה להרשמה במייל
  role: { type: String, enum: ["user","manager","admin"], default: "user" },
  avatarUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
