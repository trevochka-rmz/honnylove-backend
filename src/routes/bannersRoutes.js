// src/routes/bannersRoutes.js
const express = require('express');
const router = express.Router();
const bannersController = require('../controllers/bannersController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// ПУБЛИЧНЫЕ МАРШРУТЫ

/**
 * Получить все активные баннеры
 * GET /api/banners
 * Доступ: Публичный
 */
router.get('/', bannersController.getAllBanners);

// АДМИНСКИЕ МАРШРУТЫ

/**
 * Получить все баннеры с пагинацией
 * GET /api/banners/admin?page=1&limit=10
 * Доступ: Admin
 *
 * Query параметры:
 * - page: номер страницы (обязательно, по умолчанию 1)
 * - limit: количество на странице (обязательно, по умолчанию 10, max 50)
 */
router.get(
  '/admin',
  authenticate,
  requireRole(['admin']),
  bannersController.getAllBannersAdmin
);

/**
 * Получить баннер по ID
 * GET /api/banners/:id
 * Доступ: Admin
 */
router.get(
  '/:id',
  authenticate,
  requireRole(['admin']),
  bannersController.getBannerById
);

/**
 * Создать новый баннер
 * POST /api/banners
 * Доступ: Admin
 * Multipart form-data (для изображения)
 * 
 * Body:
 * {
 *   "preheader": "Предзаголовок" (опционально),
 *   "title": "Заголовок" (обязательно),
 *   "subtitle": "Подзаголовок" (опционально),
 *   "button_text": "Текст кнопки" (опционально),
 *   "button_link": "/link" (опционально),
 *   "display_order": 0 (опционально, по умолчанию 0),
 *   "is_active": true (опционально, по умолчанию true)
 * }
 * File: image (опционально, файл изображения)
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  bannersController.createBanner
);

/**
* Обновить баннер
* PUT /api/banners/:id
* Доступ: Admin
* Multipart form-data (для изображения)
* 
* Body: (все поля опциональны)
* {
*   "preheader": "Новый предзаголовок" (опционально),
*   "title": "Новый заголовок" (опционально),
*   "subtitle": "Новый подзаголовок" (опционально),
*   "button_text": "Новый текст кнопки" (опционально),
*   "button_link": "/new/link" (опционально),
*   "display_order": 1 (опционально),
*   "is_active": false (опционально)
* }
* File: image (опционально, новый файл изображения)
*/
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  bannersController.updateBanner
);

/**
 * Удалить баннер
 * DELETE /api/banners/:id
 * Доступ: Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  bannersController.deleteBanner
);

module.exports = router;