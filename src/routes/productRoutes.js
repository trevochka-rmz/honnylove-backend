// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.get('/', productController.getProducts);
router.get('/search', productController.searchProducts); // ?q=query
router.get('/:id', productController.getProductById);

router.post(
    '/',
    authenticate,
    requireRole(['admin']),
    productController.createProduct
);
router.put(
    '/:id',
    authenticate,
    requireRole(['admin']),
    productController.updateProduct
);
router.delete(
    '/:id',
    authenticate,
    requireRole(['admin']),
    productController.deleteProduct
);

module.exports = router;
