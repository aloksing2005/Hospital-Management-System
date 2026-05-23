const doctorModel = require("../models/doctorModel");
const appointmentModel = require("../models/appointmentModel");
const prescriptionModel = require("../models/prescriptionModel");
const labReportModel = require("../models/labReportModel");
const notificationModel = require("../models/notificationModel");
const billModel = require("../models/billModel");
const pharmacyModel = require("../models/pharmacyModel");
const reviewModel = require("../models/reviewModel");
const { findSpecialization, suggestMedicines, generateSlots } = require("../utils/aiEngine");
const bloodBankModel = require("../models/bloodBankModel");
const { User, Appointment, Prescription, PatientVitals, MedicineReminder } = require("../config/db");
const path = require("path");
const fs = require("fs");
const { writeHealthReportPdf } = require("../utils/healthReportPdf");
const { notifyUser } = require("../utils/notifyHelper");
const { Appointment: AppointmentModel } = require("../config/db");

exports.getDashboard = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const total_appointments = await Appointment.countDocuments({ patient_id: userId });
    const total_prescriptions = await Prescription.countDocuments({ patient_id: userId });
    const stats = { total_appointments, total_prescriptions };

    const appointments = await appointmentModel.getAppointmentsByPatient(userId);
    const prescriptions = await prescriptionModel.getPrescriptionsByPatient(userId);

    const now = new Date();
    const upcomingAppointment = await AppointmentModel.findOne({
      patient_id: userId,
      status: { $in: ["pending", "confirmed"] },
      date: { $gte: now }
    })
      .sort({ date: 1 })
      .populate("doctor_id", "name specialization")
      .lean();

    const labReports = await labReportModel.getReportsByPatient(userId);
    const bloodReport = labReports.find(
      r => (r.test_type && /blood/i.test(r.test_type)) || (r.report_name && /blood/i.test(r.report_name))
    );

    // Get latest vitals for Health Score
    const latestVitals = await PatientVitals.findOne({ patient_id: userId }).sort({ created_at: -1 }).lean();

    // Get unread notifications
    const unreadNotifications = await notificationModel.getUnreadCount(userId);

    let healthScore = 85; // Default
    if (latestVitals) {
      if (latestVitals.hr > 100 || latestVitals.hr < 60) healthScore -= 5;
      if (latestVitals.spo2 < 95) healthScore -= 10;
      if (latestVitals.bp_sys > 140 || latestVitals.bp_sys < 90) healthScore -= 5;
      if (latestVitals.temp > 100 || latestVitals.temp < 97) healthScore -= 5;
    }

    res.render("patient/dashboard", {
      stats,
      appointments: appointments.slice(0, 5),
      prescriptions: prescriptions.slice(0, 5),
      healthScore,
      unreadNotifications,
      upcomingAppointment: upcomingAppointment
        ? {
            id: upcomingAppointment._id,
            date: upcomingAppointment.date,
            time_slot: upcomingAppointment.time_slot,
            status: upcomingAppointment.status,
            doctor_name: upcomingAppointment.doctor_id?.name || "Doctor",
            specialization: upcomingAppointment.doctor_id?.specialization || ""
          }
        : null,
      hasBloodReport: !!bloodReport,
      user: req.session.user,
    });
  } catch (err) {
    console.error("Patient dashboard:", err.message);
    req.flash("error", "Dashboard error: " + err.message);
    if (err.name === "MongoServerError" || err.message.includes("connect")) {
      return res.redirect("/login");
    }
    res.render("patient/dashboard", {
      stats: { total_appointments: 0, total_prescriptions: 0 },
      appointments: [],
      prescriptions: [],
      healthScore: 85,
      unreadNotifications: 0,
      upcomingAppointment: null,
      hasBloodReport: false,
      user: req.session.user
    });
  }
};

