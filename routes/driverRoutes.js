const express = require('express');
const router = express.Router();
const ambulanceController = require('../controllers/ambulanceController');
const { isDriver } = require('../middleware/auth');

router.get('/dashboard', isDriver, ambulanceController.getDriverDashboard);
router.post('/accept-request', isDriver, ambulanceController.acceptRequest);
router.post('/reject-request', isDriver, ambulanceController.rejectRequest);
router.post('/update-location', isDriver, ambulanceController.updateLocation);
router.post('/update-trip-status', isDriver, ambulanceController.updateTripStatus);
router.post('/complete-trip', isDriver, ambulanceController.completeTrip);

module.exports = router;