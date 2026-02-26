// src/routes/orderRoutes.js 
const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// =====================================
// ПУБЛИЧНЫЕ МАРШРУТЫ (без аутентификации)
// =====================================

/**
 * Получить доступные статусы заказов
 * GET /api/orders/statuses
 * Доступ: Public
 */
router.get('/statuses', orderController.getOrderStatuses);

// =====================================
// КЛИЕНТСКИЕ МАРШРУТЫ (требуют аутентификации)
// =====================================

router.use(authenticate);

/**
 * Оформить заказ С онлайн-оплатой
 * POST /api/orders/checkout-with-payment
 * Доступ: Customer
 */
router.post(
  '/checkout-with-payment',
  requireRole(['customer']),
  orderController.checkoutWithPayment
);

/**
 * Оформить заказ БЕЗ онлайн-оплаты (для наличных)
 * POST /api/orders/checkout
 * Доступ: Customer
 */
router.post(
  '/checkout',
  requireRole(['customer']),
  orderController.checkout
);

/**
 * Получить мои заказы
 * GET /api/orders?page=1&limit=10
 * Доступ: Customer
 */
router.get(
  '/',
  requireRole(['customer']),
  orderController.getMyOrders
);

/**
 * Отменить мой заказ
 * PUT /api/orders/:id/cancel
 * Доступ: Customer (владелец заказа)
 */
router.put(
  '/:id/cancel',
  requireRole(['customer']),
  orderController.cancelOrder
);

/**
 * Получить детали моего заказа
 * GET /api/orders/:id
 * Доступ: Owner или Admin
 * 
 * ⚠️ ВАЖНО: Этот маршрут должен быть ПОСЛЕ всех специфичных маршрутов
 * вроде /checkout, /checkout-with-payment, /:id/cancel и т.д.
 */
router.get(
  '/:id',
  orderController.getOrder
);

// =====================================
// АДМИНСКИЕ МАРШРУТЫ
// =====================================

/**
 * ⚠️ КРИТИЧЕСКИ ВАЖНО: 
 * Все маршруты со статичными путями (вроде /stats, /create)
 * ДОЛЖНЫ идти ПЕРЕД динамическими маршрутами (вроде /:id)
 */

/**
 * Получить статистику заказов
 * GET /api/orders/admin/stats
 * Доступ: Admin, Manager
 */
router.get(
  '/admin/stats',
  requireRole(['admin', 'manager']),
  orderController.getOrderStats
);

/**
 * Получить все заказы с фильтрацией
 * GET /api/orders/admin?status=pending&page=1&limit=20&search=example
 * Доступ: Admin, Manager
 */
router.get(
  '/admin',
  requireRole(['admin', 'manager']),
  orderController.getAllOrders
);

/**
 * Создать новый заказ (админ)
 * POST /api/orders/admin
 * Доступ: Admin, Manager
 */
router.post(
  '/admin',
  requireRole(['admin', 'manager']),
  orderController.createAdminOrderController
);

/**
 * Получить детали заказа (админ)
 * GET /api/orders/admin/:id
 * Доступ: Admin, Manager
 */
router.get(
  '/admin/:id',
  requireRole(['admin', 'manager']),
  orderController.getOrderDetailsAdmin
);

/**
 * Обновить статус заказа
 * PUT /api/orders/admin/:id/status
 * Доступ: Admin, Manager
 */
router.put(
  '/admin/:id/status',
  requireRole(['admin', 'manager']),
  orderController.updateOrderStatus
);

/**
 * Обновить данные заказа
 * PUT /api/orders/admin/:id
 * Доступ: Admin, Manager
 */
router.put(
  '/admin/:id',
  requireRole(['admin', 'manager']),
  orderController.updateOrder
);

/**
 * Удалить заказ
 * DELETE /api/orders/admin/:id
 * Доступ: Admin, Manager
 */
router.delete(
  '/admin/:id',
  requireRole(['admin', 'manager']),
  orderController.deleteOrder
);

/**
 * Добавить товар в заказ
 * POST /api/orders/admin/:id/items
 * Доступ: Admin, Manager
 */
router.post(
  '/admin/:id/items',
  requireRole(['admin', 'manager']),
  orderController.addItemToOrder
);

/**
 * Удалить товар из заказа
 * DELETE /api/orders/admin/:id/items/:itemId
 * Доступ: Admin, Manager
 */
router.delete(
  '/admin/:id/items/:itemId',
  requireRole(['admin', 'manager']),
  orderController.removeItemFromOrder
);

module.exports = router;