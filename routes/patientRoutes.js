const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const chatController = require("../controllers/chatController");
const reviewController = require("../controllers/reviewController");
const { isPatient } = require("../middleware/auth");

router.get("/dashboard", isPatient, patientController.getDashboard);
router.get("/doctors", isPatient, patientController.getDoctors);
router.get("/doctors/:id", isPatient, patientController.getDoctorDetail);
router.post("/book-appointment", isPatient, patientController.bookAppointment);

router.get("/appointments", isPatient, patientController.getAppointments);
router.post("/appointments/cancel/:id", isPatient, patientController.cancelAppointment);

router.get("/history", isPatient, patientController.getHistory);
router.get("/ambulance", isPatient, patientController.getAmbulance);
router.post("/ambulance/request", isPatient, require("../controllers/ambulanceController").postRequestAmbulance);

router.get("/prescriptions", isPatient, patientController.getPrescriptions);
router.get("/symptom-checker", isPatient, patientController.getAISymptomChecker);
router.post("/symptom-checker", isPatient, patientController.postAISymptomChecker);
router.get("/chat", isPatient, patientController.getChat);

router.get("/ai-chat", isPatient, (req, res) => {
  res.render("patient/ai-chat", { user: req.session.user });
});
router.post("/ai-chat/process", isPatient, chatController.processMessage);

router.get("/lab-reports", isPatient, patientController.getLabReports);
router.get("/analytics", isPatient, patientController.getAnalytics);
router.get("/reminders", isPatient, patientController.getReminders);
router.post("/reminders/add", isPatient, patientController.postReminder);

router.get("/vitals", isPatient, patientController.getVitals);
router.get("/health-report.pdf", isPatient, patientController.downloadHealthReport);

router.get("/ai-voice", isPatient, (req, res) => {
  res.render("patient/ai-voice", { user: req.session.user });
});

router.get("/diet-planner", isPatient, (req, res) => {
  res.render("patient/diet-planner", { user: req.session.user });
});

router.get("/wellbeing", isPatient, patientController.getWellbeing);

router.get("/navigator", isPatient, (req, res) => {
  res.render("patient/navigator", { user: req.session.user });
});

router.get("/parking", isPatient, (req, res) => {
  res.render("patient/parking", { user: req.session.user });
});

router.get("/heroes", isPatient, (req, res) => {
  res.render("patient/heroes", { user: req.session.user });
});

router.get("/pharmacy", isPatient, patientController.getPharmacy);
router.get("/notifications", isPatient, patientController.getNotifications);
router.post("/notifications/read/:id", isPatient, patientController.markNotificationRead);
router.get("/bills", isPatient, patientController.getBills);

router.get("/insurance", isPatient, (req, res) => {
  res.render("patient/insurance", { user: req.session.user });
});

router.get("/donor-registry", isPatient, patientController.getDonorRegistry);
router.post("/donor-registry/register", isPatient, patientController.registerAsDonor);

router.post("/review", isPatient, reviewController.submitReview);

module.exports = router;
