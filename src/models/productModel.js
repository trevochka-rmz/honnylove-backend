// src/models/productModel.js
const db = require('../config/db');

const getAllProducts = async ({
    page = 1,
    limit = 10,
    categoryId,
    brandId,
    search,
    minPrice,
    maxPrice,
    isFeatured,
    isNew,
    isBestseller,
}) => {
    let query = 'SELECT * FROM product_products';
    const params = [];
    let where = '';
    if (categoryId) where += ` category_id = $${params.length + 1}`;
    params.push(categoryId);
    if (brandId)
        where += (where ? ' AND' : '') + ` brand_id = $${params.length + 1}`;
    params.push(brandId);
    if (search)
        where +=
            (where ? ' AND' : '') +
            ` (name ILIKE $${params.length + 1} OR description ILIKE $${
                params.length + 1
            })`;
    params.push(`%${search}%`);
    if (minPrice)
        where +=
            (where ? ' AND' : '') + ` retail_price >= $${params.length + 1}`;
    params.push(minPrice);
    if (maxPrice)
        where +=
            (where ? ' AND' : '') + ` retail_price <= $${params.length + 1}`;
    params.push(maxPrice);
    if (isFeatured !== undefined)
        where += (where ? ' AND' : '') + ` is_featured = $${params.length + 1}`;
    params.push(isFeatured);
    if (isNew !== undefined)
        where += (where ? ' AND' : '') + ` is_new = $${params.length + 1}`;
    params.push(isNew);
    if (isBestseller !== undefined)
        where +=
            (where ? ' AND' : '') + ` is_bestseller = $${params.length + 1}`;
    params.push(isBestseller);
    if (where) query += ' WHERE' + where;
    query += ` ORDER BY id LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(query, params);
    return rows;
};

const getProductById = async (id) => {
    const { rows } = await db.query(
        'SELECT * FROM product_products WHERE id = $1',
        [id]
    );
    return rows[0];
};

const createProduct = async (data) => {
    // Поля по схеме, триггеры сделают sku/slug
    const fields = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
    const { rows } = await db.query(
        `INSERT INTO product_products (${fields}) VALUES (${placeholders}) RETURNING *`,
        values
    );
    return rows[0];
};

const updateProduct = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE product_products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );
    return rows[0];
};

const deleteProduct = async (id) => {
    await db.query('DELETE FROM product_products WHERE id = $1', [id]);
};

const searchProducts = async (query) => {
    const { rows } = await db.query(
        'SELECT * FROM product_products WHERE name ILIKE $1 OR description ILIKE $1 OR sku ILIKE $1',
        [`%${query}%`]
    );
    return rows;
};

const getProductsByBrand = async (brandId) => {
    const { rows } = await db.query(
        'SELECT * FROM product_products WHERE brand_id = $1',
        [brandId]
    );
    return rows;
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
    getProductsByBrand,
};
