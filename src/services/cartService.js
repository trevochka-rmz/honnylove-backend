// src/services/cartService.js
const Joi = require('joi');
const cartModel = require('../models/cartModel');
const productService = require('./productService');
const inventoryService = require('./inventoryService');
const variantModel = require('../models/variantModel');
const AppError = require('../utils/errorUtils');

// ─────────────────────────────────────────────────────────────────
// Схема валидации
// ─────────────────────────────────────────────────────────────────
const cartItemSchema = Joi.object({
    product_id: Joi.number().integer().positive().required(),
    quantity:   Joi.number().integer().min(1).max(50).required(),
    variant_id: Joi.number().integer().positive().allow(null).optional(),
});

// ─────────────────────────────────────────────────────────────────
// Добавить товар в корзину
//
// Логика выбора варианта:
//  1. Если variant_id передан — проверяем что он существует и активен
//  2. Если variant_id НЕ передан:
//     a. У товара ровно 1 активный вариант → берём его автоматически
//     b. У товара >1 активных вариантов    → ошибка "выберите вариант"
//     c. У товара 0 вариантов              → добавляем без варианта (legacy)
// ─────────────────────────────────────────────────────────────────
const addToCart = async (userId, data) => {
    const { error } = cartItemSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);

    let { product_id, quantity, variant_id = null } = data;

    // Проверяем существование и активность товара
    const product = await productService.getProductByIdentifier(product_id);
    if (!product.isActive) {
        throw new AppError('Товар временно недоступен', 400);
    }

    // ── Логика выбора варианта ────────────────────────────────────
    if (variant_id !== null) {
        // Явно передан вариант — проверяем его
        const variant = await _getActiveVariant(product_id, variant_id);
        if (!variant) throw new AppError('Вариант товара не найден', 404);
    } else {
        // Вариант не передан — смотрим сколько их у товара
        const variantCount = await variantModel.countActiveVariants(product_id);

        if (variantCount === 1) {
            // Один вариант — берём автоматически, клиент не обязан передавать
            const single = await variantModel.getSingleVariant(product_id);
            variant_id = single.id;
        } else if (variantCount > 1) {
            // Несколько вариантов — клиент обязан выбрать
            throw new AppError(
                'Пожалуйста, выберите вариант товара (размер, объём и т.д.)',
                400
            );
        }
        // variantCount === 0 → вариант не нужен, variant_id остаётся null (legacy)
    }

    // Проверяем наличие на складе (для выбранного варианта)
    if (variant_id !== null) {
        const stockRu = await _getVariantStock(variant_id, 1);
        if (stockRu === 0) {
            throw new AppError('Товар закончился на складе', 400);
        }
    }

    // Уже в корзине? → увеличиваем количество
    const existingItem = await cartModel.getCartItem(userId, product_id, variant_id);
    if (existingItem) {
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > 50) throw new AppError('Максимальное количество — 50 шт', 400);
        return cartModel.updateCartItem(userId, product_id, quantity, variant_id);
    }

    return cartModel.addCartItem({ user_id: userId, product_id, variant_id, quantity });
};

// ─────────────────────────────────────────────────────────────────
// Получить корзину пользователя с полными данными
// ─────────────────────────────────────────────────────────────────
const getCart = async (userId) => {
    const items = await cartModel.getCartByUser(userId);
    let total      = 0;
    let itemsTotal = 0;

    for (const item of items) {
        const product = await productService.getProductByIdentifier(item.product_id).catch(() => null);
        if (!product) continue;

        item.product = product;
        item.variant = null;

        // Обогащаем данными варианта
        if (item.variant_id) {
            const variants = await variantModel.getVariantsByProductId(item.product_id);
            item.variant = variants.find(v => v.id === item.variant_id) || null;
        }

        // Остаток на складе
        let availableStock = 0;
        try {
            if (item.variant_id && item.variant) {
                availableStock = item.variant.stockQuantityRu ?? item.variant.stockQuantity ?? 0;
            } else {
                availableStock = await inventoryService.getTotalStock(item.product_id);
            }
        } catch { availableStock = 0; }

        item.inStock           = availableStock > 0;
        item.availableQuantity = availableStock;
        item.isLowStock        = availableStock > 0 && availableStock < 5;
        item.outOfStock        = availableStock === 0;

        // Цена: вариант с переопределением → иначе цена товара
        const price = _resolvePrice(product, item.variant);
        item.unitPrice = price;
        item.subtotal  = price * item.quantity;
        total      += item.subtotal;
        itemsTotal += item.quantity;
    }

    return {
        items,
        summary: {
            itemsTotal,
            subtotal: round2(total),
            shipping: 0,
            total: round2(total),
        },
        hasItems: items.length > 0,
    };
};

