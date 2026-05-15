const db = require("../config/db");

exports.getAllDoctors = async () => {
  const [rows] = await db.query(`
    SELECT d.*, u.email, COALESCE(AVG(r.rating), 0) as rating, COUNT(r.id) as review_count
    FROM doctors d 
    JOIN users u ON d.user_id = u.id 
    LEFT JOIN reviews r ON d.id = r.doctor_id
    WHERE d.status = 'active'
    GROUP BY d.id
  `);
  return rows;
};

exports.getDoctorById = async (id) => {
  const [rows] = await db.query(`
    SELECT d.*, u.email, COALESCE(AVG(r.rating), 0) as rating, COUNT(r.id) as review_count
    FROM doctors d 
    JOIN users u ON d.user_id = u.id 
    LEFT JOIN reviews r ON d.id = r.doctor_id
    WHERE d.id = ?
    GROUP BY d.id
  `, [id]);
  return rows[0];
};

exports.findByUserId = async (userId) => {
  const [rows] = await db.query("SELECT * FROM doctors WHERE user_id = ?", [userId]);
  return rows[0];
};

exports.addDoctor = async ({ user_id, name, specialization, location, photo, fees, available_from, available_to }) => {
  const [result] = await db.query(
    `INSERT INTO doctors (user_id, name, specialization, location, photo, fees, available_from, available_to) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [user_id, name, specialization, location, photo, fees, available_from, available_to]
  );
  return result.insertId;
};

exports.updateDoctor = async (id, { name, specialization, location, photo, fees, available_from, available_to }) => {
  await db.query(
    `UPDATE doctors SET name=?, specialization=?, location=?, photo=?, fees=?, available_from=?, available_to=? 
     WHERE id=?`,
    [name, specialization, location, photo, fees, available_from, available_to, id]
  );
};

exports.updateDoctorProfile = async (user_id, data) => {
  const { name, specialization, location, photo, available_from, available_to } = data;
  await db.query(
    `UPDATE doctors SET name=?, specialization=?, location=?, photo=?, available_from=?, available_to=? 
     WHERE user_id=?`,
    [name, specialization, location, photo, available_from, available_to, user_id]
  );
};

exports.deleteDoctor = async (id) => {
  await db.query("DELETE FROM doctors WHERE id = ?", [id]);
};

exports.searchDoctors = async (keyword) => {
  const [rows] = await db.query(
    `SELECT d.*, u.email, COALESCE(AVG(r.rating), 0) as rating, COUNT(r.id) as review_count 
     FROM doctors d 
     JOIN users u ON d.user_id = u.id 
     LEFT JOIN reviews r ON d.id = r.doctor_id
     WHERE d.name LIKE ? OR d.specialization LIKE ?
     GROUP BY d.id`,
    [`%${keyword}%`, `%${keyword}%`]
  );
  return rows;
};

exports.searchBySpecialization = async (specialization) => {
  const [rows] = await db.query(
    `SELECT d.*, u.email, COALESCE(AVG(r.rating), 0) as rating, COUNT(r.id) as review_count 
     FROM doctors d 
     JOIN users u ON d.user_id = u.id 
     LEFT JOIN reviews r ON d.id = r.doctor_id
     WHERE d.specialization LIKE ? AND d.status = 'active'
     GROUP BY d.id`,
    [`%${specialization}%`]
  );
  return rows;
};

exports.searchDoctorsAdvanced = async ({ search, specialization, maxFees, minRating, sort }) => {
  let query = `
    SELECT d.*, u.email, COALESCE(AVG(r.rating), 0) as rating, COUNT(r.id) as review_count 
    FROM doctors d 
    JOIN users u ON d.user_id = u.id 
    LEFT JOIN reviews r ON d.id = r.doctor_id
    WHERE d.status = 'active'
  `;
  const params = [];

  if (search) {
    query += ` AND (d.name LIKE ? OR d.specialization LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (specialization) {
    query += ` AND d.specialization = ?`;
    params.push(specialization);
  }
  if (maxFees) {
    query += ` AND d.fees <= ?`;
    params.push(maxFees);
  }

  query += ` GROUP BY d.id`;

  if (minRating) {
    query += ` HAVING rating >= ?`;
    params.push(minRating);
  }

  if (sort === "top_rated") {
    query += ` ORDER BY rating DESC`;
  } else if (sort === "lowest_fees") {
    query += ` ORDER BY fees ASC`;
  } else {
    query += ` ORDER BY d.name ASC`;
  }

  const [rows] = await db.query(query, params);
  return rows;
};

exports.getDoctorStats = async (doctorId) => {
  const [rows] = await db.query(`
    SELECT 
      COUNT(*) as total_appointments,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
    FROM appointments WHERE doctor_id = ?
  `, [doctorId]);
  return rows[0];
};

exports.getLeaves = async (doctorId) => {
  const [rows] = await db.query("SELECT * FROM doctor_leaves WHERE doctor_id = ? ORDER BY date DESC", [doctorId]);
  return rows;
};

exports.addLeave = async (doctorId, date) => {
  const [result] = await db.query("INSERT INTO doctor_leaves (doctor_id, date) VALUES (?, ?)", [doctorId, date]);
  return result.insertId;
};

exports.removeLeave = async (leaveId) => {
  await db.query("DELETE FROM doctor_leaves WHERE id = ?", [leaveId]);
};
