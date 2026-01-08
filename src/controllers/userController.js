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

const getProfile = async (req, res, next) => {
    try {
        // req.user.id из auth middleware (verifyToken)
        const profile = await userService.getProfile(req.user.id); // ← ВЫЗОВ СЕРВИСА
        res.json(profile);
    } catch (err) {
        next(err); // ← передаем в error handler
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const updated = await userService.updateProfile(req.user.id, req.body);
        res.json(updated);
    } catch (err) {
        next(err); // ← передаем в error handler
    }
};

module.exports = {
    getAllUsers,
    createAdmin,
    createManager,
    updateUserRole,
    deactivateUser,
    getProfile,
    updateProfile, // Новый экспорт
};
