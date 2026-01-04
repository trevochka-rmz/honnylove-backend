const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Публичный: Получить настройки
router.get('/', settingsController.getSettings);

// Админ: Обновить настройки
router.put(
    '/',
    authenticate,
    requireRole(['admin']),
    settingsController.updateSettings
);

module.exports = router;
