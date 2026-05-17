const { Appointment, Doctor, User } = require("../config/db");

exports.createAppointment = async ({ patient_id, doctor_id, date, time_slot, symptoms, notes }) => {
  const appt = await Appointment.create({ patient_id, doctor_id, date, time_slot, symptoms, notes });
  return appt._id;
};

exports.getAppointmentsByPatient = async (patientId) => {
  const rows = await Appointment.find({ patient_id: patientId })
    .populate({ path: "doctor_id", select: "name specialization photo" })
    .sort({ date: -1, time_slot: 1 })
    .lean();

  return rows.map(a => ({
    ...a,
    id: a._id,
    doctor_name: a.doctor_id ? a.doctor_id.name : "",
    specialization: a.doctor_id ? a.doctor_id.specialization : "",
    photo: a.doctor_id ? a.doctor_id.photo : "",
    doctor_id: a.doctor_id ? a.doctor_id._id : null
  }));
};

exports.getAppointmentsByDoctor = async (doctorId) => {
  const rows = await Appointment.find({ doctor_id: doctorId })
    .populate({ path: "patient_id", select: "name phone" })
    .sort({ date: -1, time_slot: 1 })
    .lean();

  return rows.map(a => ({
    ...a,
    id: a._id,
    patient_name: a.patient_id ? a.patient_id.name : "",
    patient_phone: a.patient_id ? a.patient_id.phone : "",
    patient_id: a.patient_id ? a.patient_id._id : null
  }));
};

exports.getAllAppointments = async () => {
  const rows = await Appointment.find()
    .populate({ path: "patient_id", select: "name" })
    .populate({ path: "doctor_id", select: "name" })
    .sort({ date: -1 })
    .lean();

  return rows.map(a => ({
    ...a,
    id: a._id,
    patient_name: a.patient_id ? a.patient_id.name : "",
    doctor_name: a.doctor_id ? a.doctor_id.name : "",
    patient_id: a.patient_id ? a.patient_id._id : null,
    doctor_id: a.doctor_id ? a.doctor_id._id : null
  }));
};

exports.updateStatus = async (id, status) => {
  await Appointment.findByIdAndUpdate(id, { status });
};

exports.getAppointmentById = async (id) => {
  const a = await Appointment.findById(id)
    .populate({ path: "patient_id", select: "name email" })
    .populate({ path: "doctor_id", select: "name" })
    .lean();

  if (!a) return null;
  return {
    ...a,
    id: a._id,
    patient_name: a.patient_id ? a.patient_id.name : "",
    patient_email: a.patient_id ? a.patient_id.email : "",
    doctor_name: a.doctor_id ? a.doctor_id.name : "",
    patient_id: a.patient_id ? a.patient_id._id : null,
    doctor_id: a.doctor_id ? a.doctor_id._id : null
  };
};

exports.getTodayAppointments = async (doctorId) => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const rows = await Appointment.find({
    doctor_id: doctorId,
    date: { $gte: startOfDay, $lte: endOfDay },
    status: { $ne: "cancelled" }
  })
    .populate({ path: "patient_id", select: "name" })
    .sort({ time_slot: 1 })
    .lean();

  return rows.map(a => ({
    ...a,
    id: a._id,
    patient_name: a.patient_id ? a.patient_id.name : "",
    patient_id: a.patient_id ? a.patient_id._id : null
  }));
};

exports.cancelAppointment = async (id) => {
  await Appointment.findByIdAndUpdate(id, { status: "cancelled" });
};
