// src/routes/userRoutes.js
const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.get('/profile', authenticate, userController.getProfile);
router.put('/profile', authenticate, userController.updateProfile);

router.get(
    '/',
    authenticate,
    requireRole(['admin']),
    userController.getAllUsers
);
router.put(
    '/:id/role',
    authenticate,
    requireRole(['admin']),
    userController.updateUserRole
); // body: {role}
router.delete(
    '/:id/deactivate',
    authenticate,
    requireRole(['admin']),
    userController.deactivateUser
);

module.exports = router;
