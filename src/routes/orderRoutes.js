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
 * 
 * Body:
 * {
 *   "selected_items": [42, 43],
 *   "shipping_address": "г. Москва, ул. Ленина, д. 10, кв. 5",
 *   "payment_method": "card",  // или "online" или "sbp"
 *   "notes": "Звонить за час",
 *   "shipping_cost": 300,
 *   "tax_amount": 0,
 *   "discount_amount": 100
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Заказ оформлен. Перейдите к оплате.",
 *   "data": {
 *     "order": { ... },
 *     "order_number": "ORD-000157",
 *     "payment": {
 *       "confirmation_url": "https://yoomoney.ru/checkout/...",
 *       "payment_id": 88,
 *       "yookassa_payment_id": "2d9f9c5e-...",
 *       "status": "pending",
 *       "amount": "4900.00"
 *     }
 *   }
 * }
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
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Заказ успешно оформлен",
 *   "data": {
 *     "order": { ... },
 *     "order_number": "ORD-000156",
 *     "items_count": 2,
 *     "needs_payment": false
 *   }
 * }
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
 * Получить детали моего заказа
 * GET /api/orders/:id
 * Доступ: Owner или Admin
 */
router.get(
  '/:id',
  orderController.getOrder
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
  requireRole(['customer']),
  orderController.cancelOrder
);

// =====================================
// АДМИНСКИЕ МАРШРУТЫ
// =====================================

/**
 * Получить статистику заказов
 * GET /api/admin/orders/stats
 * Доступ: Admin, Manager
 * 
 * ВАЖНО: Этот маршрут должен быть ПЕРЕД /:id
 */
router.get(
  '/admin/orders/stats',
  requireRole(['admin', 'manager']),
  orderController.getOrderStats
);

/**
 * Получить все заказы с фильтрацией
 * GET /api/admin/orders?status=pending&page=1&limit=20&search=example
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
  '/admin/orders',
  requireRole(['admin', 'manager']),
  orderController.getAllOrders
);

/**
 * Создать новый заказ (админ)
 * POST /api/admin/orders
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
  '/admin/orders',
  requireRole(['admin', 'manager']),
  orderController.createAdminOrderController
);

/**
 * Получить детали заказа (админ)
 * GET /api/admin/orders/:id
 * Доступ: Admin, Manager
 */
router.get(
  '/admin/orders/:id',
  requireRole(['admin', 'manager']),
  orderController.getOrderDetailsAdmin
);

/**
 * Обновить данные заказа
 * PUT /api/admin/orders/:id
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
  '/admin/orders/:id',
  requireRole(['admin', 'manager']),
  orderController.updateOrder
);

/**
 * Обновить статус заказа
 * PUT /api/admin/orders/:id/status
 * Доступ: Admin, Manager
 * 
 * Body:
 * {
 *   "newStatus": "processing",
 *   "notes": "Заказ передан в обработку"
 * }
 */
router.put(
  '/admin/orders/:id/status',
  requireRole(['admin', 'manager']),
  orderController.updateOrderStatus
);

/**
 * Удалить заказ
 * DELETE /api/admin/orders/:id
 * Доступ: Admin, Manager
 * 
 * Можно удалить только заказы в статусе: pending, cancelled
 */
router.delete(
  '/admin/orders/:id',
  requireRole(['admin', 'manager']),
  orderController.deleteOrder
);

/**
 * Добавить товар в заказ
 * POST /api/admin/orders/:id/items
 * Доступ: Admin, Manager
 * 
 * Body:
 * {
 *   "product_id": 123,
 *   "quantity": 2
 * }
 */
router.post(
  '/admin/orders/:id/items',
  requireRole(['admin', 'manager']),
  orderController.addItemToOrder
);

/**
 * Удалить товар из заказа
 * DELETE /api/admin/orders/:id/items/:itemId
 * Доступ: Admin, Manager
 */
router.delete(
  '/admin/orders/:id/items/:itemId',
  requireRole(['admin', 'manager']),
  orderController.removeItemFromOrder
);

module.exports = router;