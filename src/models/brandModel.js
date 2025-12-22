// src/models/brandModel.js
const db = require('../config/db');

const getAllBrands = async ({ page = 1, limit = 10, isActive }) => {
    let query = 'SELECT * FROM product_brands';
    const params = [];
    if (isActive !== undefined) {
        query += ' WHERE is_active = $1';
        params.push(isActive);
    }
    query += ` ORDER BY id LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(query, params);
    return rows;
};

const getBrandById = async (id) => {
    const { rows } = await db.query(
        'SELECT * FROM product_brands WHERE id = $1',
        [id]
    );
    return rows[0];
};

const getBrandByName = async (name) => {
    const { rows } = await db.query(
        'SELECT * FROM product_brands WHERE name = $1',
        [name]
    );
    return rows[0];
};

const createBrand = async (data) => {
    const { name, description, website, logo_url, is_active } = data;
    const { rows } = await db.query(
        `INSERT INTO product_brands (name, description, website, logo_url, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, description, website, logo_url, is_active]
    );
    return rows[0];
};

const updateBrand = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE product_brands SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );
    return rows[0];
};

const deleteBrand = async (id) => {
    await db.query('DELETE FROM product_brands WHERE id = $1', [id]);
};

module.exports = {
    getAllBrands,
    getBrandById,
    getBrandByName,
    createBrand,
    updateBrand,
    deleteBrand,
};
