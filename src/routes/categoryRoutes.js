// src/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.get('/', categoryController.getCategories);
router.get('/tree', categoryController.getCategoriesTree);
router.get('/:id', categoryController.getCategoryById);

router.post(
    '/',
    authenticate,
    requireRole(['admin']),
    categoryController.createCategory
);
router.put(
    '/:id',
    authenticate,
    requireRole(['admin']),
    categoryController.updateCategory
);
router.delete(
    '/:id',
    authenticate,
    requireRole(['admin']),
    categoryController.deleteCategory
);

module.exports = router;
