const { Bill, Appointment, Doctor, User } = require("../config/db");

class BillModel {
    static async createBill(data) {
        const { patient_id, appointment_id, consultation_fee, medicine_charges, lab_charges } = data;
        const total_amount = parseFloat(consultation_fee) + parseFloat(medicine_charges) + parseFloat(lab_charges);
        const bill_number = 'INV-' + Date.now().toString().slice(-8);

        const bill = await Bill.create({
            patient_id, appointment_id, bill_number,
            consultation_fee, medicine_charges, lab_charges, total_amount
        });
        return bill._id;
    }

    static async getByPatient(patientId) {
        const bills = await Bill.find({ patient_id: patientId })
            .sort({ created_at: -1 })
            .lean();

        // Populate doctor name through appointment
        for (let bill of bills) {
            bill.id = bill._id;
            if (bill.appointment_id) {
                const appt = await Appointment.findById(bill.appointment_id).lean();
                if (appt && appt.doctor_id) {
                    const doctor = await Doctor.findById(appt.doctor_id).lean();
                    bill.doctor_name = doctor ? doctor.name : "";
                }
            }
            if (!bill.doctor_name) bill.doctor_name = "";
        }
        return bills;
    }

    static async getById(id) {
        const bill = await Bill.findById(id)
            .populate({ path: "patient_id", select: "name email phone" })
            .lean();

        if (!bill) return null;
        return {
            ...bill,
            id: bill._id,
            patient_name: bill.patient_id ? bill.patient_id.name : "",
            patient_email: bill.patient_id ? bill.patient_id.email : "",
            patient_phone: bill.patient_id ? bill.patient_id.phone : "",
            patient_id: bill.patient_id ? bill.patient_id._id : null
        };
    }

    static async updateStatus(billId, status) {
        await Bill.findByIdAndUpdate(billId, { payment_status: status });
    }
}

module.exports = BillModel;
