const notificationModel = require("../models/notificationModel");
const { userRoom } = require("./socketRooms");

async function notifyUser(io, userId, title, message, type = "info") {
  const id = await notificationModel.create(userId, title, message, type);
  if (io && userId) {
    io.to(userRoom(String(userId))).emit("new-notification", {
      id,
      title,
      message,
      type,
      is_read: false,
      created_at: new Date()
    });
  }
  return id;
}

async function notifyAdmins(io, title, message, type = "danger") {
  const { User } = require("../config/db");
  const admins = await User.find({ role: "admin" }).select("_id").lean();
  for (const admin of admins) {
    await notifyUser(io, admin._id, title, message, type);
  }
}

module.exports = { notifyUser, notifyAdmins };
