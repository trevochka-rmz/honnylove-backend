// src/middleware/authMiddleware.js
const { verifyToken } = require('../utils/jwtUtils');

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res
            .status(401)
            .json({ error: 'Токен не предоставлен или неверный формат' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = verifyToken(token);
        req.user = decoded; // Добавляет user в req для контроллеров
        next();
    } catch (err) {
        res.status(403).json({ error: 'Недействительный токен' });
    }
};

const requireRole = (roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        return res
            .status(403)
            .json({ error: 'Доступ запрещен: недостаточно прав' });
    }
    next();
};

module.exports = { authenticate, requireRole };