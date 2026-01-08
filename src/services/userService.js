// src/services/userService.js
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const userModel = require('../models/userModel');
const AppError = require('../utils/errorUtils');
const {
    generateAccessToken,
    generateRefreshToken,
} = require('../utils/jwtUtils');

// Схема для создания admin/manager (добавлено discount_percentage optional)
const adminManagerSchema = Joi.object({
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    discount_percentage: Joi.number()
        .precision(2)
        .min(0)
        .max(100)
        .optional()
        .default(0.0),
});

// Схема для обновления профиля (добавлено discount_percentage optional, но лучше админам менять отдельно)
const updateProfileSchema = Joi.object({
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    // discount_percentage: Joi.number().precision(2).min(0).max(100).optional(), // Optional, но можно ограничить для self-update
    // Не добавляем sensitive поля
});

const getAllUsers = async (query) => {
    const { page = 1, limit = 10, role } = query;
    return userModel.getAllUsers({ page, limit, role });
};

const updateUserRole = async (id, role) => {
    const validRoles = ['customer', 'manager', 'admin'];
    if (!validRoles.includes(role)) throw new AppError('Invalid role', 400);
    const user = await userModel.getUserById(id);
    if (!user) throw new AppError('User not found', 404);
    return userModel.updateUser(id, { role });
};

const deactivateUser = async (id) => {
    const user = await userModel.getUserById(id);
    if (!user) throw new AppError('User not found', 404);
    return userModel.updateUser(id, { is_active: false });
};

const createAdmin = async (data) => {
    const { error, value } = adminManagerSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    const existingUser = await userModel.getUserByEmail(value.email);
    if (existingUser) throw new AppError('User already exists', 400);
    const hashedPassword = await bcrypt.hash(value.password, 10);
    const newUser = await userModel.createUser({
        ...value,
        password_hash: hashedPassword,
        role: 'admin',
    });
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);
    await userModel.updateRefreshToken(newUser.id, refreshToken);
    return {
        user: { ...newUser, password_hash: undefined },
        accessToken,
        refreshToken,
    };
};

const createManager = async (data) => {
    const { error, value } = adminManagerSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    const existingUser = await userModel.getUserByEmail(value.email);
    if (existingUser) throw new AppError('User already exists', 400);
    const hashedPassword = await bcrypt.hash(value.password, 10);
    return userModel.createUser({
        ...value,
        password_hash: hashedPassword,
        role: 'manager',
    });
};
const getProfile = async (userId) => {
  const profile = await userModel.getUserProfile(userId);
  if (!profile) {
      throw new AppError('Profile not found', 404);
  }
  return profile;
};

const updateProfile = async (userId, data) => {
  const { error, value } = updateProfileSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  
  return userModel.updateUser(userId, value);
};

module.exports = {
    getAllUsers,
    updateUserRole,
    deactivateUser,
    createAdmin,
    createManager,
    getProfile,
    updateProfile,
};
