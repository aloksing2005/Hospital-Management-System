const db = require("../config/db");

function isLoggedIn(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash("error", "Please login first");
  return res.redirect("/login");
}

function ensureAuth(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  req.flash("error", "Please login first");
  return res.redirect("/login");
}

function ensureRole(role) {
  return (req, res, next) => {
    if (req.session && req.session.user && req.session.user.role === role) {
      return next();
    }
    req.flash("error", "Unauthorized access");
    return res.redirect("/login");
  };
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "admin") {
    return next();
  }
  req.flash("error", "Access denied - Admin only");
  return res.redirect("/login");
}

function isDoctor(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "doctor") {
    return next();
  }
  req.flash("error", "Access denied - Doctor only");
  return res.redirect("/login");
}

function isPatient(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "patient") {
    return next();
  }
  req.flash("error", "Access denied - Patient only");
  return res.redirect("/login");
}

function isDriver(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === "driver") {
    return next();
  }
  req.flash("error", "Access denied - Driver only");
  return res.redirect("/login");
}

module.exports = { isLoggedIn, ensureAuth, ensureRole, isAdmin, isDoctor, isPatient, isDriver };
