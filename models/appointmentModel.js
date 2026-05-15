const db = require("../config/db");

exports.createAppointment = async ({ patient_id, doctor_id, date, time_slot, symptoms, notes }) => {
  const [result] = await db.query(
    `INSERT INTO appointments (patient_id, doctor_id, date, time_slot, symptoms, notes) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [patient_id, doctor_id, date, time_slot, symptoms, notes]
  );
  return result.insertId;
};

exports.getAppointmentsByPatient = async (patientId) => {
  const [rows] = await db.query(`
    SELECT a.*, d.name as doctor_name, d.specialization, d.photo 
    FROM appointments a 
    JOIN doctors d ON a.doctor_id = d.id 
    WHERE a.patient_id = ? 
    ORDER BY a.date DESC, a.time_slot ASC
  `, [patientId]);
  return rows;
};

exports.getAppointmentsByDoctor = async (doctorId) => {
  const [rows] = await db.query(`
    SELECT a.*, u.name as patient_name, u.phone as patient_phone 
    FROM appointments a 
    JOIN users u ON a.patient_id = u.id 
    WHERE a.doctor_id = ? 
    ORDER BY a.date DESC, a.time_slot ASC
  `, [doctorId]);
  return rows;
};

exports.getAllAppointments = async () => {
  const [rows] = await db.query(`
    SELECT a.*, u.name as patient_name, d.name as doctor_name 
    FROM appointments a 
    JOIN users u ON a.patient_id = u.id 
    JOIN doctors d ON a.doctor_id = d.id 
    ORDER BY a.date DESC
  `);
  return rows;
};

exports.updateStatus = async (id, status) => {
  await db.query("UPDATE appointments SET status = ? WHERE id = ?", [status, id]);
};

exports.getAppointmentById = async (id) => {
  const [rows] = await db.query(`
    SELECT a.*, u.name as patient_name, u.email as patient_email, d.name as doctor_name 
    FROM appointments a 
    JOIN users u ON a.patient_id = u.id 
    JOIN doctors d ON a.doctor_id = d.id 
    WHERE a.id = ?
  `, [id]);
  return rows[0];
};

exports.getTodayAppointments = async (doctorId) => {
  const [rows] = await db.query(`
    SELECT a.*, u.name as patient_name 
    FROM appointments a 
    JOIN users u ON a.patient_id = u.id 
    WHERE a.doctor_id = ? AND a.date = CURDATE() AND a.status != 'cancelled'
    ORDER BY a.time_slot ASC
  `, [doctorId]);
  return rows;
};

exports.cancelAppointment = async (id) => {
  await db.query("UPDATE appointments SET status = 'cancelled' WHERE id = ?", [id]);
};
