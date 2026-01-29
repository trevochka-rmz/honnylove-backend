// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('../config/passport');

/**
 * Регистрация нового пользователя
 * POST /api/auth/register
 * Доступ: Публичный
 *
 * Body:
 * {
 * "username": "Имя пользователя" (обязательно, min 3, max 255),
 * "email": "email@example.com" (обязательно, валидный email),
 * "password": "Пароль" (обязательно, min 6),
 * "role": "customer" (опционально, по умолчанию 'customer', может быть 'customer', 'manager', 'admin'),
 * "first_name": "Имя" (опционально),
 * "last_name": "Фамилия" (опционально),
 * "phone": "Телефон" (опционально),
 * "address": "Адрес" (опционально)
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
 * "email": "email@example.com" (обязательно),
 * "password": "Пароль" (обязательно, min 6)
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
 * "refreshToken": "Токен" (обязательно)
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
 * "email": "email@example.com" (обязательно),
 * "password": "Пароль" (обязательно)
 * }
 */
router.post('/admin/login', authController.adminLogin);

/**
 * Запрос на отправку кода верификации
 * POST /api/auth/verify/request
 * Body: { "email": "email@example.com" }
 */
router.post('/verify/request', authController.requestVerification);

/**
 * Подтвердить email по коду
 * POST /api/auth/verify/confirm
 * Body: { "email": "email@example.com", "code": "ABC123" }
 */
router.post('/verify/confirm', authController.verifyEmail);

/**
 * Запрос на сброс пароля
 * POST /api/auth/password/reset/request
 * Body: { "email": "email@example.com" }
 */
router.post('/password/reset/request', authController.requestPasswordReset);

/**
 * Подтвердить сброс пароля
 * POST /api/auth/password/reset/confirm
 * Body: { "email": "email@example.com", "code": "ABC123", "newPassword": "newpass" }
 */
router.post('/password/reset/confirm', authController.confirmPasswordReset);

/**
 * OAuth Google: Запуск авторизации
 * GET /api/auth/google
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

/**
 * OAuth Google: Callback
 * GET /api/auth/google/callback
 * После успеха redirect на фронт с токенами (нужно настроить на фронте)
 */
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login?error=auth_failed' }), (req, res) => {
  const { accessToken, refreshToken } = req.user; // Из strategy

  // Установите accessToken в cookie (не HttpOnly, чтобы фронт мог читать для API запросов)
  res.cookie('accessToken', accessToken, {
    httpOnly: false, // Доступен для JS
    secure: true,    // Только HTTPS
    sameSite: 'Strict',
    maxAge: 15 * 60 * 1000 // 15 мин, как access token
  });

  // Установите refreshToken в HttpOnly cookie (для безопасности)
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,  // Не доступен для JS (защита от XSS)
    secure: true,
    sameSite: 'Strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 дней, как refresh
  });

  // Redirect на фронт (без params)
  res.redirect(`${process.env.FRONTEND_URL}/profile`); // Или /, в зависимости от UX
});

module.exports = router;