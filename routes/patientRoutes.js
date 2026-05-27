const express = require("express");
const router = express.Router();
const patientController = require("../controllers/patientController");
const patientFeatures = require("../controllers/patientFeaturesController");
const aiConsultationController = require("../controllers/aiConsultationController");
const chatController = require("../controllers/chatController");
const realChatController = require("../controllers/realChatController");
const { isPatient } = require("../middleware/auth");

router.get("/dashboard", isPatient, patientController.getDashboard);
router.get("/doctors", isPatient, patientController.getDoctors);
router.get("/doctors/:id", isPatient, patientController.getDoctorDetail);
router.post("/book-appointment", isPatient, patientController.bookAppointment);

router.get("/appointments", isPatient, patientController.getAppointments);
router.post("/appointments/cancel/:id", isPatient, patientController.cancelAppointment);
router.post("/appointments/check-in", isPatient, patientFeatures.checkInEarly);
router.post("/review", isPatient, patientController.submitReview);

router.get("/history", isPatient, patientController.getHistory);
router.get("/ambulance", isPatient, patientController.getAmbulance);
router.post("/ambulance/request", isPatient, require("../controllers/ambulanceController").postRequestAmbulance);

router.get("/prescriptions", isPatient, patientController.getPrescriptions);
router.get("/symptom-checker", isPatient, patientController.getAISymptomChecker);
router.post("/symptom-checker", isPatient, patientController.postAISymptomChecker);
router.get("/chat", isPatient, patientController.getChat);

router.get("/chat/conversations", isPatient, realChatController.getConversations);
router.get("/chat/history/:otherUserId", isPatient, realChatController.getChatHistory);
router.post("/chat/send", isPatient, realChatController.sendMessage);
router.post("/chat/mark-read", isPatient, realChatController.markAsRead);
router.get("/chat/unread-count", isPatient, realChatController.getUnreadCount);

router.get("/ai-chat", isPatient, (req, res) => {
  res.render("patient/ai-chat", { user: req.session.user });
});
router.post("/ai-chat/process", isPatient, chatController.processMessage);

// AI Video Consultation
router.get("/ai-consultation", isPatient, aiConsultationController.getConsultationPage);
router.post("/ai-consultation/analyze", isPatient, aiConsultationController.analyzeSymptoms);
router.post("/ai-consultation/save", isPatient, aiConsultationController.saveConsultation);
router.post("/ai-consultation/audit-medications", isPatient, aiConsultationController.auditMedications);
router.get("/ai-consultation/history", isPatient, aiConsultationController.getHistory);
router.get("/ai-consultation/telemetry", isPatient, aiConsultationController.getLiveTelemetry);
router.get("/ai-consultation/:id", isPatient, aiConsultationController.getConsultationDetail);

router.get("/lab-reports", isPatient, patientController.getLabReports);
router.get("/lab-reports/blood", isPatient, patientFeatures.getBloodProfile);
router.get("/analytics", isPatient, patientController.getAnalytics);
router.get("/reminders", isPatient, patientController.getReminders);
router.post("/reminders/add", isPatient, patientController.postReminder);
router.post("/reminders/delete/:id", isPatient, patientController.deleteReminder);

router.get("/vitals", isPatient, patientController.getVitals);
router.get("/health-report.pdf", isPatient, patientController.downloadHealthReport);

router.get("/ai-voice", isPatient, (req, res) => {
  res.render("patient/ai-voice", { user: req.session.user });
});

router.get("/diet-planner", isPatient, (req, res) => {
  res.render("patient/diet-planner", { user: req.session.user });
});

router.get("/wellbeing", isPatient, patientFeatures.getWellbeing);
router.post("/wellbeing/log", isPatient, patientFeatures.logWellbeing);

router.get("/navigator", isPatient, (req, res) => {
  res.render("patient/navigator", { user: req.session.user });
});

router.get("/parking", isPatient, patientFeatures.getParking);
router.post("/parking/book", isPatient, patientFeatures.bookParking);
router.post("/parking/cancel/:id", isPatient, patientFeatures.cancelParking);

router.get("/heroes", isPatient, (req, res) => {
  res.render("patient/heroes", { user: req.session.user });
});

router.get("/pharmacy", isPatient, patientController.getPharmacy);
router.post("/pharmacy/order", isPatient, patientFeatures.placePharmacyOrder);
router.get("/pharmacy/orders", isPatient, patientFeatures.getPharmacyOrders);

router.get("/notifications", isPatient, patientController.getNotifications);
router.get("/notifications/api", isPatient, patientFeatures.getNotificationsApi);
router.post("/notifications/read/:id", isPatient, patientController.markNotificationRead);
router.post("/notifications/read-all", isPatient, patientFeatures.markAllNotificationsRead);

router.get("/bills", isPatient, patientController.getBills);

router.get("/insurance", isPatient, patientFeatures.getInsurance);
router.post("/insurance/claim", isPatient, patientFeatures.submitInsuranceClaim);

router.post("/sos", isPatient, patientFeatures.triggerSOS);

router.get("/donor-registry", isPatient, patientController.getDonorRegistry);
router.post("/donor-registry/register", isPatient, patientController.registerAsDonor);

module.exports = router;
