// src/controllers/posController.js
const posService = require('../services/posService');

/**
 * 🛒 Создать POS заказ (чек)
 * @route   POST /api/pos/checkout
 * @access  Private (Manager, Admin)
 * 
 * @body
 * {
 *   "items": [
 *     { "product_id": 1, "quantity": 2 },
 *     { "product_id": 5, "quantity": 1 }
 *   ],
 *   "payment_method": "cash",
 *   "customer_name": "Иван Иванов",
 *   "customer_phone": "+7 999 123-45-67",
 *   "notes": "Подарочная упаковка",
 *   "discount_amount": 100
 * }
 */
const createPOSCheckout = async (req, res, next) => {
  try {
    const result = await posService.createPOSOrder(
      req.user.id, // ID кассира/менеджера
      req.body
    );

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 📋 Получить список POS заказов с фильтрами
 * @route   GET /api/pos/orders
 * @access  Private (Manager, Admin)
 * 
 * @query
 * - status: pending|paid|completed|cancelled
 * - payment_method: cash|card
 * - created_by: ID кассира
 * - date_from: 2024-01-01
 * - date_to: 2024-01-31
 * - today_only: true
 * - this_week: true
 * - this_month: true
 * - search: поиск
 * - is_pos_order: true (только POS заказы)
 * - page: 1
 * - limit: 50
 */
const getPOSOrders = async (req, res, next) => {
  try {
    const result = await posService.getPOSOrders(req.query);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 📊 Получить статистику продаж
 * @route   GET /api/pos/statistics
 * @access  Private (Manager, Admin)
 * 
 * @query
 * - date_from: 2024-01-01
 * - date_to: 2024-01-31
 * - today_only: true
 * - this_week: true
 * - this_month: true
 * - cashier_id: ID кассира
 * - is_pos_order: true
 */
const getSalesStatistics = async (req, res, next) => {
  try {
    const result = await posService.getSalesStatistics(req.query);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 🔍 Предпросмотр товаров для чека
 * @route   POST /api/pos/preview
 * @access  Private (Manager, Admin)
 * 
 * @body
 * {
 *   "product_ids": [1, 2, 5, 10]
 * }
 */
const previewProducts = async (req, res, next) => {
  try {
    const { product_ids } = req.body;

    if (!product_ids || !Array.isArray(product_ids)) {
      return res.status(400).json({
        success: false,
        message: 'Укажите массив product_ids'
      });
    }

    const result = await posService.previewProductsForCheckout(product_ids);

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 📊 Быстрая статистика за сегодня
 * @route   GET /api/pos/today
 * @access  Private (Manager, Admin)
 */
const getTodayStats = async (req, res, next) => {
  try {
    const result = await posService.getSalesStatistics({
      today_only: true,
      is_pos_order: true
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 📊 Статистика за текущую неделю
 * @route   GET /api/pos/this-week
 * @access  Private (Manager, Admin)
 */
const getThisWeekStats = async (req, res, next) => {
  try {
    const result = await posService.getSalesStatistics({
      this_week: true,
      is_pos_order: true
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 📊 Статистика за текущий месяц
 * @route   GET /api/pos/this-month
 * @access  Private (Manager, Admin)
 */
const getThisMonthStats = async (req, res, next) => {
  try {
    const result = await posService.getSalesStatistics({
      this_month: true,
      is_pos_order: true
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * 📊 Статистика по кассиру
 * @route   GET /api/pos/cashier/:cashierId/stats
 * @access  Private (Manager, Admin)
 * 
 * @query
 * - date_from: 2024-01-01
 * - date_to: 2024-01-31
 */
const getCashierStats = async (req, res, next) => {
  try {
    const { cashierId } = req.params;
    const { date_from, date_to } = req.query;

    const result = await posService.getSalesStatistics({
      cashier_id: parseInt(cashierId, 10),
      date_from,
      date_to,
      is_pos_order: true
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createPOSCheckout,
  getPOSOrders,
  getSalesStatistics,
  previewProducts,
  getTodayStats,
  getThisWeekStats,
  getThisMonthStats,
  getCashierStats
};