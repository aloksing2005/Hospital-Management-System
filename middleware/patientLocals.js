const notificationModel = require("../models/notificationModel");

/** Safe defaults for all patient EJS views (sidebar badge, etc.) */
async function attachPatientLocals(req, res, next) {
  res.locals.unreadNotifications = 0;
  if (!req.session?.user || req.session.user.role !== "patient") {
    return next();
  }
  try {
    res.locals.unreadNotifications = await notificationModel.getUnreadCount(req.session.user.id);
  } catch (e) {
    console.error("patientLocals:", e.message);
  }
  next();
}

module.exports = attachPatientLocals;
