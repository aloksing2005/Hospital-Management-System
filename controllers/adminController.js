const userModel = require("../models/userModel");
const doctorModel = require("../models/doctorModel");
const appointmentModel = require("../models/appointmentModel");
const labReportModel = require("../models/labReportModel");
const db = require("../config/db");

exports.getDashboard = async (req, res) => {
  try {
    const [stats] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'patient') as total_patients,
        (SELECT COUNT(*) FROM doctors) as total_doctors,
        (SELECT COUNT(*) FROM appointments) as total_appointments,
        (SELECT COUNT(*) FROM appointments WHERE status = 'pending') as pending_appointments
    `);

    const recentAppointments = await appointmentModel.getAllAppointments();
    const doctors = await doctorModel.getAllDoctors();
    const users = await userModel.getAllUsers();

    res.render("admin/dashboard", {
      title: "Admin Dashboard - HMS",
      stats: stats[0],
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
    const [patients] = await db.query("SELECT id, name, email, phone, role, created_at FROM users WHERE role = 'patient'");
    res.render("admin/patients", { 
      title: "Patients - HMS",
      patients, 
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
    const [monthlyStats] = await db.query(`
      SELECT 
        DATE_FORMAT(created_at, '%Y-%m') as month,
        COUNT(*) as count
      FROM appointments 
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `);

    const [specializationStats] = await db.query(`
      SELECT d.specialization, COUNT(a.id) as appointments
      FROM doctors d
      LEFT JOIN appointments a ON d.id = a.doctor_id
      GROUP BY d.specialization
    `);

    const [revenueStats] = await db.query(`
      SELECT 
        d.name as doctor_name, 
        COUNT(a.id) as completed_appointments, 
        (COUNT(a.id) * d.fees) as revenue
      FROM doctors d
      LEFT JOIN appointments a ON d.id = a.doctor_id AND a.status = 'completed'
      GROUP BY d.id
      ORDER BY revenue DESC
    `);

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

exports.getAmbulances = (req, res) => {
  res.render("admin/ambulances", { user: req.session.user });
};

exports.getResources = async (req, res) => {
  try {
    const [resources] = await db.query("SELECT * FROM hospital_resources");
    res.render("admin/resources", { resources, user: req.session.user });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/admin/dashboard");
  }
};

exports.updateResource = async (req, res) => {
  try {
    const { id, change } = req.body;
    // Get current
    const [current] = await db.query("SELECT * FROM hospital_resources WHERE id = ?", [id]);
    if (current.length === 0) return res.json({ success: false });

    let newQty = current[0].available_quantity + change;
    if (newQty < 0) newQty = 0;
    if (newQty > current[0].total_quantity) newQty = current[0].total_quantity;

    await db.query("UPDATE hospital_resources SET available_quantity = ? WHERE id = ?", [newQty, id]);
    
    // Emit real-time update
    const io = req.app.get("io");
    io.emit("resource-updated-broadcast", { 
      id, 
      available_quantity: newQty, 
      total_quantity: current[0].total_quantity,
      resource_name: current[0].resource_name 
    });

    res.json({ 
      success: true, 
      new_quantity: newQty, 
      total_quantity: current[0].total_quantity,
      resource_name: current[0].resource_name
    });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
};

exports.getLabReports = async (req, res) => {
  try {
    const reports = await labReportModel.getAllReports();
    const [patients] = await db.query("SELECT id, name FROM users WHERE role = 'patient'");
    res.render("admin/lab-reports", { title: "Manage Lab Reports", reports, patients, user: req.session.user });
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

    await labReportModel.createReport({
      patient_id,
      report_name,
      test_type,
      file_path
    });

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
exports.getBloodBank = (req, res) => {
  res.render("admin/blood-bank", { user: req.session.user });
};

exports.getCommandCenter = async (req, res) => {
  try {
    const [pendingAmb] = await db.query(
      "SELECT COUNT(*) AS c FROM ambulance_requests WHERE status = 'pending'"
    );
    const [stats] = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE role = 'patient') AS patients,
        (SELECT COUNT(*) FROM appointments WHERE status = 'pending') AS pending_appts,
        (SELECT COUNT(*) FROM appointments WHERE DATE(created_at) = CURDATE()) AS appts_today
    `);
    const [patientsTop] = await db.query(`
      SELECT u.id, u.name, u.email,
        (SELECT COUNT(*) FROM appointments a WHERE a.patient_id = u.id) AS appt_n,
        (SELECT COUNT(*) FROM prescriptions p WHERE p.patient_id = u.id) AS rx_n
      FROM users u WHERE u.role = 'patient' ORDER BY appt_n DESC LIMIT 14
    `);
    res.render("admin/command-center", {
      title: "Command Center - HMS",
      user: req.session.user,
      stats: stats[0],
      pendingAmbulance: pendingAmb[0].c,
      patientsTop,
      activity: global.__HMS_ACTIVITY_LOG__ || []
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/admin/dashboard");
  }
};
