// src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.post(
    '/',
    authenticate,
    requireRole(['customer']),
    orderController.createOrder
);
router.get(
    '/my',
    authenticate,
    requireRole(['customer']),
    orderController.getUserOrders
); // ?status=pending

router.get(
    '/',
    authenticate,
    requireRole(['manager', 'admin']),
    orderController.getAllOrders
);
router.put(
    '/:id/status',
    authenticate,
    requireRole(['manager', 'admin']),
    orderController.updateOrderStatus
);

module.exports = router;
