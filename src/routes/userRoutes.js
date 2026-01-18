// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// ПУБЛИЧНЫЕ МАРШРУТЫ (для аутентифицированных пользователей)

/**
 * Получить профиль текущего пользователя
 * GET /api/users/profile
 * Доступ: Аутентифицированный пользователь
 */
router.get('/profile', authenticate, userController.getProfile);

/**
 * Обновить профиль текущего пользователя
 * PUT /api/users/profile
 * Доступ: Аутентифицированный пользователь
 *
 * Body: (все поля опциональны)
 * {
 *   "first_name": "Новое имя" (опционально),
 *   "last_name": "Новая фамилия" (опционально),
 *   "phone": "Новый телефон" (опционально),
 *   "address": "Новый адрес" (опционально)
 * }
 */
router.put('/profile', authenticate, userController.updateProfile);

// АДМИНСКИЕ МАРШРУТЫ

/**
 * Создать нового пользователя с ролью
 * POST /api/users/admin/create-user
 * Доступ: Admin
 *
 * Body:
 * {
 *   "username": "Имя пользователя" (обязательно, min 3, max 255),
 *   "email": "email@example.com" (обязательно),
 *   "password": "Пароль" (обязательно, min 8),
 *   "role": "customer|manager|admin" (обязательно),
 *   "first_name": "Имя" (опционально),
 *   "last_name": "Фамилия" (опционально),
 *   "phone": "Телефон" (опционально),
 *   "address": "Адрес" (опционально),
 *   "discount_percentage": 10.0 (опционально, min 0, max 100)
 * }
 */
router.post(
  '/admin/create-user',
  authenticate,
  requireRole(['admin']),
  userController.createUserWithRole
);

/**
 * Получить всех пользователей с пагинацией и фильтром
 * GET /api/users?page=1&limit=10&role=customer
 * Доступ: Admin
 *
 * Query параметры:
 * - page: номер страницы (по умолчанию 1)
 * - limit: количество на странице (по умолчанию 10)
 * - role: customer|manager|admin (опционально)
 */
router.get(
  '/',
  authenticate,
  requireRole(['admin']),
  userController.getAllUsers
);

/**
 * Получить пользователя по ID
 * GET /api/users/:id
 * Доступ: Admin
 */
router.get(
  '/:id',
  authenticate,
  requireRole(['admin']),
  userController.getUserByIdAdmin
);

/**
 * Обновить пользователя по ID
 * PUT /api/users/:id
 * Доступ: Admin
 *
 * Body: (все поля опциональны)
 * {
 *   "username": "Новое имя пользователя" (опционально),
 *   "email": "newemail@example.com" (опционально),
 *   "role": "manager" (опционально),
 *   "first_name": "Новое имя" (опционально),
 *   "last_name": "Новая фамилия" (опционально),
 *   "phone": "Новый телефон" (опционально),
 *   "address": "Новый адрес" (опционально),
 *   "is_active": false (опционально),
 *   "discount_percentage": 15.0 (опционально)
 * }
 */
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  userController.updateUserByIdAdmin
);

/**
 * Удалить пользователя по ID
 * DELETE /api/users/:id
 * Доступ: Admin
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  userController.deleteUserById
);

/**
 * Обновить роль пользователя
 * PUT /api/users/:id/role
 * Доступ: Admin
 *
 * Body:
 * {
 *   "role": "manager" (обязательно, customer|manager|admin)
 * }
 */
router.put(
  '/:id/role',
  authenticate,
  requireRole(['admin']),
  userController.updateUserRole
);

/**
 * Деактивировать пользователя
 * PUT /api/users/:id/deactivate
 * Доступ: Admin
 */
router.put(
  '/:id/deactivate',
  authenticate,
  requireRole(['admin']),
  userController.deactivateUser
);

module.exports = router;