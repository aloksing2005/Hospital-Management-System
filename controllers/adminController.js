const userModel = require("../models/userModel");
const doctorModel = require("../models/doctorModel");
const appointmentModel = require("../models/appointmentModel");
const labReportModel = require("../models/labReportModel");
const bloodBankModel = require("../models/bloodBankModel");
const ambulanceModel = require("../models/ambulanceModel");
const { User, Doctor, Appointment, Prescription, HospitalResource, AmbulanceRequest } = require("../config/db");

exports.getDashboard = async (req, res) => {
  try {
    const total_patients = await User.countDocuments({ role: "patient" });
    const total_doctors = await Doctor.countDocuments();
    const total_appointments = await Appointment.countDocuments();
    const pending_appointments = await Appointment.countDocuments({ status: "pending" });

    const stats = { total_patients, total_doctors, total_appointments, pending_appointments };

    const recentAppointments = await appointmentModel.getAllAppointments();
    const doctors = await doctorModel.getAllDoctors();
    const users = await userModel.getAllUsers();

    res.render("admin/dashboard", {
      title: "Admin Dashboard - HMS",
      stats,
      recentAppointments: recentAppointments.slice(0, 10),
      doctors,
      users: users.filter(u => u.role !== "admin"),
      user: req.session.user
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    req.flash("error", "Dashboard error: " + err.message);
    res.redirect("/");
  }
};

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await doctorModel.getAllDoctors();
    res.render("admin/doctors", {
      title: "Manage Doctors - HMS",
      doctors,
      user: req.session.user
    });
  } catch (err) {
    console.error("Doctors error:", err);
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.getPatients = async (req, res) => {
  try {
    const patients = await User.find({ role: "patient" }, "name email phone role created_at").lean();
    const mapped = patients.map(p => ({ ...p, id: p._id }));
    res.render("admin/patients", {
      title: "Patients - HMS",
      patients: mapped,
      user: req.session.user
    });
  } catch (err) {
    console.error("Patients error:", err);
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.getAppointments = async (req, res) => {
  try {
    const appointments = await appointmentModel.getAllAppointments();
    res.render("admin/appointments", {
      title: "Appointments - HMS",
      appointments,
      user: req.session.user
    });
  } catch (err) {
    console.error("Appointments error:", err);
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.addDoctor = async (req, res) => {
  try {
    const { name, email, password, specialization, location, fees, available_from, available_to } = req.body;

    const userId = await userModel.createUser({
      name, email, password, role: "doctor"
    });

    await doctorModel.addDoctor({
      user_id: userId,
      name,
      specialization,
      location,
      photo: req.file ? `/images/${req.file.filename}` : "/images/default-doctor.jpg",
      fees: fees || 500,
      available_from: available_from || "09:00",
      available_to: available_to || "17:00"
    });

    req.flash("success", "Doctor added successfully");
    res.redirect("/admin/doctors");
  } catch (err) {
    console.error("Add doctor error:", err);
    req.flash("error", "Failed to add doctor: " + err.message);
    res.redirect("/admin/doctors");
  }
};

exports.deleteDoctor = async (req, res) => {
  try {
    await doctorModel.deleteDoctor(req.params.id);
    req.flash("success", "Doctor deleted successfully");
    res.redirect("/admin/doctors");
  } catch (err) {
    console.error("Delete doctor error:", err);
    req.flash("error", err.message);
    res.redirect("/admin/doctors");
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    await appointmentModel.updateStatus(id, status);

    const appointment = await appointmentModel.getAppointmentById(id);
    const io = req.app.get("io");
    if (appointment && appointment.patient_id) {
      io.to(`user_${appointment.patient_id}`).emit("appointment-update", {
        appointmentId: id,
        status,
        patientId: appointment.patient_id,
        doctorName: appointment.doctor_name
      });
    }
    io.to("admins").emit("admin-appointment-update", { id, status });

    req.flash("success", "Appointment status updated");
    res.redirect("/admin/appointments");
  } catch (err) {
    console.error("Update status error:", err);
    req.flash("error", err.message);
    res.redirect("/admin/appointments");
  }
};

exports.getReports = async (req, res) => {
  try {
    // Monthly appointment stats using MongoDB aggregation
    const monthlyStats = await Appointment.aggregate([
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 12 },
      { $project: { month: "$_id", count: 1, _id: 0 } }
    ]);

    // Specialization stats
    const doctors = await Doctor.find().lean();
    const specializationMap = {};
    for (const doc of doctors) {
      const spec = doc.specialization || "Other";
      const apptCount = await Appointment.countDocuments({ doctor_id: doc._id });
      specializationMap[spec] = (specializationMap[spec] || 0) + apptCount;
    }
    const specializationStats = Object.entries(specializationMap).map(([specialization, appointments]) => ({
      specialization, appointments
    }));

    // Revenue stats
    const revenueStats = [];
    for (const doc of doctors) {
      const completedCount = await Appointment.countDocuments({ doctor_id: doc._id, status: "completed" });
      revenueStats.push({
        doctor_name: doc.name,
        completed_appointments: completedCount,
        revenue: completedCount * (doc.fees || 0)
      });
    }
    revenueStats.sort((a, b) => b.revenue - a.revenue);

    res.render("admin/reports", {
      title: "Reports & Revenue - HMS",
      monthlyStats,
      specializationStats,
      revenueStats,
      user: req.session.user
    });
  } catch (err) {
    console.error("Reports error:", err);
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.getAmbulances = async (req, res) => {
  try {
    const ambulances = await ambulanceModel.getAllAmbulances();
    const requests = await ambulanceModel.getPendingRequests();
    res.render("admin/ambulances", {
      ambulances,
      requests,
      user: req.session.user
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.getResources = async (req, res) => {
  try {
    const resources = await HospitalResource.find().lean();
    const mapped = resources.map(r => ({ ...r, id: r._id }));
    res.render("admin/resources", { resources: mapped, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.updateResource = async (req, res) => {
  try {
    const { id, change } = req.body;
    const current = await HospitalResource.findById(id);
    if (!current) return res.json({ success: false });

    let newQty = current.available_quantity + change;
    if (newQty < 0) newQty = 0;
    if (newQty > current.total_quantity) newQty = current.total_quantity;

    current.available_quantity = newQty;
    current.last_updated = new Date();
    await current.save();

    // Emit real-time update
    const io = req.app.get("io");
    io.emit("resource-updated-broadcast", {
      id,
      available_quantity: newQty,
      total_quantity: current.total_quantity,
      resource_name: current.resource_name
    });

    res.json({
      success: true,
      new_quantity: newQty,
      total_quantity: current.total_quantity,
      resource_name: current.resource_name
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};

exports.getLabReports = async (req, res) => {
  try {
    const reports = await labReportModel.getAllReports();
    const patients = await User.find({ role: "patient" }, "name").lean();
    const mapped = patients.map(p => ({ ...p, id: p._id }));
    res.render("admin/lab-reports", { title: "Manage Lab Reports", reports, patients: mapped, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.uploadLabReport = async (req, res) => {
  try {
    const { patient_id, report_name, test_type } = req.body;
    const file_path = req.file ? `/images/${req.file.filename}` : null;

    if (!file_path) {
      req.flash("error", "Please upload a report file");
      return res.redirect("/admin/lab-reports");
    }

    await labReportModel.createReport({ patient_id, report_name, test_type, file_path });

    const io = req.app.get("io");
    io.to(`user_${patient_id}`).emit("new-lab-report", {
      patientId: patient_id,
      reportName: report_name,
      testType: test_type
    });

    req.flash("success", "Lab report uploaded successfully");
    res.redirect("/admin/lab-reports");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/admin/lab-reports");
  }
};

exports.getBloodBank = async (req, res) => {
  try {
    const inventory = await bloodBankModel.getBloodInventory();
    const donors = await bloodBankModel.getDonors();
    res.render("admin/blood-bank", {
      inventory,
      donors,
      user: req.session.user
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.updateBloodStock = async (req, res) => {
  try {
    const { blood_group, units } = req.body;
    const updated = await bloodBankModel.updateBloodStock(blood_group, units);

    // Emit real-time update
    const io = req.app.get("io");
    io.emit("blood-stock-updated", updated);

    res.json({ success: true, updated });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};

exports.getCommandCenter = async (req, res) => {
  try {
    const pendingAmbulance = await AmbulanceRequest.countDocuments({ status: "pending" });

    const patients = await User.countDocuments({ role: "patient" });
    const pending_appts = await Appointment.countDocuments({ status: "pending" });

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);
    const appts_today = await Appointment.countDocuments({ created_at: { $gte: startOfDay, $lte: endOfDay } });

    const stats = { patients, pending_appts, appts_today };

    // Top patients by appointment count
    const patientsTop = await User.aggregate([
      { $match: { role: "patient" } },
      {
        $lookup: {
          from: "appointments",
          localField: "_id",
          foreignField: "patient_id",
          as: "appts"
        }
      },
      {
        $lookup: {
          from: "prescriptions",
          localField: "_id",
          foreignField: "patient_id",
          as: "rxs"
        }
      },
      {
        $project: {
          name: 1,
          email: 1,
          id: "$_id",
          appt_n: { $size: "$appts" },
          rx_n: { $size: "$rxs" }
        }
      },
      { $sort: { appt_n: -1 } },
      { $limit: 14 }
    ]);

    res.render("admin/command-center", {
      title: "Command Center - HMS",
      user: req.session.user,
      stats,
      pendingAmbulance,
      patientsTop,
      activity: global.__HMS_ACTIVITY_LOG__ || []
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/admin/dashboard");
  }
};
