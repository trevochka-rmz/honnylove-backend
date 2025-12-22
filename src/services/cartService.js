// src/services/cartService.js
const Joi = require('joi');
const cartModel = require('../models/cartModel');
const inventoryService = require('./inventoryService');
const productService = require('./productService'); // Для getCart
const AppError = require('../utils/errorUtils'); // Импорт AppError

const cartItemSchema = Joi.object({
    product_id: Joi.number().integer().required(),
    quantity: Joi.number().integer().min(1).required(),
});

const addToCart = async (userId, data) => {
    const { error } = cartItemSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    await inventoryService.checkStock(data.product_id, data.quantity);
    const existingItem = await cartModel.getCartItem(userId, data.product_id);
    if (existingItem) {
        return cartModel.updateCartItem(
            userId,
            data.product_id,
            existingItem.quantity + data.quantity
        );
    }
    return cartModel.addCartItem({ user_id: userId, ...data });
};

const getCart = async (userId) => {
    const items = await cartModel.getCartByUser(userId);
    let total = 0;
    for (const item of items) {
        const product = await productService.getProductById(item.product_id);
        item.product = product;
        item.subtotal =
            (product.discount_price || product.retail_price) * item.quantity;
        total += item.subtotal;
    }
    return { items, total };
};

const updateCartItem = async (userId, itemId, quantity) => {
    const item = await cartModel.getCartItemById(itemId);
    if (!item || item.user_id !== userId)
        throw new AppError('Cart item not found or access denied', 404);
    await inventoryService.checkStock(item.product_id, quantity);
    return cartModel.updateCartItemQuantity(itemId, quantity);
};

const removeFromCart = async (userId, itemId) => {
    const item = await cartModel.getCartItemById(itemId);
    if (!item || item.user_id !== userId)
        throw new AppError('Cart item not found or access denied', 404);
    return cartModel.removeCartItem(itemId);
};

const clearCart = async (userId) => {
    return cartModel.clearCart(userId);
};

module.exports = {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart,
};
