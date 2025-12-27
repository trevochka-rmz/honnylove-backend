// src/models/inventoryModel.js
const db = require('../config/db');

const getInventoryByProduct = async (productId) => {
    const { rows } = await db.query(
        'SELECT * FROM product_inventory WHERE product_id = $1',
        [productId]
    );
    return rows;
};

const getInventory = async (productId, locationId) => {
    const { rows } = await db.query(
        'SELECT * FROM product_inventory WHERE product_id = $1 AND location_id = $2',
        [productId, locationId]
    );
    return rows[0] || { quantity: 0 };
};

const updateInventory = async (productId, locationId, data) => {
    const existing = await getInventory(productId, locationId);
    if (!existing.id) {
        const { quantity, min_stock_level } = data;
        const { rows } = await db.query(
            `INSERT INTO product_inventory (product_id, location_id, quantity, min_stock_level)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [productId, locationId || 1, quantity, min_stock_level || 0]
        );
        return rows[0];
    }
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 3}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE product_inventory SET ${fields}, last_updated = CURRENT_TIMESTAMP
         WHERE product_id = $1 AND location_id = $2 RETURNING *`,
        [productId, locationId || existing.location_id, ...values]
    );
    return rows[0];
};

// ИСПРАВЛЕННЫЙ МЕТОД getTotalStock
const getTotalStock = async (productId) => {
    const { rows } = await db.query(
        'SELECT SUM(quantity) AS total FROM product_inventory WHERE product_id = $1',
        [productId]
    );

    // Возвращаем 0 если total null или undefined
    return rows[0]?.total !== null ? rows[0]?.total : 0;
};

const getAllLocations = async () => {
    const { rows } = await db.query('SELECT * FROM product_locations');
    return rows;
};

module.exports = {
    getInventoryByProduct,
    getInventory,
    updateInventory,
    getTotalStock,
    getAllLocations,
};
