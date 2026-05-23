const { findSpecialization, suggestMedicines, generateSlots } = require("../utils/aiEngine");
const { analyzeSymptoms } = require("../utils/medicalAI");
const doctorModel = require("../models/doctorModel");
const appointmentModel = require("../models/appointmentModel");
const { notifyUser } = require("../utils/notifyHelper");

// Chatbot state logic will mostly be handled by the client, but the server processes intent.
exports.processMessage = async (req, res) => {
  try {
    const { message, step, data, sessionData } = req.body;
    const payload = data || sessionData || {};

    if (step === 0 || step === undefined) {
      return res.json({
        reply: "Hello! I am your AI health assistant. Please describe your symptoms (e.g., 'I have fever and cough').",
        step: 1,
        nextStep: 1
      });
    }

    if (step === 1) {
      const analysis = await analyzeSymptoms(message);
      const specialization = analysis.recommended_specialty;
      const medicines = analysis.medicines;

      const doctors = await doctorModel.searchBySpecialization(specialization);
      const conditions = (analysis.possible_conditions || []).map(c => c.name).join(", ");

      let reply = `Based on your symptoms, possible conditions: ${conditions || "general concern"}.\n`;
      reply += `Specialist recommended: ${specialization}.\n`;
      reply += `Suggested care: ${medicines.join(", ")}.\n`;
      reply += analysis.summary;

      if (!doctors.length) {
        return res.json({
          reply: reply + `\n\nNo ${specialization} doctors available right now. Visit Find Doctors to browse all specialists.`,
          step: 1,
          nextStep: 1,
          sessionData: { symptoms: message, analysis }
        });
      }

      return res.json({
        reply,
        step: 2,
        nextStep: 2,
        doctors: doctors.slice(0, 5).map(d => ({
          id: d.id || d._id,
          name: d.name,
          specialization: d.specialization,
          fees: d.fees
        })),
        sessionData: { symptoms: message, analysis, specialization }
      });
    }

    if (step === 3) {
      // Step 2 (client selects doctor) is handled client-side by sending data directly to step 3.
      // Now the client sends doctor data and date. We generate slots.
      const { doctorId, fromTime, toTime } = data;
      const slots = generateSlots(fromTime, toTime, 30);
      
      let slotHtml = `Please select a time slot:<br/>`;
      slots.forEach(s => {
        slotHtml += `<button class="btn btn-sm btn-outline-success m-1 slot-select-btn" data-slot="${s}">${s}</button>`;
      });

      return res.json({
        reply: slotHtml,
        nextStep: 4
      });
    }

    if (step === 4) {
      // Client confirmed. Create appointment.
      const { doctorId, date, timeSlot, symptoms } = data;
      const patientId = req.session.user.id;

      const appId = await appointmentModel.createAppointment({
        patient_id: patientId,
        doctor_id: doctorId,
        date,
        time_slot: timeSlot,
        symptoms,
        notes: "Booked via AI Assistant"
      });

      const doctor = await doctorModel.getDoctorById(doctorId);
      const io = req.app.get("io");
      if (doctor && io) {
        const payload = {
          appointmentId: appId,
          doctorId,
          doctorUserId: doctor.user_id,
          patientId,
          patientName: req.session.user.name,
          doctorName: doctor.name,
          date,
          time_slot: timeSlot,
          symptoms
        };
        io.to("admins").emit("new-appointment", payload);
        if (doctor.user_id) {
          io.to(`user_${doctor.user_id}`).emit("doctor-notification", {
            type: "new_appointment",
            message: `New appointment from ${req.session.user.name}`,
            appointment: payload
          });
        }
      }

      if (io) {
        await notifyUser(io, patientId, "Appointment Booked", `AI assistant booked your visit with Dr. ${doctor ? doctor.name : "your doctor"}`, "success");
      }

      return res.json({
        reply: `Appointment booked successfully! ID: ${appId}. Dr. ${doctor.name} on ${date} at ${timeSlot}.`,
        step: 5,
        nextStep: 5,
        appointment: { doctorId, patientId, id: appId }
      });
    }

    return res.json({ reply: "How can I help with your health today?", step: 1, nextStep: 1 });

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "An error occurred. Please try again.", step: req.body.step || 1 });
  }
};
