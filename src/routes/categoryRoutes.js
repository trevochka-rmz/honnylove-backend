// src/routes/categoryRoutes.js
const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// ПУБЛИЧНЫЕ МАРШРУТЫ

/**
 * Получить все категории в формате дерева
 * GET /api/categories/all
 * Доступ: Публичный
 */
router.get('/all', categoryController.getAllCategoriesForFrontend);

/**
 * Получить категорию по идентификатору (id или slug) с подкатегориями
 * GET /api/categories/:identifier
 * Доступ: Публичный
 */
router.get('/:identifier', categoryController.getCategoryByIdentifier);

/**
 * Получить список категорий с пагинацией и фильтрами
 * GET /api/categories?page=1&limit=10&isActive=true&search=query&filter=popular
 * Доступ: Публичный
 *
 * Query параметры:
 * - page: номер страницы (обязательно, по умолчанию 1)
 * - limit: количество на странице (обязательно, по умолчанию 10, max 50)
 * - isActive: фильтр по активности (опционально)
 * - search: поиск по имени или описанию (опционально)
 * - filter: popular|new (опционально)
 */
router.get('/', categoryController.getCategories);

// АДМИНСКИЕ МАРШРУТЫ

/**
 * Создать новую категорию
 * POST /api/categories
 * Доступ: Admin
 *
 * Body:
 * {
 *   "name": "Название категории" (обязательно),
 *   "parent_id": 123 (опционально, null для корневой),
 *   "description": "Описание" (опционально),
 *   "slug": "slug-example" (опционально),
 *   "is_active": true (опционально, по умолчанию true),
 *   "display_order": 0 (опционально, по умолчанию 0),
 *   "image_url": "/path/to/image.jpg" (опционально)
 * }
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  categoryController.createCategory
);

/**
 * Обновить категорию
 * PUT /api/categories/:id
 * Доступ: Admin
 *
 * Body: (все поля опциональны)
 * {
 *   "name": "Новое название" (опционально),
 *   "parent_id": 456 (опционально),
 *   "description": "Новое описание" (опционально),
 *   "slug": "new-slug" (опционально),
 *   "is_active": false (опционально),
 *   "display_order": 1 (опционально),
 *   "image_url": "/new/path.jpg" (опционально)
 * }
 */
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  categoryController.updateCategory
);

/**
 * Удалить категорию
 * DELETE /api/categories/:id
 * Доступ: Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  categoryController.deleteCategory
);

module.exports = router;