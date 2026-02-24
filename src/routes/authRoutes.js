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
 * "address": "Адрес" (опционально),
 *  "sendVerification": true/false (опционально)
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
 * Доступ: Публичный (с refresh token в cookie)
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
router.get('/google', passport.authenticate('google', { 
  scope: ['profile', 'email'],
  session: false
}));

/**
 * OAuth Google: Callback
 * GET /api/auth/google/callback
 */
router.get('/google/callback', 
  passport.authenticate('google', { 
    failureRedirect: `${process.env.FRONTEND_URL}/login?error=auth_failed`,
    session: false
  }), 
  (req, res) => {
    const { accessToken, refreshToken } = req.user;

    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.redirect(`${process.env.FRONTEND_URL}/auth/google/callback`);
  }
);

/**
 * Logout - очистка cookies
 * POST /api/auth/logout
 */
router.post('/logout', (req, res) => {
  const isAdminHost = req.hostname === 'admin.honnylove.ru' || 
                      req.headers.host?.includes('admin.honnylove.ru');

  if (isAdminHost) {
    res.clearCookie('admin_accessToken');
    res.clearCookie('admin_refreshToken');
  } else {
    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
  }

  res.json({ message: 'Logged out successfully' });
});

module.exports = router;