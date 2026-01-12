// src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Маршруты доступные всем (публичные)
router.get('/statuses', orderController.getOrderStatuses);

// Маршруты, требующие аутентификации
router.use(authenticate);

// ========== КЛИЕНТСКИЕ МАРШРУТЫ ==========
router.post('/checkout', requireRole(['customer']), orderController.checkout);
router.get('/orders', requireRole(['customer']), orderController.getMyOrders);
router.get('/:orderId', orderController.getOrder); // Детали заказа (владелец или админ)
router.put('/:orderId/cancel', requireRole(['customer']), orderController.cancelOrder);

// ========== АДМИН МАРШРУТЫ ==========
router.get('/admin/orders', requireRole(['admin', 'manager']), orderController.getAllOrders);
router.get('/admin/orders/stats', requireRole(['admin', 'manager']), orderController.getOrderStats);
router.get('/admin/orders/:orderId', requireRole(['admin', 'manager']), orderController.getOrderDetails);
router.put('/admin/orders/:orderId/status', requireRole(['admin', 'manager']), orderController.updateOrderStatus);

module.exports = router;