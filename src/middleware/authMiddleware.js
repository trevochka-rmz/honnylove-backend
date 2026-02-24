// src/middleware/authMiddleware.js

const { verifyToken } = require('../utils/jwtUtils');

const authenticate = (req, res, next) => {
  // Определяем, это админка или основной сайт
  const isAdminHost = 
    req.hostname === 'admin.honnylove.ru' || 
    req.headers.host?.includes('admin.honnylove.ru');

  let token;

  if (isAdminHost) {
    token = req.cookies?.admin_accessToken;
    // fallback на Authorization header (если фронт админки шлёт Bearer)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
  } else {
    // обычный сайт — как было раньше
    token = req.cookies?.accessToken;
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Недействительный токен' });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Доступ запрещен: недостаточно прав' });
  }
  next();
};

module.exports = { authenticate, requireRole };