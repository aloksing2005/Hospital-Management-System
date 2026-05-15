const mysql = require("mysql2/promise");
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "hospital_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Test connection function
async function testConnection() {
  try {
    const [rows] = await db.query("SELECT 1");
    console.log("✅ Database connected successfully");
    return true;
  } catch (err) {
    console.error("❌ Database connection failed:", err.message);
    console.error("Please check your .env file and ensure MySQL is running");
    return false;
  }
}

// Initialize tables
async function initDB() {
  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      console.log("⚠️  Running without database. Some features won't work.");
      return;
    }

    // Create database if not exists
    await db.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || "hospital_db"}`);
    await db.query(`USE ${process.env.DB_NAME || "hospital_db"}`);

    // Users table
    await db.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(20) DEFAULT NULL,
        role ENUM('admin', 'doctor', 'patient', 'driver') DEFAULT 'patient',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ambulances table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ambulances (
        id INT AUTO_INCREMENT PRIMARY KEY,
        vehicle_no VARCHAR(20) UNIQUE NOT NULL,
        driver_id INT,
        status ENUM('available', 'busy', 'offline') DEFAULT 'offline',
        current_lat DECIMAL(10, 8),
        current_lng DECIMAL(11, 8),
        FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Ambulance Requests table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ambulance_requests (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT,
        driver_id INT,
        vehicle_id INT,
        pickup_address TEXT,
        emergency_type VARCHAR(100),
        status ENUM('pending', 'accepted', 'arrived', 'completed', 'cancelled') DEFAULT 'pending',
        pickup_lat DECIMAL(10, 8),
        pickup_lng DECIMAL(11, 8),
        eta VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id),
        FOREIGN KEY (driver_id) REFERENCES users(id),
        FOREIGN KEY (vehicle_id) REFERENCES ambulances(id)
      )
    `);

    // Ensure phone column exists (for older tables)
    try {
      await db.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20) DEFAULT NULL");
    } catch (e) {
      // Column might already exist, ignore error
    }

    // Doctors table
    await db.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT,
        name VARCHAR(100) NOT NULL,
        specialization VARCHAR(100),
        location VARCHAR(200),
        photo VARCHAR(255),
        fees INT DEFAULT 0,
        available_from TIME,
        available_to TIME,
        status ENUM('active', 'inactive') DEFAULT 'active',
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Appointments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT,
        doctor_id INT,
        date DATE,
        time_slot VARCHAR(50),
        status ENUM('pending', 'confirmed', 'completed', 'cancelled') DEFAULT 'pending',
        symptoms TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id),
        FOREIGN KEY (doctor_id) REFERENCES doctors(id)
      )
    `);

    // Prescriptions table
    await db.query(`
      CREATE TABLE IF NOT EXISTS prescriptions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        appointment_id INT,
        doctor_id INT,
        patient_id INT,
        disease VARCHAR(100),
        medicines TEXT,
        file_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      )
    `);

    // Payments table
    await db.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT,
        appointment_id INT,
        amount INT,
        razorpay_order_id VARCHAR(100),
        razorpay_payment_id VARCHAR(100),
        status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Messages table
    await db.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        sender_id INT,
        receiver_id INT,
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Reviews table
    await db.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT,
        patient_id INT,
        appointment_id INT,
        rating INT CHECK (rating >= 1 AND rating <= 5),
        review TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id),
        FOREIGN KEY (patient_id) REFERENCES users(id),
        FOREIGN KEY (appointment_id) REFERENCES appointments(id)
      )
    `);

    // Doctor Leaves table
    await db.query(`
      CREATE TABLE IF NOT EXISTS doctor_leaves (
        id INT AUTO_INCREMENT PRIMARY KEY,
        doctor_id INT,
        date DATE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE
      )
    `);

    // Lab Reports table
    await db.query(`
      CREATE TABLE IF NOT EXISTS lab_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT,
        report_name VARCHAR(255),
        test_type VARCHAR(100),
        file_path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Medicine Reminders table
    await db.query(`
      CREATE TABLE IF NOT EXISTS medicine_reminders (
        id INT AUTO_INCREMENT PRIMARY KEY,
        patient_id INT,
        medicine_name VARCHAR(255),
        dosage VARCHAR(100),
        time TIME,
        status ENUM('active', 'inactive') DEFAULT 'active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Hospital Resources table
    await db.query(`
      CREATE TABLE IF NOT EXISTS hospital_resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        resource_name VARCHAR(255) UNIQUE NOT NULL,
        total_quantity INT DEFAULT 0,
        available_quantity INT DEFAULT 0,
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Insert default resources
    const [resourceRows] = await db.query("SELECT COUNT(*) as count FROM hospital_resources");
    if (resourceRows[0].count === 0) {
      await db.query(`
        INSERT INTO hospital_resources (resource_name, total_quantity, available_quantity) VALUES 
        ('ICU Beds', 50, 15),
        ('General Ward Beds', 200, 80),
        ('Oxygen Cylinders', 500, 320),
        ('A+ Blood (Units)', 100, 45),
        ('O- Blood (Units)', 50, 12)
      `);
    }

    // Insert default admin
    const bcrypt = require("bcryptjs");
    const hashedPass = bcrypt.hashSync("admin123", 10);
    await db.query(
      `INSERT IGNORE INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
      ["Admin", "admin@hms.com", hashedPass, "admin"]
    );

    // Insert a default driver for testing
    const driverPass = bcrypt.hashSync("driver123", 10);
    await db.query(
      `INSERT IGNORE INTO users (name, email, password, role, phone) VALUES (?, ?, ?, ?, ?)`,
      ["John Driver", "driver@hms.com", driverPass, "driver", "9988776655"]
    );
    const [driver] = await db.query("SELECT id FROM users WHERE email = 'driver@hms.com'");
    if (driver.length > 0) {
      await db.query(
        `INSERT IGNORE INTO ambulances (vehicle_no, driver_id, status) VALUES (?, ?, ?)`,
        ["AMB-101", driver[0].id, "available"]
      );
    }

    console.log("✅ Database initialized successfully");
  } catch (err) {
    console.error("❌ DB Init Error:", err.message);
  }
}

initDB();

module.exports = db;
