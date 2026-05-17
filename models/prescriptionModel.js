const { Prescription, Doctor, Appointment, User } = require("../config/db");

exports.createPrescription = async ({ appointment_id, doctor_id, patient_id, disease, medicines, file_path }) => {
  const rx = await Prescription.create({ appointment_id, doctor_id, patient_id, disease, medicines, file_path });
  return rx._id;
};

exports.getPrescriptionsByPatient = async (patientId) => {
  const rows = await Prescription.find({ patient_id: patientId })
    .populate({ path: "doctor_id", select: "name" })
    .populate({ path: "appointment_id", select: "date" })
    .sort({ created_at: -1 })
    .lean();

  return rows.map(p => ({
    ...p,
    id: p._id,
    doctor_name: p.doctor_id ? p.doctor_id.name : "",
    appointment_date: p.appointment_id ? p.appointment_id.date : null,
    doctor_id: p.doctor_id ? p.doctor_id._id : null,
    appointment_id: p.appointment_id ? p.appointment_id._id : null
  }));
};

exports.getPrescriptionsByDoctor = async (doctorId) => {
  const rows = await Prescription.find({ doctor_id: doctorId })
    .populate({ path: "patient_id", select: "name" })
    .sort({ created_at: -1 })
    .lean();

  return rows.map(p => ({
    ...p,
    id: p._id,
    patient_name: p.patient_id ? p.patient_id.name : "",
    patient_id: p.patient_id ? p.patient_id._id : null
  }));
};

exports.getPrescriptionById = async (id) => {
  const p = await Prescription.findById(id).lean();
  if (p) p.id = p._id;
  return p;
};
