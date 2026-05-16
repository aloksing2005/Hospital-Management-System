const db = require("../config/db");

exports.getBloodInventory = async () => {
  const [rows] = await db.query("SELECT * FROM blood_bank ORDER BY blood_group");
  return rows;
};

exports.updateBloodStock = async (bloodGroup, units) => {
  let status = 'optimal';
  if (units <= 5) status = 'critical';
  else if (units <= 15) status = 'low';

  await db.query(
    "UPDATE blood_bank SET units = ?, status = ? WHERE blood_group = ?",
    [units, status, bloodGroup]
  );
  
  const [updated] = await db.query("SELECT * FROM blood_bank WHERE blood_group = ?", [bloodGroup]);
  return updated[0];
};

exports.registerDonor = async (donorData) => {
  const { patient_id, blood_group, organ_to_donate } = donorData;
  const [result] = await db.query(
    "INSERT INTO donors (patient_id, blood_group, organ_to_donate) VALUES (?, ?, ?)",
    [patient_id, blood_group, organ_to_donate]
  );
  return result.insertId;
};

exports.getDonors = async () => {
  const [rows] = await db.query(`
    SELECT d.*, u.name as patient_name, u.email as patient_email 
    FROM donors d 
    JOIN users u ON d.patient_id = u.id 
    ORDER BY d.created_at DESC
  `);
  return rows;
};

exports.getDonorByPatientId = async (patientId) => {
  const [rows] = await db.query("SELECT * FROM donors WHERE patient_id = ?", [patientId]);
  return rows[0];
};
