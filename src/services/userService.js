// services/userService.js
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const userModel = require('../models/userModel');
const AppError = require('../utils/errorUtils');
const {
    generateAccessToken,
    generateRefreshToken,
} = require('../utils/jwtUtils');

// Схема для создания пользователя с указанием роли
const createUserWithRoleSchema = Joi.object({
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string().valid('customer', 'manager', 'admin').required(),
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

// Схема для обновления профиля админом
const updateAdminSchema = Joi.object({
    username: Joi.string().min(3).max(255).optional(),
    email: Joi.string().email().optional(),
    role: Joi.string().valid('customer', 'manager', 'admin').optional(),
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
    is_active: Joi.boolean().optional(),
    discount_percentage: Joi.number().precision(2).min(0).max(100).optional(),
});

// Схема для обновления профиля
const updateProfileSchema = Joi.object({
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
});

// Получение всех пользователей
const getAllUsers = async (query) => {
    const { page = 1, limit = 10, role } = query;
    return userModel.getAllUsers({ page, limit, role });
};

// Получение пользователя по id для админа
const getUserByIdAdmin = async (id) => {
    const user = await userModel.getUserByIdSafe(id);
    if (!user) throw new AppError('Пользователь не найден', 404);
    return user;
};

// Обновление пользователя админом
const updateUserByIdAdmin = async (id, data) => {
    const { error, value } = updateAdminSchema.validate(data);
    if (error) throw new AppError(`Ошибка валидации: ${error.details[0].message}`, 400);
    const user = await userModel.getUserById(id);
    if (!user) throw new AppError('Пользователь не найден', 404);
    return userModel.updateUser(id, value);
};

// Удаление пользователя
const deleteUser = async (id) => {
    const user = await userModel.getUserById(id);
    if (!user) throw new AppError('Пользователь не найден', 404);
    await userModel.deleteUser(id);
};

// Обновление роли пользователя
const updateUserRole = async (id, role) => {
    const validRoles = ['customer', 'manager', 'admin'];
    if (!validRoles.includes(role)) throw new AppError('Недопустимая роль', 400);
    const user = await userModel.getUserById(id);
    if (!user) throw new AppError('Пользователь не найден', 404);
    return userModel.updateUser(id, { role });
};

// Деактивация пользователя
const deactivateUser = async (id) => {
    const user = await userModel.getUserById(id);
    if (!user) throw new AppError('Пользователь не найден', 404);
    return userModel.updateUser(id, { is_active: false });
};

// Создание пользователя с указанной ролью
const createUserWithRole = async (data) => {
    const { error, value } = createUserWithRoleSchema.validate(data);
    if (error) throw new AppError(`Ошибка валидации: ${error.details[0].message}`, 400);
    
    const existingUser = await userModel.getUserByEmail(value.email);
    if (existingUser) throw new AppError('Пользователь с таким email уже существует', 400);
    
    const existingByUsername = await userModel.getUserByUsername(value.username);
    if (existingByUsername) throw new AppError('Пользователь с таким именем уже существует', 400);

    const hashedPassword = await bcrypt.hash(value.password, 10);
    
    const newUser = await userModel.createUser({
        ...value,
        password_hash: hashedPassword,
    });
    const accessToken = generateAccessToken(newUser);
    const refreshToken = generateRefreshToken(newUser);
    await userModel.updateRefreshToken(newUser.id, refreshToken);
    const safeUser = await userModel.getUserByIdSafe(newUser.id);

    return {
        user: safeUser, 
        accessToken,
        refreshToken,
    };
};

// Получение профиля
const getProfile = async (userId) => {
  const profile = await userModel.getUserProfile(userId);
  if (!profile) {
      throw new AppError('Профиль не найден', 404);
  }
  return profile;
};

// Обновление профиля
const updateProfile = async (userId, data) => {
  const { error, value } = updateProfileSchema.validate(data);
  if (error) throw new AppError(`Ошибка валидации: ${error.details[0].message}`, 400);
  
  return userModel.updateUser(userId, value);
};

module.exports = {
    getAllUsers,
    getUserByIdAdmin,
    updateUserByIdAdmin,
    deleteUser,
    updateUserRole,
    deactivateUser,
    getProfile,
    createUserWithRole,
    updateProfile,
};