// src/services/orderService.js
const Joi = require('joi');
const orderModel = require('../models/orderModel');
const cartService = require('./cartService');
const inventoryService = require('./inventoryService');
const AppError = require('../utils/errorUtils'); // Импорт AppError

const orderSchema = Joi.object({
    shipping_address: Joi.string().required(),
    payment_method: Joi.string().valid('card', 'cash').required(),
});

const createOrder = async (userId, data) => {
    const { error } = orderSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    const cartItems = await cartService.getCart(userId);
    if (cartItems.length === 0) throw new AppError('Cart is empty', 400);
    let totalAmount = 0;
    const orderItems = [];
    for (const item of cartItems) {
        const product = await productService.getProductById(item.product_id);
        await inventoryService.checkStock(product.id, item.quantity);
        const price = product.discount_price || product.retail_price;
        totalAmount += price * item.quantity;
        orderItems.push({
            product_id: product.id,
            quantity: item.quantity,
            price,
        });
        await inventoryService.updateStock(product.id, null, -item.quantity); // Уменьшить stock
    }
    const order = await orderModel.createOrder({
        user_id: userId,
        total_amount: totalAmount,
        ...data,
    });
    await orderModel.createOrderItems(order.id, orderItems);
    await cartService.clearCart(userId);
    return order;
};

const getOrdersByUser = async (userId, query) => {
    const { page = 1, limit = 10, status } = query;
    return orderModel.getOrdersByUser(userId, { page, limit, status });
};

const getAllOrders = async (query) => {
    const { page = 1, limit = 10, status } = query;
    return orderModel.getAllOrders({ page, limit, status });
};

const updateOrderStatus = async (id, status) => {
    const validStatuses = ['pending', 'shipped', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status))
        throw new AppError('Invalid status', 400);
    const order = await orderModel.getOrderById(id);
    if (!order) throw new AppError('Order not found', 404);
    if (status === 'cancelled' && order.status !== 'pending')
        throw new AppError('Cannot cancel non-pending order', 403);
    if (status === 'cancelled') {
        // Вернуть stock
        const items = await orderModel.getOrderItems(id);
        for (const item of items) {
            await inventoryService.updateStock(
                item.product_id,
                null,
                item.quantity
            );
        }
    }
    return orderModel.updateOrderStatus(id, status);
};

module.exports = {
    createOrder,
    getOrdersByUser,
    getAllOrders,
    updateOrderStatus,
};
