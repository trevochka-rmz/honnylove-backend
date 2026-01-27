// src/controllers/wishlistController.js
const wishlistService = require('../services/wishlistService');

// Добавить товар в избранное
const addToWishlist = async (req, res, next) => {
  try {
    const item = await wishlistService.addToWishlist(req.user.id, req.body);
    const productService = require('../services/productService');
    const product = await productService.getProductByIdentifier(item.product_id);
    res.status(201).json({
      id: item.id,
      user_id: item.user_id,
      product_id: item.product_id,
      created_at: item.created_at,
      product: product,
    });
  } catch (err) {
    next(err);
  }
};

// Получить избранное пользователя
const getWishlist = async (req, res, next) => {
  try {
    const wishlist = await wishlistService.getWishlist(req.user.id);
    res.json(wishlist);
  } catch (err) {
    next(err);
  }
};

// Удалить товар из избранного
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

// Очистить все избранное
const clearWishlist = async (req, res, next) => {
  try {
    await wishlistService.clearWishlist(req.user.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  clearWishlist,
};