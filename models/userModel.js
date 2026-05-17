const { User } = require("../config/db");
const bcrypt = require("bcryptjs");

exports.findByEmail = async (email) => {
  return await User.findOne({ email });
};

exports.findById = async (id) => {
  return await User.findById(id);
};

exports.createUser = async ({ name, email, password, phone, role = "patient" }) => {
  const hashed = bcrypt.hashSync(password, 10);
  const user = await User.create({ name, email, password: hashed, phone, role });
  return user._id;
};

exports.updatePassword = async (id, newPassword) => {
  const hashed = bcrypt.hashSync(newPassword, 10);
  await User.findByIdAndUpdate(id, { password: hashed });
};

exports.getAllUsers = async () => {
  return await User.find({}, "name email phone role created_at");
};

exports.deleteUser = async (id) => {
  await User.findByIdAndDelete(id);
};
