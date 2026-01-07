// src/routes/orderRoutes.js
// Маршруты: Разделены на customer и admin.
// Улучшения: Админ-префикс /admin, роль-проверки, PUT для статуса.

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Для customers
router.use(authenticate, requireRole(['customer']));
router.post('/checkout', orderController.checkout); // POST /api/orders/checkout {shipping_address, payment_method, ...}
router.get('/', orderController.getOrders); // GET /api/orders — заказы пользователя
router.put('/:orderId/cancel', orderController.cancelOrder); // PUT /api/orders/:orderId/cancel — отмена

// Для admins/managers
router.use('/admin', authenticate, requireRole(['admin', 'manager']));
router.get('/admin/orders', orderController.getAllOrders); // GET /api/orders/admin/orders ?status=pending
router.get('/admin/orders/:orderId', orderController.getOrderDetails); // GET /api/orders/admin/orders/:orderId
router.put('/admin/orders/:orderId/status', orderController.updateStatus); // PUT /api/orders/admin/orders/:orderId/status {newStatus: 'shipped'}

module.exports = router;