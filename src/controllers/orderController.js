// src/controllers/orderController.js 
const orderService = require('../services/orderService');

// КЛИЕНТСКИЕ ЭНДПОИНТЫ

/**
 * @desc    Оформить заказ из корзины
 * @route   POST /api/orders/checkout
 * @access  Private (Customer)
 */
const checkout = async (req, res, next) => {
  try {
    const result = await orderService.createOrder(req.user.id, req.body);
    
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить заказы текущего пользователя
 * @route   GET /api/orders
 * @access  Private (Customer)
 */
const getMyOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const result = await orderService.getUserOrders(
      req.user.id,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить детали конкретного заказа
 * @route   GET /api/orders/:id
 * @access  Private (Owner or Admin)
 */
const getOrder = async (req, res, next) => {
  try {
    const result = await orderService.getOrderDetails(
      req.params.id,
      req.user.id,
      req.user.role
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Отменить заказ
 * @route   PUT /api/orders/:id/cancel
 * @access  Private (Owner)
 */
const cancelOrder = async (req, res, next) => {
  try {
    const { reason = '' } = req.body;
    
    const result = await orderService.cancelOrder(
      req.user.id,
      req.params.id,
      reason
    );
    
    res.json(result);
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
      data: {
        statuses: orderService.ORDER_STATUSES,
        descriptions: {
          pending: 'Ожидает обработки',
          paid: 'Оплачен',
          processing: 'В обработке',
          shipped: 'Отправлен',
          delivered: 'Доставлен',
          cancelled: 'Отменен',
          returned: 'Возвращен',
          completed: 'Завершен'
        },
        cancellable: orderService.CANCELLABLE_STATUSES,
        deletable: orderService.DELETABLE_STATUSES
      }
    });
  } catch (err) {
    next(err);
  }
};

// АДМИНСКИЕ ЭНДПОИНТЫ

/**
 * @desc    Получить все заказы с фильтрацией
 * @route   GET /api/admin/orders
 * @access  Private (Admin/Manager)
 */
const getAllOrders = async (req, res, next) => {
  try {
    const { 
      status, 
      user_id, 
      date_from, 
      date_to, 
      search,
      page = 1, 
      limit = 20 
    } = req.query;
    
    const filters = {
      status,
      user_id: user_id ? parseInt(user_id, 10) : undefined,
      date_from,
      date_to,
      search
    };
    
    // Удаляем undefined значения
    Object.keys(filters).forEach(key => 
      filters[key] === undefined && delete filters[key]
    );
    
    const result = await orderService.getAllOrders(
      filters,
      parseInt(page, 10),
      parseInt(limit, 10)
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc Создать новый заказ (админ)
 * @route POST /api/admin/orders
 * @access Private (Admin/Manager)
 */
const createAdminOrderController = async (req, res, next) => {
  try {
    const result = await orderService.createAdminOrder(req.user.id, req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить детали заказа (админ)
 * @route   GET /api/admin/orders/:id
 * @access  Private (Admin/Manager)
 */
const getOrderDetailsAdmin = async (req, res, next) => {
  try {
    const result = await orderService.getOrderDetails(
      req.params.id,
      null,
      req.user.role
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Обновить статус заказа
 * @route   PUT /api/admin/orders/:id/status
 * @access  Private (Admin/Manager)
 */
const updateOrderStatus = async (req, res, next) => {
  try {
    const { newStatus, notes = '' } = req.body;
    
    if (!newStatus) {
      return res.status(400).json({
        success: false,
        message: 'Укажите новый статус заказа (поле newStatus)'
      });
    }
    
    const result = await orderService.updateOrderStatus(
      req.params.id,
      newStatus,
      req.user.id,
      notes
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Обновить данные заказа
 * @route   PUT /api/admin/orders/:id
 * @access  Private (Admin/Manager)
 */
const updateOrder = async (req, res, next) => {
  try {
    const result = await orderService.updateOrder(
      req.params.id,
      req.body,
      req.user.id,
      req.user.role
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Удалить заказ
 * @route   DELETE /api/admin/orders/:id
 * @access  Private (Admin/Manager)
 */
const deleteOrder = async (req, res, next) => {
  try {
    const result = await orderService.deleteOrder(
      req.params.id,
      req.user.id,
      req.user.role
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Получить статистику заказов
 * @route   GET /api/admin/orders/stats
 * @access  Private (Admin/Manager)
 */
const getOrderStats = async (req, res, next) => {
  try {
    const result = await orderService.getOrderStatistics();
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Добавить товар в заказ
 * @route   POST /api/admin/orders/:id/items
 * @access  Private (Admin/Manager)
 */
const addItemToOrder = async (req, res, next) => {
  try {
    const result = await orderService.addItemToOrder(
      req.params.id,
      req.body,
      req.user.id,
      req.user.role
    );
    
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * @desc    Удалить товар из заказа
 * @route   DELETE /api/admin/orders/:id/items/:itemId
 * @access  Private (Admin/Manager)
 */
const removeItemFromOrder = async (req, res, next) => {
  try {
    const result = await orderService.removeItemFromOrder(
      req.params.id,
      req.params.itemId,
      req.user.id,
      req.user.role
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  // Клиентские
  checkout,
  getMyOrders,
  getOrder,
  cancelOrder,
  getOrderStatuses,
  
  // Админские
  getAllOrders,
  getOrderDetailsAdmin,
  createAdminOrderController,
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  getOrderStats,
  addItemToOrder,
  removeItemFromOrder
};