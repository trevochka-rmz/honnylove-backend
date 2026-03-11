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
// АДМИНСКИЕ МАРШРУТЫ
// =====================================

/**
 * Получить статистику заказов
 * GET /api/orders/admin/stats
 * Доступ: Admin, Manager
 */
router.get(
  '/admin/stats',
  authenticate,
  requireRole(['admin', 'manager']),
  orderController.getOrderStats
);

/**
 * Получить все заказы с фильтрацией
 * GET /api/orders/admin?status=pending&page=1&limit=20&search=example
 * Доступ: Admin, Manager
 * 
 * Query параметры:
 * - status: pending|paid|processing|shipped|delivered|cancelled|returned|completed
 * - user_id: ID пользователя
 * - date_from: дата от (YYYY-MM-DD)
 * - date_to: дата до (YYYY-MM-DD)
 * - search: поиск по номеру заказа, email, имени
 * - page: номер страницы (по умолчанию 1)
 * - limit: кол-во на странице (по умолчанию 20)
 */
router.get(
  '/admin',
  authenticate,
  requireRole(['admin', 'manager']),
  orderController.getAllOrders
);

/**
 * Создать новый заказ от имени пользователя (админ)
 * POST /api/orders/admin
 * Доступ: Admin, Manager
 * 
 * Body:
 * {
 *   "user_id": 123,
 *   "items": [
 *     { "product_id": 1, "quantity": 2 },
 *     { "product_id": 2, "quantity": 1 }
 *   ],
 *   "shipping_address": "г. Москва, ул. Ленина, д. 10, кв. 5",
 *   "payment_method": "card",
 *   "notes": "Звонить за час",
 *   "shipping_cost": 300,
 *   "tax_amount": 0,
 *   "discount_amount": 100,
 *   "tracking_number": "TRACK123"
 * }
 */
router.post(
  '/admin',
  authenticate,
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
  authenticate,
  requireRole(['admin', 'manager']),
  orderController.getOrderDetailsAdmin
);

/**
 * Обновить статус заказа
 * PUT /api/orders/admin/:id/status
 * Доступ: Admin, Manager
 * 
 * Body:
 * {
 *   "newStatus": "processing",
 *   "notes": "Заказ передан в обработку"
 * }
 * 
 * Доступные статусы:
 * - pending (Ожидает обработки)
 * - paid (Оплачен)
 * - processing (В обработке)
 * - shipped (Отправлен)
 * - delivered (Доставлен)
 * - cancelled (Отменен)
 * - returned (Возвращен)
 * - completed (Завершен)
 */
router.put(
  '/admin/:id/status',
  authenticate,
  requireRole(['admin', 'manager']),
  orderController.updateOrderStatus
);

/**
 * Обновить данные заказа
 * PUT /api/orders/admin/:id
 * Доступ: Admin, Manager
 * 
 * Body (все поля опциональны):
 * {
 *   "shipping_address": "новый адрес",
 *   "payment_method": "card",
 *   "shipping_cost": 500,
 *   "tax_amount": 50,
 *   "discount_amount": 200,
 *   "tracking_number": "TRACK123456",
 *   "notes": "примечания"
 * }
 */
router.put(
  '/admin/:id',
  authenticate,
  requireRole(['admin', 'manager']),
  orderController.updateOrder
);

/**
 * Удалить заказ
 * DELETE /api/orders/admin/:id
 * Доступ: Admin, Manager
 * 
 * Можно удалить только заказы в статусе: pending, cancelled
 */
router.delete(
  '/admin/:id',
  authenticate,
  requireRole(['admin', 'manager']),
  orderController.deleteOrder
);

/**
 * Добавить товар в заказ
 * POST /api/orders/admin/:id/items
 * Доступ: Admin, Manager
 * 
 * Body:
 * {
 *   "product_id": 123,
 *   "quantity": 2
 * }
 */
router.post(
  '/admin/:id/items',
  authenticate,
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
  authenticate,
  requireRole(['admin', 'manager']),
  orderController.removeItemFromOrder
);

// =====================================
// КЛИЕНТСКИЕ МАРШРУТЫ (требуют аутентификации)
// =====================================

/**
 * Оформить заказ С онлайн-оплатой
 * POST /api/orders/checkout-with-payment
 * Доступ: Customer
 * 
 * Body:
 * {
 *   "selected_items": [42, 43],
 *   "shipping_address": "г. Москва, ул. Ленина, д. 10, кв. 5",
 *   "payment_method": "card",
 *   "notes": "Звонить за час",
 *   "shipping_cost": 300,
 *   "tax_amount": 0,
 *   "discount_amount": 100
 * }
 */
router.post(
  '/checkout-with-payment',
  authenticate,
  requireRole(['customer']),
  orderController.checkoutWithPayment
);

/**
 * Оформить заказ БЕЗ онлайн-оплаты (для наличных)
 * POST /api/orders/checkout
 * Доступ: Customer
 * 
 * Body:
 * {
 *   "selected_items": [42, 43],
 *   "shipping_address": "г. Москва, ул. Ленина, д. 10, кв. 5",
 *   "payment_method": "cash",
 *   "notes": "Звонить за час",
 *   "shipping_cost": 300,
 *   "tax_amount": 0,
 *   "discount_amount": 100
 * }
 */
router.post(
  '/checkout',
  authenticate,
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
  authenticate,
  requireRole(['customer']),
  orderController.getMyOrders
);

/**
 * Отменить мой заказ
 * PUT /api/orders/:id/cancel
 * Доступ: Customer (владелец заказа)
 * 
 * Body:
 * {
 *   "reason": "Передумал"
 * }
 */
router.put(
  '/:id/cancel',
  authenticate,
  requireRole(['customer']),
  orderController.cancelOrder
);

/**
 * Получить детали моего заказа
 * GET /api/orders/:id
 * Доступ: Owner или Admin
 */
router.get(
  '/:id',
  authenticate,
  orderController.getOrder
);

module.exports = router;