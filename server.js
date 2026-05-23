const express = require("express");
const session = require("express-session");
const flash = require("connect-flash");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();
const { createSessionStore } = require("./utils/sessionStore");
const attachPatientLocals = require("./middleware/patientLocals");

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
  secret: process.env.SESSION_SECRET || "hms_secret_key_premium_2024",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production', // HTTPS only in production
    httpOnly: true,
    sameSite: 'lax',
    domain: process.env.NODE_ENV === 'production' ? process.env.DOMAIN : undefined
  },
  name: 'hms.sid',
  rolling: true, // Reset session cookie on each request
  store: createSessionStore()
}));

app.use(flash());

// Flash messages to all views
app.use(async (req, res, next) => {
  res.locals.success = req.flash("success");
  res.locals.error = req.flash("error");
  res.locals.user = req.session.user || null;
  res.locals.unreadNotifications = 0;
  if (req.session?.user && req.session.user.id) {
    try {
      const notificationModel = require("./models/notificationModel");
      res.locals.unreadNotifications = await notificationModel.getUnreadCount(req.session.user.id);
    } catch (e) {
      console.error("Global unread count error:", e.message);
    }
  }
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

  // Typing indicators
  socket.on("typing-start", (data) => {
    if (data && data.to) io.to(userRoom(data.to)).emit("typing-start", { from: data.from, fromName: data.fromName });
  });

  socket.on("typing-stop", (data) => {
    if (data && data.to) io.to(userRoom(data.to)).emit("typing-stop", { from: data.from });
  });

  // Online status
  socket.on("user-online", (userId) => {
    socket.broadcast.emit("user-came-online", { userId });
  });

  socket.on("user-offline", (userId) => {
    socket.broadcast.emit("user-went-offline", { userId });
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

  // Incoming call system
  socket.on("initiate-call", (data) => {
    const { appointmentId, callerId, callerName, receiverId } = data;
    io.to(`user_${receiverId}`).emit("incoming-call", {
      appointmentId,
      callerId,
      callerName
    });
  });

  socket.on("accept-call", (data) => {
    const { appointmentId, callerId } = data;
    io.to(`user_${callerId}`).emit("call-accepted", { appointmentId });
  });

  socket.on("reject-call", (data) => {
    const { appointmentId, callerId } = data;
    io.to(`user_${callerId}`).emit("call-rejected", { appointmentId });
  });

  socket.on("end-call", (data) => {
    const { appointmentId } = data;
    socket.to(`consultation_${appointmentId}`).emit("call-ended", { appointmentId });
  });

  // Real-time clinical telemetry synchronization channel
  socket.on("telemetry-update", (data) => {
    if (socket.userId) {
      socket.broadcast.emit("patient-telemetry-sync", {
        patientId: socket.userId,
        vitals: data
      });
    }
  });

  socket.on("trigger-sos", async (data) => {
    const payload = { ...data, ts: data.ts || Date.now() };
    io.to("admins").emit("sos-alert", payload);
    io.to("drivers").emit("sos-alert", payload);
    io.to("doctors").emit("sos-alert", payload);
    if (data && data.patientId) {
      try {
        const { EmergencyAlert } = require("./config/db");
        const exists = await EmergencyAlert.findOne({
          patient_id: data.patientId,
          status: "active",
          created_at: { $gte: new Date(Date.now() - 60000) }
        });
        if (!exists) {
          await EmergencyAlert.create({
            patient_id: data.patientId,
            patient_name: data.patientName || "Patient",
            lat: data.lat || null,
            lng: data.lng || null,
            message: data.message || "Emergency SOS",
            status: "active"
          });
        }
      } catch (e) {
        console.error("SOS persist error:", e.message);
      }
    }
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
app.use("/patient", attachPatientLocals, require("./routes/patientRoutes"));
app.use("/driver", require("./routes/driverRoutes"));
app.use("/payment", require("./routes/paymentRoutes"));
app.use("/consultation", require("./routes/consultationRoutes"));
app.use("/api", require("./routes/apiRoutes"));

// Home Route - FIXED: No redirect loops
app.get("/", (req, res) => {
  res.render("home", { title: "Hospital Management System" });
});

// Global Error Handling Middleware
const { formatErrorResponse } = require("./middleware/validation");
app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  if (process.env.NODE_ENV === "development") console.error(err.stack);

  const statusCode = err.statusCode || 500;
  const wantsJson =
    req.path.startsWith("/api") ||
    req.xhr ||
    (req.headers.accept && req.headers.accept.includes("application/json"));

  if (wantsJson) {
    return res.status(statusCode).json({
      ...formatErrorResponse(err, req),
      ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
  }

  req.flash("error", err.message || "Something went wrong");
  if (req.session?.user) {
    const role = req.session.user.role;
    if (role === "patient") return res.redirect("/patient/dashboard");
    if (role === "doctor") return res.redirect("/doctor/dashboard");
    if (role === "admin") return res.redirect("/admin/dashboard");
    if (role === "driver") return res.redirect("/driver/dashboard");
  }
  res.status(statusCode).redirect("/login");
});

// 404
app.use((req, res) => {
  res.status(404).render("404", { title: "404 - Page Not Found" });
});

const startReminderCron = require("./utils/reminderCron");
const mongoose = require("mongoose");

const BASE_PORT = parseInt(process.env.PORT, 10) || 3000;

function listenWithFallback(port, attemptsLeft) {
  const onListening = () => {
    server.off("error", onError);
    console.log(`HMS Server running on http://localhost:${port}`);
    console.log("Socket.IO ready for real-time updates");
    try {
      startReminderCron();
    } catch (e) {
      console.warn("Reminder cron skipped:", e.message);
    }
  };

  const onError = (err) => {
    server.off("listening", onListening);
    if (err.code === "EADDRINUSE" && attemptsLeft > 0) {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      listenWithFallback(port + 1, attemptsLeft - 1);
      return;
    }
    console.error("Server failed to start:", err.message);
    process.exit(1);
  };

  server.once("listening", onListening);
  server.once("error", onError);
  server.listen(port);
}

let serverStarted = false;
function boot() {
  if (serverStarted) return;
  serverStarted = true;
  listenWithFallback(BASE_PORT, 10);
}

if (mongoose.connection.readyState === 1) {
  boot();
} else {
  mongoose.connection.once("open", boot);
  setTimeout(boot, 6000);
}
