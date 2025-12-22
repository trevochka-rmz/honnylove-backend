// src/controllers/cartController.js
const cartService = require('../services/cartService');

const addToCart = async (req, res, next) => {
    try {
        const item = await cartService.addToCart(req.user.id, req.body);
        res.status(201).json(item);
    } catch (err) {
        next(err);
    }
};

const getCart = async (req, res, next) => {
    try {
        const cart = await cartService.getCart(req.user.id);
        res.json(cart);
    } catch (err) {
        next(err);
    }
};

const updateCartItem = async (req, res, next) => {
    try {
        const item = await cartService.updateCartItem(
            req.user.id,
            req.params.itemId,
            req.body.quantity
        );
        res.json(item);
    } catch (err) {
        next(err);
    }
};

const removeFromCart = async (req, res, next) => {
    try {
        await cartService.removeFromCart(req.user.id, req.params.itemId);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

const clearCart = async (req, res, next) => {
    try {
        await cartService.clearCart(req.user.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart,
};
