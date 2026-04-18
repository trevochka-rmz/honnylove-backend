// src/controllers/variantController.js
const variantService = require('../services/variantService');
const AppError = require('../utils/errorUtils');
const upload = require('../middleware/uploadMiddleware');

// ─────────────────────────────────────────────────────────────────
// GET /api/products/:productId/variants
// Публичный. Возвращает только активные варианты.
// ─────────────────────────────────────────────────────────────────
const getVariants = async (req, res, next) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        if (isNaN(productId)) throw new AppError('Неверный ID товара', 400);

        const variants = await variantService.getVariantsByProductId(productId);
        res.json(variants);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────
// POST /api/products/:productId/variants
// Admin. Content-Type: multipart/form-data
//
// Поля FormData:
//   name (обязательно)
//   options (JSON строка, например '{"Размер":"XL"}')
//   sku
//   priceOverride, discountOverride, purchaseOverride         ← RUB
//   priceOverrideKg, discountOverrideKg, purchaseOverrideKg  ← KGS
//   stockQuantity   (Россия, loc=1, по умолчанию 0)
//   stockQuantityKg (Кыргызстан, loc=4, по умолчанию 0)
//   sortOrder
//   isActive
// Файлы:
//   variantMainImage (1 шт, опционально — null в БД → view берёт фото товара)
//   variantGallery   (до 5 шт)
// ─────────────────────────────────────────────────────────────────
const createVariant = [
    upload.fields([
        { name: 'variantMainImage', maxCount: 1 },
        { name: 'variantGallery',   maxCount: 5 },
    ]),
    async (req, res, next) => {
        try {
            const productId = parseInt(req.params.productId, 10);
            if (isNaN(productId)) throw new AppError('Неверный ID товара', 400);

            const mainImageFile = req.files?.variantMainImage?.[0] || null;
            const galleryFiles  = req.files?.variantGallery || [];

            const variant = await variantService.createVariant(
                productId, req.body, mainImageFile, galleryFiles
            );
            res.status(201).json(variant);
        } catch (err) {
            next(err);
        }
    },
];

// ─────────────────────────────────────────────────────────────────
// PUT /api/products/:productId/variants/:variantId
// Admin. Content-Type: multipart/form-data
//
// Все поля опциональны — передавай только изменяемые.
// Загрузка variantMainImage → старое фото удаляется из S3
// Загрузка variantGallery   → вся галерея заменяется
// ─────────────────────────────────────────────────────────────────
const updateVariant = [
    upload.fields([
        { name: 'variantMainImage', maxCount: 1 },
        { name: 'variantGallery',   maxCount: 5 },
    ]),
    async (req, res, next) => {
        try {
            const productId = parseInt(req.params.productId, 10);
            const variantId = parseInt(req.params.variantId, 10);
            if (isNaN(productId) || isNaN(variantId)) throw new AppError('Неверный ID', 400);

            const mainImageFile = req.files?.variantMainImage?.[0] || null;
            const galleryFiles  = req.files?.variantGallery || [];

            const variant = await variantService.updateVariant(
                variantId, productId, req.body, mainImageFile, galleryFiles
            );
            res.json(variant);
        } catch (err) {
            next(err);
        }
    },
];

// ─────────────────────────────────────────────────────────────────
// DELETE /api/products/:productId/variants/:variantId
// Admin. Мягкое удаление: is_active=FALSE, инвентарь→0, S3 очищается.
// ─────────────────────────────────────────────────────────────────
const deleteVariant = async (req, res, next) => {
    try {
        const productId = parseInt(req.params.productId, 10);
        const variantId = parseInt(req.params.variantId, 10);
        if (isNaN(productId) || isNaN(variantId)) throw new AppError('Неверный ID', 400);

        await variantService.deleteVariant(variantId, productId);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = { getVariants, createVariant, updateVariant, deleteVariant };