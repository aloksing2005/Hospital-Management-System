const db = require('../config/db');

class LabReportModel {
  static async createReport(data) {
    const { patient_id, report_name, file_path, test_type } = data;
    const [result] = await db.query(
      'INSERT INTO lab_reports (patient_id, report_name, file_path, test_type) VALUES (?, ?, ?, ?)',
      [patient_id, report_name, file_path, test_type]
    );
    return result.insertId;
  }

  static async getReportsByPatient(patientId) {
    const [reports] = await db.query(
      'SELECT * FROM lab_reports WHERE patient_id = ? ORDER BY created_at DESC',
      [patientId]
    );
    return reports;
  }

  static async getAllReports() {
    const [reports] = await db.query(`
      SELECT lr.*, u.name as patient_name 
      FROM lab_reports lr
      JOIN users u ON lr.patient_id = u.id
      ORDER BY lr.created_at DESC
    `);
    return reports;
  }
}

module.exports = LabReportModel;
