// src/controllers/userController.js
const userService = require('../services/userService');

// Получить всех пользователей
const getAllUsers = async (req, res, next) => {
  try {
    const users = await userService.getAllUsers(req.query);
    res.json(users);
  } catch (err) {
    next(err);
  }
};

// Получить пользователя по ID для админа
const getUserByIdAdmin = async (req, res, next) => {
  try {
    const user = await userService.getUserByIdAdmin(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Обновить пользователя админом
const updateUserByIdAdmin = async (req, res, next) => {
  try {
    const updated = await userService.updateUserByIdAdmin(req.params.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Удалить пользователя
const deleteUserById = async (req, res, next) => {
  try {
    await userService.deleteUser(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// Создать пользователя с ролью
const createUserWithRole = async (req, res, next) => {
  try {
    const result = await userService.createUserWithRole(req.body);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// Обновить роль пользователя
const updateUserRole = async (req, res, next) => {
  try {
    const user = await userService.updateUserRole(
      req.params.id,
      req.body.role
    );
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Деактивировать пользователя
const deactivateUser = async (req, res, next) => {
  try {
    const user = await userService.deactivateUser(req.params.id);
    res.json(user);
  } catch (err) {
    next(err);
  }
};

// Получить профиль пользователя
const getProfile = async (req, res, next) => {
  try {
    const profile = await userService.getProfile(req.user.id);
    res.json(profile);
  } catch (err) {
    next(err);
  }
};

// Обновить профиль пользователя
const updateProfile = async (req, res, next) => {
  try {
    const updated = await userService.updateProfile(req.user.id, req.body);
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllUsers,
  getUserByIdAdmin,
  updateUserByIdAdmin,
  deleteUserById,
  createUserWithRole,
  updateUserRole,
  deactivateUser,
  getProfile,
  updateProfile,
};