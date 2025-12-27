// src/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole(['customer']));

// POST /api/cart - Добавить товар в корзину
// Body: { "product_id": 123, "quantity": 2 }
router.post('/', cartController.addToCart);

// GET /api/cart - Получить корзину
router.get('/', cartController.getCart);

// PUT /api/cart/:itemId - Изменить количество
// Body: { "quantity": 3 }
router.put('/:itemId', cartController.updateCartItem);

// DELETE /api/cart/:itemId - Удалить товар из корзины
router.delete('/:itemId', cartController.removeFromCart);

// DELETE /api/cart - Очистить всю корзину
router.delete('/', cartController.clearCart);

module.exports = router;
