// src/services/orderService.js
// Бизнес-логика: Валидация, транзакции, проверки, расчёты.
// Улучшения: Полный расчёт total с новыми полями, резерв по inventory, возврат при ошибке/отмене, админ-функции.

const Joi = require('joi');
const orderModel = require('../models/orderModel');
const cartService = require('./cartService');
const AppError = require('../utils/errorUtils');
const db = require('../config/db'); // Для pool.connect()

// Схема валидации для checkout
const checkoutSchema = Joi.object({
  shipping_address: Joi.string().min(10).required(),
  payment_method: Joi.string().valid('card', 'cash', 'online').required(),
  notes: Joi.string().optional(),
  shipping_cost: Joi.number().min(0).default(0),
  tax_amount: Joi.number().min(0).default(0),
  discount_amount: Joi.number().min(0).default(0),
});

// Создание заказа из корзины
const createOrder = async (userId, data) => {
  const { error, value } = checkoutSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);

  const cart = await cartService.getCart(userId);
  if (!cart.hasItems) throw new AppError('Корзина пуста', 400);

  // Расчёт total_amount с учётом полей
  let subtotal = 0;
  const itemsWithPrices = cart.items.map(item => {
    const price = item.product.discountPrice || item.product.price;
    subtotal += price * item.quantity;
    return { ...item, price, discount_price: item.product.discountPrice };
  });
  const total_amount = subtotal + value.shipping_cost + value.tax_amount - value.discount_amount;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Проверка и уменьшение inventory
    for (const item of itemsWithPrices) {
      // Проверка наличия (inventoryService не нужен, если SUM в model; но для примера)
      const res = await client.query(`
        SELECT SUM(pi.quantity) AS total FROM product_inventory pi
        JOIN product_locations pl ON pi.location_id = pl.id
        WHERE pi.product_id = $1 AND pl.is_active = true
      `, [item.product_id]);
      const available = parseInt(res.rows[0].total) || 0;
      if (available < item.quantity) throw new AppError(`Недостаточно товара ${item.product.name} (доступно: ${available})`, 400);

      await orderModel.decreaseInventory(client, item.product_id, item.quantity);
    }

    // Создание заказа
    const order = await orderModel.createOrder(client, {
      user_id,
      total_amount,
      shipping_address: value.shipping_address,
      payment_method: value.payment_method,
      shipping_cost: value.shipping_cost,
      tax_amount: value.tax_amount,
      discount_amount: value.discount_amount,
      notes: value.notes,
    });

    // Добавление items
    for (const item of itemsWithPrices) {
      await orderModel.addOrderItem(client, {
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        discount_price: item.discount_price,
      });
    }

    // Лог статуса
    await orderModel.addStatusHistory(client, order.id, 'pending');

    // Очистка корзины
    await cartService.clearCart(userId); // Но в транзакции? Если cart в той же БД — добавь DELETE здесь

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    // Возврат inventory при ошибке
    for (const item of itemsWithPrices) {
      try {
        await client.query(`
          UPDATE product_inventory
          SET quantity = quantity + $1
          WHERE product_id = $2
          LIMIT 1
        `, [item.quantity, item.product_id]);
      } catch {} // Игнор ошибки возврата
    }
    throw err;
  } finally {
    client.release();
  }
};

// Получение заказов пользователя
const getUserOrders = async (userId) => {
  return orderModel.getUserOrders(userId);
};

// Получение всех заказов (админ)
const getAllOrders = async (status) => {
  return orderModel.getAllOrders(status);
};

// Получение деталей заказа (админ или user)
const getOrderDetails = async (orderId, userId = null, role) => {
  const order = await orderModel.getOrderById(orderId);
  if (!order) throw new AppError('Заказ не найден', 404);
  if (role !== 'admin' && role !== 'manager' && order.user_id !== userId) throw new AppError('Доступ запрещён', 403);
  return order;
};

// Обновление статуса (админ)
const updateOrderStatus = async (orderId, newStatus, changerUserId) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const updatedOrder = await orderModel.updateOrderStatus(client, orderId, newStatus);
    await orderModel.addStatusHistory(client, orderId, newStatus, changerUserId);

    // Если cancelled — возврат inventory
    if (newStatus === 'cancelled') {
      await orderModel.returnInventory(client, updatedOrder.items || await orderModel.getOrderItems(orderId));
    }

    await client.query('COMMIT');
    return updatedOrder;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Отмена заказа (user)
const cancelOrder = async (userId, orderId) => {
  const order = await orderModel.getOrderById(orderId);
  if (!order || order.user_id !== userId) throw new AppError('Заказ не найден или доступ запрещён', 404);
  if (!['pending', 'processing'].includes(order.status)) throw new AppError('Нельзя отменить', 400);

  return updateOrderStatus(orderId, 'cancelled', userId); // Переиспользуем админ-функцию
};

module.exports = {
  createOrder,
  getUserOrders,
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
};