const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");
const { isDoctor } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.get("/dashboard", isDoctor, doctorController.getDashboard);
router.get("/profile", isDoctor, doctorController.getProfile);
router.post("/profile", isDoctor, upload.single("photo"), doctorController.updateProfile);

router.get("/appointments", isDoctor, doctorController.getAppointments);
router.get("/anatomy", isDoctor, (req, res) => {
  res.render("doctor/anatomy", { user: req.session.user });
});
router.post("/appointments/update/:id", isDoctor, doctorController.updateAppointmentStatus);

router.get("/prescription/:id", isDoctor, doctorController.getPrescriptionForm);
router.post("/prescription", isDoctor, doctorController.savePrescription);

router.get("/chat", isDoctor, doctorController.getChat);

router.post("/leaves", isDoctor, doctorController.addLeave);
router.post("/leaves/delete/:id", isDoctor, doctorController.removeLeave);

module.exports = router;
