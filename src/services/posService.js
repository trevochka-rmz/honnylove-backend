// src/services/posService.js
const Joi = require('joi');
const db = require('../config/db');
const posModel = require('../models/posModel');
const orderModel = require('../models/orderModel');
const AppError = require('../utils/errorUtils');

// ─────────────────────────────────────────────────────────────────
// Схемы валидации
// ─────────────────────────────────────────────────────────────────

const createPOSOrderSchema = Joi.object({
    items: Joi.array().items(
        Joi.object({
            product_id: Joi.number().integer().positive().required()
                .messages({ 'any.required': 'Укажите ID товара' }),
            variant_id: Joi.number().integer().positive().allow(null).optional(),
            quantity:   Joi.number().integer().min(1).required()
                .messages({ 'number.min': 'Количество — минимум 1' }),
        })
    ).min(1).required()
        .messages({ 'array.min': 'Должен быть хотя бы один товар' }),

    payment_method: Joi.string().valid('cash', 'card').required()
        .messages({ 'any.only': 'Способ оплаты: cash или card' }),

    customer_first_name: Joi.string().max(100).optional().allow(''),
    customer_last_name:  Joi.string().max(100).optional().allow(''),
    customer_phone:      Joi.string().max(20).optional().allow(''),
    notes:               Joi.string().max(1000).optional().allow(''),
    discount_amount:     Joi.number().min(0).default(0),
});

const posFiltersSchema = Joi.object({
    status:         Joi.string().valid(
        'pending','paid','processing','shipped','delivered','cancelled','returned','completed'
    ).optional(),
    payment_method: Joi.string().valid('cash','card','online','sbp').optional(),
    created_by:     Joi.number().integer().positive().optional(),
    date_from:      Joi.date().iso().optional(),
    date_to:        Joi.date().iso().optional(),
    today_only:     Joi.boolean().optional(),
    this_week:      Joi.boolean().optional(),
    this_month:     Joi.boolean().optional(),
    search:         Joi.string().max(200).optional(),
    is_pos_order:   Joi.boolean().optional(),
    page:           Joi.number().integer().min(1).default(1),
    limit:          Joi.number().integer().min(1).max(100).default(50),
});

