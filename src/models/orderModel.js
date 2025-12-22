// src/models/orderModel.js
const db = require('../config/db');

const createOrder = async (data) => {
    const {
        user_id,
        status = 'pending',
        total_amount,
        shipping_address,
        payment_method,
    } = data;
    const { rows } = await db.query(
        `INSERT INTO orders (user_id, status, total_amount, shipping_address, payment_method)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [user_id, status, total_amount, shipping_address, payment_method]
    );
    return rows[0];
};

const createOrderItems = async (orderId, items) => {
    for (const item of items) {
        const { product_id, quantity, price } = item;
        await db.query(
            `INSERT INTO order_items (order_id, product_id, quantity, price)
       VALUES ($1, $2, $3, $4)`,
            [orderId, product_id, quantity, price]
        );
    }
};

const getOrdersByUser = async (userId, { page = 1, limit = 10, status }) => {
    let query = 'SELECT * FROM orders WHERE user_id = $1';
    const params = [userId];
    if (status) {
        query += ' AND status = $2';
        params.push(status);
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(query, params);
    return rows;
};

const getAllOrders = async ({ page = 1, limit = 10, status }) => {
    let query = 'SELECT * FROM orders';
    const params = [];
    if (status) {
        query += ' WHERE status = $1';
        params.push(status);
    }
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);
    const { rows } = await db.query(query, params);
    return rows;
};

const getOrderById = async (id) => {
    const { rows } = await db.query('SELECT * FROM orders WHERE id = $1', [id]);
    return rows[0];
};

const updateOrderStatus = async (id, status) => {
    const { rows } = await db.query(
        `UPDATE orders SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, status]
    );
    return rows[0];
};

const getOrderItems = async (orderId) => {
    const { rows } = await db.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [orderId]
    );
    return rows;
};

const hasUserPurchasedProduct = async (userId, productId) => {
    const query = `
    SELECT 1 FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = $1 AND oi.product_id = $2 AND o.status = 'shipped'
    LIMIT 1
  `;
    const { rows } = await db.query(query, [userId, productId]);
    return rows.length > 0;
};

module.exports = {
    createOrder,
    createOrderItems,
    getOrdersByUser,
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    getOrderItems,
    hasUserPurchasedProduct,
};
