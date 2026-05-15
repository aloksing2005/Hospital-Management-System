const reviewModel = require("../models/reviewModel");
const appointmentModel = require("../models/appointmentModel");

exports.submitReview = async (req, res) => {
  try {
    const { appointment_id, rating, review } = req.body;
    
    // Verify appointment belongs to user and is completed
    const appointment = await appointmentModel.getAppointmentById(appointment_id);
    if (!appointment || appointment.patient_id !== req.session.user.id) {
      req.flash("error", "Invalid appointment.");
      return res.redirect("/patient/appointments");
    }
    
    if (appointment.status !== 'completed') {
      req.flash("error", "You can only review completed appointments.");
      return res.redirect("/patient/appointments");
    }

    await reviewModel.addReview({
      doctor_id: appointment.doctor_id,
      patient_id: req.session.user.id,
      appointment_id,
      rating: parseInt(rating),
      review
    });

    req.flash("success", "Thank you for your review!");
    res.redirect("/patient/appointments");
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/appointments");
  }
};
