// src/controllers/orderController.js
// Обработчики запросов: Вызывают service, обрабатывают res/next.
// Улучшения: Полные ответы с деталями, обработка ошибок.

const orderService = require('../services/orderService');

// Оформление заказа (customer)
const checkout = async (req, res, next) => {
  try {
    const order = await orderService.createOrder(req.user.id, req.body);
    res.status(201).json({ message: 'Заказ оформлен', order });
  } catch (err) {
    next(err);
  }
};

// Получение заказов пользователя (customer)
const getOrders = async (req, res, next) => {
  try {
    const orders = await orderService.getUserOrders(req.user.id);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

// Отмена заказа (customer)
const cancelOrder = async (req, res, next) => {
  try {
    const result = await orderService.cancelOrder(req.user.id, req.params.orderId);
    res.json({ message: 'Заказ отменён', order: result });
  } catch (err) {
    next(err);
  }
};

// Получение всех заказов (admin/manager)
const getAllOrders = async (req, res, next) => {
  try {
    const { status } = req.query; // Фильтр ?status=pending
    const orders = await orderService.getAllOrders(status);
    res.json(orders);
  } catch (err) {
    next(err);
  }
};

// Получение деталей заказа (admin/manager)
const getOrderDetails = async (req, res, next) => {
  try {
    const order = await orderService.getOrderDetails(req.params.orderId, null, req.user.role);
    res.json(order);
  } catch (err) {
    next(err);
  }
};

// Обновление статуса (admin/manager)
const updateStatus = async (req, res, next) => {
  try {
    const { newStatus } = req.body;
    if (!newStatus) throw new AppError('Укажите новый статус', 400);
    const updated = await orderService.updateOrderStatus(req.params.orderId, newStatus, req.user.id);
    res.json({ message: 'Статус обновлён', order: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkout,
  getOrders,
  cancelOrder,
  getAllOrders,
  getOrderDetails,
  updateStatus,
};