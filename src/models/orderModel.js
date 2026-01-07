// src/models/orderModel.js
// Модель для SQL-запросов к заказам. Содержит только чистые запросы без логики.
// Улучшения: Добавлены запросы для админ-функций, JOIN для деталей, использование ENUM в status.

const db = require('../config/db'); // pg pool

// Создание заказа
const createOrder = async (client, orderData) => {
  const { user_id, total_amount, shipping_address, payment_method, shipping_cost, tax_amount, discount_amount, notes } = orderData;
  const res = await client.query(`
    INSERT INTO orders (user_id, status, total_amount, shipping_address, payment_method, shipping_cost, tax_amount, discount_amount, notes)
    VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [user_id, total_amount, shipping_address, payment_method, shipping_cost, tax_amount, discount_amount, notes]);
  return res.rows[0];
};

// Добавление товара в заказ
const addOrderItem = async (client, orderItemData) => {
  const { order_id, product_id, quantity, price, discount_price } = orderItemData;
  const res = await client.query(`
    INSERT INTO order_items (order_id, product_id, quantity, price, discount_price)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [order_id, product_id, quantity, price, discount_price]);
  return res.rows[0];
};

// Получение заказов пользователя с items
const getUserOrders = async (userId) => {
  const res = await db.query(`
    SELECT o.*,
           json_agg(
             json_build_object(
               'id', oi.id,
               'product_id', oi.product_id,
               'quantity', oi.quantity,
               'price', oi.price,
               'discount_price', oi.discount_price,
               'created_at', oi.created_at
             )
           ) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    WHERE o.user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `, [userId]);
  return res.rows;
};

// Получение всех заказов (для админа, с опциональным фильтром по status)
const getAllOrders = async (status = null) => {
  let query = `
    SELECT o.*,
           json_agg(
             json_build_object(
               'id', oi.id,
               'product_id', oi.product_id,
               'quantity', oi.quantity,
               'price', oi.price,
               'discount_price', oi.discount_price
             )
           ) as items
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `;
  let params = [];
  if (status) {
    query = `
      SELECT o.*,
             json_agg(
               json_build_object(
                 'id', oi.id,
                 'product_id', oi.product_id,
                 'quantity', oi.quantity,
                 'price', oi.price,
                 'discount_price', oi.discount_price
               )
             ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.status = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    params = [status];
  }
  const res = await db.query(query, params);
  return res.rows;
};

// Получение заказа по ID (с items)
const getOrderById = async (orderId) => {
  const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
  if (!orderRes.rows[0]) return null;
  const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
  return { ...orderRes.rows[0], items: itemsRes.rows };
};

// Обновление статуса заказа
const updateOrderStatus = async (client, orderId, status) => {
  const res = await client.query(`
    UPDATE orders
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `, [status, orderId]);
  return res.rows[0];
};

// Добавление записи в историю статусов (с user_id для админа)
const addStatusHistory = async (client, orderId, status, changerUserId = null) => {
  await client.query(`
    INSERT INTO order_status_history (order_id, status, user_id)
    VALUES ($1, $2, $3)
  `, [orderId, status, changerUserId]);
};

// Уменьшение inventory (в первой доступной локации)
const decreaseInventory = async (client, productId, quantity) => {
  const res = await client.query(`
    UPDATE product_inventory
    SET quantity = quantity - $1
    WHERE product_id = $2 AND quantity >= $1
    LIMIT 1
    RETURNING *
  `, [quantity, productId]);
  if (res.rowCount === 0) throw new Error(`Не удалось уменьшить inventory для продукта ${productId}`);
};

// Возврат inventory при отмене
const returnInventory = async (client, items) => {
  for (const item of items) {
    await client.query(`
      UPDATE product_inventory
      SET quantity = quantity + $1
      WHERE product_id = $2
      LIMIT 1
    `, [item.quantity, item.product_id]);
  }
};

module.exports = {
  createOrder,
  addOrderItem,
  getUserOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  addStatusHistory,
  decreaseInventory,
  returnInventory,
};