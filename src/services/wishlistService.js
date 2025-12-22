// src/services/wishlistService.js
const wishlistModel = require('../models/wishlistModel');
const productService = require('./productService'); // Для getWishlist
const AppError = require('../utils/errorUtils'); // Импорт AppError

const addToWishlist = async (userId, productId) => {
    const existing = await wishlistModel.getWishlistItem(userId, productId);
    if (existing) throw new AppError('Item already in wishlist', 409);
    return wishlistModel.addWishlistItem({
        user_id: userId,
        product_id: productId,
    });
};

const getWishlist = async (userId) => {
    const items = await wishlistModel.getWishlistByUser(userId);
    for (const item of items) {
        item.product = await productService.getProductById(item.product_id);
    }
    return items;
};

const removeFromWishlist = async (userId, productId) => {
    const existing = await wishlistModel.getWishlistItem(userId, productId);
    if (!existing) throw new AppError('Item not found in wishlist', 404);
    return wishlistModel.removeWishlistItem(userId, productId);
};

module.exports = { addToWishlist, getWishlist, removeFromWishlist };
