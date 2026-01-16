// controllers/userController.js
const userService = require('../services/userService');

// Получение всех пользователей
const getAllUsers = async (req, res, next) => {
    try {
        const users = await userService.getAllUsers(req.query);
        res.json(users);
    } catch (err) {
        next(err);
    }
};

// Получение пользователя по id для админа
const getUserByIdAdmin = async (req, res, next) => {
    try {
        const user = await userService.getUserByIdAdmin(req.params.id);
        res.json(user);
    } catch (err) {
        next(err);
    }
};

// Обновление пользователя по id для админа
const updateUserByIdAdmin = async (req, res, next) => {
    try {
        const updated = await userService.updateUserByIdAdmin(req.params.id, req.body);
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

// Удаление пользователя по id
const deleteUserById = async (req, res, next) => {
    try {
        await userService.deleteUser(req.params.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// Создание пользователя с указанной ролью
const createUserWithRole = async (req, res, next) => {
    try {
        const result = await userService.createUserWithRole(req.body);
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
};

// Обновление роли пользователя
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

// Деактивация пользователя
const deactivateUser = async (req, res, next) => {
    try {
        const user = await userService.deactivateUser(req.params.id);
        res.json(user);
    } catch (err) {
        next(err);
    }
};

// Получение профиля
const getProfile = async (req, res, next) => {
    try {
        const profile = await userService.getProfile(req.user.id);
        res.json(profile);
    } catch (err) {
        next(err);
    }
};

// Обновление профиля
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