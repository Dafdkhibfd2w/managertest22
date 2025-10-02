// REPLACE your existing models/user.js with this content (backup first)
const mongoose = require('mongoose');

const TenantRole = { OWNER:'owner', ADMIN:'admin', MEMBER:'member' };

const MembershipSchema = new mongoose.Schema({
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', index: true },
  role: { type: String, enum: Object.values(TenantRole), default: TenantRole.MEMBER }
}, { _id:false });

const UserSchema = new mongoose.Schema({
  name: { type: String, trim: true, default: "" },
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  passwordHash: { type: String, required: true },
  tenants: { type: [MembershipSchema], default: [] },
  activeTenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', default: null },
  // any other existing fields...
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
module.exports.TenantRole = TenantRole;
