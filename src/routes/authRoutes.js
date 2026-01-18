// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

/**
 * Регистрация нового пользователя
 * POST /api/auth/register
 * Доступ: Публичный
 *
 * Body:
 * {
 *   "username": "Имя пользователя" (обязательно, min 3, max 255),
 *   "email": "email@example.com" (обязательно, валидный email),
 *   "password": "Пароль" (обязательно, min 8),
 *   "role": "customer" (опционально, по умолчанию 'customer', может быть 'customer', 'manager', 'admin'),
 *   "first_name": "Имя" (опционально),
 *   "last_name": "Фамилия" (опционально),
 *   "phone": "Телефон" (опционально),
 *   "address": "Адрес" (опционально)
 * }
 */
router.post('/register', authController.register);

/**
 * Логин пользователя
 * POST /api/auth/login
 * Доступ: Публичный
 *
 * Body:
 * {
 *   "email": "email@example.com" (обязательно),
 *   "password": "Пароль" (обязательно)
 * }
 */
router.post('/login', authController.login);

/**
 * Обновить access token
 * POST /api/auth/refresh
 * Доступ: Публичный (с refresh token)
 *
 * Body:
 * {
 *   "refreshToken": "Токен" (обязательно)
 * }
 */
router.post('/refresh', authController.refresh);

/**
 * Логин администратора
 * POST /api/auth/admin/login
 * Доступ: Публичный
 *
 * Body:
 * {
 *   "email": "email@example.com" (обязательно),
 *   "password": "Пароль" (обязательно)
 * }
 */
router.post('/admin/login', authController.adminLogin);

module.exports = router;