exports.getDoctors = async (req, res) => {
  try {
    const { search, specialization, maxFees, minRating, sort } = req.query;

    const doctors = await doctorModel.searchDoctorsAdvanced({
      search,
      specialization,
      maxFees: maxFees ? parseInt(maxFees) : null,
      minRating: minRating ? parseInt(minRating) : null,
      sort
    });

    res.render("patient/doctors", {
      doctors,
      user: req.session.user,
      search,
      specialization,
      maxFees,
      minRating,
      sort
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getDoctorDetail = async (req, res) => {
  try {
    const doctor = await doctorModel.getDoctorById(req.params.id);
    if (!doctor) {
      req.flash("error", "Doctor not found");
      return res.redirect("/patient/doctors");
    }

    const slots = generateSlots(doctor.available_from, doctor.available_to, 30);
    const leaves = await doctorModel.getLeaves(doctor._id || doctor.id);
    const leaveDates = leaves.map(l => new Date(l.date).toISOString().split('T')[0]);

    res.render("patient/doctor-detail", { doctor, slots, leaveDates, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/doctors");
  }
};

exports.bookAppointment = async (req, res) => {
  try {
    const { doctor_id, date, time_slot, symptoms, notes } = req.body;

    const appointmentId = await appointmentModel.createAppointment({
      patient_id: req.session.user.id,
      doctor_id,
      date,
      time_slot,
      symptoms,
      notes
    });

    const doctor = await doctorModel.getDoctorById(doctor_id);

    const io = req.app.get("io");
    const payload = {
      appointmentId,
      doctorId: doctor_id,
      doctorUserId: doctor.user_id,
      patientId: req.session.user.id,
      patientName: req.session.user.name,
      doctorName: doctor.name,
      date,
      time_slot,
      symptoms
    };
    io.to("admins").emit("new-appointment", payload);
    if (doctor.user_id) {
      io.to(`user_${doctor.user_id}`).emit("doctor-notification", {
        type: "new_appointment",
        message: `New appointment from ${req.session.user.name}`,
        appointment: payload
      });
    }

    await notifyUser(
      io,
      req.session.user.id,
      "Appointment Booked",
      `Your appointment with Dr. ${doctor.name} on ${date} at ${time_slot} is confirmed.`,
      "success"
    );

    req.flash("success", `Appointment booked with Dr. ${doctor.name} on ${date} at ${time_slot}`);
    res.redirect("/patient/appointments");
  } catch (err) {
    req.flash("error", "Booking failed: " + err.message);
    res.redirect("/patient/doctors");
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const appointments = await appointmentModel.getAppointmentsByPatient(req.session.user.id);
    res.render("patient/appointments", { appointments, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getPrescriptions = async (req, res) => {
  try {
    const prescriptions = await prescriptionModel.getPrescriptionsByPatient(req.session.user.id);
    res.render("patient/prescriptions", { prescriptions, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getAISymptomChecker = (req, res) => {
  res.render("patient/symptom-checker", { user: req.session.user, result: null });
};

exports.postAISymptomChecker = (req, res) => {
  try {
    const { symptoms } = req.body;
    const specialization = findSpecialization(symptoms);
    const medicines = suggestMedicines(symptoms);

    res.render("patient/symptom-checker", {
      user: req.session.user,
      result: {
        symptoms,
        specialization,
        medicines,
        recommendation: specialization
          ? `We recommend consulting a ${specialization}.`
          : "Please consult a General Physician for proper diagnosis."
      }
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getChat = async (req, res) => {
  try {
    const appointments = await appointmentModel.getAppointmentsByPatient(req.session.user.id);
    res.render("patient/chat", { appointments, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.cancelAppointment = async (req, res) => {
  try {
    await appointmentModel.cancelAppointment(req.params.id);
    req.flash("success", "Appointment cancelled successfully");
    res.redirect("/patient/appointments");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/appointments");
  }
};

exports.getHistory = async (req, res) => {
  try {
    const appointments = await appointmentModel.getAppointmentsByPatient(req.session.user.id);
    const prescriptions = await prescriptionModel.getPrescriptionsByPatient(req.session.user.id);
    res.render("patient/history", { appointments, prescriptions, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getAmbulance = (req, res) => {
  res.render("patient/ambulance", { user: req.session.user });
};

exports.getLabReports = async (req, res) => {
  try {
    const reports = await labReportModel.getReportsByPatient(req.session.user.id);
    res.render("patient/lab-reports", { title: "My Lab Reports", reports, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const vitals = await PatientVitals.find({ patient_id: req.session.user.id })
      .sort({ created_at: 1 })
      .limit(50)
      .lean();

    res.render("patient/analytics", {
      vitalsHistory: vitals,
      user: req.session.user
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getReminders = async (req, res) => {
  try {
    const reminders = await MedicineReminder.find({ patient_id: req.session.user.id })
      .sort({ time: 1 })
      .lean();
    const mapped = reminders.map(r => ({ ...r, id: r._id }));
    res.render("patient/reminders", { user: req.session.user, reminders: mapped });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.postReminder = async (req, res) => {
  try {
    const { medicine_name, dosage, time } = req.body;
    await MedicineReminder.create({ patient_id: req.session.user.id, medicine_name, dosage, time });
    req.flash("success", "Reminder added successfully");
    res.redirect("/patient/reminders");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/reminders");
  }
};

exports.deleteReminder = async (req, res) => {
  try {
    await MedicineReminder.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getVitals = (req, res) => {
  res.render("patient/vitals", { title: "Live Vitals - HMS", user: req.session.user });
};

exports.downloadHealthReport = async (req, res) => {
  try {
    const uid = req.session.user.id;
    const patient = await User.findById(uid, "name email").lean();
    if (!patient) {
      req.flash("error", "Patient not found");
      return res.redirect("/patient/dashboard");
    }
    const appointments = await appointmentModel.getAppointmentsByPatient(uid);
    const prescriptions = await prescriptionModel.getPrescriptionsByPatient(uid);
    const dir = path.join(__dirname, "../public/reports");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const fname = `health_report_${uid}_${Date.now()}.pdf`;
    const outPath = path.join(dir, fname);
    await writeHealthReportPdf(
      {
        patientName: patient.name,
        patientEmail: patient.email,
        appointments,
        prescriptions
      },
      outPath
    );
    res.download(outPath, "Health_Report.pdf");
  } catch (e) {
    req.flash("error", e.message || "Could not generate report");
    res.redirect("/patient/dashboard");
  }
};

exports.getDonorRegistry = async (req, res) => {
  try {
    const donor = await bloodBankModel.getDonorByPatientId(req.session.user.id);
    res.render("patient/donor-registry", { user: req.session.user, donor });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.registerAsDonor = async (req, res) => {
  try {
    const { blood_group, organ_to_donate } = req.body;
    await bloodBankModel.registerDonor({
      patient_id: req.session.user.id,
      blood_group,
      organ_to_donate
    });
    req.flash("success", "Successfully registered as a donor. Thank you for your contribution!");
    res.redirect("/patient/donor-registry");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/donor-registry");
  }
};

exports.getWellbeing = (req, res) => {
  res.redirect("/patient/wellbeing");
};

exports.getNotifications = async (req, res) => {
  try {
    const raw = await notificationModel.getByUser(req.session.user.id);
    const notifications = raw.map(n => ({ ...n, read: n.is_read }));
    res.render("patient/notifications", { title: "My Notifications", notifications, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.markNotificationRead = async (req, res) => {
  try {
    await notificationModel.markAsRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.getBills = async (req, res) => {
  try {
    const bills = await billModel.getByPatient(req.session.user.id);
    res.render("patient/bills", { title: "My Bills", bills, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getPharmacy = async (req, res) => {
  try {
    const query = req.query.search || "";
    const raw = query ? await pharmacyModel.search(query) : await pharmacyModel.getAll();
    const medicines = raw.map(m => ({
      id: m._id || m.id,
      name: m.medicine_name,
      stock: m.stock_quantity,
      price: m.price,
      category: m.category,
      description: m.category ? `${m.category} medication` : "Hospital pharmacy stock"
    }));
    res.render("patient/pharmacy", { title: "Pharmacy Inventory", medicines, query, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.submitReview = async (req, res) => {
  try {
    const { appointment_id, doctor_id, rating, review } = req.body;
    const patientId = req.session.user.id;

    await reviewModel.addReview({
      doctor_id,
      patient_id: patientId,
      appointment_id,
      rating: parseInt(rating),
      review
    });

    req.flash("success", "Review submitted successfully");
    res.redirect("/patient/appointments");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/appointments");
  }
};
