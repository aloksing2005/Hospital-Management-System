const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Global io access
app.set("io", io);

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || "hms_secret_key",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false, // Set to true only if using HTTPS
    httpOnly: true
  }
}));

app.use(flash());

// Flash messages to all views
app.use((req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  next();
});

// i18n Middleware
const i18n = require("./middleware/i18n");
app.use(i18n);

// Language toggle route
app.get("/lang/:locale", (req, res) => {
  if (['en', 'hi'].includes(req.params.locale)) {
    req.session.lang = req.params.locale;
  }
  res.redirect("back");
});

// EJS Setup
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Socket.IO Real-time (room-based routing)
const { userRoom } = require("./utils/socketRooms");
const dispatchIntervals = new Map();

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join", (data) => {
    if (!data || !data.userId) return;
    const uid = String(data.userId);
    socket.userId = uid;
    socket.role = data.role;
    socket.join(userRoom(uid));
    if (data.role === "admin") socket.join("admins");
    if (data.role === "doctor") socket.join("doctors");
    if (data.role === "patient") socket.join("patients");
    if (data.role === "driver") socket.join("drivers");
    console.log(`${data.role} ${uid} joined rooms`);
  });

  socket.on("appointment-booked", (data) => {
    io.to("admins").emit("new-appointment", data);
    if (data.doctorUserId) {
      io.to(userRoom(data.doctorUserId)).emit("doctor-notification", {
        type: "new_appointment",
        message: `New appointment from ${data.patientName}`,
        appointment: data
      });
    }
  });

  socket.on("appointment-status-update", (data) => {
    if (data.patientId) io.to(userRoom(data.patientId)).emit("appointment-update", data);
    io.to("admins").emit("admin-appointment-update", data);
  });

  socket.on("prescription-generated", (data) => {
    if (data.patientId) io.to(userRoom(data.patientId)).emit("new-prescription", data);
  });

  socket.on("chat-message", (data) => {
    if (data && data.to) io.to(userRoom(data.to)).emit("chat-message", data);
  });

  // WebRTC Signaling
  socket.on("join-consultation", (appointmentId) => {
    socket.join(`consultation_${appointmentId}`);
    socket.to(`consultation_${appointmentId}`).emit("user-joined");
  });

  socket.on("webrtc-offer", (data) => {
    socket.to(`consultation_${data.appointmentId}`).emit("webrtc-offer", data.offer);
  });

  socket.on("webrtc-answer", (data) => {
    socket.to(`consultation_${data.appointmentId}`).emit("webrtc-answer", data.answer);
  });

  socket.on("webrtc-ice-candidate", (data) => {
    socket.to(`consultation_${data.appointmentId}`).emit("webrtc-ice-candidate", data.candidate);
  });

  socket.on("trigger-sos", (data) => {
    io.to("admins").emit("sos-alert", data);
    io.to("drivers").emit("sos-alert", data);
  });

  socket.on("request-ambulance", (data) => {
    io.to("admins").emit("admin-ambulance-request", data);
  });

  socket.on("dispatch-ambulance", (data) => {
    const pid = data && data.patientId ? String(data.patientId) : null;
    if (pid && dispatchIntervals.has(pid)) {
      clearInterval(dispatchIntervals.get(pid));
      dispatchIntervals.delete(pid);
    }
    let lat = 28.7041;
    let lng = 77.1025;
    let distance = 5.0;
    const interval = setInterval(() => {
      distance -= 0.5;
      lat += 0.001;
      lng += 0.001;
      if (distance <= 0) {
        clearInterval(interval);
        if (pid) dispatchIntervals.delete(pid);
        if (pid) io.to(userRoom(pid)).emit("ambulance-arrived", { patientId: pid });
        else io.emit("ambulance-arrived", { patientId: data.patientId });
      } else {
        const payload = {
          patientId: data.patientId,
          lat,
          lng,
          distance: distance.toFixed(1) + " km"
        };
        if (pid) io.to(userRoom(pid)).emit("ambulance-location-update", payload);
        else io.emit("ambulance-location-update", payload);
      }
    }, 2000);
    if (pid) dispatchIntervals.set(pid, interval);
  });

  socket.on("call-next-patient", (data) => {
    io.emit("live-queue-update", data);
  });

  // --- Real-Time Vitals Simulation ---
  socket.on("start-vitals-monitoring", (data) => {
    const { patientId } = data;
    if (socket.vitalsInterval) {
      clearInterval(socket.vitalsInterval);
    }
    
    // Simulate initial vitals
    let vitals = {
      hr: Math.floor(Math.random() * (95 - 75) + 75), // Heart Rate: 75-95
      spo2: Math.floor(Math.random() * (100 - 95) + 95), // SpO2: 95-100
      bpSys: Math.floor(Math.random() * (130 - 110) + 110), // BP Systolic
      bpDia: Math.floor(Math.random() * (85 - 70) + 70), // BP Diastolic
      temp: (Math.random() * (99.2 - 97.8) + 97.8).toFixed(1) // Temp F
    };

    socket.vitalsInterval = setInterval(() => {
      // Fluctuate values slightly for realism
      vitals.hr += Math.floor(Math.random() * 5) - 2;
      vitals.spo2 += Math.floor(Math.random() * 3) - 1;
      
      // Keep within bounds
      if(vitals.spo2 > 100) vitals.spo2 = 100;
      if(vitals.spo2 < 85) vitals.spo2 = 85; 
      if(vitals.hr < 40) vitals.hr = 40;
      if(vitals.hr > 180) vitals.hr = 180;

      vitals.bpSys += Math.floor(Math.random() * 5) - 2;
      vitals.bpDia += Math.floor(Math.random() * 5) - 2;
      vitals.temp = (parseFloat(vitals.temp) + (Math.random() * 0.2 - 0.1)).toFixed(1);

      // Periodically save to DB (every ~10 seconds - 5 ticks)
      if (!socket.vitalsTick) socket.vitalsTick = 0;
      socket.vitalsTick++;
      if (socket.vitalsTick % 5 === 0) {
        const { PatientVitals } = require("./config/db");
        PatientVitals.create({
          patient_id: patientId,
          hr: vitals.hr,
          spo2: vitals.spo2,
          bp_sys: vitals.bpSys,
          bp_dia: vitals.bpDia,
          temp: vitals.temp
        }).catch(e => console.error("Error saving vitals:", e.message));
      }

      io.to(userRoom(String(patientId))).emit("vitals-update", { patientId, vitals });
    }, 2000);
  });

  socket.on("stop-vitals-monitoring", () => {
    if (socket.vitalsInterval) {
      clearInterval(socket.vitalsInterval);
      socket.vitalsInterval = null;
    }
  });

  socket.on("update-bed-status", (data) => {
    io.emit("bed-status-broadcast", data);
  });

  socket.on("disconnect", () => {
    if (socket.vitalsInterval) {
      clearInterval(socket.vitalsInterval);
    }
    if (socket.userId) {
      const pid = String(socket.userId);
      if (dispatchIntervals.has(pid)) {
        clearInterval(dispatchIntervals.get(pid));
        dispatchIntervals.delete(pid);
      }
    }
    console.log("User disconnected:", socket.id);
  });

  socket.on("doctor-login", (doctorId) => {
    socket.broadcast.emit("doctor-status-change", { doctorId, status: "online" });
  });

  socket.on("trigger-global-alert", (data) => {
    io.emit("emergency-broadcast", data);
  });

  socket.on("update-notice", (notice) => {
    io.emit("new-notice", notice);
  });

  socket.on("icu-bed-toggle", (bedData) => {
    socket.broadcast.emit("icu-bed-sync", bedData);
  });

  socket.on("driver-online", () => {
    socket.join("drivers");
    socket.join("ambulance-drivers");
  });

  socket.on("join-trip", (requestId) => {
    if (requestId) socket.join(`trip_${requestId}`);
  });
});

// Routes
app.use("/", require("./routes/authRoutes"));
app.use(require("./middleware/localization"));
app.use("/admin", require("./routes/adminRoutes"));
app.use("/doctor", require("./routes/doctorRoutes"));
app.use("/patient", require("./routes/patientRoutes"));
app.use("/driver", require("./routes/driverRoutes"));
app.use("/payment", require("./routes/paymentRoutes"));
app.use("/consultation", require("./routes/consultationRoutes"));
app.use("/api", require("./routes/apiRoutes"));

// Home Route - FIXED: No redirect loops
app.get("/", (req, res) => {
  res.render("home", { title: "Hospital Management System" });
});

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - Page Not Found" });
});

const startReminderCron = require("./utils/reminderCron");

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`HMS Server running on http://localhost:${PORT}`);
  console.log(`Socket.IO ready for real-time updates`);
  
  // Start automated reminders
  startReminderCron();
});
