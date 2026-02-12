// src/routes/posRoutes.js
const express = require('express');
const router = express.Router();
const posController = require('../controllers/posController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// =====================================
// ВСЕ МАРШРУТЫ ТРЕБУЮТ АУТЕНТИФИКАЦИИ
// Доступ: Manager, Admin
// =====================================

router.use(authenticate);
router.use(requireRole(['manager', 'admin']));

// =====================================
// ОСНОВНЫЕ POS ОПЕРАЦИИ
// =====================================

/**
 * Создать POS заказ (чек)
 * POST /api/pos/checkout
 * Доступ: Manager, Admin
 * 
 * Body:
 * {
 *   "items": [
 *     { "product_id": 1, "quantity": 2 },
 *     { "product_id": 5, "quantity": 1 }
 *   ],
 *   "payment_method": "cash",       // cash или card
 *   "customer_name": "Иван Иванов",  // опционально
 *   "customer_phone": "+7 999 123",  // опционально
 *   "notes": "Примечания",           // опционально
 *   "discount_amount": 100           // опционально
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Чек успешно создан",
 *   "data": {
 *     "order": { ... },
 *     "receipt_number": "CHK-000123",
 *     "items_count": 2,
 *     "total_quantity": 3,
 *     "subtotal": 5000,
 *     "discount": 100,
 *     "total": 4900,
 *     "payment_method": "cash"
 *   }
 * }
 */
router.post('/checkout', posController.createPOSCheckout);

/**
 * Предпросмотр товаров перед созданием чека
 * POST /api/pos/preview
 * Доступ: Manager, Admin
 * 
 * Body:
 * {
 *   "product_ids": [1, 2, 5, 10]
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "products": [
 *     {
 *       "id": 1,
 *       "name": "Крем для лица",
 *       "sku": "NIVEA-FACE-0001-COS",
 *       "retail_price": "2500.00",
 *       "discount_price": "2000.00",
 *       "final_price": "2000.00",
 *       "available_stock": 50,
 *       "is_active": true
 *     }
 *   ],
 *   "summary": {
 *     "total_items": 4,
 *     "subtotal": 8000,
 *     "unavailable_count": 0,
 *     "unavailable_products": []
 *   }
 * }
 */
router.post('/preview', posController.previewProducts);

// =====================================
// ПРОСМОТР ЗАКАЗОВ
// =====================================

/**
 * Получить список POS заказов с фильтрами
 * GET /api/pos/orders
 * Доступ: Manager, Admin
 * 
 * Query параметры:
 * - status: pending|paid|completed|cancelled
 * - payment_method: cash|card
 * - created_by: ID кассира
 * - date_from: 2024-01-01
 * - date_to: 2024-01-31
 * - today_only: true        (только за сегодня)
 * - this_week: true         (только за эту неделю)
 * - this_month: true        (только за этот месяц)
 * - search: поисковый запрос
 * - is_pos_order: true      (только POS заказы, помеченные [POS])
 * - page: 1
 * - limit: 50
 * 
 * Примеры:
 * - /api/pos/orders?today_only=true
 * - /api/pos/orders?date_from=2024-01-01&date_to=2024-01-31
 * - /api/pos/orders?payment_method=cash&this_month=true
 */
router.get('/orders', posController.getPOSOrders);

/**
 * Обновить POS заказ (чек)
 * PUT /api/pos/orders/:orderId
 * Доступ: Manager, Admin (владелец заказа)
 * 
 * Body:
 * {
 *   "payment_method": "card",          // опционально: cash или card
 *   "discount_amount": 150,            // опционально
 *   "customer_name": "Новое имя",      // опционально
 *   "customer_phone": "+7 999 888",    // опционально
 *   "notes": "Дополнительные заметки"  // опционально
 * }
 * 
 * Ограничения:
 * - Можно изменить только заказы в статусе: pending, paid, completed
 * - Нельзя изменять товары в заказе
 * - При изменении скидки автоматически пересчитывается сумма
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "POS заказ успешно обновлен",
 *   "data": {
 *     "order": { ... полная информация о заказе }
 *   }
 * }
 */
router.put('/orders/:orderId', posController.updatePOSOrder);

/**
 * Удалить POS заказ (чек)
 * DELETE /api/pos/orders/:orderId
 * Доступ: Manager, Admin (владелец заказа)
 * 
 * Ограничения:
 * - Можно удалить только заказы в статусе: pending, cancelled
 * - Товары автоматически возвращаются на склад (если заказ не был отменен)
 * - Админ может удалить любой POS заказ
 * - Менеджер может удалить только свой заказ
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "POS заказ успешно удален"
 * }
 */
router.delete('/orders/:orderId', posController.deletePOSOrder);

// =====================================
// СТАТИСТИКА
// =====================================

/**
 * Получить общую статистику продаж
 * GET /api/pos/statistics
 * Доступ: Manager, Admin
 * 
 * Query параметры:
 * - date_from: 2024-01-01
 * - date_to: 2024-01-31
 * - today_only: true
 * - this_week: true
 * - this_month: true
 * - cashier_id: ID кассира
 * - is_pos_order: true
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": {
 *       "total_orders": 150,
 *       "completed_orders": 140,
 *       "paid_orders": 145,
 *       "cancelled_orders": 5,
 *       "total_revenue": "450000.00",
 *       "avg_order_value": "3000.00",
 *       "cash_orders": 80,
 *       "card_orders": 70,
 *       "cash_revenue": "240000.00",
 *       "card_revenue": "210000.00"
 *     },
 *     "top_products": [
 *       {
 *         "id": 1,
 *         "name": "Крем для лица",
 *         "times_ordered": 45,
 *         "total_quantity_sold": 67,
 *         "total_revenue": "134000.00"
 *       }
 *     ],
 *     "daily_stats": [
 *       {
 *         "date": "2024-01-15",
 *         "orders_count": 12,
 *         "daily_revenue": "36000.00",
 *         "avg_order_value": "3000.00"
 *       }
 *     ]
 *   }
 * }
 */
router.get('/statistics', posController.getSalesStatistics);

/**
 * Быстрая статистика за сегодня
 * GET /api/pos/today
 * Доступ: Manager, Admin
 */
router.get('/today', posController.getTodayStats);

/**
 * Статистика за текущую неделю
 * GET /api/pos/this-week
 * Доступ: Manager, Admin
 */
router.get('/this-week', posController.getThisWeekStats);

/**
 * Статистика за текущий месяц
 * GET /api/pos/this-month
 * Доступ: Manager, Admin
 */
router.get('/this-month', posController.getThisMonthStats);

/**
 * Статистика по конкретному кассиру
 * GET /api/pos/cashier/:cashierId/stats
 * Доступ: Manager, Admin
 * 
 * Query параметры:
 * - date_from: 2024-01-01
 * - date_to: 2024-01-31
 */
router.get('/cashier/:cashierId/stats', posController.getCashierStats);

// =====================================
// УПРАВЛЕНИЕ КАССИРАМИ
// =====================================

/**
 * Получить список кассиров
 * GET /api/pos/cashiers
 * Доступ: Manager, Admin
 * 
 * Права доступа:
 * - Manager: видит только менеджеров
 * - Admin: видит менеджеров + админов
 * 
 * Response:
 * {
 *   "success": true,
 *   "cashiers": [
 *     {
 *       "id": 5,
 *       "email": "manager@shop.com",
 *       "first_name": "Иван",
 *       "last_name": "Петров",
 *       "role": "manager",
 *       "phone": "+7 999 123-45-67",
 *       "is_active": true,
 *       "total_orders": 145,
 *       "total_revenue": "450000.00",
 *       "avg_order_value": "3103.45",
 *       "last_order_date": "2024-02-12T15:30:00Z"
 *     }
 *   ],
 *   "total": 5
 * }
 */
router.get('/cashiers', posController.getCashiers);

/**
 * Получить детальную информацию о кассире
 * GET /api/pos/cashiers/:cashierId
 * Доступ: Manager, Admin
 * 
 * Права доступа:
 * - Manager: может видеть только менеджеров
 * - Admin: может видеть менеджеров + админов
 * 
 * Response:
 * {
 *   "success": true,
 *   "cashier": {
 *     "id": 5,
 *     "email": "manager@shop.com",
 *     "first_name": "Иван",
 *     "last_name": "Петров",
 *     "role": "manager",
 *     "total_orders": 145,
 *     "total_revenue": "450000.00",
 *     "avg_order_value": "3103.45",
 *     "max_order_value": "15000.00",
 *     "cash_orders": 80,
 *     "card_orders": 65,
 *     "first_order_date": "2024-01-01T10:00:00Z",
 *     "last_order_date": "2024-02-12T15:30:00Z"
 *   }
 * }
 */
router.get('/cashiers/:cashierId', posController.getCashierDetails);

module.exports = router;