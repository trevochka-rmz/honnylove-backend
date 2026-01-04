const bcrypt = require('bcrypt');
const Joi = require('joi');
const userModel = require('../models/userModel');
const {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
} = require('../utils/jwtUtils');
const AppError = require('../utils/errorUtils');

const userSchema = Joi.object({
    username: Joi.string().min(3).max(255).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    role: Joi.string()
        .valid('customer', 'manager', 'admin')
        .default('customer'),
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

const registerUser = async (data) => {
    const { error } = userSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    const existingUser = await userModel.getUserByEmail(data.email);
    if (existingUser) throw new AppError('User already exists', 400);
    const hashedPassword = await bcrypt.hash(data.password, 10);
    const newUser = await userModel.createUser({
        ...data,
        password_hash: hashedPassword,
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

const adminLogin = async (credentials) => {
    const result = await loginUser(credentials); // Сначала обычный login
    const user = result.user;
    if (!['admin', 'manager'].includes(user.role)) {
        throw new AppError(
            'Access denied: Admin or manager role required',
            401
        );
    }
    return result; // Возвращаем то же, если role ок
};

const loginUser = async (credentials) => {
    const { error } = loginSchema.validate(credentials);
    if (error) throw new AppError(error.details[0].message, 400);
    const user = await userModel.getUserByEmail(credentials.email);
    if (!user) throw new AppError('Invalid credentials', 401);
    const isMatch = await bcrypt.compare(
        credentials.password,
        user.password_hash
    );
    if (!isMatch) throw new AppError('Invalid credentials', 401);
    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    await userModel.updateRefreshToken(user.id, refreshToken);
    return {
        user: { ...user, password_hash: undefined },
        accessToken,
        refreshToken,
    };
};

const refreshToken = async (token) => {
    try {
        const decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET);
        const user = await userModel.getUserById(decoded.id);
        if (!user || user.refresh_token !== token) {
            throw new AppError('Invalid refresh token', 401);
        }
        const newAccessToken = generateAccessToken(user);
        return { accessToken: newAccessToken };
    } catch (err) {
        if (err.message === 'Invalid or expired token') {
            throw new AppError('Refresh token expired or invalid', 401);
        }
        throw err;
    }
};

const getUserById = async (id) => {
    const user = await userModel.getUserById(id);
    if (!user) throw new AppError('User not found', 404);
    return { ...user, password_hash: undefined };
};

const updateUser = async (id, data) => {
    const updateSchema = Joi.object({
        first_name: Joi.string().optional(),
        last_name: Joi.string().optional(),
        phone: Joi.string().optional(),
        address: Joi.string().optional(),
    });
    const { error } = updateSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    return userModel.updateUser(id, data);
};

module.exports = {
    registerUser,
    loginUser,
    refreshToken,
    getUserById,
    updateUser,
    adminLogin,
};
