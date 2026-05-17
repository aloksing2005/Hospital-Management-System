const express = require("express");
const router = express.Router();
const { Appointment, Prescription } = require("../config/db");
const AmbulanceModel = require("../models/ambulanceModel");
const { isLoggedIn } = require("../middleware/auth");

function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Public: nearest available ambulances by GPS */
router.get("/nearest-ambulances", async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ success: false, message: "lat and lng required" });
    }
    const rows = await AmbulanceModel.listAvailableWithCoords();
    const ranked = rows
      .map((r) => ({
        ...r,
        distance_km:
          r.current_lat != null && r.current_lng != null
            ? haversineKm(lat, lng, Number(r.current_lat), Number(r.current_lng))
            : null
      }))
      .filter((r) => r.distance_km != null)
      .sort((a, b) => a.distance_km - b.distance_km)
      .slice(0, 8);
    res.json({ success: true, ambulances: ranked });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

/** Emergency priority score from type + vitals hints (demo heuristic) */
router.post("/emergency-priority", express.json(), (req, res) => {
  const { emergency_type, vitals } = req.body || {};
  let score = 40;
  const t = String(emergency_type || "").toLowerCase();
  if (t.includes("cardiac")) score += 35;
  if (t.includes("trauma") || t.includes("accident")) score += 25;
  if (t.includes("respiratory")) score += 20;
  if (t.includes("pregnancy")) score += 15;
  if (vitals && typeof vitals === "object") {
    if (vitals.spo2 < 92) score += 20;
    if (vitals.hr > 120 || vitals.hr < 50) score += 10;
  }
  score = Math.min(100, score);
  const band = score >= 80 ? "CRITICAL" : score >= 55 ? "HIGH" : score >= 35 ? "MEDIUM" : "STANDARD";
  res.json({ success: true, score, band });
});

/** AI-style patient risk (aggregate from appointments — demo model) */
router.get("/patient-risk/:patientId", isLoggedIn, async (req, res) => {
  try {
    const pid = req.params.patientId;
    if (req.session.user.role !== "admin" && String(req.session.user.id) !== String(pid)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    // Aggregate appointment counts by status
    const statusCounts = await Appointment.aggregate([
      { $match: { patient_id: require("mongoose").Types.ObjectId.createFromHexString(pid) } },
      { $group: { _id: "$status", c: { $sum: 1 } } }
    ]);

    const rxCount = await Prescription.countDocuments({ patient_id: pid });

    const pending = statusCounts.find((a) => a._id === "pending")?.c || 0;
    const cancelled = statusCounts.find((a) => a._id === "cancelled")?.c || 0;
    const completed = statusCounts.find((a) => a._id === "completed")?.c || 0;

    let risk = 15 + pending * 4 + cancelled * 6 - Math.min(20, completed * 2);
    risk += Math.min(25, rxCount * 3);
    risk = Math.max(5, Math.min(98, Math.round(risk)));

    const factors = [
      { label: "Pending visits", weight: pending * 4 },
      { label: "Cancellations", weight: cancelled * 6 },
      { label: "Care episodes (rx)", weight: Math.min(25, rxCount * 3) }
    ];

    res.json({
      success: true,
      patientId: pid,
      riskScore: risk,
      band: risk >= 75 ? "High" : risk >= 45 ? "Moderate" : "Low",
      factors
    });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

module.exports = router;
