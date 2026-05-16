const db = require('../config/db');

class BillModel {
    static async createBill(data) {
        const { patient_id, appointment_id, consultation_fee, medicine_charges, lab_charges } = data;
        const total_amount = parseFloat(consultation_fee) + parseFloat(medicine_charges) + parseFloat(lab_charges);
        const bill_number = 'INV-' + Date.now().toString().slice(-8);
        
        const [result] = await db.query(
            `INSERT INTO bills (patient_id, appointment_id, bill_number, consultation_fee, medicine_charges, lab_charges, total_amount) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [patient_id, appointment_id, bill_number, consultation_fee, medicine_charges, lab_charges, total_amount]
        );
        return result.insertId;
    }

    static async getByPatient(patientId) {
        const [rows] = await db.query(
            `SELECT b.*, d.name as doctor_name 
             FROM bills b 
             LEFT JOIN appointments a ON b.appointment_id = a.id
             LEFT JOIN doctors d ON a.doctor_id = d.id
             WHERE b.patient_id = ? ORDER BY b.created_at DESC`,
            [patientId]
        );
        return rows;
    }

    static async getById(id) {
        const [rows] = await db.query(
            `SELECT b.*, p.name as patient_name, p.email as patient_email, u_p.phone as patient_phone
             FROM bills b
             JOIN users p ON b.patient_id = p.id
             LEFT JOIN users u_p ON p.id = u_p.id
             WHERE b.id = ?`,
            [id]
        );
        return rows[0];
    }

    static async updateStatus(billId, status) {
        await db.query('UPDATE bills SET payment_status = ? WHERE id = ?', [status, billId]);
    }
}

module.exports = BillModel;
