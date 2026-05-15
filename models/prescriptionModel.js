const db = require("../config/db");

exports.createPrescription = async ({ appointment_id, doctor_id, patient_id, disease, medicines, file_path }) => {
  const [result] = await db.query(
    `INSERT INTO prescriptions (appointment_id, doctor_id, patient_id, disease, medicines, file_path) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [appointment_id, doctor_id, patient_id, disease, medicines, file_path]
  );
  return result.insertId;
};

exports.getPrescriptionsByPatient = async (patientId) => {
  const [rows] = await db.query(`
    SELECT p.*, d.name as doctor_name, a.date as appointment_date 
    FROM prescriptions p 
    JOIN doctors d ON p.doctor_id = d.id 
    JOIN appointments a ON p.appointment_id = a.id 
    WHERE p.patient_id = ? 
    ORDER BY p.created_at DESC
  `, [patientId]);
  return rows;
};

exports.getPrescriptionsByDoctor = async (doctorId) => {
  const [rows] = await db.query(`
    SELECT p.*, u.name as patient_name 
    FROM prescriptions p 
    JOIN users u ON p.patient_id = u.id 
    WHERE p.doctor_id = ? 
    ORDER BY p.created_at DESC
  `, [doctorId]);
  return rows;
};

exports.getPrescriptionById = async (id) => {
  const [rows] = await db.query("SELECT * FROM prescriptions WHERE id = ?", [id]);
  return rows[0];
};
