// src/controllers/userController.js
const userService = require('../services/userService');

const getAllUsers = async (req, res, next) => {
    try {
        const users = await userService.getAllUsers(req.query);
        res.json(users);
    } catch (err) {
        next(err);
    }
};

const createAdmin = async (req, res, next) => {
    try {
        const admin = await userService.createAdmin(req.body);
        res.status(201).json(admin);
    } catch (err) {
        next(err);
    }
};

const createManager = async (req, res, next) => {
    try {
        const manager = await userService.createManager(req.body);
        res.status(201).json(manager);
    } catch (err) {
        next(err);
    }
};

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

const deactivateUser = async (req, res, next) => {
    try {
        const user = await userService.deactivateUser(req.params.id);
        res.json(user);
    } catch (err) {
        next(err);
    }
};

// НОВЫЙ ХЭНДЛЕР: Получение профиля
const getProfile = async (req, res, next) => {
    try {
        // req.user приходит из middleware verifyToken (id и role)
        const profile = await userService.getProfile(req.user.id);
        res.json(profile);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getAllUsers,
    createAdmin,
    createManager,
    updateUserRole,
    deactivateUser,
    getProfile, // Новый экспорт
};
