const db = require("../config/db");
const bcrypt = require("bcryptjs");

exports.findByEmail = async (email) => {
  const [rows] = await db.query("SELECT * FROM users WHERE email = ?", [email]);
  return rows[0];
};

exports.findById = async (id) => {
  const [rows] = await db.query("SELECT * FROM users WHERE id = ?", [id]);
  return rows[0];
};

exports.createUser = async ({ name, email, password, phone, role = "patient" }) => {
  const hashed = bcrypt.hashSync(password, 10);
  const [result] = await db.query(
    "INSERT INTO users (name, email, password, phone, role) VALUES (?, ?, ?, ?, ?)",
    [name, email, hashed, phone, role]
  );
  return result.insertId;
};

exports.updatePassword = async (id, newPassword) => {
  const hashed = bcrypt.hashSync(newPassword, 10);
  await db.query("UPDATE users SET password = ? WHERE id = ?", [hashed, id]);
};

exports.getAllUsers = async () => {
  const [rows] = await db.query("SELECT id, name, email, phone, role, created_at FROM users");
  return rows;
};

exports.deleteUser = async (id) => {
  await db.query("DELETE FROM users WHERE id = ?", [id]);
};
