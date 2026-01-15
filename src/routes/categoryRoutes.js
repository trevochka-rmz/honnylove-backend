// src/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Публичные роуты
router.get('/all', categoryController.getAllCategoriesForFrontend);
router.get('/:identifier', categoryController.getCategoryByIdentifier); // Изменили на :identifier
router.get('/', categoryController.getCategories);

// Защищенные роуты (админка)
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