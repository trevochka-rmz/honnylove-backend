// src/routes/settingsRoutes.js
const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// ПУБЛИЧНЫЕ МАРШРУТЫ

/**
 * Получить настройки сайта
 * GET /api/settings
 * Доступ: Публичный
 */
router.get('/', settingsController.getSettings);

// АДМИНСКИЕ МАРШРУТЫ

/**
 * Обновить настройки сайта
 * PUT /api/settings
 * Доступ: Admin
 *
 * Body: (все поля опциональны)
 * {
 *   "phone": "Номер телефона" (опционально),
 *   "email": "email@example.com" (опционально, должен быть валидным email),
 *   "description": "Описание сайта" (опционально),
 *   "social_links": [
 *     {
 *       "name": "Название социальной сети" (обязательно),
 *       "url": "https://example.com" (обязательно, валидный URL),
 *       "icon": "/path/to/icon.svg" (опционально)
 *     }
 *   ] (опционально, массив объектов),
 *   "footer_links": [
 *     {
 *       "title": "Заголовок ссылки" (обязательно),
 *       "url": "/link" (обязательно)
 *     }
 *   ] (опционально, массив объектов)
 * }
 */
router.put(
  '/',
  authenticate,
  requireRole(['admin']),
  settingsController.updateSettings
);

module.exports = router;