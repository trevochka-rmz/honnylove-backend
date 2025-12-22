// src/routes/wishlistRoutes.js
const express = require('express');
const router = express.Router();
const wishlistController = require('../controllers/wishlistController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole(['customer']));

router.post('/', wishlistController.addToWishlist); // body: {productId}
router.get('/', wishlistController.getWishlist);
router.delete('/:productId', wishlistController.removeFromWishlist);

module.exports = router;
