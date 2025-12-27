// controllers/orderController.js
const orderService = require('../services/orderService');

// Оформление заказа
const checkout = async (req, res, next) => {
    try {
        const order = await orderService.createOrder(req.user.id, req.body);

        res.status(201).json({
            message: 'Заказ успешно оформлен',
            order: order,
            orderId: order.id,
        });
    } catch (err) {
        next(err);
    }
};

// Получение заказов пользователя
const getOrders = async (req, res, next) => {
    try {
        const orders = await orderService.getUserOrders(req.user.id);
        res.json(orders);
    } catch (err) {
        next(err);
    }
};

// Отмена заказа
const cancelOrder = async (req, res, next) => {
    try {
        const result = await orderService.cancelOrder(
            req.user.id,
            req.params.orderId
        );
        res.json(result);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    checkout,
    getOrders,
    cancelOrder,
};