// ─────────────────────────────────────────────────────────────────
// Обновить количество конкретной позиции корзины
// ─────────────────────────────────────────────────────────────────
const updateCartItem = async (userId, itemId, quantity) => {
    if (quantity < 1)  throw new AppError('Количество должно быть не менее 1', 400);
    if (quantity > 50) throw new AppError('Максимальное количество — 50 шт', 400);

    const item = await cartModel.getCartItemById(itemId);
    if (!item || item.user_id !== userId) {
        throw new AppError('Элемент корзины не найден', 404);
    }

    return cartModel.updateCartItemQuantity(itemId, quantity);
};

// ─────────────────────────────────────────────────────────────────
// Удалить позицию из корзины
// ─────────────────────────────────────────────────────────────────
const removeFromCart = async (userId, itemId) => {
    const item = await cartModel.getCartItemById(itemId);
    if (!item || item.user_id !== userId) {
        throw new AppError('Элемент корзины не найден', 404);
    }
    await cartModel.removeCartItem(itemId);
};

// ─────────────────────────────────────────────────────────────────
// Очистить корзину
// ─────────────────────────────────────────────────────────────────
const clearCart = async (userId) => {
    await cartModel.clearCart(userId);
};

// ─────────────────────────────────────────────────────────────────
// Получить выбранные позиции для предпросмотра заказа
// ─────────────────────────────────────────────────────────────────
const getSelectedCartItems = async (userId, selectedItemIds) => {
    if (!Array.isArray(selectedItemIds) || selectedItemIds.length === 0) {
        throw new AppError('Укажите ID товаров для оформления', 400);
    }

    const itemIds = selectedItemIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    if (itemIds.length === 0) throw new AppError('Некорректные ID товаров', 400);

    const allItems      = await cartModel.getCartByUser(userId);
    const selectedItems = allItems.filter(item => itemIds.includes(item.id));

    if (selectedItems.length === 0) {
        throw new AppError('Выбранные товары не найдены в корзине', 404);
    }

    let total      = 0;
    let itemsTotal = 0;

    for (const item of selectedItems) {
        const product = await productService.getProductByIdentifier(item.product_id).catch(() => null);
        if (!product) continue;

        item.product = product;
        item.variant = null;

        if (item.variant_id) {
            const variants = await variantModel.getVariantsByProductId(item.product_id);
            item.variant = variants.find(v => v.id === item.variant_id) || null;
        }

        let availableStock = 0;
        try {
            if (item.variant_id && item.variant) {
                availableStock = item.variant.stockQuantityRu ?? item.variant.stockQuantity ?? 0;
            } else {
                availableStock = await inventoryService.getTotalStock(item.product_id);
            }
        } catch { availableStock = 0; }

        item.inStock           = availableStock > 0;
        item.availableQuantity = availableStock;
        item.isLowStock        = availableStock > 0 && availableStock < 5;
        item.outOfStock        = availableStock === 0;

        const price = _resolvePrice(product, item.variant);
        item.unitPrice = price;
        item.subtotal  = price * item.quantity;
        total      += item.subtotal;
        itemsTotal += item.quantity;
    }

    return {
        items: selectedItems,
        summary: {
            itemsTotal,
            subtotal: round2(total),
            shipping: 0,
            total: round2(total),
        },
        hasItems: selectedItems.length > 0,
    };
};

// ─────────────────────────────────────────────────────────────────
// Приватные хелперы
// ─────────────────────────────────────────────────────────────────

// Вычислить цену позиции: вариант → товар
// Приоритет: скидка варианта → цена варианта → скидка товара → цена товара
const _resolvePrice = (product, variant) => {
    if (variant?.priceOverride) {
        return variant.discountOverride
            ? parseFloat(variant.discountOverride)
            : parseFloat(variant.priceOverride);
    }
    const discountPrice = product.discountPrice ? parseFloat(product.discountPrice) : null;
    const retailPrice   = product.price          ? parseFloat(product.price)         : 0;
    return discountPrice || retailPrice;
};

// Получить вариант если он активен
const _getActiveVariant = async (productId, variantId) => {
    const variants = await variantModel.getVariantsByProductId(productId);
    return variants.find(v => v.id === variantId) || null;
};

// Остаток варианта на конкретной локации
const _getVariantStock = async (variantId, locationId = 1) => {
    const db = require('../config/db');
    const { rows } = await db.query(
        `SELECT COALESCE(SUM(quantity), 0)::integer AS qty
         FROM product_inventory WHERE variant_id = $1 AND location_id = $2`,
        [variantId, locationId]
    );
    return rows[0]?.qty ?? 0;
};

const round2 = (n) => parseFloat(n.toFixed(2));

module.exports = {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart,
    getSelectedCartItems,
};