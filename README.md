# 🏥 Hospital Management System (HMS)

A complete **Real-time Hospital Management System** built with Node.js, Express, MySQL, Socket.IO, and EJS.

## ✨ Features

### 👨‍⚕️ Admin Dashboard
- Real-time statistics (patients, doctors, appointments)
- Manage doctors (add, delete)
- View all patients
- Manage all appointments with live status updates
- Reports & analytics

### 👨‍⚕️ Doctor Dashboard
- View today's schedule
- Manage appointments (confirm, complete)
- Generate PDF prescriptions
- Update profile
- Real-time chat with patients
- Live notifications for new bookings

### 🧑‍⚕️ Patient Dashboard
- Search & book appointments with doctors
- AI-powered symptom checker
- View appointment history with live status
- Download prescription PDFs
- Real-time chat with doctors
- Online payment via Razorpay

### 🔔 Real-time Features (Socket.IO)
- **Live Hospital Resource Tracking**: Real-time sync for Beds, Blood, and Oxygen levels across all dashboards.
- **Live ICU Bed Monitoring System**: Visual bed occupancy map for Admins with real-time status toggling.
- **Public Live OPD Queue Display**: Professional waiting-room dashboard showing live token calls and room assignments.
- **Real-Time Patient Vitals Monitor**: Simulated IoT vitals (Heart Rate, SpO2, BP, Temp) with live animations and critical alerts for doctors.
- **Automated Lab Reports**: Instant notifications when new lab reports (PDF/Image) are uploaded by Admin.
- **Live Queue Tracker**: Real-time token system that alerts patients when it's their turn to see the doctor.
- **Instant Chat**: Real-time messaging between doctors and patients.
- **Live Notifications**: Toast alerts for bookings, status updates, and prescriptions.
- **Emergency SOS**: One-click SOS for patients to alert all doctors and admins.

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd hospital-management-system
npm install
```

### 2. Setup Database
- Create MySQL database: `hospital_db`
- Update `.env` file with your DB credentials

### 3. Configure Environment
Edit `.env` file:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=hospital_db

EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

RAZORPAY_KEY_ID=your_razorpay_key_id
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

SESSION_SECRET=your_super_secret_session_key_2024
```

### 4. Start Server
```bash
# Development
npm run dev

# Production
npm start
```

### 5. Default Login
- **Admin**: `admin@hms.com` / `admin123`

## 📁 Project Structure
```
hospital-management-system/
├── config/
│   ├── db.js          # MySQL connection & auto-init tables
│   └── payment.js     # Razorpay config
├── controllers/
│   ├── authController.js      # Login, register, OTP
│   ├── adminController.js     # Admin dashboard & management
│   ├── doctorController.js    # Doctor panel & prescriptions
│   ├── patientController.js   # Patient booking & AI
│   └── paymentController.js   # Razorpay payments
├── middleware/
│   ├── auth.js        # Role-based authentication
│   └── upload.js      # Multer file upload
├── models/
│   ├── userModel.js
│   ├── doctorModel.js
│   ├── appointmentModel.js
│   ├── prescriptionModel.js
│   └── labReportModel.js
├── routes/
│   ├── authRoutes.js
│   ├── adminRoutes.js
│   ├── doctorRoutes.js
│   ├── patientRoutes.js
│   └── paymentRoutes.js
├── utils/
│   ├── aiEngine.js          # Symptom analysis & slot generation
│   ├── generatePrescription.js  # PDFKit prescription generator
│   ├── mailer.js            # Nodemailer email
│   ├── otpGenerator.js      # 6-digit OTP
│   ├── otpStore.js          # In-memory OTP store
│   └── sms.js               # Twilio SMS
├── views/
│   ├── layouts/main.ejs
│   ├── partials/header.ejs
│   ├── partials/footer.ejs
│   ├── admin/          # Dashboard, doctors, patients, appointments, reports, lab-reports, resources
│   ├── doctor/         # Dashboard, appointments, profile, prescription, chat
│   ├── patient/        # Dashboard, doctors, appointments, prescriptions, lab-reports, symptom-checker, chat
│   ├── auth/           # Login, register
│   ├── home.ejs
│   ├── 404.ejs
│   └── payment.ejs
├── public/             # CSS, JS, images, prescriptions
├── server.js           # Main server with Socket.IO
├── package.json
└── .env
```

## 🔐 Authentication & Roles
- **Admin**: Full system access
- **Doctor**: Manage appointments, generate prescriptions
- **Patient**: Book appointments, AI symptom check, chat

## 💳 Payment Integration
- Razorpay payment gateway
- Create order → Verify signature
- Payment history tracking

## 📧 Notifications
- Email OTP verification
- Real-time Socket.IO notifications
- Toast alerts for all users

## 🤖 AI Symptom Checker
- Keyword-based symptom analysis
- Suggests specialization
- Recommends common medicines
- **Disclaimer**: AI suggestions only, consult doctor for proper diagnosis

## 💬 Real-time Chat
- Doctor ↔ Patient messaging
- Socket.IO powered
- Persistent chat interface

## 🎨 UI/UX
- Bootstrap 5 responsive design
- Custom CSS with animations
- Font Awesome icons
- Poppins font family
- Mobile-friendly sidebar

## 📄 Prescription PDF
- Auto-generated with PDFKit
- Doctor details, patient info, medicines
- Downloadable PDF format

## 🛡️ Security
- bcrypt password hashing
- Session-based authentication
- Role-based access control
- Environment variable protection

## 📞 Contact
For issues or suggestions, please reach out!

---
**Built with ❤️ for better healthcare management**
