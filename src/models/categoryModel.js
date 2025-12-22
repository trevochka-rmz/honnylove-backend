// src/models/categoryModel.js
const db = require('../config/db');

const getAllCategories = async ({ page = 1, limit = 10, isActive }) => {
    let query = 'SELECT * FROM product_categories';
    const params = [];
    if (isActive !== undefined) {
        query += ' WHERE is_active = $1';
        params.push(isActive);
    }
    query += ` ORDER BY display_order, id LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(query, params);
    return rows;
};

const getCategoryById = async (id) => {
    const { rows } = await db.query(
        'SELECT * FROM product_categories WHERE id = $1',
        [id]
    );
    return rows[0];
};

const createCategory = async (data) => {
    const { name, parent_id, description, is_active, display_order } = data;
    const { rows } = await db.query(
        `INSERT INTO product_categories (name, parent_id, description, is_active, display_order)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, parent_id, description, is_active, display_order]
    );
    return rows[0];
};

const updateCategory = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE product_categories SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );
    return rows[0];
};

const deleteCategory = async (id) => {
    await db.query('DELETE FROM product_categories WHERE id = $1', [id]);
};

const getCategoriesTree = async () => {
    const query = `
    WITH RECURSIVE category_tree AS (
      SELECT id, name, parent_id, 0 AS level
      FROM product_categories
      WHERE parent_id IS NULL
      UNION ALL
      SELECT c.id, c.name, c.parent_id, ct.level + 1
      FROM product_categories c
      JOIN category_tree ct ON c.parent_id = ct.id
    )
    SELECT * FROM category_tree ORDER BY level, id;
  `;
    const { rows } = await db.query(query);
    return rows;
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoriesTree,
};
