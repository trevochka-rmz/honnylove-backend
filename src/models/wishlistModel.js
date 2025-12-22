// src/models/wishlistModel.js
const db = require('../config/db');

const addWishlistItem = async (data) => {
    const { user_id, product_id } = data;
    const { rows } = await db.query(
        `INSERT INTO wishlist_items (user_id, product_id)
     VALUES ($1, $2) RETURNING *`,
        [user_id, product_id]
    );
    return rows[0];
};

const getWishlistByUser = async (userId) => {
    const { rows } = await db.query(
        'SELECT * FROM wishlist_items WHERE user_id = $1',
        [userId]
    );
    return rows;
};

const getWishlistItem = async (userId, productId) => {
    const { rows } = await db.query(
        'SELECT * FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
    );
    return rows[0];
};

const removeWishlistItem = async (userId, productId) => {
    await db.query(
        'DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
    );
};

module.exports = {
    addWishlistItem,
    getWishlistByUser,
    getWishlistItem,
    removeWishlistItem,
};
