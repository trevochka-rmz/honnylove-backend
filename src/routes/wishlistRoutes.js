// src/routes/wishlistRoutes.js
const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole(['customer']));

/**
 * Добавить товар в избранное
 * POST /api/wishlist
 * Доступ: Customer
 *
 * Body:
 * {
 *   "productId": 123 (обязательно, ID товара)
 * }
 */
router.post('/', wishlistController.addToWishlist);

/**
 * Получить список избранного
 * GET /api/wishlist
 * Доступ: Customer
 */
router.get('/', wishlistController.getWishlist);

/**
 * Удалить товар из избранного
 * DELETE /api/wishlist/:productId
 * Доступ: Customer
 */
router.delete('/:productId', wishlistController.removeFromWishlist);

/**
 * Очистить все избранное
 * DELETE /api/wishlist
 * Доступ: Customer
 */
router.delete('/', wishlistController.clearWishlist);

module.exports = router;