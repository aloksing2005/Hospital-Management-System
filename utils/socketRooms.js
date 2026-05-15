/**
 * Centralized Socket.IO room names for role/user targeting.
 */
function userRoom(userId) {
  return `user_${userId}`;
}

module.exports = {
  userRoom,
  ADMINS: "admins",
  DOCTORS: "doctors",
  PATIENTS: "patients",
  DRIVERS: "drivers"
};
