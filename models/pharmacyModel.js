const { PharmacyInventory } = require("../config/db");

class PharmacyModel {
    static async getAll() {
        const rows = await PharmacyInventory.find().sort({ medicine_name: 1 }).lean();
        return rows.map(r => ({ ...r, id: r._id }));
    }

    static async updateStock(id, quantity) {
        await PharmacyInventory.findByIdAndUpdate(id, { $inc: { stock_quantity: quantity }, last_updated: new Date() });
    }

    static async search(query) {
        const regex = new RegExp(query, "i");
        const rows = await PharmacyInventory.find({
            $or: [{ medicine_name: regex }, { category: regex }]
        }).lean();
        return rows.map(r => ({ ...r, id: r._id }));
    }
}

module.exports = PharmacyModel;
