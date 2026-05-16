const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const { isAdmin } = require("../middleware/auth");
const upload = require("../middleware/upload");

router.get("/command-center", isAdmin, adminController.getCommandCenter);
router.get("/dashboard", isAdmin, adminController.getDashboard);
router.get("/doctors", isAdmin, adminController.getDoctors);
router.get("/patients", isAdmin, adminController.getPatients);
router.get("/appointments", isAdmin, adminController.getAppointments);
router.get("/reports", isAdmin, adminController.getReports);
router.get("/ambulances", isAdmin, adminController.getAmbulances);

router.post("/doctors/add", isAdmin, upload.single("photo"), adminController.addDoctor);
router.post("/doctors/delete/:id", isAdmin, adminController.deleteDoctor);
router.post("/appointments/update/:id", isAdmin, adminController.updateAppointmentStatus);
router.get("/lab-reports", isAdmin, adminController.getLabReports);
router.post("/lab-reports/upload", isAdmin, upload.single("report"), adminController.uploadLabReport);
router.get("/resources", isAdmin, adminController.getResources);
router.get("/blood-bank", isAdmin, adminController.getBloodBank);
router.post("/blood-bank/update", isAdmin, adminController.updateBloodStock);
router.post("/resources/update", isAdmin, adminController.updateResource);

module.exports = router;
