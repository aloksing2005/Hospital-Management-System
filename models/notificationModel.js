const { Notification } = require("../config/db");

class NotificationModel {
    static async create(userId, title, message, type = "info") {
        const notif = await Notification.create({ user_id: userId, title, message, type });
        return notif._id;
    }

    static async getByUser(userId) {
        const rows = await Notification.find({ user_id: userId })
            .sort({ created_at: -1 })
            .limit(20)
            .lean();
        return rows.map(r => ({ ...r, id: r._id }));
    }

    static async markAsRead(id) {
        await Notification.findByIdAndUpdate(id, { is_read: true });
    }

    static async getUnreadCount(userId) {
        return await Notification.countDocuments({ user_id: userId, is_read: false });
    }
}

module.exports = NotificationModel;