// ─────────────────────────────────────────────────────────────────
// Создать POS заказ (чек)
//
// ИСПРАВЛЕНО:
//  1. variant_id сохраняется в orderItems и передаётся в addOrderItem/decreaseInventory
//  2. checkInventory вызывается с variant_id
// ─────────────────────────────────────────────────────────────────
const createPOSOrder = async (cashierId, orderData) => {
    const { error, value } = createPOSOrderSchema.validate(orderData);
    if (error) throw new AppError(error.details[0].message, 400);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Получаем базовую информацию о товарах (цены, активность, остаток без варианта)
        const productIds = [...new Set(value.items.map(i => i.product_id))];
        const products   = await posModel.getProductsForCheckout(client, productIds);

        if (products.length === 0) throw new AppError('Товары не найдены', 404);

        const productMap = Object.fromEntries(products.map(p => [p.id, p]));

        const orderItems       = [];
        let   subtotal         = 0;
        const insufficientItems = [];

        for (const item of value.items) {
            const product   = productMap[item.product_id];
            const variantId = item.variant_id ?? null;

            if (!product) {
                throw new AppError(`Товар с ID ${item.product_id} не найден`, 404);
            }
            if (!product.is_active) {
                throw new AppError(`Товар "${product.name}" недоступен`, 400);
            }

            // Проверяем наличие — с variant_id!
            // checkInventory автоматически выберет: если variant_id есть → по варианту,
            // если нет → по продукту (legacy)
            const inventoryCheck = await orderModel.checkInventory(
                client,
                item.product_id,
                item.quantity,
                variantId   // ← ИСПРАВЛЕНО
            );

            if (!inventoryCheck.sufficient) {
                insufficientItems.push({
                    product_id: item.product_id,
                    variant_id: variantId,
                    name:       product.name,
                    sku:        product.sku,
                    available:  inventoryCheck.available,
                    required:   item.quantity,
                    shortage:   inventoryCheck.shortage,
                });
            }

            const lineTotal = parseFloat(product.final_price) * item.quantity;
            subtotal += lineTotal;

            // ИСПРАВЛЕНО: сохраняем variant_id в позиции
            orderItems.push({
                product_id:   item.product_id,
                variant_id:   variantId,            // ← было забыто
                quantity:     item.quantity,
                price:        product.retail_price,
                discount_price: product.discount_price,
                line_total:   lineTotal,
                product_name: product.name,
                product_sku:  product.sku,
            });
        }

        if (insufficientItems.length > 0) {
            throw new AppError('Недостаточно товаров на складе', 400, { insufficientItems });
        }

        const total_amount = subtotal - (value.discount_amount || 0);
        if (total_amount < 0) throw new AppError('Итоговая сумма не может быть отрицательной', 400);

        // Метка POS
        let notes = '[POS]';
        if (value.notes) notes += ` | ${value.notes}`;

        const newOrder = await orderModel.createOrder(client, {
            user_id:             cashierId,
            total_amount,
            shipping_address:    'Самовывоз (POS)',
            payment_method:      value.payment_method,
            shipping_cost:       0,
            tax_amount:          0,
            discount_amount:     value.discount_amount || 0,
            notes,
            customer_first_name: value.customer_first_name || null,
            customer_last_name:  value.customer_last_name  || null,
            customer_phone:      value.customer_phone      || null,
        });

        // Добавляем позиции и списываем со склада — с variant_id!
        for (const item of orderItems) {
            await orderModel.addOrderItem(client, {
                order_id:      newOrder.id,
                product_id:    item.product_id,
                quantity:      item.quantity,
                price:         item.price,
                discount_price:item.discount_price || null,
                variant_id:    item.variant_id,         // ← ИСПРАВЛЕНО
                variant_snapshot: null,
            });

            await orderModel.decreaseInventory(
                client,
                item.product_id,
                item.quantity,
                item.variant_id   // ← ИСПРАВЛЕНО
            );
        }

        // POS заказы сразу завершаются
        const initialStatus = 'completed';
        await orderModel.updateOrderStatus(client, newOrder.id, initialStatus);
        await orderModel.addStatusHistory(client, newOrder.id, initialStatus, cashierId);

        await client.query('COMMIT');

        const fullOrder = await orderModel.getOrderById(newOrder.id);

        return {
            success: true,
            message: 'Чек успешно создан',
            data: {
                order:          fullOrder,
                receipt_number: `CHK-${String(newOrder.id).padStart(6, '0')}`,
                items_count:    orderItems.length,
                total_quantity: orderItems.reduce((s, i) => s + i.quantity, 0),
                subtotal,
                discount:       value.discount_amount || 0,
                total:          total_amount,
                payment_method: value.payment_method,
            },
        };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        console.error('Ошибка при создании POS заказа:', err);
        throw new AppError('Произошла ошибка при создании чека: ' + err.message, 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Получить список POS заказов
// ─────────────────────────────────────────────────────────────────
const getPOSOrders = async (filters = {}) => {
    const { error, value } = posFiltersSchema.validate(filters);
    if (error) throw new AppError(error.details[0].message, 400);

    const { page, limit, ...filterParams } = value;
    const offset = (page - 1) * limit;

    const [orders, total] = await Promise.all([
        posModel.getPOSOrders(filterParams, limit, offset),
        posModel.getPOSOrdersCount(filterParams),
    ]);

    const totalPages = Math.ceil(total / limit);
    return {
        success: true,
        orders,
        pagination: { total, page, limit, totalPages, hasMore: page < totalPages },
    };
};

// ─────────────────────────────────────────────────────────────────
// Статистика продаж
// ─────────────────────────────────────────────────────────────────
const getSalesStatistics = async (filters = {}) => {
    const [stats, topProducts, dailyStats] = await Promise.all([
        posModel.getSalesStatistics(filters),
        posModel.getTopProducts(filters, 10),
        posModel.getDailySalesStats(filters),
    ]);

    return {
        success: true,
        data: { summary: stats, top_products: topProducts, daily_stats: dailyStats },
    };
};

// ─────────────────────────────────────────────────────────────────
// Предпросмотр товаров для чека
// ─────────────────────────────────────────────────────────────────
const previewProductsForCheckout = async (productIds) => {
    if (!productIds?.length) throw new AppError('Укажите ID товаров', 400);

    const client = await db.pool.connect();
    try {
        const products = await posModel.getProductsForCheckout(client, productIds);
        if (products.length === 0) throw new AppError('Товары не найдены', 404);

        let subtotal = 0;
        const unavailableProducts = [];

        products.forEach(p => {
            subtotal += parseFloat(p.final_price);
            if (!p.is_active)          unavailableProducts.push({ id: p.id, name: p.name, reason: 'Товар неактивен' });
            if (p.available_stock <= 0) unavailableProducts.push({ id: p.id, name: p.name, reason: 'Нет в наличии' });
        });

        return {
            success: true,
            products,
            summary: {
                total_items:          products.length,
                subtotal,
                unavailable_count:    unavailableProducts.length,
                unavailable_products: unavailableProducts,
            },
        };
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Управление кассирами
// ─────────────────────────────────────────────────────────────────
const getCashiers = async (currentUserRole) => {
    if (!['manager','admin'].includes(currentUserRole)) {
        throw new AppError('У вас нет прав для просмотра списка кассиров', 403);
    }
    const cashiers = await posModel.getCashiers(currentUserRole);
    return { success: true, cashiers, total: cashiers.length };
};

const getCashierDetails = async (cashierId, currentUserRole) => {
    if (!['manager','admin'].includes(currentUserRole)) {
        throw new AppError('У вас нет прав для просмотра информации о кассирах', 403);
    }
    const cashier = await posModel.getCashierById(cashierId);
    if (!cashier) throw new AppError('Кассир не найден', 404);
    if (currentUserRole === 'manager' && cashier.role !== 'manager') {
        throw new AppError('У вас нет прав для просмотра этого пользователя', 403);
    }
    return { success: true, cashier };
};

// ─────────────────────────────────────────────────────────────────
// Удалить POS заказ
// ИСПРАВЛЕНО: returnInventory с variant_id из позиций заказа
// ─────────────────────────────────────────────────────────────────
const deletePOSOrder = async (orderId, userId, userRole) => {
    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const order = await orderModel.getOrderById(orderId);
        if (!order) throw new AppError('Заказ не найден', 404);

        if (!order.notes?.includes('[POS]')) {
            throw new AppError('Это не POS заказ. Используйте обычный API заказов.', 400);
        }

        const isAdmin = userRole === 'admin';
        const isOwner = order.user_id === userId;
        if (!isAdmin && !isOwner) throw new AppError('У вас нет прав для удаления этого заказа', 403);

        const deletableStatuses = ['pending','cancelled'];
        if (!deletableStatuses.includes(order.status)) {
            throw new AppError(
                `Нельзя удалить заказ в статусе "${order.status}". ` +
                `Удаление возможно только для: ${deletableStatuses.join(', ')}`,
                400
            );
        }

        // Возвращаем товары с variant_id
        if (order.status !== 'cancelled') {
            for (const item of (order.items || [])) {
                await orderModel.returnInventory(
                    client,
                    item.product_id,
                    item.quantity,
                    item.variant_id ?? null   // ← ИСПРАВЛЕНО
                );
            }
        }

        await orderModel.deleteOrder(client, orderId);
        await client.query('COMMIT');

        return { success: true, message: 'POS заказ успешно удален' };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('Не удалось удалить POS заказ: ' + err.message, 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Обновить POS заказ
// ─────────────────────────────────────────────────────────────────
const updatePOSOrder = async (orderId, updateData, userId, userRole) => {
    const updateSchema = Joi.object({
        payment_method:      Joi.string().valid('cash','card').optional(),
        discount_amount:     Joi.number().min(0).optional(),
        notes:               Joi.string().max(1000).optional().allow(''),
        customer_first_name: Joi.string().max(100).optional().allow(''),
        customer_last_name:  Joi.string().max(100).optional().allow(''),
        customer_phone:      Joi.string().max(20).optional().allow(''),
    });

    const { error, value } = updateSchema.validate(updateData);
    if (error) throw new AppError(error.details[0].message, 400);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const order = await orderModel.getOrderById(orderId);
        if (!order) throw new AppError('Заказ не найден', 404);

        if (!order.notes?.includes('[POS]')) {
            throw new AppError('Это не POS заказ. Используйте обычный API заказов.', 400);
        }

        const isAdmin = userRole === 'admin' || userRole === 'manager';
        const isOwner = order.user_id === userId;
        if (!isAdmin && !isOwner) throw new AppError('У вас нет прав для изменения этого заказа', 403);

        const editableStatuses = ['pending','paid','completed'];
        if (!editableStatuses.includes(order.status)) {
            throw new AppError(
                `Нельзя изменить заказ в статусе "${order.status}". ` +
                `Изменение возможно только для: ${editableStatuses.join(', ')}`,
                400
            );
        }

        const updated = await orderModel.updateOrder(client, orderId, value);
        if (!updated) throw new AppError('Нет данных для обновления', 400);

        if (value.discount_amount !== undefined) {
            await orderModel.recalculateOrderTotal(client, orderId);
        }

        await client.query('COMMIT');

        const fullOrder = await orderModel.getOrderById(orderId);
        return { success: true, message: 'POS заказ успешно обновлен', data: { order: fullOrder } };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('Не удалось обновить POS заказ: ' + err.message, 500);
    } finally {
        client.release();
    }
};

module.exports = {
    createPOSOrder,
    getPOSOrders,
    getSalesStatistics,
    previewProductsForCheckout,
    getCashiers,
    getCashierDetails,
    deletePOSOrder,
    updatePOSOrder,
};