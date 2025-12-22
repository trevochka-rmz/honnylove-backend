// src/routes/brandRoutes.js
const express = require('express');
const router = express.Router();
const brandController = require('../controllers/brandController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.get('/', brandController.getBrands);
router.get('/:id', brandController.getBrandById);

router.post(
    '/',
    authenticate,
    requireRole(['admin']),
    brandController.createBrand
);
router.put(
    '/:id',
    authenticate,
    requireRole(['admin']),
    brandController.updateBrand
);
router.delete(
    '/:id',
    authenticate,
    requireRole(['admin']),
    brandController.deleteBrand
);

module.exports = router;
