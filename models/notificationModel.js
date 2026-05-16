const db = require('../config/db');

class NotificationModel {
    static async create(userId, title, message, type = 'info') {
        const [result] = await db.query(
            'INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, ?)',
            [userId, title, message, type]
        );
        return result.insertId;
    }

    static async getByUser(userId) {
        const [rows] = await db.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 20',
            [userId]
        );
        return rows;
    }

    static async markAsRead(id) {
        await db.query('UPDATE notifications SET is_read = TRUE WHERE id = ?', [id]);
    }

    static async getUnreadCount(userId) {
        const [rows] = await db.query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE',
            [userId]
        );
        return rows[0].count;
    }
}

module.exports = NotificationModel;
