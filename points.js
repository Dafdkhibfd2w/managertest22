// services/points.js
const Shift = require("./models/Shift")

async function addPoints(shiftDate, workerName, amount = 1) {
  const shift = await Shift.findOne({ date: shiftDate });
  if (!shift) throw new Error("Shift not found");

  // חפש או צור את העובד
  let member = shift.team.find(m => m.name === workerName);
  if (!member) {
    member = { name: workerName, points: 0 };
    shift.team.push(member);
  }
  member.points += amount;

  await shift.save();
  return member.points;
}

module.exports = { addPoints };
