const AmbulanceModel = require("../models/ambulanceModel");

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

exports.getDriverDashboard = async (req, res) => {
  try {
    const ambulance = await AmbulanceModel.getAmbulanceByDriver(req.session.user.id);
    const pendingRequests = await AmbulanceModel.getPendingRequests();
    res.render("driver/dashboard", {
      title: "Driver Dashboard",
      user: req.session.user,
      ambulance,
      pendingRequests
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/");
  }
};

exports.postRequestAmbulance = async (req, res) => {
  try {
    const { pickup_address, emergency_type, pickup_lat, pickup_lng } = req.body;
    const requestId = await AmbulanceModel.createRequest({
      patient_id: req.session.user.id,
      pickup_address,
      emergency_type,
      pickup_lat,
      pickup_lng
    });

    const request = await AmbulanceModel.getRequestById(requestId);
    const io = req.app.get("io");

    let nearest = [];
    const plat = parseFloat(pickup_lat);
    const plng = parseFloat(pickup_lng);
    if (!Number.isNaN(plat) && !Number.isNaN(plng)) {
      const available = await AmbulanceModel.listAvailableWithCoords();
      nearest = available
        .map((a) => ({
          ...a,
          distance_km: haversineKm(plat, plng, Number(a.current_lat), Number(a.current_lng))
        }))
        .sort((a, b) => a.distance_km - b.distance_km)
        .slice(0, 5);
    }

    const enriched = { ...request, nearest_ambulances: nearest };
    io.to("admins").emit("admin-ambulance-request", enriched);
    io.to("drivers").emit("new-ambulance-request", enriched);

    res.json({ success: true, requestId, nearest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.body;
    const driverId = req.session.user.id;
    const ambulance = await AmbulanceModel.getAmbulanceByDriver(driverId);

    if (!ambulance || ambulance.status !== "available") {
      return res.json({ success: false, error: "You are already busy or offline" });
    }

    await AmbulanceModel.acceptRequest(requestId, driverId, ambulance.id);
    const request = await AmbulanceModel.getRequestById(requestId);

    const io = req.app.get("io");
    if (request.patient_id) {
      io.to(`user_${request.patient_id}`).emit("ambulance-request-accepted", request);
      io.to(`trip_${requestId}`).emit("ambulance-request-accepted", request);
    }

    res.json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    await AmbulanceModel.updateLocation(req.session.user.id, lat, lng);

    const io = req.app.get("io");
    const active = await AmbulanceModel.getActiveRequestForDriver(req.session.user.id);
    const payload = {
      driverId: req.session.user.id,
      lat,
      lng,
      requestId: active ? active.id : null
    };
    if (active && active.patient_id) {
      io.to(`user_${active.patient_id}`).emit("ambulance-location-sync", payload);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.completeTrip = async (req, res) => {
  try {
    const { requestId } = req.body;
    const reqRow = await AmbulanceModel.getRequestById(requestId);
    await AmbulanceModel.updateRequestStatus(requestId, "completed");

    const io = req.app.get("io");
    if (reqRow && reqRow.patient_id) {
      io.to(`user_${reqRow.patient_id}`).emit("ambulance-trip-completed", { requestId });
    }
    io.emit("ambulance-trip-completed", { requestId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
