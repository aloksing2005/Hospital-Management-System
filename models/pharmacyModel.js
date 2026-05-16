const db = require('../config/db');

class PharmacyModel {
    static async getAll() {
        const [rows] = await db.query('SELECT * FROM pharmacy_inventory ORDER BY medicine_name ASC');
        return rows;
    }

    static async updateStock(id, quantity) {
        await db.query('UPDATE pharmacy_inventory SET stock_quantity = stock_quantity + ? WHERE id = ?', [quantity, id]);
    }

    static async search(query) {
        const [rows] = await db.query(
            'SELECT * FROM pharmacy_inventory WHERE medicine_name LIKE ? OR category LIKE ?',
            [`%${query}%`, `%${query}%`]
        );
        return rows;
    }
}

module.exports = PharmacyModel;
