// src/utils/jwtUtils.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

const generateAccessToken = (user) => {
    return jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '15m',
    });
};

const generateRefreshToken = (user) => {
    return jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: '7d',
    });
};

const verifyToken = (token, secret = process.env.JWT_SECRET) => {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        throw new Error('Invalid or expired token');
    }
};

module.exports = { generateAccessToken, generateRefreshToken, verifyToken };
