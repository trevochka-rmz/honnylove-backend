// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Получение всех пользователей (админ)
router.get(
    '/',
    authenticate,
    requireRole(['admin']),
    userController.getAllUsers
);

// Получение пользователя по id (админ)
router.get(
    '/:id',
    authenticate,
    requireRole(['admin']),
    userController.getUserByIdAdmin
);

// Получение профиля (аутентифицированные)
router.get('/profile', authenticate, userController.getProfile);

// Обновление профиля (аутентифицированные)
router.put('/profile', authenticate, userController.updateProfile);

// Создание админа (админ)
router.post(
    '/admin/create-admin',
    authenticate,
    requireRole(['admin']),
    userController.createAdmin
);

// Создание менеджера (админ)
router.post(
    '/admin/create-manager',
    authenticate,
    requireRole(['admin']),
    userController.createManager
);

// Обновление роли (админ)
router.put(
    '/:id/role',
    authenticate,
    requireRole(['admin']),
    userController.updateUserRole
);

// Деактивация (админ)
router.put(
    '/:id/deactivate',
    authenticate,
    requireRole(['admin']),
    userController.deactivateUser
);

module.exports = router;