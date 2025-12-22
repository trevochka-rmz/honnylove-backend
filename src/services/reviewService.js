// src/services/reviewService.js
const Joi = require('joi');
const reviewModel = require('../models/reviewModel');
const orderModel = require('../models/orderModel');
const AppError = require('../utils/errorUtils'); // Импорт AppError

const reviewSchema = Joi.object({
    rating: Joi.number().integer().min(1).max(5).required(),
    comment: Joi.string().optional(),
});

const addReview = async (userId, productId, data) => {
    const { error } = reviewSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    // Проверка покупки
    const purchased = await orderModel.hasUserPurchasedProduct(
        userId,
        productId
    );
    if (!purchased)
        throw new AppError('You must purchase the product to review', 403);
    const existing = await reviewModel.getReviewByUserAndProduct(
        userId,
        productId
    );
    if (existing) throw new AppError('Review already exists', 409);
    return reviewModel.addReview({
        product_id: productId,
        user_id: userId,
        ...data,
        is_approved: false,
    });
};

const getReviewsByProduct = async (productId, query) => {
    const { page = 1, limit = 10 } = query;
    return reviewModel.getApprovedReviewsByProduct(productId, { page, limit });
};

const approveReview = async (id) => {
    const review = await reviewModel.getReviewById(id);
    if (!review) throw new AppError('Review not found', 404);
    return reviewModel.approveReview(id);
};

const deleteReview = async (id) => {
    const review = await reviewModel.getReviewById(id);
    if (!review) throw new AppError('Review not found', 404);
    return reviewModel.deleteReview(id);
};

module.exports = {
    addReview,
    getReviewsByProduct,
    approveReview,
    deleteReview,
};
