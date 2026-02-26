// src/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const passport = require('../config/passport');
const { authenticate } = require('../middleware/authMiddleware');

/**
 * Регистрация нового пользователя
 * POST /api/auth/register
 */
router.post('/register', authController.register);

/**
 * Логин пользователя
 * POST /api/auth/login
 */
router.post('/login', authController.login);

/**
 * Обновить access token
 * POST /api/auth/refresh
 */
router.post('/refresh', authController.refresh);

/**
 * Логин администратора
 * POST /api/auth/admin/login
 */
router.post('/admin/login', authController.adminLogin);

/**
 * Logout - выход с текущего устройства
 * POST /api/auth/logout
 */
router.post('/logout', authController.logout);

/**
 * Logout со всех устройств
 * POST /api/auth/logout-all
 * Требует авторизации
 */
router.post('/logout-all', authenticate, authController.logoutAll);

/**
 * Получить список активных сессий
 * GET /api/auth/sessions
 * Требует авторизации
 */
router.get('/sessions', authenticate, authController.getActiveSessions);

/**
 * Запрос на отправку кода верификации
 * POST /api/auth/verify/request
 */
router.post('/verify/request', authController.requestVerification);

/**
 * Подтвердить email по коду
 * POST /api/auth/verify/confirm
 */
router.post('/verify/confirm', authController.verifyEmail);

/**
 * Запрос на сброс пароля
 * POST /api/auth/password/reset/request
 */
router.post('/password/reset/request', authController.requestPasswordReset);

/**
 * Подтвердить сброс пароля
 * POST /api/auth/password/reset/confirm
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

module.exports = router;