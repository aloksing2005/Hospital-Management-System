const cron = require('node-cron');
const { Appointment, Doctor, User } = require('../config/db');
const mailer = require('./mailer');
const sms = require('./sms');

const startReminderCron = () => {
  // Run every 15 minutes to check for appointments in the next hour
  cron.schedule('*/15 * * * *', async () => {
    console.log("Running reminder cron job...");
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      // Find confirmed appointments for today
      const appointments = await Appointment.find({
        status: "confirmed",
        date: { $gte: startOfDay, $lte: endOfDay }
      })
        .populate({ path: "patient_id", select: "name email phone" })
        .populate({ path: "doctor_id", select: "name" })
        .lean();

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
          const patientName = app.patient_id ? app.patient_id.name : "Patient";
          const patientEmail = app.patient_id ? app.patient_id.email : null;
          const patientPhone = app.patient_id ? app.patient_id.phone : null;
          const doctorName = app.doctor_id ? app.doctor_id.name : "Doctor";

          console.log(`Sending reminder for appointment ${app._id} to ${patientName}`);

          const subject = "Appointment Reminder";
          const text = `Hi ${patientName}, this is a reminder for your appointment with Dr. ${doctorName} today at ${app.time_slot}.`;

          if (patientEmail) {
            mailer.sendMail(patientEmail, subject, text).catch(err => console.error("Email fail:", err));
          }
          if (patientPhone) {
            sms.sendSMS(patientPhone, text).catch(err => console.error("SMS fail:", err));
          }
        }
      }
    } catch (err) {
      console.error("Cron Error:", err);
    }
  });
};

module.exports = startReminderCron;
