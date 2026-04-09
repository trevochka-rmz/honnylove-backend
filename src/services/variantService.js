// src/services/variantService.js
const Joi = require('joi');
const variantModel = require('../models/variantModel');
const AppError = require('../utils/errorUtils');
const { validateImageFile } = require('../utils/imageUtils');

// ─────────────────────────────────────────────────────────────────
// Схема валидации — СОЗДАНИЕ
// ─────────────────────────────────────────────────────────────────
const createVariantSchema = Joi.object({
    name: Joi.string().trim().min(1).max(255).required()
        .messages({
            'string.empty': 'Поле name обязательно',
            'any.required': 'Поле name обязательно',
        }),

    // Произвольный объект опций: {"Размер":"XL","Цвет":"Синий"}
    options: Joi.object().default({}),

    sku: Joi.string().max(100).allow(null, '').optional(),

    // Цены Россия (RUB). null = наследуется у товара через COALESCE в view
    priceOverride:    Joi.number().positive().allow(null).optional(),
    discountOverride: Joi.number().min(0).allow(null).optional(),
    purchaseOverride: Joi.number().positive().allow(null).optional(),

    // Цены Кыргызстан (KGS)
    priceOverrideKg:    Joi.number().positive().allow(null).optional(),
    discountOverrideKg: Joi.number().min(0).allow(null).optional(),
    purchaseOverrideKg: Joi.number().positive().allow(null).optional(),

    // Количество на складе
    stockQuantity:   Joi.number().integer().min(0).default(0),  // Россия (loc=1)
    stockQuantityKg: Joi.number().integer().min(0).default(0),  // Кыргызстан (loc=4)

    sortOrder: Joi.number().integer().min(0).default(0),
});

// ─────────────────────────────────────────────────────────────────
// Схема валидации — ОБНОВЛЕНИЕ (все поля опциональны)
// ─────────────────────────────────────────────────────────────────
const updateVariantSchema = Joi.object({
    name:               Joi.string().trim().min(1).max(255).optional(),
    options:            Joi.object().optional(),
    sku:                Joi.string().max(100).allow(null, '').optional(),
    priceOverride:      Joi.number().positive().allow(null).optional(),
    discountOverride:   Joi.number().min(0).allow(null).optional(),
    purchaseOverride:   Joi.number().positive().allow(null).optional(),
    priceOverrideKg:    Joi.number().positive().allow(null).optional(),
    discountOverrideKg: Joi.number().min(0).allow(null).optional(),
    purchaseOverrideKg: Joi.number().positive().allow(null).optional(),
    stockQuantity:      Joi.number().integer().min(0).optional(),
    stockQuantityKg:    Joi.number().integer().min(0).optional(),
    isActive:           Joi.boolean().optional(),
    sortOrder:          Joi.number().integer().min(0).optional(),
});

// ─────────────────────────────────────────────────────────────────
// Парсинг FormData (всё приходит строками из multipart/form-data)
// ─────────────────────────────────────────────────────────────────
const parseVariantBody = (body) => {
    const parsed = { ...body };

    // Числовые поля: пустая строка / '0' / 'null' → null (для цен) или 0 (для количества)
    const nullableNumFields = [
        'priceOverride', 'discountOverride', 'purchaseOverride',
        'priceOverrideKg', 'discountOverrideKg', 'purchaseOverrideKg',
    ];
    for (const field of nullableNumFields) {
        if (parsed[field] !== undefined) {
            parsed[field] = (parsed[field] === '' || parsed[field] === '0' || parsed[field] === 'null')
                ? null
                : Number(parsed[field]);
        }
    }

    const intFields = ['stockQuantity', 'stockQuantityKg', 'sortOrder'];
    for (const field of intFields) {
        if (parsed[field] !== undefined) {
            parsed[field] = Number(parsed[field]) || 0;
        }
    }

    // isActive: строка → boolean
    if (parsed.isActive !== undefined) {
        if (parsed.isActive === 'true' || parsed.isActive === true)        parsed.isActive = true;
        else if (parsed.isActive === 'false' || parsed.isActive === false) parsed.isActive = false;
    }

    // options: JSON строка → объект
    if (parsed.options && typeof parsed.options === 'string') {
        try {
            parsed.options = JSON.parse(parsed.options);
        } catch {
            throw new AppError('Неверный формат options (ожидается JSON объект)', 400);
        }
    }

    // sku: пустая строка → null
    if (parsed.sku === '') parsed.sku = null;

    return parsed;
};

// ─────────────────────────────────────────────────────────────────
// Получить все активные варианты товара
// ─────────────────────────────────────────────────────────────────
const getVariantsByProductId = async (productId) => {
    return variantModel.getVariantsByProductId(productId);
};

// ─────────────────────────────────────────────────────────────────
// Создать вариант
// ─────────────────────────────────────────────────────────────────
const createVariant = async (productId, body, mainImageFile, galleryFiles) => {
    const parsed = parseVariantBody(body);

    const { error, value } = createVariantSchema.validate(parsed, { abortEarly: true });
    if (error) throw new AppError(error.details[0].message, 400);

    // Скидка < основная цена
    if (value.priceOverride && value.discountOverride) {
        if (value.discountOverride >= value.priceOverride) {
            throw new AppError('Цена со скидкой (RUB) должна быть меньше основной цены', 400);
        }
    }
    if (value.priceOverrideKg && value.discountOverrideKg) {
        if (value.discountOverrideKg >= value.priceOverrideKg) {
            throw new AppError('Цена со скидкой (KGS) должна быть меньше основной цены', 400);
        }
    }

    if (mainImageFile) validateImageFile(mainImageFile);
    if (galleryFiles?.length) galleryFiles.forEach(f => validateImageFile(f));

    return variantModel.createVariant(productId, value, mainImageFile, galleryFiles);
};

// ─────────────────────────────────────────────────────────────────
// Обновить вариант
// ─────────────────────────────────────────────────────────────────
const updateVariant = async (variantId, productId, body, mainImageFile, galleryFiles) => {
    const parsed = parseVariantBody(body);

    const { error, value } = updateVariantSchema.validate(parsed, { abortEarly: true });
    if (error) throw new AppError(error.details[0].message, 400);

    const existing = await variantModel.getVariantById(variantId, productId);
    if (!existing) throw new AppError('Вариант не найден', 404);

    if (mainImageFile) validateImageFile(mainImageFile);
    if (galleryFiles?.length) galleryFiles.forEach(f => validateImageFile(f));

    const updated = await variantModel.updateVariant(variantId, productId, value, mainImageFile, galleryFiles);
    if (!updated) throw new AppError('Вариант не найден', 404);
    return updated;
};

// ─────────────────────────────────────────────────────────────────
// Мягкое удаление
// ─────────────────────────────────────────────────────────────────
const deleteVariant = async (variantId, productId) => {
    const existing = await variantModel.getVariantById(variantId, productId);
    if (!existing) throw new AppError('Вариант не найден', 404);
    return variantModel.deleteVariant(variantId, productId);
};

module.exports = {
    getVariantsByProductId,
    createVariant,
    updateVariant,
    deleteVariant,
};