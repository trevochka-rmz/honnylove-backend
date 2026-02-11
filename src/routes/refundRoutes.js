// src/routes/refundRoutes.js - НОВЫЙ ФАЙЛ
const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const refundService = require('../services/refundService');

// Все маршруты требуют авторизации
router.use(authenticate);

/**
 * Создать возврат для заказа
 * POST /api/refunds/order/:orderId
 * Доступ: Admin, Manager, Owner
 * 
 * Body:
 * {
 *   "amount": 1000,  // опционально, если не указано - полный возврат
 *   "reason": "Товар не подошел"
 * }
 */
router.post('/order/:orderId', async (req, res, next) => {
  try {
    const result = await refundService.createRefund(
      req.params.orderId,
      req.body,
      req.user.id,
      req.user.role
    );
    
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Получить список возвратов для заказа
 * GET /api/refunds/order/:orderId
 * Доступ: Admin, Manager, Owner
 */
router.get('/order/:orderId', async (req, res, next) => {
  try {
    const result = await refundService.getOrderRefunds(
      req.params.orderId,
      req.user.id,
      req.user.role
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * Отменить ОПЛАЧЕННЫЙ заказ (с возвратом средств)
 * PUT /api/refunds/order/:orderId/cancel-paid
 * Доступ: Admin, Manager, Owner
 * 
 * Body:
 * {
 *   "reason": "Передумал, хочу отменить"
 * }
 */
router.put('/order/:orderId/cancel-paid', async (req, res, next) => {
  try {
    const { reason } = req.body;
    
    const result = await refundService.cancelPaidOrder(
      req.params.orderId,
      reason,
      req.user.id,
      req.user.role
    );
    
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;