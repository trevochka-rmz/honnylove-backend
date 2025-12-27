// services/inventoryService.js
const Joi = require('joi');
const db = require('../config/db');
const inventoryModel = require('../models/inventoryModel');
const AppError = require('../utils/errorUtils');

// Получение информации о запасах товара
const getInventoryByProduct = async (productId) => {
    return inventoryModel.getInventoryByProduct(productId);
};

// Обновление запасов (delta может быть отрицательным для списания)
const updateStock = async (productId, locationId, delta) => {
    // Находим основной склад, если locationId не указан
    const location = locationId || 1;

    const current = await inventoryModel.getInventory(productId, location);

    // Если записи нет, создаем
    if (!current.id) {
        const newQuantity = Math.max(delta, 0); // Не может быть отрицательным
        return inventoryModel.updateInventory(productId, location, {
            quantity: newQuantity,
            min_stock_level: 0,
        });
    }

    const newQuantity = current.quantity + delta;

    if (newQuantity < 0) {
        throw new AppError(
            `Недостаточно товара на складе. Текущий остаток: ${
                current.quantity
            }, требуется: ${-delta}`,
            400
        );
    }

    return inventoryModel.updateInventory(productId, location, {
        quantity: newQuantity,
    });
};

// Проверка наличия товара
const checkStock = async (productId, requiredQuantity) => {
    const stock = await inventoryModel.getTotalStock(productId);

    if (stock === null || stock === undefined) {
        throw new AppError(`Товар с ID ${productId} не найден на складе`, 404);
    }

    const availableQuantity = Number(stock);

    if (isNaN(availableQuantity)) {
        throw new AppError(
            `Некорректные данные о запасах для товара ID ${productId}`,
            500
        );
    }

    if (availableQuantity < requiredQuantity) {
        throw new AppError(
            `Недостаточно товара на складе. Доступно: ${availableQuantity}, требуется: ${requiredQuantity}`,
            400
        );
    }

    return availableQuantity;
};

// Получение общего количества товара на всех складах
const getTotalStock = async (productId) => {
    const stock = await inventoryModel.getTotalStock(productId);
    return stock !== null ? stock : 0;
};

module.exports = {
    getInventoryByProduct,
    updateStock,
    checkStock,
    getTotalStock,
};
