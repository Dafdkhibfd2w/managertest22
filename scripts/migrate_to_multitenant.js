require("dotenv").config();
const mongoose = require("mongoose");
const Tenant = require("../models/Tenant");
const User = require("../models/user");
const Invoice = require("../models/Invoice");
const Supplier = require("../models/Supplier");
const Task = require("../models/Task");
const Shift = require("../models/Shift");
const ShiftSubmission = require("../models/ShiftSubmission");
const Dispersal = require("../models/Dispersal");
const DailyOrder = require("../models/DailyOrder");
const Schedule = require("../models/Schedule");
let PushSubscription = null;
try { PushSubscription = require("../models/PushSubscription"); } catch {}

const TENANT_NAME = process.env.TENANT_NAME || "Default Branch";
const OWNER_EMAIL = (process.env.ADMIN_EMAIL_OWNER||"").toLowerCase();

async function run(){
  if(!process.env.MONGODB_URI) throw new Error("MONGODB_URI missing");
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected.");

  let tenant = await Tenant.findOne({ name: TENANT_NAME });
  if(!tenant){
    tenant = await Tenant.create({ name: TENANT_NAME });
    console.log("Tenant created:", tenant._id.toString());
  } else {
    console.log("Tenant exists:", tenant._id.toString());
  }

  const users = await User.find({});
  for (const u of users){
    u.tenants = u.tenants || [];
    const has = u.tenants.some(m => String(m.tenant) === String(tenant._id));
    if(!has){
      const role = OWNER_EMAIL && u.email?.toLowerCase() === OWNER_EMAIL ? "owner" : "member";
      u.tenants.push({ tenant: tenant._id, role });
      if (role === "owner") tenant.owner = u._id;
    }
    if(!u.activeTenant) u.activeTenant = tenant._id;
    await u.save();
  }
  if (tenant.isModified()) await tenant.save();
  console.log("Users linked.");

  async function backfill(Model, name){
    const res = await Model.updateMany(
      { $or: [{ tenant: { $exists:false } }, { tenant: null }] },
      { $set: { tenant: tenant._id } }
    );
    console.log(name, "backfilled:", res.modifiedCount || res.nModified || 0);
  }

  await backfill(Invoice, "Invoice");
  await backfill(Supplier, "Supplier");
  await backfill(Task, "Task");
  await backfill(Shift, "Shift");
  await backfill(ShiftSubmission, "ShiftSubmission");
  await backfill(Dispersal, "Dispersal");
  await backfill(DailyOrder, "DailyOrder");
  await backfill(Schedule, "Schedule");
  if (PushSubscription) await backfill(PushSubscription, "PushSubscription");

  await mongoose.disconnect();
  console.log("Done.");
}

run().catch(e => { console.error(e); process.exit(1); });
