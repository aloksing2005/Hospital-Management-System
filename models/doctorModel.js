const { Doctor, Review, DoctorLeave } = require("../config/db");

exports.getAllDoctors = async () => {
  const doctors = await Doctor.find({ status: "active" }).populate("user_id", "email").lean();
  // Attach rating info
  for (let doc of doctors) {
    const reviews = await Review.find({ doctor_id: doc._id });
    doc.email = doc.user_id ? doc.user_id.email : "";
    doc.user_id = doc.user_id ? doc.user_id._id : null;
    doc.review_count = reviews.length;
    doc.rating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    // Provide 'id' alias for template compatibility
    doc.id = doc._id;
  }
  return doctors;
};

exports.getDoctorById = async (id) => {
  const doc = await Doctor.findById(id).populate("user_id", "email").lean();
  if (!doc) return null;
  const reviews = await Review.find({ doctor_id: doc._id });
  doc.email = doc.user_id ? doc.user_id.email : "";
  doc.user_id = doc.user_id ? doc.user_id._id : null;
  doc.review_count = reviews.length;
  doc.rating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  doc.id = doc._id;
  return doc;
};

exports.findByUserId = async (userId) => {
  const doc = await Doctor.findOne({ user_id: userId }).lean();
  if (doc) doc.id = doc._id;
  return doc;
};

exports.addDoctor = async ({ user_id, name, specialization, location, photo, fees, available_from, available_to }) => {
  const doc = await Doctor.create({ user_id, name, specialization, location, photo, fees, available_from, available_to });
  return doc._id;
};

exports.updateDoctor = async (id, { name, specialization, location, photo, fees, available_from, available_to }) => {
  await Doctor.findByIdAndUpdate(id, { name, specialization, location, photo, fees, available_from, available_to });
};

exports.updateDoctorProfile = async (user_id, data) => {
  const { name, specialization, location, photo, available_from, available_to } = data;
  const updateData = { name, specialization, location, available_from, available_to };
  if (photo) updateData.photo = photo;
  await Doctor.findOneAndUpdate({ user_id }, updateData);
};

exports.deleteDoctor = async (id) => {
  await Doctor.findByIdAndDelete(id);
};

exports.searchDoctors = async (keyword) => {
  const regex = new RegExp(keyword, "i");
  const doctors = await Doctor.find({
    $or: [{ name: regex }, { specialization: regex }]
  }).populate("user_id", "email").lean();

  for (let doc of doctors) {
    const reviews = await Review.find({ doctor_id: doc._id });
    doc.email = doc.user_id ? doc.user_id.email : "";
    doc.user_id = doc.user_id ? doc.user_id._id : null;
    doc.review_count = reviews.length;
    doc.rating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    doc.id = doc._id;
  }
  return doctors;
};

exports.searchBySpecialization = async (specialization) => {
  const regex = new RegExp(specialization, "i");
  const doctors = await Doctor.find({ specialization: regex, status: "active" }).populate("user_id", "email").lean();

  for (let doc of doctors) {
    const reviews = await Review.find({ doctor_id: doc._id });
    doc.email = doc.user_id ? doc.user_id.email : "";
    doc.user_id = doc.user_id ? doc.user_id._id : null;
    doc.review_count = reviews.length;
    doc.rating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    doc.id = doc._id;
  }
  return doctors;
};

exports.searchDoctorsAdvanced = async ({ search, specialization, maxFees, minRating, sort }) => {
  const filter = { status: "active" };

  if (search) {
    const regex = new RegExp(search, "i");
    filter.$or = [{ name: regex }, { specialization: regex }];
  }
  if (specialization) {
    filter.specialization = new RegExp(specialization, "i");
  }
  if (maxFees) {
    filter.fees = { $lte: maxFees };
  }

  let sortObj = { name: 1 };
  if (sort === "lowest_fees") sortObj = { fees: 1 };

  let doctors = await Doctor.find(filter).populate("user_id", "email").sort(sortObj).lean();

  // Attach ratings
  for (let doc of doctors) {
    const reviews = await Review.find({ doctor_id: doc._id });
    doc.email = doc.user_id ? doc.user_id.email : "";
    doc.user_id = doc.user_id ? doc.user_id._id : null;
    doc.review_count = reviews.length;
    doc.rating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
    doc.id = doc._id;
  }

  // Post-filter by minRating (can't do in Mongo query since rating is computed)
  if (minRating) {
    doctors = doctors.filter(d => d.rating >= minRating);
  }

  // Sort by top_rated after computing ratings
  if (sort === "top_rated") {
    doctors.sort((a, b) => b.rating - a.rating);
  }

  return doctors;
};

exports.getDoctorStats = async (doctorId) => {
  const { Appointment } = require("../config/db");
  const total_appointments = await Appointment.countDocuments({ doctor_id: doctorId });
  const pending = await Appointment.countDocuments({ doctor_id: doctorId, status: "pending" });
  const confirmed = await Appointment.countDocuments({ doctor_id: doctorId, status: "confirmed" });
  const completed = await Appointment.countDocuments({ doctor_id: doctorId, status: "completed" });
  return { total_appointments, pending, confirmed, completed };
};

exports.getLeaves = async (doctorId) => {
  const leaves = await DoctorLeave.find({ doctor_id: doctorId }).sort({ date: -1 }).lean();
  return leaves.map(l => ({ ...l, id: l._id }));
};

exports.addLeave = async (doctorId, date) => {
  const leave = await DoctorLeave.create({ doctor_id: doctorId, date });
  return leave._id;
};

exports.removeLeave = async (leaveId) => {
  await DoctorLeave.findByIdAndDelete(leaveId);
};
