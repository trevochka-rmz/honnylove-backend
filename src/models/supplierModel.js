// src/models/supplierModel.js
const db = require('../config/db');

const getAllSuppliers = async ({
    page = 1,
    limit = 10,
    status,
    categoryId,
}) => {
    let query = 'SELECT * FROM suppliers';
    const params = [];
    let where = '';
    if (status) where += ` status = $${params.length + 1}`;
    params.push(status);
    if (categoryId)
        where += (where ? ' AND' : '') + ` category_id = $${params.length + 1}`;
    params.push(categoryId);
    if (where) query += ' WHERE' + where;
    query += ` ORDER BY id LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(query, params);
    return rows;
};

const getSupplierById = async (id) => {
    const { rows } = await db.query('SELECT * FROM suppliers WHERE id = $1', [
        id,
    ]);
    return rows[0];
};

const createSupplier = async (data) => {
    // Все поля по схеме
    const fields = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
    const { rows } = await db.query(
        `INSERT INTO suppliers (${fields}) VALUES (${placeholders}) RETURNING *`,
        values
    );
    return rows[0];
};

const updateSupplier = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE suppliers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );
    return rows[0];
};

const deleteSupplier = async (id) => {
    await db.query('DELETE FROM suppliers WHERE id = $1', [id]);
};

const getSuppliersByCategory = async (categoryId) => {
    const { rows } = await db.query(
        'SELECT * FROM suppliers WHERE category_id = $1',
        [categoryId]
    );
    return rows;
};

// Для supplier_categories, если отдельно нужно
const getAllSupplierCategories = async () => {
    const { rows } = await db.query('SELECT * FROM supplier_categories');
    return rows;
};

module.exports = {
    getAllSuppliers,
    getSupplierById,
    createSupplier,
    updateSupplier,
    deleteSupplier,
    getSuppliersByCategory,
    getAllSupplierCategories,
};
