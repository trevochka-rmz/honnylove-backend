// src/controllers/authController.js
const authService = require('../services/authService');

// Регистрация нового пользователя
const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// Логин пользователя
const login = async (req, res, next) => {
  try {
    const result = await authService.loginUser(req.body);
    
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({ 
      user: result.user,
      message: 'Login successful'
    });
  } catch (err) {
    next(err);
  }
};

// Логин администратора
const adminLogin = async (req, res, next) => {
  try {
    const result = await authService.adminLogin(req.body);

    // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
    // Главное изменение здесь:
    res.cookie('admin_accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000
    });

    res.cookie('admin_refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    // ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←

    res.json({
      user: result.user,
      message: 'Admin login successful'
    });
  } catch (err) {
    next(err);
  }
};

// Обновить токен
const refresh = async (req, res, next) => {
  try {
    const isAdminHost = 
      req.hostname === 'admin.honnylove.ru' || 
      req.headers.host?.includes('admin.honnylove.ru');

    const refreshToken = isAdminHost 
      ? req.cookies.admin_refreshToken 
      : req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token не найден' });
    }

    const result = await authService.refreshToken(refreshToken);

    // Ставим новый access-токен с правильным именем
    if (isAdminHost) {
      res.cookie('admin_accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 15 * 60 * 1000
      });
    } else {
      res.cookie('accessToken', result.accessToken, { /* старые настройки */ });
    }

    res.json({ message: 'Token refreshed successfully' });
  } catch (err) {
    next(err);
  }
};

// Запрос верификации
const requestVerification = async (req, res, next) => {
  try {
    const result = await authService.requestVerification(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Подтвердить email
const verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body.email, req.body.code);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Запрос сброса пароля
const requestPasswordReset = async (req, res, next) => {
  try {
    const result = await authService.requestPasswordReset(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Подтвердить сброс пароля
const confirmPasswordReset = async (req, res, next) => {
  try {
    const result = await authService.confirmPasswordReset(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { 
  register, 
  login, 
  refresh, 
  adminLogin,
  requestVerification,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset 
};