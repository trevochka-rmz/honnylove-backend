// src/controllers/orderController.js
const orderService = require('../services/orderService');

const createOrder = async (req, res, next) => {
    try {
        const order = await orderService.createOrder(req.user.id, req.body);
        res.status(201).json(order);
    } catch (err) {
        next(err);
    }
};

const getUserOrders = async (req, res, next) => {
    try {
        const orders = await orderService.getOrdersByUser(
            req.user.id,
            req.query
        );
        res.json(orders);
    } catch (err) {
        next(err);
    }
};

const getAllOrders = async (req, res, next) => {
    try {
        const orders = await orderService.getAllOrders(req.query);
        res.json(orders);
    } catch (err) {
        next(err);
    }
};

const updateOrderStatus = async (req, res, next) => {
    try {
        const order = await orderService.updateOrderStatus(
            req.params.id,
            req.body.status
        );
        res.json(order);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    createOrder,
    getUserOrders,
    getAllOrders,
    updateOrderStatus,
};
