const doctorModel = require("../models/doctorModel");
const appointmentModel = require("../models/appointmentModel");
const prescriptionModel = require("../models/prescriptionModel");
const { generateSlots } = require("../utils/aiEngine");
const generatePrescription = require("../utils/generatePrescription");
const path = require("path");

exports.getDashboard = async (req, res) => {
  try {
    const doctor = await doctorModel.findByUserId(req.session.user.id);
    if (!doctor) {
      req.flash("error", "Doctor profile not found");
      return res.redirect("/doctor/profile");
    }

    const stats = await doctorModel.getDoctorStats(doctor.id);
    const todayAppointments = await appointmentModel.getTodayAppointments(doctor.id);
    const recentAppointments = await appointmentModel.getAppointmentsByDoctor(doctor.id);
    const prescriptions = await prescriptionModel.getPrescriptionsByDoctor(doctor.id);

    res.render("doctor/dashboard", {
      doctor,
      stats,
      todayAppointments,
      recentAppointments: recentAppointments.slice(0, 10),
      prescriptions: prescriptions.slice(0, 5),
      user: req.session.user
    });
  } catch (err) {
    req.flash("error", "Dashboard error: " + err.message);
    res.redirect("/doctor/dashboard");
  }
};

exports.getProfile = async (req, res) => {
  try {
    const doctor = await doctorModel.findByUserId(req.session.user.id);
    const leaves = await doctorModel.getLeaves(doctor.id);
    res.render("doctor/profile", { doctor, leaves, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/doctor/dashboard");
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, specialization, location, available_from, available_to, fees } = req.body;
    const photo = req.file ? `/images/${req.file.filename}` : undefined;

    await doctorModel.updateDoctorProfile(req.session.user.id, {
      name,
      specialization,
      location,
      photo,
      available_from,
      available_to,
      fees
    });

    req.flash("success", "Profile updated successfully");
    res.redirect("/doctor/profile");
  } catch (err) {
    req.flash("error", "Update failed: " + err.message);
    res.redirect("/doctor/profile");
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const doctor = await doctorModel.findByUserId(req.session.user.id);
    const appointments = await appointmentModel.getAppointmentsByDoctor(doctor.id);
    res.render("doctor/appointments", { appointments, doctor, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/doctor/dashboard");
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await appointmentModel.updateStatus(id, status);

    const appointment = await appointmentModel.getAppointmentById(id);

    const io = req.app.get("io");
    io.to(`user_${appointment.patient_id}`).emit("appointment-update", {
      appointmentId: id,
      status,
      patientId: appointment.patient_id,
      doctorName: appointment.doctor_name
    });
    io.to("admins").emit("admin-appointment-update", {
      id,
      status,
      patientName: appointment.patient_name
    });

    req.flash("success", `Appointment ${status}`);
    res.redirect("/doctor/appointments");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/doctor/appointments");
  }
};

exports.getPrescriptionForm = async (req, res) => {
  try {
    const appointment = await appointmentModel.getAppointmentById(req.params.id);
    res.render("doctor/prescription", { appointment, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/doctor/appointments");
  }
};

exports.savePrescription = async (req, res) => {
  try {
    const { appointmentId, patientName, disease, medicines } = req.body;
    const medicineList = medicines ? medicines.split(",").map(m => m.trim()).filter(Boolean) : [];

    const appointment = await appointmentModel.getAppointmentById(appointmentId);
    const doctor = await doctorModel.findByUserId(req.session.user.id);

    const fileName = `prescription_${Date.now()}.pdf`;
    const filePath = path.join(__dirname, "../public/prescriptions/", fileName);

    await generatePrescription({
      doctorName: doctor.name,
      address: doctor.location || "City Hospital",
      date: new Date().toLocaleDateString(),
      patientName: patientName || appointment.patient_name,
      disease,
      medicines: medicineList,
      photo: doctor.photo
    }, filePath);

    await prescriptionModel.createPrescription({
      appointment_id: appointmentId,
      doctor_id: doctor.id,
      patient_id: appointment.patient_id,
      disease,
      medicines: medicineList.join(", "),
      file_path: `/prescriptions/${fileName}`
    });

    const io = req.app.get("io");
    io.to(`user_${appointment.patient_id}`).emit("new-prescription", {
      patientId: appointment.patient_id,
      doctorName: doctor.name,
      filePath: `/prescriptions/${fileName}`
    });

    req.flash("success", "Prescription generated successfully");
    res.redirect("/doctor/appointments");
  } catch (err) {
    req.flash("error", "Prescription failed: " + err.message);
    res.redirect("/doctor/appointments");
  }
};

exports.getChat = async (req, res) => {
  try {
    const doctor = await doctorModel.findByUserId(req.session.user.id);
    const appointments = await appointmentModel.getAppointmentsByDoctor(doctor.id);
    res.render("doctor/chat", { appointments, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/doctor/dashboard");
  }
};

exports.addLeave = async (req, res) => {
  try {
    const doctor = await doctorModel.findByUserId(req.session.user.id);
    const { leave_date } = req.body;
    await doctorModel.addLeave(doctor.id, leave_date);
    req.flash("success", "Leave marked successfully.");
    res.redirect("/doctor/profile");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/doctor/profile");
  }
};

exports.removeLeave = async (req, res) => {
  try {
    await doctorModel.removeLeave(req.params.id);
    req.flash("success", "Leave removed.");
    res.redirect("/doctor/profile");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/doctor/profile");
  }
};
