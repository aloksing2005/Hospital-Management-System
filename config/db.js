const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

// ─── Mongoose Connection ───────────────────────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/hospital_db";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch(err => {
    console.error("❌ MongoDB connection failed:", err.message);
    console.error("Please check your MONGO_URI in .env");
  });

// ─── Schema Definitions ────────────────────────────────────────────────────────

// --- Users ---
const userSchema = new mongoose.Schema({
  name:     { type: String, required: true, maxlength: 100 },
  email:    { type: String, required: true, unique: true, maxlength: 100 },
  password: { type: String, required: true },
  phone:    { type: String, default: null, maxlength: 20 },
  role:     { type: String, enum: ["admin", "doctor", "patient", "driver"], default: "patient" }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

userSchema.index({ role: 1 });

// --- Doctors ---
const doctorSchema = new mongoose.Schema({
  user_id:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name:           { type: String, required: true, maxlength: 100 },
  specialization: { type: String, maxlength: 100 },
  location:       { type: String, maxlength: 200 },
  photo:          { type: String, maxlength: 255 },
  fees:           { type: Number, default: 0 },
  available_from: { type: String },
  available_to:   { type: String },
  status:         { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: false });

doctorSchema.index({ user_id: 1 });
doctorSchema.index({ specialization: 1 });
doctorSchema.index({ status: 1 });

// --- Appointments ---
const appointmentSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  doctor_id:  { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  date:       { type: Date },
  time_slot:  { type: String, maxlength: 50 },
  status:     { type: String, enum: ["pending", "confirmed", "completed", "cancelled"], default: "pending" },
  symptoms:   { type: String },
  notes:      { type: String }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

appointmentSchema.index({ patient_id: 1 });
appointmentSchema.index({ doctor_id: 1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ date: 1 });

// --- Prescriptions ---
const prescriptionSchema = new mongoose.Schema({
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
  doctor_id:      { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  patient_id:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  disease:        { type: String, maxlength: 100 },
  medicines:      { type: String },
  file_path:      { type: String, maxlength: 255 }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

prescriptionSchema.index({ patient_id: 1 });
prescriptionSchema.index({ doctor_id: 1 });

// --- Payments ---
const paymentSchema = new mongoose.Schema({
  patient_id:          { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  appointment_id:      { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
  amount:              { type: Number },
  razorpay_order_id:   { type: String, maxlength: 100 },
  razorpay_payment_id: { type: String, maxlength: 100 },
  status:              { type: String, enum: ["pending", "success", "failed"], default: "pending" }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

paymentSchema.index({ razorpay_order_id: 1 });

// --- Messages ---
const messageSchema = new mongoose.Schema({
  sender_id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  receiver_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  message:     { type: String }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

// --- Reviews ---
const reviewSchema = new mongoose.Schema({
  doctor_id:      { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  patient_id:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  appointment_id: { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
  rating:         { type: Number, min: 1, max: 5 },
  review:         { type: String }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

reviewSchema.index({ doctor_id: 1 });
reviewSchema.index({ appointment_id: 1 });

// --- Doctor Leaves ---
const doctorLeaveSchema = new mongoose.Schema({
  doctor_id: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  date:      { type: Date }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

doctorLeaveSchema.index({ doctor_id: 1 });

// --- Lab Reports ---
const labReportSchema = new mongoose.Schema({
  patient_id:  { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  report_name: { type: String, maxlength: 255 },
  test_type:   { type: String, maxlength: 100 },
  file_path:   { type: String, maxlength: 255 }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

labReportSchema.index({ patient_id: 1 });

// --- Medicine Reminders ---
const medicineReminderSchema = new mongoose.Schema({
  patient_id:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  medicine_name: { type: String, maxlength: 255 },
  dosage:        { type: String, maxlength: 100 },
  time:          { type: String },
  status:        { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

medicineReminderSchema.index({ patient_id: 1 });

// --- Blood Bank ---
const bloodBankSchema = new mongoose.Schema({
  blood_group:  { type: String, unique: true, required: true, maxlength: 10 },
  units:        { type: Number, default: 0 },
  status:       { type: String, enum: ["low", "optimal", "critical"], default: "optimal" },
  last_updated: { type: Date, default: Date.now }
}, { timestamps: false });

// --- Donors ---
const donorSchema = new mongoose.Schema({
  patient_id:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  blood_group:     { type: String, maxlength: 10 },
  organ_to_donate: { type: String, maxlength: 100 },
  status:          { type: String, enum: ["active", "inactive"], default: "active" }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

donorSchema.index({ patient_id: 1 });

// --- Hospital Resources ---
const hospitalResourceSchema = new mongoose.Schema({
  resource_name:      { type: String, unique: true, required: true, maxlength: 255 },
  total_quantity:     { type: Number, default: 0 },
  available_quantity: { type: Number, default: 0 },
  last_updated:       { type: Date, default: Date.now }
}, { timestamps: false });

// --- Patient Vitals ---
const patientVitalsSchema = new mongoose.Schema({
  patient_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  hr:         { type: Number },
  spo2:       { type: Number },
  bp_sys:     { type: Number },
  bp_dia:     { type: Number },
  temp:       { type: Number }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

patientVitalsSchema.index({ patient_id: 1 });

// --- Notifications ---
const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title:   { type: String, maxlength: 255 },
  message: { type: String },
  type:    { type: String, enum: ["info", "warning", "success", "danger"], default: "info" },
  is_read: { type: Boolean, default: false }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

notificationSchema.index({ user_id: 1 });
notificationSchema.index({ is_read: 1 });

// --- Pharmacy Inventory ---
const pharmacyInventorySchema = new mongoose.Schema({
  medicine_name:  { type: String, unique: true, required: true, maxlength: 255 },
  category:       { type: String, maxlength: 100 },
  stock_quantity: { type: Number, default: 0 },
  price:          { type: Number },
  expiry_date:    { type: Date },
  last_updated:   { type: Date, default: Date.now }
}, { timestamps: false });

// --- Bills ---
const billSchema = new mongoose.Schema({
  patient_id:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  appointment_id:   { type: mongoose.Schema.Types.ObjectId, ref: "Appointment" },
  bill_number:      { type: String, unique: true, maxlength: 50 },
  consultation_fee: { type: Number, default: 0 },
  medicine_charges: { type: Number, default: 0 },
  lab_charges:      { type: Number, default: 0 },
  tax:              { type: Number, default: 0 },
  total_amount:     { type: Number },
  payment_status:   { type: String, enum: ["pending", "paid"], default: "pending" }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

billSchema.index({ patient_id: 1 });


// --- Ambulances ---
const ambulanceSchema = new mongoose.Schema({
  vehicle_no:  { type: String, unique: true, required: true, maxlength: 20 },
  driver_id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  status:      { type: String, enum: ["available", "busy", "offline"], default: "offline" },
  current_lat: { type: Number },
  current_lng: { type: Number }
}, { timestamps: false });

ambulanceSchema.index({ driver_id: 1 });
ambulanceSchema.index({ status: 1 });

// --- Ambulance Requests ---
const ambulanceRequestSchema = new mongoose.Schema({
  patient_id:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  driver_id:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  vehicle_id:     { type: mongoose.Schema.Types.ObjectId, ref: "Ambulance" },
  pickup_address: { type: String },
  emergency_type: { type: String, maxlength: 100 },
  status:         { type: String, enum: ["pending", "accepted", "arrived", "completed", "cancelled"], default: "pending" },
  pickup_lat:     { type: Number },
  pickup_lng:     { type: Number },
  eta:            { type: String, maxlength: 50 }
}, { timestamps: { createdAt: "created_at", updatedAt: false } });

ambulanceRequestSchema.index({ patient_id: 1 });
ambulanceRequestSchema.index({ status: 1 });
ambulanceRequestSchema.index({ driver_id: 1 });

// ─── Model Exports ─────────────────────────────────────────────────────────────
const User               = mongoose.model("User", userSchema);
const Doctor             = mongoose.model("Doctor", doctorSchema);
const Appointment        = mongoose.model("Appointment", appointmentSchema);
const Prescription       = mongoose.model("Prescription", prescriptionSchema);
const Payment            = mongoose.model("Payment", paymentSchema);
const Message            = mongoose.model("Message", messageSchema);
const Review             = mongoose.model("Review", reviewSchema);
const DoctorLeave        = mongoose.model("DoctorLeave", doctorLeaveSchema);
const LabReport          = mongoose.model("LabReport", labReportSchema);
const MedicineReminder   = mongoose.model("MedicineReminder", medicineReminderSchema);
const BloodBank          = mongoose.model("BloodBank", bloodBankSchema);
const Donor              = mongoose.model("Donor", donorSchema);
const HospitalResource   = mongoose.model("HospitalResource", hospitalResourceSchema);
const PatientVitals      = mongoose.model("PatientVitals", patientVitalsSchema);
const Notification       = mongoose.model("Notification", notificationSchema);
const PharmacyInventory  = mongoose.model("PharmacyInventory", pharmacyInventorySchema);
const Bill               = mongoose.model("Bill", billSchema);
const Ambulance          = mongoose.model("Ambulance", ambulanceSchema);
const AmbulanceRequest   = mongoose.model("AmbulanceRequest", ambulanceRequestSchema);

// ─── Seed Default Data ──────────────────────────────────────────────────────────
async function seedDB() {
  try {
    // --- Default Admin ---
    const adminExists = await User.findOne({ email: "admin@hms.com" });
    if (!adminExists) {
      const hashedPass = bcrypt.hashSync("admin123", 10);
      await User.create({ name: "Admin", email: "admin@hms.com", password: hashedPass, role: "admin" });
      console.log("  → Default admin created (admin@hms.com / admin123)");
    }

    // --- Default Driver ---
    const driverExists = await User.findOne({ email: "driver@hms.com" });
    let driverUser = driverExists;
    if (!driverExists) {
      const driverPass = bcrypt.hashSync("driver123", 10);
      driverUser = await User.create({ name: "John Driver", email: "driver@hms.com", password: driverPass, role: "driver", phone: "9988776655" });
      console.log("  → Default driver created (driver@hms.com / driver123)");
    }

    // --- Default Ambulance ---
    const ambExists = await Ambulance.findOne({ vehicle_no: "AMB-101" });
    if (!ambExists && driverUser) {
      await Ambulance.create({ vehicle_no: "AMB-101", driver_id: driverUser._id, status: "available" });
      console.log("  → Default ambulance created (AMB-101)");
    }

    // --- Blood Bank Seed ---
    const bloodCount = await BloodBank.countDocuments();
    if (bloodCount === 0) {
      await BloodBank.insertMany([
        { blood_group: "A+",  units: 45, status: "optimal" },
        { blood_group: "A-",  units: 12, status: "low" },
        { blood_group: "B+",  units: 38, status: "optimal" },
        { blood_group: "B-",  units: 8,  status: "low" },
        { blood_group: "AB+", units: 15, status: "optimal" },
        { blood_group: "AB-", units: 4,  status: "critical" },
        { blood_group: "O+",  units: 60, status: "optimal" },
        { blood_group: "O-",  units: 12, status: "low" }
      ]);
      console.log("  → Blood bank inventory seeded");
    }

    // --- Pharmacy Seed ---
    const pharmCount = await PharmacyInventory.countDocuments();
    if (pharmCount === 0) {
      await PharmacyInventory.insertMany([
        { medicine_name: "Paracetamol 500mg",  category: "Painkiller",     stock_quantity: 1000, price: 2.50,  expiry_date: new Date("2026-12-01") },
        { medicine_name: "Amoxicillin 250mg",  category: "Antibiotic",     stock_quantity: 500,  price: 15.00, expiry_date: new Date("2025-06-15") },
        { medicine_name: "Cetirizine 10mg",    category: "Antihistamine",  stock_quantity: 800,  price: 5.00,  expiry_date: new Date("2026-08-20") },
        { medicine_name: "Metformin 500mg",    category: "Diabetes",       stock_quantity: 1200, price: 8.50,  expiry_date: new Date("2027-01-10") },
        { medicine_name: "Atorvastatin 10mg",  category: "Cholesterol",    stock_quantity: 600,  price: 25.00, expiry_date: new Date("2025-11-30") }
      ]);
      console.log("  → Pharmacy inventory seeded");
    }

    // --- Hospital Resources Seed ---
    const resCount = await HospitalResource.countDocuments();
    if (resCount === 0) {
      await HospitalResource.insertMany([
        { resource_name: "ICU Beds",           total_quantity: 50,  available_quantity: 15 },
        { resource_name: "General Ward Beds",  total_quantity: 200, available_quantity: 80 },
        { resource_name: "Oxygen Cylinders",   total_quantity: 500, available_quantity: 320 }
      ]);
      console.log("  → Hospital resources seeded");
    }

    console.log("✅ Database seeding completed");
  } catch (err) {
    console.error("❌ DB Seed Error:", err.message);
  }
}

// Run seeding after connection
mongoose.connection.once("open", () => {
  seedDB();
});

// ─── Exports ────────────────────────────────────────────────────────────────────
module.exports = {
  User,
  Doctor,
  Appointment,
  Prescription,
  Payment,
  Message,
  Review,
  DoctorLeave,
  LabReport,
  MedicineReminder,
  BloodBank,
  Donor,
  HospitalResource,
  PatientVitals,
  Notification,
  PharmacyInventory,
  Bill,
  Ambulance,
  AmbulanceRequest
};
