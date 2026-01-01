const express = require('express');
const router = express.Router();
const bannersController = require('../controllers/bannersController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Публичные роуты
router.get('/', bannersController.getAllBanners); // Для фронта: все активные баннеры

// Админ роуты
router.get(
    '/admin',
    authenticate,
    requireRole(['admin']),
    bannersController.getAllBannersAdmin
); // Все с пагинацией
router.get(
    '/:id',
    authenticate,
    requireRole(['admin']),
    bannersController.getBannerById
);
router.post(
    '/',
    authenticate,
    requireRole(['admin']),
    bannersController.createBanner
);
router.put(
    '/:id',
    authenticate,
    requireRole(['admin']),
    bannersController.updateBanner
);
router.delete(
    '/:id',
    authenticate,
    requireRole(['admin']),
    bannersController.deleteBanner
);

module.exports = router;
