// src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole(['customer']));

// POST /api/orders/checkout - Оформить заказ
router.post('/checkout', orderController.checkout);

// GET /api/orders - Получить все заказы пользователя
router.get('/', orderController.getOrders);

// PUT /api/orders/:orderId/cancel - Отменить заказ
router.put('/:orderId/cancel', orderController.cancelOrder);

module.exports = router;
