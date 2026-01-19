// src/routes/brandRoutes.js
const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

/**
 * Получить список брендов с пагинацией и фильтрами
 * GET /api/brands?page=1&limit=8&isActive=true&search=query&filter=popular
 * Доступ: Публичный
 *
 * Query параметры:
 * - page: номер страницы (обязательно, по умолчанию 1)
 * - limit: количество на странице (обязательно, по умолчанию 8, max 50)
 * - isActive: фильтр по активности (опционально)
 * - search: поиск по имени, описанию и т.д. (опционально)
 * - filter: popular|new|recommended (опционально)
 */
router.get('/', brandController.getBrands);

/**
 * Получить краткий список всех активных брендов
 * GET /api/brands/brief
 * Доступ: Публичный
 */
router.get('/brief', brandController.getBrandsBrief);

/**
 * Получить бренд по идентификатору (id или slug)
 * GET /api/brands/:identifier
 * Доступ: Публичный
 */
router.get('/:identifier', brandController.getBrandByIdentifier);

/**
 * Создать новый бренд
 * POST /api/brands
 * Доступ: Admin
 * Multipart form-data (для логотипа)
 * 
 * Body:
 * {
 *   "name": "Название бренда" (обязательно),
 *   "description": "Описание" (опционально),
 *   "website": "https://example.com" (опционально),
 *   "is_active": true (опционально, по умолчанию true),
 *   "full_description": "Полное описание" (опционально),
 *   "country": "Страна" (опционально, по умолчанию 'Южная Корея'),
 *   "founded": "Год основания" (опционально),
 *   "philosophy": "Философия бренда" (опционально),
 *   "highlights": ["Хайлайт 1", "Хайлайт 2"] (опционально)
 * }
 * File: logo (опционально, файл логотипа)
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  brandController.createBrand
);

/**
* Обновить бренд
* PUT /api/brands/:id
* Доступ: Admin
* Multipart form-data (для логотипа)
* 
* Body: (все поля опциональны)
* {
*   "name": "Новое название" (опционально),
*   "description": "Новое описание" (опционально),
*   "website": "https://new.com" (опционально),
*   "is_active": false (опционально),
*   "full_description": "Новое полное описание" (опционально),
*   "country": "Новая страна" (опционально),
*   "founded": "Новый год" (опционально),
*   "philosophy": "Новая философия" (опционально),
*   "highlights": ["Новый хайлайт 1"] (опционально)
* }
* File: logo (опционально, новый файл логотипа)
*/
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  brandController.updateBrand
);

/**
 * Удалить бренд
 * DELETE /api/brands/:id
 * Доступ: Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  brandController.deleteBrand
);

module.exports = router;