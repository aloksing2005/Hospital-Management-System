const db = require('../config/db');

class AmbulanceModel {
  static async getAllAmbulances() {
    const [rows] = await db.query(`
      SELECT a.*, u.name as driver_name, u.phone as driver_phone 
      FROM ambulances a
      JOIN users u ON a.driver_id = u.id
    `);
    return rows;
  }

  static async getAmbulanceByDriver(driverId) {
    const [rows] = await db.query('SELECT * FROM ambulances WHERE driver_id = ?', [driverId]);
    return rows[0];
  }

  static async updateStatus(driverId, status) {
    await db.query('UPDATE ambulances SET status = ? WHERE driver_id = ?', [status, driverId]);
  }

  static async updateLocation(driverId, lat, lng) {
    await db.query('UPDATE ambulances SET current_lat = ?, current_lng = ? WHERE driver_id = ?', [lat, lng, driverId]);
  }

  static async createRequest(data) {
    const { patient_id, pickup_address, emergency_type, pickup_lat, pickup_lng } = data;
    const [result] = await db.query(
      'INSERT INTO ambulance_requests (patient_id, pickup_address, emergency_type, pickup_lat, pickup_lng, status) VALUES (?, ?, ?, ?, ?, ?)',
      [patient_id, pickup_address, emergency_type, pickup_lat, pickup_lng, 'pending']
    );
    return result.insertId;
  }

  static async acceptRequest(requestId, driverId, vehicleId) {
    await db.query(
      'UPDATE ambulance_requests SET driver_id = ?, vehicle_id = ?, status = ? WHERE id = ?',
      [driverId, vehicleId, 'accepted', requestId]
    );
    await db.query('UPDATE ambulances SET status = ? WHERE id = ?', ['busy', vehicleId]);
  }

  static async getRequestById(id) {
    const [rows] = await db.query(`
      SELECT ar.*, p.name as patient_name, p.phone as patient_phone, 
             d.name as driver_name, d.phone as driver_phone, a.vehicle_no,
             a.current_lat, a.current_lng
      FROM ambulance_requests ar
      JOIN users p ON ar.patient_id = p.id
      LEFT JOIN users d ON ar.driver_id = d.id
      LEFT JOIN ambulances a ON ar.vehicle_id = a.id
      WHERE ar.id = ?
    `, [id]);
    return rows[0];
  }

  static async getActiveRequestForDriver(driverId) {
    const [rows] = await db.query(
      `SELECT * FROM ambulance_requests WHERE driver_id = ? AND status = 'accepted' ORDER BY id DESC LIMIT 1`,
      [driverId]
    );
    return rows[0];
  }

  static async listAvailableWithCoords() {
    const [rows] = await db.query(`
      SELECT a.*, u.name AS driver_name, u.phone AS driver_phone
      FROM ambulances a
      JOIN users u ON a.driver_id = u.id
      WHERE a.status = 'available' AND a.current_lat IS NOT NULL AND a.current_lng IS NOT NULL
    `);
    return rows;
  }

  static async updateRequestStatus(requestId, status) {
    await db.query('UPDATE ambulance_requests SET status = ? WHERE id = ?', [status, requestId]);
    if (status === 'completed' || status === 'cancelled') {
      const [req] = await db.query('SELECT vehicle_id FROM ambulance_requests WHERE id = ?', [requestId]);
      if (req[0].vehicle_id) {
        await db.query('UPDATE ambulances SET status = ? WHERE id = ?', ['available', req[0].vehicle_id]);
      }
    }
  }

  static async getPendingRequests() {
    const [rows] = await db.query(`
      SELECT ar.*, p.name as patient_name, p.phone as patient_phone
      FROM ambulance_requests ar
      JOIN users p ON ar.patient_id = p.id
      WHERE ar.status = 'pending'
    `);
    return rows;
  }
}

module.exports = AmbulanceModel;
