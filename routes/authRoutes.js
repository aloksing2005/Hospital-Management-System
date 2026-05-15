const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.get("/register", authController.showRegister);
router.post("/register", authController.register);

router.get("/login", authController.showLogin);
router.post("/login", authController.login);

router.get("/logout", authController.logout);

router.post("/send-otp", authController.sendOTP);
router.post("/verify-otp", authController.verifyOTP);

router.get("/public-queue", (req, res) => {
  res.render("public-queue", { title: "Live OPD Queue - HMS", user: req.session.user || null });
});

module.exports = router;
