const { findSpecialization, suggestMedicines, generateSlots } = require("../utils/aiEngine");
const doctorModel = require("../models/doctorModel");
const appointmentModel = require("../models/appointmentModel");

// Chatbot state logic will mostly be handled by the client, but the server processes intent.
exports.processMessage = async (req, res) => {
  try {
    const { message, step, data } = req.body;
    // step: 0 = initial (ask symptoms), 1 = symptoms provided (find doctor), 2 = doctor selected (ask date), 3 = date provided (show slots), 4 = slot selected (book)

    if (step === 0) {
      return res.json({ 
        reply: "Hello! I am your AI assistant. Could you describe your symptoms? (e.g., 'I have a headache')", 
        nextStep: 1 
      });
    }

    if (step === 1) {
      const specialization = findSpecialization(message);
      const medicines = suggestMedicines(message);

      if (!specialization) {
        return res.json({
          reply: "I couldn't detect a specific specialization for your symptoms. Here is a basic suggestion: " + medicines.join(", ") + ". Please try describing it differently.",
          nextStep: 1
        });
      }

      // Find doctors with this specialization
      const doctors = await doctorModel.searchBySpecialization(specialization);
      if (doctors.length === 0) {
        return res.json({
          reply: `You need a ${specialization}, but currently no doctors are available in this field.`,
          nextStep: 1
        });
      }

      let docListHtml = `I suggest a ${specialization}. Basic medicine: ${medicines.join(", ")}.<br/>Here are available doctors:<br/>`;
      doctors.forEach(d => {
        docListHtml += `<button class="btn btn-sm btn-outline-primary m-1 doc-select-btn" data-id="${d.id}" data-name="${d.name}" data-from="${d.available_from}" data-to="${d.available_to}">Dr. ${d.name} (Fees: ₹${d.fees})</button>`;
      });

      return res.json({
        reply: docListHtml,
        nextStep: 2,
        symptoms: message
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

      return res.json({
        reply: `✅ Appointment booked successfully! Your appointment ID is ${appId}.`,
        nextStep: 5,
        appointment: { doctorId, patientId, id: appId }
      });
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ reply: "An error occurred.", nextStep: req.body.step });
  }
};
