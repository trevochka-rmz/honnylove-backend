// src/models/paymentModel.js
const db = require('../config/db');

// Создать платеж
const createPayment = async (paymentData) => {
  const { 
    order_id, 
    yookassa_payment_id, 
    amount, 
    status = 'pending',
    currency = 'RUB',
    payment_method = null,
    description = '',
    metadata = {},
    confirmation_url = null
  } = paymentData;
  
  const { rows } = await db.query(`
    INSERT INTO payments (
      order_id, 
      yookassa_payment_id, 
      amount, 
      status, 
      currency, 
      payment_method, 
      description, 
      metadata, 
      confirmation_url,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `, [
    order_id, 
    yookassa_payment_id, 
    amount, 
    status, 
    currency, 
    payment_method, 
    description, 
    JSON.stringify(metadata), 
    confirmation_url
  ]);
  
  return rows[0];
};

// Обновить статус платежа
const updatePaymentStatus = async (paymentId, status, capturedAt = null) => {
  let query = `
    UPDATE payments 
    SET status = $2, updated_at = CURRENT_TIMESTAMP
  `;
  let params = [paymentId, status];
  
  if (status === 'succeeded' && capturedAt) {
    query = `
      UPDATE payments 
      SET status = $2, captured_at = $3, updated_at = CURRENT_TIMESTAMP
    `;
    params = [paymentId, status, capturedAt];
  }
  
  query += ' WHERE id = $1 RETURNING *';
  
  const { rows } = await db.query(query, params);
  return rows[0];
};

// Обновить payment_id в заказе
const updateOrderPaymentId = async (orderId, paymentId) => {
  const { rows } = await db.query(`
    UPDATE orders 
    SET payment_id = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *
  `, [orderId, paymentId]);
  
  return rows[0];
};

// Найти платеж по ID ЮKassa
const findPaymentByYookassaId = async (yookassaPaymentId) => {
  const { rows } = await db.query(
    'SELECT * FROM payments WHERE yookassa_payment_id = $1',
    [yookassaPaymentId]
  );
  return rows[0];
};

// Найти платеж по ID заказа
const findPaymentByOrderId = async (orderId) => {
  const { rows } = await db.query(
    'SELECT * FROM payments WHERE order_id = $1 ORDER BY created_at DESC LIMIT 1',
    [orderId]
  );
  return rows[0];
};

// Получить историю платежей пользователя
const getUserPayments = async (userId, limit = 10, offset = 0) => {
  const { rows } = await db.query(`
    SELECT 
      p.*,
      o.id as order_id,
      o.status as order_status,
      o.total_amount as order_total,
      o.created_at as order_created_at
    FROM payments p
    INNER JOIN orders o ON p.order_id = o.id
    WHERE o.user_id = $1
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  
  return rows;
};

module.exports = {
  createPayment,
  updatePaymentStatus,
  updateOrderPaymentId,
  findPaymentByYookassaId,
  findPaymentByOrderId,
  getUserPayments
};