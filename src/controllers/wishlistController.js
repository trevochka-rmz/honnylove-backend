// controllers/wishlistController.js
const wishlistService = require('../services/wishlistService');
const { addFullImageUrls } = require('../utils/imageUtils');

// Добавление в избранное
const addToWishlist = async (req, res, next) => {
    try {
        const item = await wishlistService.addToWishlist(req.user.id, req.body);

        // Получаем полные данные продукта для ответа
        const productService = require('../services/productService');
        const product = await productService.getProductById(item.product_id);
        const processedProduct = addFullImageUrls(product, req);

        res.status(201).json({
            id: item.id,
            user_id: item.user_id,
            product_id: item.product_id,
            created_at: item.created_at,
            product: processedProduct,
        });
    } catch (err) {
        next(err);
    }
};

// Получение избранного
const getWishlist = async (req, res, next) => {
    try {
        const wishlist = await wishlistService.getWishlist(req.user.id);

        // Обрабатываем изображения в каждом продукте
        const processedWishlist = wishlist.map((item) => ({
            ...item,
            product: item.product ? addFullImageUrls(item.product, req) : null,
        }));

        res.json(processedWishlist);
    } catch (err) {
        next(err);
    }
};

// Удаление из избранного
const removeFromWishlist = async (req, res, next) => {
    try {
        // Используем req.params.productId вместо req.body
        await wishlistService.removeFromWishlist(
            req.user.id,
            req.params.productId
        );
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// Очистка всего избранного
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
