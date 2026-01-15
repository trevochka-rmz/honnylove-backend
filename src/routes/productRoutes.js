const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Для клиентов
router.get('/', (req, res, next) =>
  productController.getProducts(req, res, next, false)
); // isAdmin=false
router.get('/search', productController.searchProducts);
router.get('/:identifier', (req, res, next) =>
  productController.getProductByIdentifier(req, res, next, false)
); // Изменили на :identifier, isAdmin=false

// Для админов и менеджеров (чтение)
router.get(
  '/admin/all',
  authenticate,
  requireRole(['admin', 'manager']),
  (req, res, next) => productController.getProducts(req, res, next, true) // isAdmin=true
);
router.get(
  '/admin/:identifier',
  authenticate,
  requireRole(['admin', 'manager']),
  (req, res, next) => productController.getProductByIdentifier(req, res, next, true) // Изменили на :identifier, isAdmin=true
);

// Только для админов (create, update, delete)
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