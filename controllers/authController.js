const userModel = require("../models/userModel");
const doctorModel = require("../models/doctorModel");
const bcrypt = require("bcryptjs");
const { generateOTP } = require("../utils/otpGenerator");
const { setOTP, verifyOTP } = require("../utils/otpStore");
const { sendMail } = require("../utils/mailer");

exports.showRegister = (req, res) => {
  res.render("auth/register", { title: "Register - HMS" });
};

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role } = req.body;

    const existing = await userModel.findByEmail(email);
    if (existing) {
      req.flash("error", "Email already registered");
      return res.redirect("/register");
    }

    const userId = await userModel.createUser({ name, email, password, phone, role });

    // If doctor, create doctor profile
    if (role === "doctor") {
      await doctorModel.addDoctor({
        user_id: userId,
        name: name,
        specialization: req.body.specialization || "General Physician",
        location: req.body.location || "",
        photo: "/images/default-doctor.jpg",
        fees: req.body.fees || 500,
        available_from: "09:00",
        available_to: "17:00"
      });
    }

    req.flash("success", "Registration successful! Please login.");
    res.redirect("/login");
  } catch (err) {
    req.flash("error", "Registration failed: " + err.message);
    res.redirect("/register");
  }
};

exports.showLogin = (req, res) => {
  res.render("auth/login", { title: "Login - HMS" });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await userModel.findByEmail(email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
      req.flash("error", "Invalid email or password");
      return res.redirect("/login");
    }

    // CRITICAL FIX: Properly set session user object
    req.session.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || ""
    };

    // Save session explicitly before redirect
    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        req.flash("error", "Login failed. Please try again.");
        return res.redirect("/login");
      }

      req.flash("success", `Welcome back, ${user.name}!`);

      // Redirect based on role
      if (user.role === "admin") return res.redirect("/admin/dashboard");
      if (user.role === "doctor") return res.redirect("/doctor/dashboard");
      if (user.role === "patient") return res.redirect("/patient/dashboard");
      if (user.role === "driver") return res.redirect("/driver/dashboard");

      res.redirect("/");
    });

  } catch (err) {
    req.flash("error", "Login failed: " + err.message);
    res.redirect("/login");
  }
};

exports.logout = (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("hms.sid");
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
};

exports.sendOTP = async (req, res) => {
  try {
    const { email } = req.body;
    const otp = generateOTP();
    setOTP(email, otp);

    await sendMail(email, "Your HMS OTP", `Your OTP is: ${otp}. Valid for 5 minutes.`);

    res.json({ success: true, message: "OTP sent to your email" });
  } catch (err) {
    res.status(500).json({ success: false, message: "Failed to send OTP" });
  }
};

exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const isValid = verifyOTP(email, otp);

    if (isValid) {
      res.json({ success: true, message: "OTP verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: "Verification failed" });
  }
};

exports.quickLogin = async (req, res) => {
  try {
    const { role } = req.body;
    
    if (!["patient", "doctor", "admin", "driver"].includes(role)) {
      req.flash("error", "Invalid demo role requested");
      return res.redirect("/login");
    }

    let email = "";
    if (role === "admin") email = "admin@hms.com";
    else if (role === "patient") email = "patient@hms.com";
    else if (role === "driver") email = "driver@hms.com";
    else if (role === "doctor") email = "doctor@hms.com";

    const user = await userModel.findByEmail(email);
    if (!user) {
      req.flash("error", `Demo user for role ${role} not found. Please ensure database is seeded.`);
      return res.redirect("/login");
    }

    req.session.user = {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || ""
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save error:", err);
        req.flash("error", "Demo login failed");
        return res.redirect("/login");
      }

      req.flash("success", `Logged in as Demo ${role.toUpperCase()}: ${user.name}`);
      
      if (user.role === "admin") return res.redirect("/admin/dashboard");
      if (user.role === "doctor") return res.redirect("/doctor/dashboard");
      if (user.role === "patient") return res.redirect("/patient/dashboard");
      if (user.role === "driver") return res.redirect("/driver/dashboard");

      res.redirect("/");
    });
  } catch (err) {
    req.flash("error", "Quick Login failed: " + err.message);
    res.redirect("/login");
  }
};
