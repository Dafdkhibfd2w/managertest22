const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
// --- multi-tenant fields ---
  tenants: {
    type: [{
      tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
      role: { type: String, enum: ['owner','admin','member'], default: 'member' }
    }],
    default: []
  },
  activeTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },

  username: { type: String, unique: true, sparse: true }, // אופציונלי
  email:    { type: String, unique: true, sparse: true }, // חובה להרשמה במייל
  role: { type: String, enum: ["user","manager","admin"], default: "user" },
  avatarUrl: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
