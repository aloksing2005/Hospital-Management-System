const { body, validationResult, param } = require('express-validator');

// Validation middleware
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value
      }))
    });
  }
  next();
};

// Common validation rules
const validationRules = {
  // User validation
  register: [
    body('name').trim().notEmpty().withMessage('Name is required')
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('email').trim().notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
      .isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('phone').optional().trim()
      .isMobilePhone('any').withMessage('Invalid phone number'),
    body('role').optional().isIn(['patient', 'doctor', 'admin', 'driver'])
      .withMessage('Invalid role')
  ],

  login: [
    body('email').trim().notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('password').notEmpty().withMessage('Password is required')
  ],

  // Appointment validation
  bookAppointment: [
    body('doctor_id').notEmpty().withMessage('Doctor ID is required')
      .isMongoId().withMessage('Invalid doctor ID'),
    body('date').notEmpty().withMessage('Date is required')
      .isISO8601().withMessage('Invalid date format'),
    body('time_slot').notEmpty().withMessage('Time slot is required')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)'),
    body('symptoms').optional().trim()
      .isLength({ max: 500 }).withMessage('Symptoms must be less than 500 characters'),
    body('notes').optional().trim()
      .isLength({ max: 1000 }).withMessage('Notes must be less than 1000 characters')
  ],

  updateAppointmentStatus: [
    param('id').isMongoId().withMessage('Invalid appointment ID'),
    body('status').notEmpty().withMessage('Status is required')
      .isIn(['pending', 'confirmed', 'completed', 'cancelled']).withMessage('Invalid status')
  ],

  // Ambulance validation
  ambulanceRequest: [
    body('pickup_location').trim().notEmpty().withMessage('Pickup location is required'),
    body('pickup_lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Invalid latitude'),
    body('pickup_lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Invalid longitude'),
    body('emergency_type').optional().trim()
      .isIn(['cardiac', 'trauma', 'respiratory', 'pregnancy', 'other']).withMessage('Invalid emergency type'),
    body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority')
  ],

  updateAmbulanceStatus: [
    body('requestId').notEmpty().withMessage('Request ID is required')
      .isMongoId().withMessage('Invalid request ID'),
    body('status').notEmpty().withMessage('Status is required')
      .isIn(['pending', 'accepted', 'on_the_way', 'arrived', 'completed', 'cancelled']).withMessage('Invalid status')
  ],

  // Chat validation
  sendMessage: [
    body('receiver_id').notEmpty().withMessage('Receiver ID is required')
      .isMongoId().withMessage('Invalid receiver ID'),
    body('message').trim().notEmpty().withMessage('Message is required')
      .isLength({ min: 1, max: 2000 }).withMessage('Message must be between 1 and 2000 characters')
  ],

  markAsRead: [
    body('sender_id').notEmpty().withMessage('Sender ID is required')
      .isMongoId().withMessage('Invalid sender ID')
  ],

  // Prescription validation
  savePrescription: [
    body('appointmentId').notEmpty().withMessage('Appointment ID is required')
      .isMongoId().withMessage('Invalid appointment ID'),
    body('patientName').optional().trim(),
    body('disease').optional().trim()
      .isLength({ max: 200 }).withMessage('Disease must be less than 200 characters'),
    body('medicines').optional().trim()
      .isLength({ max: 1000 }).withMessage('Medicines must be less than 1000 characters')
  ],

  // Doctor profile validation
  updateDoctorProfile: [
    body('name').optional().trim()
      .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters'),
    body('specialization').optional().trim()
      .isLength({ max: 100 }).withMessage('Specialization must be less than 100 characters'),
    body('location').optional().trim()
      .isLength({ max: 200 }).withMessage('Location must be less than 200 characters'),
    body('fees').optional().isFloat({ min: 0 }).withMessage('Fees must be a positive number'),
    body('available_from').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Invalid time format (HH:MM)'),
    body('available_to').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .withMessage('Invalid time format (HH:MM)')
  ],

  // Blood bank validation
  updateBloodStock: [
    body('blood_group').notEmpty().withMessage('Blood group is required')
      .isIn(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).withMessage('Invalid blood group'),
    body('units').isInt({ min: 0 }).withMessage('Units must be a non-negative integer')
  ],

  // Lab report validation
  uploadLabReport: [
    body('patient_id').notEmpty().withMessage('Patient ID is required')
      .isMongoId().withMessage('Invalid patient ID'),
    body('report_name').trim().notEmpty().withMessage('Report name is required')
      .isLength({ max: 200 }).withMessage('Report name must be less than 200 characters'),
    body('test_type').optional().trim()
      .isLength({ max: 100 }).withMessage('Test type must be less than 100 characters')
  ],

  // Reminder validation
  postReminder: [
    body('medicine_name').trim().notEmpty().withMessage('Medicine name is required')
      .isLength({ max: 200 }).withMessage('Medicine name must be less than 200 characters'),
    body('dosage').optional().trim()
      .isLength({ max: 100 }).withMessage('Dosage must be less than 100 characters'),
    body('time').notEmpty().withMessage('Time is required')
      .matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid time format (HH:MM)')
  ],

  // OTP validation
  sendOTP: [
    body('email').trim().notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail()
  ],

  verifyOTP: [
    body('email').trim().notEmpty().withMessage('Email is required')
      .isEmail().withMessage('Invalid email format')
      .normalizeEmail(),
    body('otp').trim().notEmpty().withMessage('OTP is required')
      .isLength({ min: 4, max: 6 }).withMessage('OTP must be 4-6 digits')
      .isNumeric().withMessage('OTP must contain only numbers')
  ]
};

// Custom validators
const customValidators = {
  isValidDate: (dateString) => {
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  },

  isFutureDate: (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    return date > now;
  },

  isPastDate: (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    return date < now;
  },

  isValidObjectId: (id) => {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }
};

// Error response formatter
const formatErrorResponse = (error, req) => {
  console.error(`Error in ${req.method} ${req.path}:`, error.message);
  
  if (error.name === 'ValidationError') {
    return {
      success: false,
      message: 'Validation Error',
      errors: Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }))
    };
  }

  if (error.name === 'CastError') {
    return {
      success: false,
      message: 'Invalid ID format',
      field: error.path
    };
  }

  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyPattern)[0];
    return {
      success: false,
      message: `${field} already exists`,
      field
    };
  }

  if (error.name === 'UnauthorizedError') {
    return {
      success: false,
      message: 'Unauthorized access'
    };
  }

  return {
    success: false,
    message: error.message || 'Internal Server Error'
  };
};

module.exports = {
  validateRequest,
  validationRules,
  customValidators,
  formatErrorResponse
};
