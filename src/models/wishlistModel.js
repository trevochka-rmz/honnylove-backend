// models/wishlistModel.js
const db = require('../config/db');

// Добавление в избранное
const addWishlistItem = async (data) => {
    const { user_id, product_id } = data;
    const { rows } = await db.query(
        `INSERT INTO wishlist_items (user_id, product_id)
         VALUES ($1, $2) RETURNING *`,
        [user_id, product_id]
    );
    return rows[0];
};

// Получение избранного пользователя
const getWishlistByUser = async (userId) => {
    const { rows } = await db.query(
        'SELECT * FROM wishlist_items WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
    );
    return rows;
};

// Получение конкретного элемента
const getWishlistItem = async (userId, productId) => {
    const { rows } = await db.query(
        'SELECT * FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
    );
    return rows[0];
};

// Удаление элемента
const removeWishlistItem = async (userId, productId) => {
    await db.query(
        'DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
    );
};

// НОВАЯ ФУНКЦИЯ: Очистка всего избранного пользователя
const clearWishlist = async (userId) => {
    await db.query('DELETE FROM wishlist_items WHERE user_id = $1', [userId]);
};

module.exports = {
    addWishlistItem,
    getWishlistByUser,
    getWishlistItem,
    removeWishlistItem,
    clearWishlist,
};
