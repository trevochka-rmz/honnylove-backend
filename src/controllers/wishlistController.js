// src/controllers/wishlistController.js
const wishlistService = require('../services/wishlistService');

const addToWishlist = async (req, res, next) => {
    try {
        const item = await wishlistService.addToWishlist(
            req.user.id,
            req.body.productId
        );
        res.status(201).json(item);
    } catch (err) {
        next(err);
    }
};

const getWishlist = async (req, res, next) => {
    try {
        const wishlist = await wishlistService.getWishlist(req.user.id);
        res.json(wishlist);
    } catch (err) {
        next(err);
    }
};

const removeFromWishlist = async (req, res, next) => {
    try {
        await wishlistService.removeFromWishlist(
            req.user.id,
            req.params.productId
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = { addToWishlist, getWishlist, removeFromWishlist };
