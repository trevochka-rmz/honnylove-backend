// src/middleware/authMiddleware.js
const { verifyToken } = require('../utils/jwtUtils');

const authenticate = (req, res, next) => {
  // Определяем, это админка или основной сайт
  const isAdminHost = 
    req.hostname === 'admin.honnylove.ru' || 
    req.headers.host?.includes('admin.honnylove.ru');

  let token;
  
  if (isAdminHost) {
    // Для админки читаем admin_accessToken
    token = req.cookies?.admin_accessToken;
    
    // Fallback на Authorization header (если фронт шлёт Bearer)
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
  } else {
    // Для обычного сайта читаем accessToken
    token = req.cookies?.accessToken;
    
    // Fallback на Authorization header
    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }
  }

  // Логирование для отладки (потом можно убрать)
  console.log('🔐 Auth Middleware:', {
    host: req.headers.host,
    isAdminHost,
    hasCookie: !!token,
    cookieName: isAdminHost ? 'admin_accessToken' : 'accessToken'
  });

  if (!token) {
    return res.status(401).json({ error: 'Токен не предоставлен' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (err) {
    console.error('🔐 Token verification failed:', err.message);
    res.status(403).json({ error: 'Недействительный токен' });
  }
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Доступ запрещен: недостаточно прав',
      requiredRoles: roles,
      userRole: req.user?.role
    });
  }
  next();
};

module.exports = { authenticate, requireRole };