// src/utils/jwtUtils.js
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// Access Token (15 минут)
const generateAccessToken = (user) => {
    return jwt.sign(
        { 
            id: user.id, 
            role: user.role,
            email: user.email 
        }, 
        process.env.JWT_ACCESS_SECRET, 
        { expiresIn: '15m' }
    );
};

// Session Token (заменяет refresh token, 7 дней)
const generateSessionToken = (sessionData) => {
    return jwt.sign(
        { 
            userId: sessionData.userId,
            sessionId: sessionData.sessionId 
        }, 
        process.env.JWT_SESSION_SECRET, 
        { expiresIn: '7d' }
    );
};

// Верификация токенов
const verifyToken = (token, secret = process.env.JWT_ACCESS_SECRET) => {
    try {
        return jwt.verify(token, secret);
    } catch (err) {
        throw new Error('Неверный или срок действия токена закончился');
    }
};

// Верификация session token
const verifySessionToken = (token) => {
    return verifyToken(token, process.env.JWT_SESSION_SECRET);
};

module.exports = { 
    generateAccessToken, 
    generateSessionToken,
    verifyToken,
    verifySessionToken
};