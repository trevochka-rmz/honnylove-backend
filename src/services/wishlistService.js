// services/wishlistService.js
const wishlistModel = require('../models/wishlistModel');
const productService = require('./productService');
const AppError = require('../utils/errorUtils');

// Добавление в избранное
const addToWishlist = async (userId, data) => {
    // Поддерживаем разные форматы данных
    const productId = data.productId || data.product_id || data;

    if (!productId) {
        throw new AppError('Не указан ID товара', 400);
    }

    // Проверяем существование товара
    const product = await productService.getProductByIdentifier(productId);
    if (!product) {
        throw new AppError('Товар не найден', 404);
    }

    const existing = await wishlistModel.getWishlistItem(userId, productId);
    if (existing) {
        throw new AppError('Товар уже в избранном', 409);
    }

    return wishlistModel.addWishlistItem({
        user_id: userId,
        product_id: productId,
    });
};

// Получение избранного с продуктами
const getWishlist = async (userId) => {
    const items = await wishlistModel.getWishlistByUser(userId);

    for (const item of items) {
        const product = await productService.getProductByIdentifier(item.product_id);
        if (product) {
            item.product = product;
        }
    }

    return items;
};

// Удаление из избранного - ИСПРАВЛЯЕМ!
const removeFromWishlist = async (userId, productId) => {
    if (!productId) {
        throw new AppError('Не указан ID товара', 400);
    }

    const existing = await wishlistModel.getWishlistItem(userId, productId);
    if (!existing) {
        throw new AppError('Товар не найден в избранном', 404);
    }

    await wishlistModel.removeWishlistItem(userId, productId);
};

// НОВАЯ ФУНКЦИЯ: Очистка всего избранного
const clearWishlist = async (userId) => {
    await wishlistModel.clearWishlist(userId);
};

module.exports = {
    addToWishlist,
    getWishlist,
    removeFromWishlist,
    clearWishlist,
};
