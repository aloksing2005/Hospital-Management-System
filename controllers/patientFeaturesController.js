const {
  ParkingSlot,
  ParkingReservation,
  PharmacyOrder,
  PharmacyInventory,
  InsuranceClaim,
  WellbeingLog,
  EmergencyAlert,
  Appointment,
  DietPlan
} = require("../config/db");
const appointmentModel = require("../models/appointmentModel");
const notificationModel = require("../models/notificationModel");
const pharmacyModel = require("../models/pharmacyModel");
const { notifyUser, notifyAdmins } = require("../utils/notifyHelper");
const upload = require("../middleware/upload");

// ─── Parking ───────────────────────────────────────────────────────────────────
exports.getParking = async (req, res) => {
  try {
    const slots = await ParkingSlot.find().sort({ spot_code: 1 }).lean();
    const reservations = await ParkingReservation.find({
      patient_id: req.session.user.id,
      status: "active"
    }).lean();
    const availableCount = slots.filter(s => s.status === "available").length;
    res.render("patient/parking", {
      user: req.session.user,
      slots: slots.map(s => ({ ...s, id: s._id })),
      reservations: reservations.map(r => ({ ...r, id: r._id })),
      availableCount
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.bookParking = async (req, res) => {
  try {
    const { slot_id } = req.body;
    const slot = await ParkingSlot.findById(slot_id);
    if (!slot || slot.status !== "available") {
      return res.status(400).json({ success: false, error: "Spot not available" });
    }

    const existing = await ParkingReservation.findOne({
      patient_id: req.session.user.id,
      status: "active"
    });
    if (existing) {
      return res.status(400).json({ success: false, error: "You already have an active reservation" });
    }

    slot.status = "reserved";
    await slot.save();

    const reservation = await ParkingReservation.create({
      patient_id: req.session.user.id,
      slot_id: slot._id,
      spot_code: slot.spot_code,
      status: "active"
    });

    const io = req.app.get("io");
    await notifyUser(io, req.session.user.id, "Parking Reserved", `Spot ${slot.spot_code} booked successfully.`, "success");

    res.json({
      success: true,
      reservation: { id: reservation._id, spot_code: slot.spot_code }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.cancelParking = async (req, res) => {
  try {
    const reservation = await ParkingReservation.findOne({
      _id: req.params.id,
      patient_id: req.session.user.id,
      status: "active"
    });
    if (!reservation) return res.status(404).json({ success: false, error: "Reservation not found" });

    await ParkingSlot.findByIdAndUpdate(reservation.slot_id, { status: "available" });
    reservation.status = "cancelled";
    await reservation.save();

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Check-in ──────────────────────────────────────────────────────────────────
exports.checkInEarly = async (req, res) => {
  try {
    const patientId = req.session.user.id;
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 2);

    const appointment = await Appointment.findOne({
      patient_id: patientId,
      status: { $in: ["pending", "confirmed"] },
      date: { $gte: now, $lte: tomorrow }
    }).sort({ date: 1 }).populate("doctor_id", "name");

    if (!appointment) {
      return res.status(404).json({ success: false, error: "No upcoming appointment found" });
    }

    appointment.status = "checked_in";
    await appointment.save();

    const io = req.app.get("io");
    const payload = {
      id: appointment._id,
      patientId: String(patientId),
      status: "checked_in",
      doctorName: appointment.doctor_id ? appointment.doctor_id.name : ""
    };
    io.to("admins").emit("admin-appointment-update", payload);
    io.to(`user_${patientId}`).emit("appointment-update", payload);

    await notifyUser(io, patientId, "Checked In", "You have been checked in for your appointment.", "success");

    res.json({ success: true, appointmentId: appointment._id, status: "checked_in" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Blood profile ─────────────────────────────────────────────────────────────
exports.getBloodProfile = async (req, res) => {
  try {
    const labReportModel = require("../models/labReportModel");
    const allReports = await labReportModel.getReportsByPatient(req.session.user.id);
    const bloodReports = allReports.filter(
      r =>
        (r.test_type && /blood/i.test(r.test_type)) ||
        (r.report_name && /blood/i.test(r.report_name))
    );
    res.render("patient/blood-profile", {
      user: req.session.user,
      reports: bloodReports,
      hasBloodReport: bloodReports.length > 0
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

// ─── Insurance ─────────────────────────────────────────────────────────────────
exports.getInsurance = async (req, res) => {
  try {
    const claims = await InsuranceClaim.find({ patient_id: req.session.user.id })
      .sort({ created_at: -1 })
      .lean();
    res.render("patient/insurance", {
      user: req.session.user,
      claims: claims.map(c => ({ ...c, id: c._id }))
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.submitInsuranceClaim = [
  upload.single("document"),
  async (req, res) => {
    try {
      const { provider, policy_number, amount, description } = req.body;
      if (!provider || !policy_number || !amount) {
        req.flash("error", "Please fill all required fields");
        return res.redirect("/patient/insurance");
      }

      const claim = await InsuranceClaim.create({
        patient_id: req.session.user.id,
        provider,
        policy_number,
        amount: parseFloat(amount),
        description: description || "",
        document_path: req.file ? `/images/${req.file.filename}` : null,
        status: "submitted"
      });

      const io = req.app.get("io");
      await notifyUser(
        io,
        req.session.user.id,
        "Insurance Claim Submitted",
        `Claim #${claim._id.toString().slice(-6)} is under review.`,
        "info"
      );
      await notifyAdmins(io, "New Insurance Claim", `${req.session.user.name} submitted a claim for ₹${amount}`, "warning");

      req.flash("success", "Insurance claim submitted successfully");
      res.redirect("/patient/insurance");
    } catch (err) {
      req.flash("error", err.message);
      res.redirect("/patient/insurance");
    }
  }
];

// ─── Wellbeing ─────────────────────────────────────────────────────────────────
exports.getWellbeing = async (req, res) => {
  try {
    const logs = await WellbeingLog.find({ patient_id: req.session.user.id })
      .sort({ created_at: -1 })
      .limit(14)
      .lean();
    const moodLogs = logs.filter(l => l.activity === "mood");
    const tips = [
      "Take 5 deep breaths when you feel overwhelmed.",
      "A 10-minute walk can reduce stress hormones significantly.",
      "Limit screen time 1 hour before sleep for better rest.",
      "Stay connected with friends — social support improves mental health."
    ];
    res.render("patient/wellbeing", {
      user: req.session.user,
      logs: logs.map(l => ({ ...l, id: l._id })),
      moodLogs,
      dailyTip: tips[new Date().getDate() % tips.length]
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.logWellbeing = async (req, res) => {
  try {
    const { mood, activity, notes, duration_mins, stress_level } = req.body;
    await WellbeingLog.create({
      patient_id: req.session.user.id,
      mood: mood || "",
      activity: activity || "mood",
      notes: notes || "",
      duration_mins: duration_mins ? parseInt(duration_mins, 10) : null,
      stress_level: stress_level ? parseInt(stress_level, 10) : null
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Pharmacy orders ───────────────────────────────────────────────────────────
exports.placePharmacyOrder = async (req, res) => {
  try {
    const { items, prescription_required } = req.body;
    let parsedItems = items;
    if (typeof items === "string") parsedItems = JSON.parse(items);

    if (!parsedItems || !parsedItems.length) {
      return res.status(400).json({ success: false, error: "Cart is empty" });
    }

    let total = 0;
    const orderItems = [];
    for (const item of parsedItems) {
      const med = await PharmacyInventory.findById(item.medicine_id);
      if (!med || med.stock_quantity < item.quantity) {
        return res.status(400).json({
          success: false,
          error: `${item.medicine_name || "Medicine"} is out of stock`
        });
      }
      const lineTotal = med.price * item.quantity;
      total += lineTotal;
      orderItems.push({
        medicine_id: med._id,
        medicine_name: med.medicine_name,
        quantity: item.quantity,
        price: med.price
      });
      await pharmacyModel.updateStock(med._id, -item.quantity);
    }

    const trackingId = "RX" + Date.now().toString(36).toUpperCase();
    const order = await PharmacyOrder.create({
      patient_id: req.session.user.id,
      items: orderItems,
      total_amount: total,
      prescription_required: !!prescription_required,
      prescription_verified: !prescription_required,
      tracking_id: trackingId,
      status: "confirmed"
    });

    const io = req.app.get("io");
    await notifyUser(
      io,
      req.session.user.id,
      "Pharmacy Order Placed",
      `Order ${trackingId} confirmed. Total ₹${total.toFixed(2)}`,
      "success"
    );

    res.json({ success: true, orderId: order._id, trackingId, total });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getPharmacyOrders = async (req, res) => {
  try {
    const orders = await PharmacyOrder.find({ patient_id: req.session.user.id })
      .sort({ created_at: -1 })
      .lean();
    res.json({ success: true, orders: orders.map(o => ({ ...o, id: o._id })) });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── SOS ───────────────────────────────────────────────────────────────────────
exports.triggerSOS = async (req, res) => {
  try {
    const { lat, lng, message } = req.body;
    const patientId = req.session.user.id;
    const patientName = req.session.user.name;

    const alert = await EmergencyAlert.create({
      patient_id: patientId,
      patient_name: patientName,
      lat: lat ? parseFloat(lat) : null,
      lng: lng ? parseFloat(lng) : null,
      message: message || "Emergency SOS triggered",
      status: "active"
    });

    const io = req.app.get("io");
    const payload = {
      alertId: alert._id,
      patientId: String(patientId),
      patientName,
      lat: alert.lat,
      lng: alert.lng,
      message: alert.message,
      ts: Date.now()
    };

    io.to("admins").emit("sos-alert", payload);
    io.to("drivers").emit("sos-alert", payload);
    io.to("doctors").emit("sos-alert", payload);

    await notifyAdmins(io, "SOS EMERGENCY", `${patientName} triggered SOS`, "danger");

    // Automatically create pending ambulance request for the SOS
    const AmbulanceModel = require("../models/ambulanceModel");
    const requestId = await AmbulanceModel.createRequest({
      patient_id: patientId,
      pickup_address: "Emergency SOS Location",
      emergency_type: "SOS Emergency",
      pickup_lat: lat ? parseFloat(lat) : null,
      pickup_lng: lng ? parseFloat(lng) : null
    });

    const ambulanceRequest = await AmbulanceModel.getRequestById(requestId);
    io.to("drivers").emit("new-ambulance-request", ambulanceRequest);

    const { User } = require("../config/db");
    const drivers = await User.find({ role: "driver" }).select("_id").lean();
    for (const d of drivers) {
      await notifyUser(io, d._id, "SOS Dispatch", `${patientName} needs emergency help`, "danger");
    }

    res.json({ success: true, alertId: alert._id, requestId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// ─── Notifications bulk ────────────────────────────────────────────────────────
exports.markAllNotificationsRead = async (req, res) => {
  try {
    const { Notification } = require("../config/db");
    await Notification.updateMany(
      { user_id: req.session.user.id, is_read: false },
      { is_read: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.getNotificationsApi = async (req, res) => {
  try {
    const notifications = await notificationModel.getByUser(req.session.user.id);
    const unread = await notificationModel.getUnreadCount(req.session.user.id);
    res.json({
      success: true,
      notifications: notifications.map(n => ({
        ...n,
        is_read: n.is_read,
        read: n.is_read
      })),
      unread
    });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

exports.getDietPlanner = async (req, res) => {
  try {
    const plan = await DietPlan.findOne({ patient_id: req.session.user.id }).sort({ _id: -1 }).lean();
    res.render("patient/diet-planner", { user: req.session.user, activePlan: plan });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.generateDiet = async (req, res) => {
  try {
    const { goal, activity } = req.body;
    if (!goal || !activity) {
      return res.status(400).json({ success: false, error: "Goal and activity level are required" });
    }
    const { generateDietPlan } = require("../utils/medicalAI");
    const plan = await generateDietPlan(goal, activity);
    
    // Save generated diet plan to MongoDB
    await DietPlan.create({
      patient_id: req.session.user.id,
      goal,
      activity,
      calories: plan.calories,
      macros: plan.macros,
      meals: plan.meals,
      advice: plan.advice
    });

    res.json({ success: true, plan });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
