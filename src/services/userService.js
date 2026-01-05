// src/services/userService.js
const bcrypt = require('bcrypt');
const Joi = require('joi');
const userModel = require('../models/userModel');
const AppError = require('../utils/errorUtils');
const {
    generateAccessToken,
    generateRefreshToken,
} = require('../utils/jwtUtils');

// Схема для создания admin/manager (без role в body)
const adminManagerSchema = Joi.object({
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
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
    const { error } = adminManagerSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    const existingUser = await userModel.getUserByEmail(data.email);
    if (existingUser) throw new AppError('User already exists', 400);
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = await userModel.createUser({
        ...data,
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
    const { error } = adminManagerSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    const existingUser = await userModel.getUserByEmail(data.email);
    if (existingUser) throw new AppError('User already exists', 400);
    const hashedPassword = await bcrypt.hash(data.password, 10);
    return userModel.createUser({
        ...data,
        password_hash: hashedPassword,
        role: 'manager', // Фиксированно
    });
};

// НОВЫЙ МЕТОД: Получение профиля
const getProfile = async (userId) => {
    const profile = await userModel.getUserProfile(userId);
    if (!profile) throw new AppError('User not found', 404);
    return profile;
};

module.exports = {
    getAllUsers,
    updateUserRole,
    deactivateUser,
    createAdmin,
    createManager,
    getProfile, // Новый экспорт
};
