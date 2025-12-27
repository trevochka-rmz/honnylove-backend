// services/cartService.js
const Joi = require('joi');
const cartModel = require('../models/cartModel');
const productService = require('./productService');
const AppError = require('../utils/errorUtils');

// Схема валидации
const cartItemSchema = Joi.object({
    product_id: Joi.number().integer().required(),
    quantity: Joi.number().integer().min(1).max(50).required(), // Лимит 50 шт
});

// Добавление в корзину - БЕЗ проверки склада
const addToCart = async (userId, data) => {
    const { error } = cartItemSchema.validate(data);
    if (error) {
        throw new AppError(error.details[0].message, 400);
    }

    const { product_id, quantity } = data;

    // Проверяем существование товара
    const product = await productService.getProductById(product_id);
    if (!product) {
        throw new AppError('Товар не найден', 404);
    }

    // Проверяем активность товара
    if (!product.is_active && product.is_active !== undefined) {
        throw new AppError('Товар временно недоступен', 400);
    }

    // Проверяем, есть ли уже товар в корзине
    const existingItem = await cartModel.getCartItem(userId, product_id);

    if (existingItem) {
        // Если товар уже есть, увеличиваем количество (макс 50)
        const newQuantity = existingItem.quantity + quantity;
        if (newQuantity > 50) {
            throw new AppError(
                'Максимальное количество товара в корзине - 50 шт',
                400
            );
        }
        return cartModel.updateCartItem(userId, product_id, quantity);
    }

    // Добавляем новый товар
    return cartModel.addCartItem({
        user_id: userId,
        product_id: product_id,
        quantity: quantity,
    });
};

// Получение корзины с информацией о наличии
const getCart = async (userId) => {
    const items = await cartModel.getCartByUser(userId);
    let total = 0;
    let itemsTotal = 0;

    for (const item of items) {
        // Получаем информацию о продукте
        const product = await productService.getProductById(item.product_id);

        if (product) {
            item.product = product;

            // Проверяем наличие на складе через инвентарь
            const inventoryService = require('./inventoryService');
            let availableStock = 0;
            try {
                availableStock = await inventoryService.getTotalStock(
                    item.product_id
                );
            } catch (error) {
                availableStock = 0;
            }

            // Добавляем информацию о наличии
            item.inStock = availableStock > 0;
            item.availableQuantity = availableStock;
            item.isLowStock = availableStock > 0 && availableStock < 5; // Мало товара
            item.outOfStock = availableStock === 0;

            // Используем discountPrice если есть, иначе retailPrice
            const discountPrice = product.discountPrice
                ? parseFloat(product.discountPrice)
                : null;
            const retailPrice = product.retailPrice
                ? parseFloat(product.retailPrice)
                : parseFloat(product.price) || 0;
            const price = discountPrice || retailPrice;

            // Рассчитываем subtotal
            item.unitPrice = price;
            item.subtotal = price * item.quantity;
            total += item.subtotal;
            itemsTotal += item.quantity;
        }
    }

    return {
        items: items,
        summary: {
            itemsTotal: itemsTotal,
            subtotal: parseFloat(total.toFixed(2)),
            shipping: 0, // Будет рассчитываться при оформлении
            total: parseFloat(total.toFixed(2)),
        },
        hasItems: items.length > 0,
    };
};

// Обновление количества в корзине
const updateCartItem = async (userId, itemId, quantity) => {
    if (quantity < 1) {
        throw new AppError('Количество должно быть не менее 1', 400);
    }

    if (quantity > 50) {
        throw new AppError(
            'Максимальное количество товара в корзине - 50 шт',
            400
        );
    }

    const item = await cartModel.getCartItemById(itemId);

    if (!item || item.user_id !== userId) {
        throw new AppError(
            'Элемент корзины не найден или доступ запрещён',
            404
        );
    }

    return cartModel.updateCartItemQuantity(itemId, quantity);
};

// Удаление из корзины
const removeFromCart = async (userId, itemId) => {
    const item = await cartModel.getCartItemById(itemId);

    if (!item || item.user_id !== userId) {
        throw new AppError(
            'Элемент корзины не найден или доступ запрещён',
            404
        );
    }

    await cartModel.removeCartItem(itemId);
};

// Очистка корзины
const clearCart = async (userId) => {
    await cartModel.clearCart(userId);
};

module.exports = {
    addToCart,
    getCart,
    updateCartItem,
    removeFromCart,
    clearCart,
};
