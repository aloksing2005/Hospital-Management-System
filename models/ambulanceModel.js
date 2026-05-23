const { Ambulance, AmbulanceRequest, User } = require("../config/db");

class AmbulanceModel {
  static async getAllAmbulances() {
    const rows = await Ambulance.find()
      .populate({ path: "driver_id", select: "name phone" })
      .lean();

    return rows.map(a => ({
      ...a,
      id: a._id,
      driver_name: a.driver_id ? a.driver_id.name : "",
      driver_phone: a.driver_id ? a.driver_id.phone : "",
      driver_id: a.driver_id ? a.driver_id._id : null
    }));
  }

  static async getAmbulanceByDriver(driverId) {
    const amb = await Ambulance.findOne({ driver_id: driverId }).lean();
    if (amb) amb.id = amb._id;
    return amb;
  }

  static async updateStatus(driverId, status) {
    await Ambulance.findOneAndUpdate({ driver_id: driverId }, { status });
  }

  static async updateLocation(driverId, lat, lng) {
    await Ambulance.findOneAndUpdate({ driver_id: driverId }, { current_lat: lat, current_lng: lng });
  }

  static async createRequest(data) {
    const { patient_id, pickup_address, emergency_type, pickup_lat, pickup_lng } = data;
    const req = await AmbulanceRequest.create({
      patient_id, pickup_address, emergency_type, pickup_lat, pickup_lng, status: "pending"
    });
    return req._id;
  }

  static async acceptRequest(requestId, driverId, vehicleId) {
    await AmbulanceRequest.findByIdAndUpdate(requestId, {
      driver_id: driverId, vehicle_id: vehicleId, status: "accepted"
    });
    await Ambulance.findByIdAndUpdate(vehicleId, { status: "busy" });
  }

  static async getRequestById(id) {
    const req = await AmbulanceRequest.findById(id)
      .populate({ path: "patient_id", select: "name phone" })
      .populate({ path: "driver_id", select: "name phone" })
      .populate({ path: "vehicle_id", select: "vehicle_no current_lat current_lng" })
      .lean();

    if (!req) return null;
    return {
      ...req,
      id: req._id,
      patient_name: req.patient_id ? req.patient_id.name : "",
      patient_phone: req.patient_id ? req.patient_id.phone : "",
      driver_name: req.driver_id ? req.driver_id.name : "",
      driver_phone: req.driver_id ? req.driver_id.phone : "",
      vehicle_no: req.vehicle_id ? req.vehicle_id.vehicle_no : "",
      current_lat: req.vehicle_id ? req.vehicle_id.current_lat : null,
      current_lng: req.vehicle_id ? req.vehicle_id.current_lng : null,
      patient_id: req.patient_id ? req.patient_id._id : null,
      driver_id: req.driver_id ? req.driver_id._id : null,
      vehicle_id: req.vehicle_id ? req.vehicle_id._id : null
    };
  }

  static async getActiveRequestForDriver(driverId) {
    const req = await AmbulanceRequest.findOne({ driver_id: driverId, status: "accepted" })
      .sort({ _id: -1 })
      .lean();
    if (req) req.id = req._id;
    return req;
  }

  static async listAvailableWithCoords() {
    const rows = await Ambulance.find({
      status: "available",
      current_lat: { $ne: null },
      current_lng: { $ne: null }
    })
      .populate({ path: "driver_id", select: "name phone" })
      .lean();

    return rows.map(a => ({
      ...a,
      id: a._id,
      driver_name: a.driver_id ? a.driver_id.name : "",
      driver_phone: a.driver_id ? a.driver_id.phone : "",
      driver_id: a.driver_id ? a.driver_id._id : null
    }));
  }

  static async rejectRequest(requestId, driverId) {
    await AmbulanceRequest.findByIdAndUpdate(requestId, { 
      $unset: { driver_id: 1, vehicle_id: 1 },
      status: "pending"
    });
  }

  static async updateRequestStatus(requestId, status, eta = null) {
    const updateData = { status };
    if (eta) updateData.eta = eta;
    await AmbulanceRequest.findByIdAndUpdate(requestId, updateData);
    if (status === "completed" || status === "cancelled") {
      const req = await AmbulanceRequest.findById(requestId).lean();
      if (req && req.vehicle_id) {
        await Ambulance.findByIdAndUpdate(req.vehicle_id, { status: "available" });
      }
    }
  }

  static async calculateETA(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
    
    // Assume average speed of 40 km/h in city
    const avgSpeedKmH = 40;
    const timeMinutes = (distanceKm / avgSpeedKmH) * 60;
    
    return Math.ceil(timeMinutes);
  }

  static async getPendingRequests() {
    const rows = await AmbulanceRequest.find({ status: "pending" })
      .populate({ path: "patient_id", select: "name phone" })
      .lean();

    return rows.map(r => ({
      ...r,
      id: r._id,
      patient_name: r.patient_id ? r.patient_id.name : "",
      patient_phone: r.patient_id ? r.patient_id.phone : "",
      patient_id: r.patient_id ? r.patient_id._id : null
    }));
  }
}

module.exports = AmbulanceModel;
