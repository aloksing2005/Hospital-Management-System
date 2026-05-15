const cron = require('node-cron');
const db = require('../config/db');
const mailer = require('./mailer');
const sms = require('./sms');

const startReminderCron = () => {
  // Run every 15 minutes to check for appointments in the next hour
  cron.schedule('*/15 * * * *', async () => {
    console.log("Running reminder cron job...");
    try {
      // Find appointments that are exactly 1 hour away.
      // E.g., if current time is 10:00, we look for appointments at 11:00.
      // Since time_slot is string like "10:00 - 10:30", we need to parse it.
      
      const [appointments] = await db.query(`
        SELECT a.*, u.name as patient_name, u.email as patient_email, u.phone as patient_phone, d.name as doctor_name 
        FROM appointments a 
        JOIN users u ON a.patient_id = u.id 
        JOIN doctors d ON a.doctor_id = d.id 
        WHERE a.status = 'confirmed' AND a.date = CURDATE()
      `);

      const now = new Date();
      const currentHour = now.getHours();
      const currentMin = now.getMinutes();
      const currentTotalMins = currentHour * 60 + currentMin;

      for (let app of appointments) {
        // Parse "10:00 - 10:30"
        const startTimeStr = app.time_slot.split(' - ')[0];
        const [appHour, appMin] = startTimeStr.split(':').map(Number);
        const appTotalMins = appHour * 60 + appMin;

        // If appointment is between 45 to 60 mins from now, send reminder
        const diffMins = appTotalMins - currentTotalMins;

        if (diffMins > 45 && diffMins <= 60) {
          console.log(`Sending reminder for appointment ${app.id} to ${app.patient_name}`);
          
          const subject = "Appointment Reminder";
          const text = `Hi ${app.patient_name}, this is a reminder for your appointment with Dr. ${app.doctor_name} today at ${app.time_slot}.`;

          if (app.patient_email) {
            mailer.sendMail(app.patient_email, subject, text).catch(err => console.error("Email fail:", err));
          }
          if (app.patient_phone) {
            sms.sendSMS(app.patient_phone, text).catch(err => console.error("SMS fail:", err));
          }
        }
      }
    } catch (err) {
      console.error("Cron Error:", err);
    }
  });
};

module.exports = startReminderCron;
