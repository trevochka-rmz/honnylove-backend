// src/controllers/authController.js
const authService = require('../services/authService');

/**
 * Вспомогательная функция для получения информации об устройстве
 */
const getDeviceInfo = (req) => {
  return {
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    deviceName: req.body.deviceName || null, // Фронт может передать название устройства
  };
};

/**
 * Регистрация нового пользователя
 */
const register = async (req, res, next) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Логин пользователя
 */
const login = async (req, res, next) => {
  try {
    const deviceInfo = getDeviceInfo(req);
    const result = await authService.loginUser(req.body, deviceInfo);
    
    // Устанавливаем cookies
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000, // 15 минут
    });

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 дней
    });

    res.json({ 
      user: result.user,
      message: 'Login successful'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Логин администратора
 */
const adminLogin = async (req, res, next) => {
  try {
    const deviceInfo = getDeviceInfo(req);
    const result = await authService.adminLogin(req.body, deviceInfo);

    // Устанавливаем cookies с префиксом admin_
    res.cookie('admin_accessToken', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 15 * 60 * 1000,
      path: '/', // Важно! Делаем доступным для всего домена
    });

    res.cookie('admin_refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    res.json({
      user: result.user,
      message: 'Admin login successful'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Обновить токен
 */
const refresh = async (req, res, next) => {
  try {
    // Определяем, это админка или основной сайт
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

    // Устанавливаем новый access token
    if (isAdminHost) {
      res.cookie('admin_accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 15 * 60 * 1000,
        path: '/',
      });
    } else {
      res.cookie('accessToken', result.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Strict',
        maxAge: 15 * 60 * 1000,
      });
    }

    res.json({ message: 'Token refreshed successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout - выход с текущего устройства
 */
const logout = async (req, res, next) => {
  try {
    const isAdminHost = 
      req.hostname === 'admin.honnylove.ru' || 
      req.headers.host?.includes('admin.honnylove.ru');

    const refreshToken = isAdminHost 
      ? req.cookies.admin_refreshToken 
      : req.cookies.refreshToken;

    // Удаляем refresh token из БД
    if (refreshToken) {
      await authService.logout(refreshToken);
    }

    // Очищаем cookies
    if (isAdminHost) {
      res.clearCookie('admin_accessToken', { path: '/' });
      res.clearCookie('admin_refreshToken', { path: '/' });
    } else {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
    }

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Logout со всех устройств
 */
const logoutAll = async (req, res, next) => {
  try {
    await authService.logoutAll(req.user.id);
    
    const isAdminHost = 
      req.hostname === 'admin.honnylove.ru' || 
      req.headers.host?.includes('admin.honnylove.ru');

    // Очищаем cookies на текущем устройстве
    if (isAdminHost) {
      res.clearCookie('admin_accessToken', { path: '/' });
      res.clearCookie('admin_refreshToken', { path: '/' });
    } else {
      res.clearCookie('accessToken');
      res.clearCookie('refreshToken');
    }

    res.json({ message: 'Logged out from all devices successfully' });
  } catch (err) {
    next(err);
  }
};

/**
 * Получить активные сессии
 */
const getActiveSessions = async (req, res, next) => {
  try {
    const sessions = await authService.getActiveSessions(req.user.id);
    res.json(sessions);
  } catch (err) {
    next(err);
  }
};

/**
 * Запрос верификации
 */
const requestVerification = async (req, res, next) => {
  try {
    const result = await authService.requestVerification(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Подтвердить email
 */
const verifyEmail = async (req, res, next) => {
  try {
    const result = await authService.verifyEmail(req.body.email, req.body.code);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Запрос сброса пароля
 */
const requestPasswordReset = async (req, res, next) => {
  try {
    const result = await authService.requestPasswordReset(req.body.email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

/**
 * Подтвердить сброс пароля
 */
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
  logout,
  logoutAll,
  getActiveSessions,
  requestVerification,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset 
};