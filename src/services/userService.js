// src/services/userService.js
const userModel = require('../models/userModel');
const AppError = require('../utils/errorUtils'); // Импорт AppError

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

module.exports = { getAllUsers, updateUserRole, deactivateUser };
