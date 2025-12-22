// src/controllers/reviewController.js
const reviewService = require('../services/reviewService');

const addReview = async (req, res, next) => {
    try {
        const review = await reviewService.addReview(
            req.user.id,
            req.params.productId,
            req.body
        );
        res.status(201).json(review);
    } catch (err) {
        next(err);
    }
};

const getReviews = async (req, res, next) => {
    try {
        const reviews = await reviewService.getReviewsByProduct(
            req.params.productId,
            req.query
        );
        res.json(reviews);
    } catch (err) {
        next(err);
    }
};

const approveReview = async (req, res, next) => {
    try {
        const review = await reviewService.approveReview(req.params.id);
        res.json(review);
    } catch (err) {
        next(err);
    }
};

const deleteReview = async (req, res, next) => {
    try {
        await reviewService.deleteReview(req.params.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = { addReview, getReviews, approveReview, deleteReview };
