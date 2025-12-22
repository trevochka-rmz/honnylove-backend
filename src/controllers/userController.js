// src/controllers/userController.js
const authService = require('../services/authService');
const userService = require('../services/userService');

const getProfile = async (req, res, next) => {
    try {
        const user = await authService.getUserById(req.user.id);
        res.json(user);
    } catch (err) {
        next(err);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const user = await authService.updateUser(req.user.id, req.body);
        res.json(user);
    } catch (err) {
        next(err);
    }
};

const getAllUsers = async (req, res, next) => {
    try {
        const users = await userService.getAllUsers(req.query);
        res.json(users);
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
        await userService.deactivateUser(req.params.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getProfile,
    updateProfile,
    getAllUsers,
    updateUserRole,
    deactivateUser,
};
