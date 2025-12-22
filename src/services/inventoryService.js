// src/services/inventoryService.js
const Joi = require('joi');
const inventoryModel = require('../models/inventoryModel');
const AppError = require('../utils/errorUtils'); // Импорт AppError

const stockSchema = Joi.object({
    quantity: Joi.number().integer().required(),
    min_stock_level: Joi.number().integer().optional(),
});

const getInventoryByProduct = async (productId) => {
    return inventoryModel.getInventoryByProduct(productId);
};

const updateStock = async (productId, locationId, delta) => {
    const current = await inventoryModel.getInventory(productId, locationId);
    const newQuantity = current.quantity + delta;
    if (newQuantity < 0) throw new AppError('Insufficient stock', 400);
    return inventoryModel.updateInventory(productId, locationId, {
        quantity: newQuantity,
    });
};

const checkStock = async (productId, requiredQuantity) => {
    const stock = await inventoryModel.getTotalStock(productId);
    if (stock < requiredQuantity) throw new AppError('Out of stock', 400);
};

module.exports = { getInventoryByProduct, updateStock, checkStock };
