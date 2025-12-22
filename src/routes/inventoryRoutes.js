// src/routes/inventoryRoutes.js
const express = require('express');
const router = express.Router();
const inventoryController = require('../controllers/inventoryController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole(['manager', 'admin']));

router.get('/:productId', inventoryController.getInventory);
router.put('/:productId', inventoryController.updateStock); // body: {locationId, delta}

module.exports = router;
