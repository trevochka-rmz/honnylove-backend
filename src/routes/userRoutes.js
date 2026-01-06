const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Админ-роуты для пользователей
router.get(
    '/',
    authenticate,
    requireRole(['admin']),
    userController.getAllUsers
);

// Профиль: Доступен для всех аутентифицированных (customer, admin, manager)
router.get('/profile', authenticate, userController.getProfile);

// НОВЫЙ: Обновление профиля (для всех аутентифицированных)
router.put('/profile', authenticate, userController.updateProfile);

router.post(
    '/admin/create-admin',
    authenticate,
    requireRole(['admin']),
    userController.createAdmin
);

router.post(
    '/admin/create-manager',
    authenticate,
    requireRole(['admin']),
    userController.createManager
);

router.put(
    '/:id/role',
    authenticate,
    requireRole(['admin']),
    userController.updateUserRole
);

router.put(
    '/:id/deactivate',
    authenticate,
    requireRole(['admin']),
    userController.deactivateUser
);

module.exports = router;
