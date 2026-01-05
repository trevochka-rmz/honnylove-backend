const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Админ-роуты для пользователей
router.get(
    '/',
    authenticate,
    // requireRole(['admin']),
    userController.getAllUsers
);

router.get(
    '/profile',
    authenticate,
    // requireRole(['admin']),
    userController.getProfile
);

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
