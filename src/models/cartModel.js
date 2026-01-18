// src/models/cartModel.js
const db = require('../config/db');

// Добавить товар в корзину
const addCartItem = async (data) => {
  const { user_id, product_id, quantity } = data;
  const { rows } = await db.query(
    `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3) RETURNING *`,
    [user_id, product_id, quantity]
  );
  return rows[0];
};

// Получить корзину пользователя
const getCartByUser = async (userId) => {
  const { rows } = await db.query(
    'SELECT * FROM cart_items WHERE user_id = $1',
    [userId]
  );
  return rows;
};

// Получить конкретный элемент корзины
const getCartItem = async (userId, productId) => {
  const { rows } = await db.query(
    'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
    [userId, productId]
  );
  return rows[0];
};

// Получить элемент корзины по ID
const getCartItemById = async (id) => {
  const { rows } = await db.query('SELECT * FROM cart_items WHERE id = $1', [
    id,
  ]);
  return rows[0];
};

// Обновить количество товара в корзине (инкремент)
const updateCartItem = async (userId, productId, quantity) => {
  const { rows } = await db.query(
    `UPDATE cart_items SET quantity = quantity + $3, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND product_id = $2 RETURNING *`,
    [userId, productId, quantity]
  );
  return rows[0];
};

// Установить точное количество товара
const updateCartItemQuantity = async (id, quantity) => {
  const { rows } = await db.query(
    `UPDATE cart_items SET quantity = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, quantity]
  );
  return rows[0];
};

// Удалить элемент из корзины
const removeCartItem = async (id) => {
  await db.query('DELETE FROM cart_items WHERE id = $1', [id]);
};

// Очистить корзину пользователя
const clearCart = async (userId) => {
  await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
};

module.exports = {
  addCartItem,
  getCartByUser,
  getCartItem,
  getCartItemById,
  updateCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCart,
};