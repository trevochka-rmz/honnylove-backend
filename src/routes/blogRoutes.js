// src/routes/blogRoutes.js
const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// ПУБЛИЧНЫЕ МАРШРУТЫ

/**
 * Получить все посты блога с пагинацией и фильтрами
 * GET /api/blog?page=1&limit=10&search=query&category=cat&tags=tag1,tag2&sort=latest
 * Доступ: Публичный
 *
 * Query параметры:
 * - page: номер страницы (обязательно, по умолчанию 1)
 * - limit: количество на странице (обязательно, по умолчанию 10, max 50)
 * - search: поиск по заголовку, excerpt или контенту (опционально)
 * - category: категория поста (опционально)
 * - tags: теги (строка с запятыми или массив) (опционально)
 * - sort: latest|oldest|readTime (опционально, по умолчанию latest)
 */
router.get('/', blogController.getBlogPosts);

/**
 * Получить пост блога по идентификатору (id или slug)
 * GET /api/blog/:identifier
 * Доступ: Публичный
 */
router.get('/:identifier', blogController.getBlogPostByIdentifier);

/**
 * Получить все уникальные теги блога
 * GET /api/blog/tags/all
 * Доступ: Публичный
 */
router.get('/tags/all', blogController.getBlogTags);


// АДМИНСКИЕ МАРШРУТЫ

/**
 * Создать новый пост блога
 * POST /api/blog
 * Доступ: Admin
 * Multipart form-data (для изображения)
 *
 * Body:
 * {
 *   "title": "Заголовок" (обязательно),
 *   "excerpt": "Краткое описание" (обязательно),
 *   "content": "Содержание" (обязательно),
 *   "category": "Категория" (обязательно),
 *   "author": "Автор" (обязательно),
 *   "date": "YYYY-MM-DD" (опционально, по умолчанию текущая дата),
 *   "read_time": 5 (обязательно, время чтения в минутах, min 1),
 *   "tags": ["тег1", "тег2"] (опционально, массив строк)
 * }
 * File: image (опционально, файл изображения)
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  blogController.createBlogPost
);

/**
 * Обновить пост блога
 * PUT /api/blog/:id
 * Доступ: Admin
 * Multipart form-data (для изображения)
 *
 * Body: (все поля опциональны)
 * {
 *   "title": "Новый заголовок" (опционально),
 *   "excerpt": "Новое краткое описание" (опционально),
 *   "content": "Новое содержание" (опционально),
 *   "category": "Новая категория" (опционально),
 *   "author": "Новый автор" (опционально),
 *   "date": "YYYY-MM-DD" (опционально),
 *   "read_time": 6 (опционально),
 *   "tags": ["новый тег"] (опционально)
 * }
 * File: image (опционально, новый файл изображения)
 */
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  blogController.updateBlogPost
);

/**
 * Удалить пост блога
 * DELETE /api/blog/:id
 * Доступ: Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  blogController.deleteBlogPost
);

module.exports = router;