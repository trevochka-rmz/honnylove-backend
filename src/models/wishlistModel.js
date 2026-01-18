// src/models/wishlistModel.js
const db = require('../config/db');

// Добавить товар в избранное пользователя
const addWishlistItem = async (data) => {
  const { user_id, product_id } = data;
  const { rows } = await db.query(
    `INSERT INTO wishlist_items (user_id, product_id)
         VALUES ($1, $2) RETURNING *`,
    [user_id, product_id]
  );
  return rows[0];
};

// Получить список избранного пользователя
const getWishlistByUser = async (userId) => {
  const { rows } = await db.query(
    'SELECT * FROM wishlist_items WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  return rows;
};

// Получить конкретный элемент избранного
const getWishlistItem = async (userId, productId) => {
  const { rows } = await db.query(
    'SELECT * FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
    [userId, productId]
  );
  return rows[0];
};

// Удалить товар из избранного
const removeWishlistItem = async (userId, productId) => {
  await db.query(
    'DELETE FROM wishlist_items WHERE user_id = $1 AND product_id = $2',
    [userId, productId]
  );
};

// Очистить все избранное пользователя
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