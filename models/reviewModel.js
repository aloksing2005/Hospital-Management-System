const db = require("../config/db");

exports.addReview = async ({ doctor_id, patient_id, appointment_id, rating, review }) => {
  // Check if review already exists
  const [existing] = await db.query(
    "SELECT id FROM reviews WHERE appointment_id = ?",
    [appointment_id]
  );
  if (existing.length > 0) {
    throw new Error("You have already reviewed this appointment.");
  }

  const [result] = await db.query(
    `INSERT INTO reviews (doctor_id, patient_id, appointment_id, rating, review) 
     VALUES (?, ?, ?, ?, ?)`,
    [doctor_id, patient_id, appointment_id, rating, review]
  );
  return result.insertId;
};

exports.getDoctorReviews = async (doctorId) => {
  const [rows] = await db.query(`
    SELECT r.*, u.name as patient_name 
    FROM reviews r 
    JOIN users u ON r.patient_id = u.id 
    WHERE r.doctor_id = ? 
    ORDER BY r.created_at DESC
  `, [doctorId]);
  return rows;
};
