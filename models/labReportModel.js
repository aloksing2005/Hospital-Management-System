const { LabReport, User } = require("../config/db");

class LabReportModel {
  static async createReport(data) {
    const { patient_id, report_name, file_path, test_type } = data;
    const report = await LabReport.create({ patient_id, report_name, file_path, test_type });
    return report._id;
  }

  static async getReportsByPatient(patientId) {
    const reports = await LabReport.find({ patient_id: patientId })
      .sort({ created_at: -1 })
      .lean();
    return reports.map(r => ({ ...r, id: r._id }));
  }

  static async getAllReports() {
    const reports = await LabReport.find()
      .populate({ path: "patient_id", select: "name" })
      .sort({ created_at: -1 })
      .lean();

    return reports.map(r => ({
      ...r,
      id: r._id,
      patient_name: r.patient_id ? r.patient_id.name : "",
      patient_id: r.patient_id ? r.patient_id._id : null
    }));
  }
}

module.exports = LabReportModel;
