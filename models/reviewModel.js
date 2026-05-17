const { Review, User } = require("../config/db");

exports.addReview = async ({ doctor_id, patient_id, appointment_id, rating, review }) => {
  // Check if review already exists
  const existing = await Review.findOne({ appointment_id });
  if (existing) {
    throw new Error("You have already reviewed this appointment.");
  }

  const rev = await Review.create({ doctor_id, patient_id, appointment_id, rating, review });
  return rev._id;
};

exports.getDoctorReviews = async (doctorId) => {
  const rows = await Review.find({ doctor_id: doctorId })
    .populate({ path: "patient_id", select: "name" })
    .sort({ created_at: -1 })
    .lean();

  return rows.map(r => ({
    ...r,
    id: r._id,
    patient_name: r.patient_id ? r.patient_id.name : "",
    patient_id: r.patient_id ? r.patient_id._id : null
  }));
};
