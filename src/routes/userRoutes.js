// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');


// Получение профиля (аутентифицированные)
router.get('/profile', authenticate, userController.getProfile);
// Обновление профиля (аутентифицированные)
router.put('/profile', authenticate, userController.updateProfile);


// Админские маршруты
// Создание пользователя с указанием роли (админ)
router.post(
    '/admin/create-user',
    authenticate,
    requireRole(['admin']),
    userController.createUserWithRole // один маршрут вместо двух
);


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

// Обновление пользователя по id (админ)
router.put(
    '/:id',
    authenticate,
    requireRole(['admin']),
    userController.updateUserByIdAdmin
);

// Удаление пользователя по id (админ)
router.delete(
    '/:id',
    authenticate,
    requireRole(['admin']),
    userController.deleteUserById
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