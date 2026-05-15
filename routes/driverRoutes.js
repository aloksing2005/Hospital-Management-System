const express = require('express');
const router = express.Router();
const ambulanceController = require('../controllers/ambulanceController');
const { isDriver } = require('../middleware/auth');

router.get('/dashboard', isDriver, ambulanceController.getDriverDashboard);
router.post('/accept-request', isDriver, ambulanceController.acceptRequest);
router.post('/update-location', isDriver, ambulanceController.updateLocation);
router.post('/complete-trip', isDriver, ambulanceController.completeTrip);

module.exports = router;
