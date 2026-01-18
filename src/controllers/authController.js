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
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Логин администратора
const adminLogin = async (req, res, next) => {
  try {
    const result = await authService.adminLogin(req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Обновить токен
const refresh = async (req, res, next) => {
  try {
    const result = await authService.refreshToken(req.body.refreshToken);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, refresh, adminLogin };