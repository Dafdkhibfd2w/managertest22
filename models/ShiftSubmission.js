const tenantPlugin = require('./plugins/tenantPlugin');
const mongoose = require("mongoose");

const shiftSubmissionSchema = new mongoose.Schema({

  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  username: { String },
  weekStartDate: { type: Date, required: true },
  shifts: {
    sun: [String],
    mon: [String],
    tue: [String],
    wed: [String],
    thu: [String],
    fri: [String],
  },
  notes: {
    sun: String,
    mon: String,
    tue: String,
    wed: String,
    thu: String,
    fri: String,
  },
}, { timestamps: true });

shiftSubmissionSchema.index({ userId: 1, weekStartDate: 1 }, { unique: true });

shiftSubmissionSchema.plugin(tenantPlugin);
module.exports = mongoose.model("ShiftSubmission", shiftSubmissionSchema);
