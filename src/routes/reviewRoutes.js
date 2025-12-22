// src/routes/reviewRoutes.js
const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.get('/product/:productId', reviewController.getReviews); // Открытый

router.post(
    '/product/:productId',
    authenticate,
    requireRole(['customer']),
    reviewController.addReview
); // body: {rating, comment}

router.put(
    '/:id/approve',
    authenticate,
    requireRole(['admin']),
    reviewController.approveReview
);
router.delete(
    '/:id',
    authenticate,
    requireRole(['admin']),
    reviewController.deleteReview
);

module.exports = router;
