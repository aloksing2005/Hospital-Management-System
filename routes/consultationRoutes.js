const express = require("express");
const router = express.Router();
const appointmentModel = require("../models/appointmentModel");

// Middleware to check if user is logged in
const checkAuth = (req, res, next) => {
  if (req.session.user) return next();
  res.redirect("/login");
};

router.get("/:id", checkAuth, async (req, res) => {
  try {
    const appointmentId = req.params.id;
    const appointment = await appointmentModel.getAppointmentById(appointmentId);
    
    if (!appointment) {
      req.flash("error", "Appointment not found.");
      return res.redirect("/");
    }

    // Check if the current user is either the doctor or the patient of this appointment
    const userId = req.session.user.id;
    const userRole = req.session.user.role;
    
    let hasAccess = false;
    if (userRole === "patient" && appointment.patient_id === userId) hasAccess = true;
    // For doctor, session.user.id is the user id, appointment.doctor_id is the doctor table id.
    // We should fetch doctor table id, but we can just assume if role is doctor, they click from their dashboard where they have access.
    // Better check:
    if (userRole === "doctor") {
      const doctorModel = require("../models/doctorModel");
      const docProfile = await doctorModel.findByUserId(userId);
      if (docProfile && docProfile.id === appointment.doctor_id) hasAccess = true;
    }

    if (!hasAccess && userRole !== "admin") {
      req.flash("error", "Unauthorized to join this consultation.");
      return res.redirect("/");
    }

    // Optional: check if the appointment date and time is near (e.g. today).
    // For demo purposes, we will just allow it.

    res.render("consultation", { appointmentId });
  } catch (err) {
    console.error(err);
    res.redirect("/");
  }
});

module.exports = router;
