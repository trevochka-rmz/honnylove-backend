// src/services/wishlistService.js
const Joi = require('joi');
const wishlistModel = require('../models/wishlistModel');
const productService = require('./productService');
const AppError = require('../utils/errorUtils');

// Схема валидации для добавления в избранное
const addSchema = Joi.object({
  productId: Joi.number().integer().required(),
});

// Добавить товар в избранное
const addToWishlist = async (userId, data) => {
  const productId = data.productId || data.product_id || data;
  const { error } = addSchema.validate({ productId });
  if (error) throw new AppError(error.details[0].message, 400);

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

// Получить избранное пользователя с деталями продуктов
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

// Удалить товар из избранного
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

// Очистить все избранное пользователя
const clearWishlist = async (userId) => {
  await wishlistModel.clearWishlist(userId);
};

module.exports = {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
  clearWishlist,
};