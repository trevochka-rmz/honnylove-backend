// services/orderService.js
const Joi = require('joi');
const orderModel = require('../models/orderModel');
const cartService = require('./cartService');
const inventoryService = require('./inventoryService');
const AppError = require('../utils/errorUtils');

// Схема оформления заказа
const checkoutSchema = Joi.object({
    shipping_address: Joi.string().required().min(10),
    payment_method: Joi.string().valid('card', 'cash', 'online').required(),
    notes: Joi.string().optional(),
});

// Проверка и резервирование товаров
const reserveItems = async (items) => {
    const reservedItems = [];

    for (const item of items) {
        // Проверяем наличие
        const availableStock = await inventoryService.getTotalStock(
            item.product_id
        );

        if (availableStock < item.quantity) {
            throw new AppError(
                `Недостаточно товара "${item.product.name}". Доступно: ${availableStock}, в корзине: ${item.quantity}`,
                400
            );
        }

        // Вычитаем из запасов (резервируем)
        await inventoryService.updateStock(item.product_id, 1, -item.quantity);

        reservedItems.push({
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.unitPrice,
            reserved: true,
        });
    }

    return reservedItems;
};

// Создание заказа
const createOrder = async (userId, orderData) => {
    // Валидация данных
    const { error } = checkoutSchema.validate(orderData);
    if (error) {
        throw new AppError(error.details[0].message, 400);
    }

    // Получаем корзину пользователя
    const cart = await cartService.getCart(userId);

    if (!cart.hasItems) {
        throw new AppError('Корзина пуста', 400);
    }

    const connection = await require('../config/db').getConnection();

    try {
        await connection.query('BEGIN');

        // Резервируем товары
        await reserveItems(cart.items);

        // Создаем заказ
        const order = await orderModel.createOrder({
            user_id: userId,
            status: 'pending',
            total_amount: cart.summary.total,
            shipping_address: orderData.shipping_address,
            payment_method: orderData.payment_method,
        });

        // Создаем элементы заказа
        for (const item of cart.items) {
            await orderModel.addOrderItem({
                order_id: order.id,
                product_id: item.product_id,
                quantity: item.quantity,
                price: item.unitPrice,
            });
        }

        // Записываем историю статуса
        await orderModel.addStatusHistory(order.id, 'pending');

        // Очищаем корзину
        await cartService.clearCart(userId);

        await connection.query('COMMIT');

        return order;
    } catch (error) {
        await connection.query('ROLLBACK');

        // Если произошла ошибка, возвращаем товары на склад
        try {
            for (const item of cart.items) {
                await inventoryService.updateStock(
                    item.product_id,
                    1,
                    item.quantity
                );
            }
        } catch (rollbackError) {
            console.error(
                'Ошибка при возврате товаров на склад:',
                rollbackError
            );
        }

        throw error;
    }
};

// Получение заказов пользователя
const getUserOrders = async (userId) => {
    return orderModel.getUserOrders(userId);
};

// Отмена заказа с возвратом товаров
const cancelOrder = async (userId, orderId) => {
    // Проверяем принадлежность заказа
    const order = await orderModel.getOrderById(orderId, userId);

    if (!order) {
        throw new AppError('Заказ не найден', 404);
    }

    // Проверяем, можно ли отменить
    if (!['pending', 'processing'].includes(order.status)) {
        throw new AppError('Нельзя отменить заказ в текущем статусе', 400);
    }

    const connection = await require('../config/db').getConnection();

    try {
        await connection.query('BEGIN');

        // Получаем товары из заказа
        const items = await orderModel.getOrderItems(orderId);

        // Возвращаем товары на склад
        for (const item of items) {
            await inventoryService.updateStock(
                item.product_id,
                1,
                item.quantity
            );
        }

        // Обновляем статус заказа
        const updatedOrder = await orderModel.updateOrderStatus(
            orderId,
            'cancelled'
        );

        // Записываем в историю
        await orderModel.addStatusHistory(orderId, 'cancelled');

        await connection.query('COMMIT');

        return {
            message: 'Заказ отменен, товары возвращены на склад',
            order: updatedOrder,
        };
    } catch (error) {
        await connection.query('ROLLBACK');
        throw error;
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    cancelOrder,
};
