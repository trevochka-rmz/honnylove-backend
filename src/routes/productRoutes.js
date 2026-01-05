const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Для клиентов
router.get('/', (req, res, next) =>
    productController.getProducts(req, res, next, false)
); // isAdmin=false
router.get('/search', productController.searchProducts);
router.get('/:id', (req, res, next) =>
    productController.getProductById(req, res, next, false)
); // isAdmin=false

// Для админов
router.get(
    '/admin/all',
    authenticate,
    requireRole(['admin', 'manager']),
    (req, res, next) => productController.getProducts(req, res, next, true) // isAdmin=true
);
router.get(
    '/admin/:id',
    authenticate,
    requireRole(['admin', 'manager']),
    (req, res, next) => productController.getProductById(req, res, next, true) // isAdmin=true, новый роут для single admin
);

router.post(
    '/',
    authenticate,
    requireRole(['admin', 'manager']),
    productController.createProduct
);
router.put(
    '/:id',
    authenticate,
    requireRole(['admin', 'manager']),
    productController.updateProduct
);
router.delete(
    '/:id',
    authenticate,
    requireRole(['admin', 'manager']),
    productController.deleteProduct
);

module.exports = router;
