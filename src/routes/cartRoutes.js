// src/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole(['customer']));

/**
 * Добавить товар в корзину
 * POST /api/cart
 * Доступ: Customer
 *
 * Body:
 * {
 *   "product_id": 123 (обязательно, ID товара),
 *   "quantity": 2 (обязательно, количество, min 1, max 50)
 * }
 */
router.post('/', cartController.addToCart);

/**
 * Получить корзину пользователя
 * GET /api/cart
 * Доступ: Customer
 */
router.get('/', cartController.getCart);

/**
 * Получить выбранные товары из корзины
 * POST /api/cart/selected
 * Доступ: Customer
 * 
 * Body:
 * {
 *   "selected_items": [1, 2, 3] // ID товаров в корзине (cart_items.id)
 * }
 */
router.post('/selected', cartController.getSelectedCartItems);

/**
 * Обновить количество товара в корзине
 * PUT /api/cart/:itemId
 * Доступ: Customer
 *
 * Body:
 * {
 *   "quantity": 3 (обязательно, новое количество, min 1, max 50)
 * }
 */
router.put('/:itemId', cartController.updateCartItem);

/**
 * Удалить товар из корзины
 * DELETE /api/cart/:itemId
 * Доступ: Customer
 */
router.delete('/:itemId', cartController.removeFromCart);

/**
 * Очистить всю корзину
 * DELETE /api/cart
 * Доступ: Customer
 */
router.delete('/', cartController.clearCart);

module.exports = router;