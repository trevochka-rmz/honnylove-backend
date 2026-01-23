// src/routes/paymentRoutes.js
const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

/**
 * Создать платеж для заказа
 * POST /api/payments/order/:orderId/create
 * Доступ: Customer (владелец заказа) или Admin
 */
router.post('/order/:orderId/create', 
  authenticate, 
  requireRole(['customer', 'admin', 'manager']), 
  paymentController.createPayment
);

/**
 * Получить статус платежа заказа
 * GET /api/payments/order/:orderId/status
 * Доступ: Customer (владелец заказа) или Admin
 */
router.get('/order/:orderId/status', 
  authenticate, 
  requireRole(['customer', 'admin', 'manager']), 
  paymentController.getPaymentStatus
);

/**
 * Вебхук для уведомлений от ЮKassa
 * POST /api/payments/webhook
 * Доступ: Только ЮKassa (без авторизации!)
 */
router.post('/webhook', 
  express.json({ verify: (req, res, buf) => {
    // Здесь можно сохранить сырые данные для проверки подписи
    req.rawBody = buf.toString();
  }}),
  paymentController.handleWebhook
);

/**
 * Страница успешной оплаты (редирект от ЮKassa)
 * GET /api/payments/success/:orderId
 * Доступ: Все
 */
router.get('/success/:orderId', paymentController.paymentSuccess);

module.exports = router;