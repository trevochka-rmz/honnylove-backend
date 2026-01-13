// src/controllers/orderController.js
const orderService = require('../services/orderService');
const { processOrderImages, processOrdersImages } = require('../utils/orderImageUtils');

/**
 * @desc    Оформить заказ из корзины
 * @route   POST /api/orders/checkout
 * @access  Private (Customer)
 */
const checkout = async (req, res, next) => {
  try {
    const result = await orderService.createOrder(req.user.id, req.body);
    
    // Обрабатываем изображения в заказе
    if (result.data && result.data.order) {
      result.data.order = processOrderImages(result.data.order, req);
    }
    
    res.status(201).json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить заказы текущего пользователя
 * @route   GET /api/orders/my-orders
 * @access  Private (Customer)
 */
const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const result = await orderService.getUserOrders(req.user.id, page, limit);
    
    // Обрабатываем изображения в заказах
    const processedOrders = processOrdersImages(result.orders, req);
    
    res.json({
      success: true,
      data: processedOrders,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить детали конкретного заказа
 * @route   GET /api/orders/:orderId
 * @access  Private (Owner or Admin)
 */
const getOrder = async (req, res, next) => {
  try {
    const result = await orderService.getOrderDetails(
      req.params.orderId,
      req.user.id,
      req.user.role
    );
    
    // Обрабатываем изображения в заказе
    const processedOrder = processOrderImages(result.order, req);
    
    res.json({
      success: true,
      data: processedOrder,
      accessible: result.accessible
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Отменить заказ
 * @route   PUT /api/orders/:orderId/cancel
 * @access  Private (Owner)
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const result = await orderService.cancelOrder(
      req.user.id,
      req.params.orderId,
      reason || ''
    );
    
    // Обрабатываем изображения в заказе
    if (result.data && result.data.order) {
      result.data.order = processOrderImages(result.data.order, req);
    }
    
    res.json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить все заказы (админ)
 * @route   GET /api/admin/orders
 * @access  Private (Admin/Manager)
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    
    const result = await orderService.getAllOrders(status, page, limit);
    
    // Обрабатываем изображения в заказах
    const processedOrders = processOrdersImages(result.orders, req);
    
    res.json({
      success: true,
      data: processedOrders,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить детали заказа (админ)
 * @route   GET /api/admin/orders/:orderId
 * @access  Private (Admin/Manager)
 */
const getOrderDetails = async (req, res, next) => {
  try {
    const result = await orderService.getOrderDetails(
      req.params.orderId,
      null, // userId не нужен для админа
      req.user.role
    );
    
    // Обрабатываем изображения в заказе
    const processedOrder = processOrderImages(result.order, req);
    
    res.json({
      success: true,
      data: processedOrder
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Обновить статус заказа (админ)
 * @route   PUT /api/admin/orders/:orderId/status
 * @access  Private (Admin/Manager)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { newStatus, notes } = req.body;
    
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: 'Укажите новый статус заказа'
      });
    }
    
    const result = await orderService.updateOrderStatus(
      req.params.orderId,
      newStatus,
      req.user.id,
      notes || ''
    );
    
    // Обрабатываем изображения в заказе
    if (result.data && result.data.order) {
      result.data.order = processOrderImages(result.data.order, req);
    }
    
    res.json({
      success: true,
      message: result.message,
      data: result.data
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить статистику заказов (админ)
 * @route   GET /api/admin/orders/stats
 * @access  Private (Admin/Manager)
 */
const getOrderStats = async (req, res, next) => {
  try {
    const result = await orderService.getOrderStatistics();
    
    res.json({
      success: true,
      data: result.stats,
      daily: result.daily_stats
    });
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить доступные статусы заказов
 * @route   GET /api/orders/statuses
 * @access  Public
 */
const getOrderStatuses = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: orderService.ORDER_STATUSES,
      descriptions: {
        pending: 'Ожидает обработки',
        paid: 'Оплачен',
        processing: 'В обработке',
        shipped: 'Отправлен',
        delivered: 'Доставлен',
        cancelled: 'Отменен',
        returned: 'Возвращен',
        completed: 'Завершен'
      }
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  checkout,
  getMyOrders,
  getOrder,
  cancelOrder,
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  getOrderStats,
  getOrderStatuses
};