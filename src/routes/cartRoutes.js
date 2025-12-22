// src/routes/cartRoutes.js
const express = require('express');
const router = express.Router();
const cartController = require('../controllers/cartController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole(['customer'])); // Все роуты protected

router.post('/', cartController.addToCart); // body: {productId, quantity}
router.get('/', cartController.getCart);
router.put('/:itemId', cartController.updateCartItem); // body: {quantity}
router.delete('/:itemId', cartController.removeFromCart);
router.delete('/', cartController.clearCart);

module.exports = router;
