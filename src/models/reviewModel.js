// src/models/reviewModel.js
const db = require('../config/db');

const addReview = async (data) => {
    const { product_id, user_id, rating, comment, is_approved } = data;
    const { rows } = await db.query(
        `INSERT INTO product_reviews (product_id, user_id, rating, comment, is_approved)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [product_id, user_id, rating, comment, is_approved]
    );
    return rows[0];
};

const getApprovedReviewsByProduct = async (
    productId,
    { page = 1, limit = 10 }
) => {
    const { rows } = await db.query(
        `SELECT * FROM product_reviews WHERE product_id = $1 AND is_approved = true
     ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
        [productId, limit, (page - 1) * limit]
    );
    return rows;
};

const getReviewById = async (id) => {
    const { rows } = await db.query(
        'SELECT * FROM product_reviews WHERE id = $1',
        [id]
    );
    return rows[0];
};

const getReviewByUserAndProduct = async (userId, productId) => {
    const { rows } = await db.query(
        'SELECT * FROM product_reviews WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
    );
    return rows[0];
};

const approveReview = async (id) => {
    const { rows } = await db.query(
        `UPDATE product_reviews SET is_approved = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id]
    );
    return rows[0];
};

const deleteReview = async (id) => {
    await db.query('DELETE FROM product_reviews WHERE id = $1', [id]);
};

module.exports = {
    addReview,
    getApprovedReviewsByProduct,
    getReviewById,
    getReviewByUserAndProduct,
    approveReview,
    deleteReview,
};
