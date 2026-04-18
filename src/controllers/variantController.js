// src/controllers/variantController.js
const variantModel = require('../models/variantModel');
const AppError = require('../utils/errorUtils');
const upload = require('../middleware/uploadMiddleware');

// Получить все варианты товара
const getVariants = async (req, res, next) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        if (isNaN(productId)) throw new AppError('Неверный ID товара', 400);
        const variants = await variantModel.getVariantsByProductId(productId);
        res.json(variants);
    } catch (err) {
        next(err);
    }
};

// Создать новый вариант с загрузкой изображений
const createVariant = [
    upload.fields([
        { name: 'variantMainImage', maxCount: 1 },
        { name: 'variantGallery', maxCount: 5 },
    ]),
    async (req, res, next) => {
        try {
            const productId = parseInt(req.params.productId, 10);
            if (isNaN(productId)) throw new AppError('Неверный ID товара', 400);

            const { name, options, priceOverride, discountOverride,
                    priceOverrideKg, discountOverrideKg,
                    stockQuantity, isAvailable, sortOrder } = req.body;

            if (!name || !name.trim()) throw new AppError('Поле name обязательно', 400);

            const data = {
                name: name.trim(),
                options: options ? (typeof options === 'string' ? JSON.parse(options) : options) : {},
                priceOverride: priceOverride ? Number(priceOverride) : null,
                discountOverride: discountOverride ? Number(discountOverride) : null,
                priceOverrideKg: priceOverrideKg ? Number(priceOverrideKg) : null,
                discountOverrideKg: discountOverrideKg ? Number(discountOverrideKg) : null,
                stockQuantity: stockQuantity ? Number(stockQuantity) : 0,
                isAvailable: isAvailable === 'false' ? false : true,
                sortOrder: sortOrder ? Number(sortOrder) : 0,
            };

            const mainImageFile = req.files?.variantMainImage?.[0] || null;
            const galleryFiles = req.files?.variantGallery || [];

            const variant = await variantModel.createVariant(productId, data, mainImageFile, galleryFiles);
            res.status(201).json(variant);
        } catch (err) {
            if (err.message && err.message.includes('JSON')) {
                return next(new AppError('Неверный формат options (ожидается JSON)', 400));
            }
            next(err);
        }
    },
];

// Обновить вариант с возможной заменой изображений
const updateVariant = [
    upload.fields([
        { name: 'variantMainImage', maxCount: 1 },
        { name: 'variantGallery', maxCount: 5 },
    ]),
    async (req, res, next) => {
        try {
            const productId = parseInt(req.params.productId, 10);
            const variantId = parseInt(req.params.variantId, 10);
            if (isNaN(productId) || isNaN(variantId)) throw new AppError('Неверный ID', 400);

            const data = {};
            const { name, options, priceOverride, discountOverride,
                    priceOverrideKg, discountOverrideKg,
                    stockQuantity, isActive, isAvailable, sortOrder } = req.body;

            if (name !== undefined) data.name = name.trim();
            if (options !== undefined) {
                data.options = typeof options === 'string' ? JSON.parse(options) : options;
            }
            if (priceOverride !== undefined) {
                data.priceOverride = (priceOverride === '' || priceOverride === '0') ? null : Number(priceOverride);
            }
            if (discountOverride !== undefined) {
                data.discountOverride = (discountOverride === '' || discountOverride === '0') ? null : Number(discountOverride);
            }
            if (priceOverrideKg !== undefined) {
                data.priceOverrideKg = (priceOverrideKg === '' || priceOverrideKg === '0') ? null : Number(priceOverrideKg);
            }
            if (discountOverrideKg !== undefined) {
                data.discountOverrideKg = (discountOverrideKg === '' || discountOverrideKg === '0') ? null : Number(discountOverrideKg);
            }
            if (stockQuantity !== undefined) data.stockQuantity = Number(stockQuantity);
            if (isActive !== undefined) data.isActive = isActive === 'true' || isActive === true;
            if (isAvailable !== undefined) data.isAvailable = isAvailable === 'true' || isAvailable === true;
            if (sortOrder !== undefined) data.sortOrder = Number(sortOrder);

            const mainImageFile = req.files?.variantMainImage?.[0] || null;
            const galleryFiles = req.files?.variantGallery || [];

            const variant = await variantModel.updateVariant(variantId, productId, data, mainImageFile, galleryFiles);
            if (!variant) throw new AppError('Вариант не найден', 404);
            res.json(variant);
        } catch (err) {
            if (err.message && err.message.includes('JSON')) {
                return next(new AppError('Неверный формат options (ожидается JSON)', 400));
            }
            next(err);
        }
    },
];

// Мягкое удаление варианта
const deleteVariant = async (req, res, next) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        const variantId = parseInt(req.params.variantId, 10);
        if (isNaN(productId) || isNaN(variantId)) throw new AppError('Неверный ID', 400);

        const result = await variantModel.deleteVariant(variantId, productId);
        if (!result) throw new AppError('Вариант не найден', 404);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getVariants,
    createVariant,
    updateVariant,
    deleteVariant,
};