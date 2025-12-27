// models/orderModel.js
const db = require('../config/db');

// Создание заказа
const createOrder = async (orderData) => {
    const { user_id, status, total_amount, shipping_address, payment_method } =
        orderData;

    const { rows } = await db.query(
        `INSERT INTO orders (user_id, status, total_amount, shipping_address, payment_method)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [user_id, status, total_amount, shipping_address, payment_method]
    );

    return rows[0];
};

// Добавление товара в заказ
const addOrderItem = async (orderItemData) => {
    const { order_id, product_id, quantity, price } = orderItemData;

    const { rows } = await db.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [order_id, product_id, quantity, price]
    );

    return rows[0];
};

// Получение заказов пользователя
const getUserOrders = async (userId) => {
    const { rows } = await db.query(
        `SELECT o.*,
                json_agg(
                    json_build_object(
                        'id', oi.id,
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'price', oi.price,
                        'created_at', oi.created_at
                    )
                ) as items
         FROM orders o
         LEFT JOIN order_items oi ON o.id = oi.order_id
         WHERE o.user_id = $1
         GROUP BY o.id
         ORDER BY o.created_at DESC`,
        [userId]
    );

    return rows;
};

// Получение заказа по ID с проверкой пользователя
const getOrderById = async (orderId, userId) => {
    const { rows } = await db.query(
        'SELECT * FROM orders WHERE id = $1 AND user_id = $2',
        [orderId, userId]
    );

    return rows[0];
};

// Получение товаров заказа
const getOrderItems = async (orderId) => {
    const { rows } = await db.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [orderId]
    );

    return rows;
};

// Обновление статуса заказа
const updateOrderStatus = async (orderId, status) => {
    const { rows } = await db.query(
        `UPDATE orders 
         SET status = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING *`,
        [status, orderId]
    );

    return rows[0];
};

// Добавление записи в историю статусов
const addStatusHistory = async (orderId, status) => {
    const { rows } = await db.query(
        `INSERT INTO order_status_history (order_id, status)
         VALUES ($1, $2)
         RETURNING *`,
        [orderId, status]
    );

    return rows[0];
};

module.exports = {
    createOrder,
    addOrderItem,
    getUserOrders,
    getOrderById,
    getOrderItems,
    updateOrderStatus,
    addStatusHistory,
};
