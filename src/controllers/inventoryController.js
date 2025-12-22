// src/controllers/inventoryController.js
const inventoryService = require('../services/inventoryService');

const getInventory = async (req, res, next) => {
    try {
        const inventory = await inventoryService.getInventoryByProduct(
            req.params.productId
        );
        res.json(inventory);
    } catch (err) {
        next(err);
    }
};

const updateStock = async (req, res, next) => {
    try {
        const updated = await inventoryService.updateStock(
            req.params.productId,
            req.body.locationId,
            req.body.delta
        );
        res.json(updated);
    } catch (err) {
        next(err);
    }
};

module.exports = { getInventory, updateStock };
