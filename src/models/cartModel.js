// src/models/cartModel.js
const db = require('../config/db');

const addCartItem = async (data) => {
    const { user_id, product_id, quantity } = data;
    const { rows } = await db.query(
        `INSERT INTO cart_items (user_id, product_id, quantity)
     VALUES ($1, $2, $3) RETURNING *`,
        [user_id, product_id, quantity]
    );
    return rows[0];
};

const getCartByUser = async (userId) => {
    const { rows } = await db.query(
        'SELECT * FROM cart_items WHERE user_id = $1',
        [userId]
    );
    return rows;
};

const getCartItem = async (userId, productId) => {
    const { rows } = await db.query(
        'SELECT * FROM cart_items WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
    );
    return rows[0];
};

const getCartItemById = async (id) => {
    const { rows } = await db.query('SELECT * FROM cart_items WHERE id = $1', [
        id,
    ]);
    return rows[0];
};

const updateCartItem = async (userId, productId, quantity) => {
    const { rows } = await db.query(
        `UPDATE cart_items SET quantity = quantity + $3, updated_at = CURRENT_TIMESTAMP
     WHERE user_id = $1 AND product_id = $2 RETURNING *`,
        [userId, productId, quantity]
    );
    return rows[0];
};

const updateCartItemQuantity = async (id, quantity) => {
    const { rows } = await db.query(
        `UPDATE cart_items SET quantity = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, quantity]
    );
    return rows[0];
};

const removeCartItem = async (id) => {
    await db.query('DELETE FROM cart_items WHERE id = $1', [id]);
};

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
