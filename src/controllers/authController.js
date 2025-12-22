// src/controllers/authController.js
const authService = require('../services/authService');

const register = async (req, res, next) => {
    try {
        const result = await authService.registerUser(req.body);
        res.status(201).json(result);
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    try {
        const result = await authService.loginUser(req.body);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

const refresh = async (req, res, next) => {
    try {
        const result = await authService.refreshToken(req.body.refreshToken);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

module.exports = { register, login, refresh };
