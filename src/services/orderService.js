// src/services/orderService.js
const Joi = require('joi');
const db = require('../config/db');
const telegramService = require('./telegramService');
const orderModel = require('../models/orderModel');
const AppError = require('../utils/errorUtils');
const emailService = require('./emailService');

// ─────────────────────────────────────────────────────────────────
// Схемы валидации
// ─────────────────────────────────────────────────────────────────

const checkoutSchema = Joi.object({
    selected_items: Joi.array()
        .items(Joi.number().integer().positive())
        .min(1).required()
        .messages({ 'any.required': 'Не указаны товары' }),

    customer_first_name: Joi.string().min(2).max(100).required()
        .messages({ 'any.required': 'Укажите имя получателя' }),
    customer_last_name: Joi.string().min(2).max(100).required()
        .messages({ 'any.required': 'Укажите фамилию получателя' }),
    customer_phone: Joi.string().min(10).max(20).required()
        .messages({ 'any.required': 'Укажите телефон получателя' }),

    shipping_address: Joi.string().min(10).max(500).required()
        .messages({ 'any.required': 'Укажите адрес доставки' }),

    payment_method: Joi.string()
        .valid('card', 'cash', 'online', 'sbp').required()
        .messages({ 'any.required': 'Укажите способ оплаты' }),

    notes:           Joi.string().max(1000).optional().allow(''),
    shipping_cost:   Joi.number().min(0).default(0),
    tax_amount:      Joi.number().min(0).default(0),
    discount_amount: Joi.number().min(0).default(0),
    save_address:    Joi.boolean().default(false),
});

const createAdminOrderSchema = Joi.object({
    user_id: Joi.number().integer().positive().required()
        .messages({ 'any.required': 'Укажите ID пользователя' }),

    items: Joi.array().items(
        Joi.object({
            product_id: Joi.number().integer().positive().required(),
            variant_id: Joi.number().integer().positive().allow(null).optional(),
            quantity:   Joi.number().integer().min(1).required(),
        })
    ).min(1).required()
        .messages({ 'array.min': 'Должен быть хотя бы один товар' }),

    shipping_address: Joi.string().min(10).max(500).required(),
    payment_method:   Joi.string().valid('card','cash','online','bank_transfer').required(),
    notes:            Joi.string().max(1000).optional().allow(''),
    shipping_cost:    Joi.number().min(0).default(0),
    tax_amount:       Joi.number().min(0).default(0),
    discount_amount:  Joi.number().min(0).default(0),
    tracking_number:  Joi.string().max(100).optional().allow(null, ''),
    customer_first_name: Joi.string().min(2).max(100).optional().allow('', null),
    customer_last_name:  Joi.string().min(2).max(100).optional().allow('', null),
    customer_phone:      Joi.string().min(10).max(20).optional().allow('', null),
});

const updateOrderSchema = Joi.object({
    shipping_address: Joi.string().min(10).max(500).optional(),
    payment_method:   Joi.string().valid('card','cash','online','sbp').optional(),
    shipping_cost:    Joi.number().min(0).optional(),
    tax_amount:       Joi.number().min(0).optional(),
    discount_amount:  Joi.number().min(0).optional(),
    tracking_number:  Joi.string().max(100).optional().allow(null, ''),
    notes:            Joi.string().max(1000).optional().allow(''),
});

const addOrderItemSchema = Joi.object({
    product_id: Joi.number().integer().positive().required(),
    variant_id: Joi.number().integer().positive().allow(null).optional(),
    quantity:   Joi.number().integer().min(1).required(),
});

// ─────────────────────────────────────────────────────────────────
// Константы
// ─────────────────────────────────────────────────────────────────

const ORDER_STATUSES = [
    'pending','paid','processing','shipped','delivered',
    'cancelled','returned','completed',
];
const CANCELLABLE_STATUSES = ['pending','paid','processing'];
const DELETABLE_STATUSES   = ['pending','cancelled'];

// ─────────────────────────────────────────────────────────────────
// Создание заказа из корзины (для покупателя)
// ─────────────────────────────────────────────────────────────────
const createOrder = async (userId, orderData) => {
    const { error, value } = checkoutSchema.validate(orderData);
    if (error) throw new AppError(error.details[0].message, 400);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Обновляем профиль пользователя (только пустые поля)
        await client.query(`
            UPDATE users SET
                first_name = CASE WHEN (first_name IS NULL OR first_name = '') THEN $1 ELSE first_name END,
                last_name  = CASE WHEN (last_name  IS NULL OR last_name  = '') THEN $2 ELSE last_name  END,
                phone      = CASE WHEN (phone      IS NULL OR phone      = '') THEN $3 ELSE phone      END,
                address    = CASE WHEN $5 = TRUE THEN $4 ELSE address END,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $6
        `, [
            value.customer_first_name,
            value.customer_last_name,
            value.customer_phone,
            value.shipping_address,
            value.save_address,
            userId,
        ]);

        // Получаем выбранные позиции корзины
        const cartItems = await orderModel.getSelectedCartItemsWithDetails(
            client, userId, value.selected_items
        );
        if (!cartItems?.length) {
            throw new AppError('Выбранные товары не найдены в корзине', 400);
        }

        // Проверяем активность и наличие на складе
        // ВАЖНО: передаём variant_id из позиции корзины!
        const insufficientItems = [];
        for (const item of cartItems) {
            if (!item.is_active) {
                throw new AppError(`Товар "${item.name}" больше недоступен`, 400);
            }
            const check = await orderModel.checkInventory(
                client,
                item.product_id,
                item.cart_quantity,
                item.variant_id ?? null   // ← ключевое исправление
            );
            if (!check.sufficient) {
                insufficientItems.push({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    name:       item.name,
                    sku:        item.sku,
                    available:  check.available,
                    required:   item.cart_quantity,
                    shortage:   check.shortage,
                });
            }
        }
        if (insufficientItems.length > 0) {
            throw new AppError(
                'Недостаточно товаров на складе. Попробуйте изменить количество.',
                400,
                { insufficientItems }
            );
        }

        // Считаем сумму
        const subtotal = cartItems.reduce((sum, item) =>
            sum + (parseFloat(item.final_price) * item.cart_quantity), 0);
        const total_amount = subtotal + value.shipping_cost + value.tax_amount - value.discount_amount;

        if (total_amount < 0) {
            throw new AppError('Итоговая сумма заказа не может быть отрицательной', 400);
        }

        // Создаём заказ
        const newOrder = await orderModel.createOrder(client, {
            user_id:             userId,
            total_amount,
            shipping_address:    value.shipping_address,
            payment_method:      value.payment_method,
            shipping_cost:       value.shipping_cost,
            tax_amount:          value.tax_amount,
            discount_amount:     value.discount_amount,
            notes:               value.notes || '',
            customer_first_name: value.customer_first_name,
            customer_last_name:  value.customer_last_name,
            customer_phone:      value.customer_phone,
        });

        // Добавляем позиции и списываем со склада
        for (const item of cartItems) {
            await orderModel.addOrderItem(client, {
                order_id:        newOrder.id,
                product_id:      item.product_id,
                quantity:        item.cart_quantity,
                price:           item.retail_price,
                discount_price:  (item.discount_price && Number(item.discount_price) > 0)
                                    ? item.discount_price : null,
                variant_id:      item.variant_id ?? null,
                variant_snapshot:item.variant_snapshot ?? null,
            });

            // ВАЖНО: передаём variant_id!
            await orderModel.decreaseInventory(
                client,
                item.product_id,
                item.cart_quantity,
                item.variant_id ?? null   // ← ключевое исправление
            );
        }

        await orderModel.addStatusHistory(client, newOrder.id, 'pending', userId);
        await orderModel.removeSelectedCartItems(client, userId, value.selected_items);

        await client.query('COMMIT');

        const fullOrder = await orderModel.getOrderById(newOrder.id);

        // Уведомления
        if (value.payment_method === 'cash') {
            telegramService
                .sendNewOrderNotification(fullOrder, `ORD-${String(newOrder.id).padStart(6, '0')}`)
                .catch(err => console.error('[Telegram]', err));

            emailService.sendOrderConfirmation(fullOrder.user_email, {
                orderNumber: `ORD-${String(newOrder.id).padStart(6, '0')}`,
                order: fullOrder,
            }).catch(err => console.error('[Email]', err));
        }

        return {
            success:      true,
            message:      'Заказ успешно оформлен',
            data: {
                order:         fullOrder,
                order_number:  `ORD-${String(newOrder.id).padStart(6, '0')}`,
                items_count:   cartItems.length,
                needs_payment: ['card','online','sbp'].includes(value.payment_method),
            },
        };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        console.error('Ошибка при создании заказа:', err);
        throw new AppError('Произошла ошибка при оформлении заказа: ' + err.message, 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Создание заказа с немедленной оплатой (card / online / sbp)
// ─────────────────────────────────────────────────────────────────
const createOrderWithPayment = async (userId, orderData) => {
    if (!['card','online','sbp'].includes(orderData.payment_method)) {
        throw new AppError(
            'Этот метод только для онлайн-оплаты (card, online, sbp).',
            400
        );
    }

    const orderResult = await createOrder(userId, orderData);
    if (!orderResult.success) return orderResult;

    const orderId     = orderResult.data.order.id;
    const orderAmount = orderResult.data.order.total_amount;

    const paymentService = require('./paymentService');
    const payment = await paymentService.createYookassaPayment({
        order_id:    orderId,
        amount:      orderAmount,
        description: `Оплата заказа №${orderId}`,
        metadata: {
            user_id:      userId,
            order_number: orderResult.data.order_number,
        },
    });

    return {
        success: true,
        message: 'Заказ оформлен. Перейдите к оплате.',
        data: {
            order:        orderResult.data.order,
            order_number: orderResult.data.order_number,
            payment: {
                confirmation_url:    payment.confirmation_url,
                payment_id:          payment.payment_id,
                yookassa_payment_id: payment.yookassa_payment_id,
                status:              payment.status,
                amount:              payment.amount,
            },
        },
    };
};

// ─────────────────────────────────────────────────────────────────
// Создание заказа администратором (указывает товары вручную)
// ─────────────────────────────────────────────────────────────────
const createAdminOrder = async (adminUserId, orderData) => {
    const { error, value } = createAdminOrderSchema.validate(orderData);
    if (error) throw new AppError(error.details[0].message, 400);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        // Проверяем пользователя
        const userRes = await client.query(
            'SELECT id FROM users WHERE id = $1 AND is_active = TRUE',
            [value.user_id]
        );
        if (userRes.rowCount === 0) throw new AppError('Пользователь не найден или неактивен', 404);

        // Получаем детали каждого товара
        const items      = [];
        let   subtotal   = 0;

        for (const item of value.items) {
            const productRes = await client.query(`
                SELECT
                    id, name, sku, retail_price, discount_price, is_active,
                    CASE
                        WHEN discount_price IS NOT NULL AND discount_price > 0
                        THEN discount_price ELSE retail_price
                    END AS final_price
                FROM product_products
                WHERE id = $1 AND is_active = TRUE
            `, [item.product_id]);

            if (productRes.rowCount === 0) {
                throw new AppError(`Товар с ID ${item.product_id} не найден или недоступен`, 404);
            }

            const product  = productRes.rows[0];
            const variantId = item.variant_id ?? null;

            // Если передан вариант — проверяем его существование
            if (variantId) {
                const variantRes = await client.query(
                    `SELECT id FROM product_variants
                     WHERE id = $1 AND product_id = $2 AND is_active = TRUE`,
                    [variantId, item.product_id]
                );
                if (variantRes.rowCount === 0) {
                    throw new AppError(
                        `Вариант с ID ${variantId} не найден для товара ${item.product_id}`,
                        404
                    );
                }
            }

            subtotal += parseFloat(product.final_price) * item.quantity;
            items.push({ ...product, cart_quantity: item.quantity, variant_id: variantId });
        }

        // Проверяем наличие — с variant_id!
        const insufficientItems = [];
        for (const item of items) {
            const check = await orderModel.checkInventory(
                client, item.id, item.cart_quantity, item.variant_id
            );
            if (!check.sufficient) {
                insufficientItems.push({
                    product_id: item.id,
                    variant_id: item.variant_id,
                    name:       item.name,
                    sku:        item.sku,
                    available:  check.available,
                    required:   item.cart_quantity,
                    shortage:   check.shortage,
                });
            }
        }
        if (insufficientItems.length > 0) {
            throw new AppError('Недостаточно товаров на складе.', 400, { insufficientItems });
        }

        const total_amount = subtotal + value.shipping_cost + value.tax_amount - value.discount_amount;
        if (total_amount < 0) throw new AppError('Итоговая сумма не может быть отрицательной', 400);

        const newOrder = await orderModel.createOrder(client, {
            user_id:             value.user_id,
            total_amount,
            shipping_address:    value.shipping_address,
            payment_method:      value.payment_method,
            shipping_cost:       value.shipping_cost,
            tax_amount:          value.tax_amount,
            discount_amount:     value.discount_amount,
            notes:               value.notes || '',
            tracking_number:     value.tracking_number || null,
            customer_first_name: value.customer_first_name || null,
            customer_last_name:  value.customer_last_name  || null,
            customer_phone:      value.customer_phone      || null,
        });

        for (const item of items) {
            await orderModel.addOrderItem(client, {
                order_id:        newOrder.id,
                product_id:      item.id,
                quantity:        item.cart_quantity,
                price:           item.retail_price,
                discount_price:  (item.discount_price && Number(item.discount_price) > 0)
                                    ? item.discount_price : null,
                variant_id:      item.variant_id,
                variant_snapshot:null,
            });

            // Списываем с variant_id!
            await orderModel.decreaseInventory(
                client, item.id, item.cart_quantity, item.variant_id
            );
        }

        await orderModel.addStatusHistory(client, newOrder.id, 'pending', adminUserId);
        await client.query('COMMIT');

        const fullOrder = await orderModel.getOrderById(newOrder.id);

        telegramService
            .sendNewOrderNotification(fullOrder, `ORD-${String(newOrder.id).padStart(6, '0')}`)
            .catch(err => console.error('[Telegram]', err));

        return {
            success:     true,
            message:     'Заказ успешно создан администратором',
            data: {
                order:        fullOrder,
                order_number: `ORD-${String(newOrder.id).padStart(6, '0')}`,
            },
        };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        console.error('Ошибка при создании заказа администратором:', err);
        throw new AppError('Произошла ошибка при создании заказа: ' + err.message, 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Получение заказов
// ─────────────────────────────────────────────────────────────────
const getUserOrders = async (userId, page = 1, limit = 10, status = null) => {
    const offset = (page - 1) * limit;
    const [orders, total] = await Promise.all([
        orderModel.getUserOrders(userId, limit, offset, status),
        orderModel.getUserOrdersCount(userId, status),
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
        success: true,
        orders,
        pagination: { total, page: +page, limit: +limit, totalPages, hasMore: page < totalPages },
    };
};

const getAllOrders = async (filters = {}, page = 1, limit = 20) => {
    const offset = (page - 1) * limit;
    const [orders, total] = await Promise.all([
        orderModel.getAllOrders(filters, limit, offset),
        orderModel.getAllOrdersCount(filters),
    ]);
    const totalPages = Math.ceil(total / limit);
    return {
        success: true,
        orders,
        pagination: { total, page: +page, limit: +limit, totalPages, hasMore: page < totalPages },
    };
};

const getOrderDetails = async (orderId, userId = null, role = 'customer') => {
    const order = await orderModel.getOrderById(orderId);
    if (!order) throw new AppError('Заказ не найден', 404);

    const isAdmin = role === 'admin' || role === 'manager';
    const isOwner = order.user_id === userId;
    if (!isAdmin && !isOwner) throw new AppError('У вас нет доступа к этому заказу', 403);

    return { success: true, order, accessible: true };
};

// ─────────────────────────────────────────────────────────────────
// Обновить статус заказа
// При отмене → возвращаем товары (с variant_id!)
// При восстановлении из отмены → списываем (с variant_id!)
// ─────────────────────────────────────────────────────────────────
const updateOrderStatus = async (orderId, newStatus, changerUserId, notes = '') => {
    if (!ORDER_STATUSES.includes(newStatus)) {
        throw new AppError(`Недопустимый статус. Доступные: ${ORDER_STATUSES.join(', ')}`, 400);
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const currentOrder = await orderModel.getOrderById(orderId);
        if (!currentOrder) throw new AppError('Заказ не найден', 404);

        const oldStatus = currentOrder.status;
        if (oldStatus === newStatus) throw new AppError('Новый статус совпадает с текущим', 400);

        await orderModel.updateOrderStatus(client, orderId, newStatus);
        await orderModel.addStatusHistory(client, orderId, newStatus, changerUserId);

        // Отмена → возвращаем товары на склад с variant_id
        if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
            for (const item of (currentOrder.items || [])) {
                await orderModel.returnInventory(
                    client,
                    item.product_id,
                    item.quantity,
                    item.variant_id ?? null   // ← ключевое исправление
                );
            }
        }

        // Восстановление из отмены → списываем снова с variant_id
        if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
            const insufficientItems = [];
            for (const item of (currentOrder.items || [])) {
                const check = await orderModel.checkInventory(
                    client, item.product_id, item.quantity, item.variant_id ?? null
                );
                if (!check.sufficient) {
                    insufficientItems.push({
                        product_id: item.product_id,
                        variant_id: item.variant_id,
                        name:       item.product_name,
                        sku:        item.product_sku,
                        available:  check.available,
                        required:   item.quantity,
                        shortage:   check.shortage,
                    });
                }
            }
            if (insufficientItems.length > 0) {
                throw new AppError(
                    'Недостаточно товаров на складе для восстановления заказа.',
                    400,
                    { insufficientItems }
                );
            }
            for (const item of (currentOrder.items || [])) {
                await orderModel.decreaseInventory(
                    client, item.product_id, item.quantity, item.variant_id ?? null
                );
            }
        }

        await client.query('COMMIT');

        const fullOrder = await orderModel.getOrderById(orderId);
        return {
            success: true,
            message: `Статус заказа изменен с "${oldStatus}" на "${newStatus}"`,
            data:    { order: fullOrder },
        };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        console.error('Ошибка при обновлении статуса:', err);
        throw new AppError('Не удалось обновить статус заказа', 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Обновить данные заказа
// ─────────────────────────────────────────────────────────────────
const updateOrder = async (orderId, updateData, userId, role) => {
    const { error, value } = updateOrderSchema.validate(updateData);
    if (error) throw new AppError(error.details[0].message, 400);

    if (role !== 'admin' && role !== 'manager') {
        throw new AppError('Только администратор может редактировать заказы', 403);
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');
        const order = await orderModel.getOrderById(orderId);
        if (!order) throw new AppError('Заказ не найден', 404);

        await orderModel.updateOrder(client, orderId, value);
        await client.query('COMMIT');

        const fullOrder = await orderModel.getOrderById(orderId);
        return { success: true, message: 'Заказ успешно обновлен', data: { order: fullOrder } };
    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('Не удалось обновить заказ', 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Отменить заказ (покупатель)
// ─────────────────────────────────────────────────────────────────
const cancelOrder = async (userId, orderId, reason = '') => {
    const order = await orderModel.getOrderById(orderId);
    if (!order) throw new AppError('Заказ не найден', 404);
    if (order.user_id !== userId) throw new AppError('У вас нет доступа к этому заказу', 403);

    if (!CANCELLABLE_STATUSES.includes(order.status)) {
        throw new AppError(
            `Нельзя отменить заказ в статусе "${order.status}". ` +
            `Отмена возможна только для: ${CANCELLABLE_STATUSES.join(', ')}`,
            400
        );
    }

    return updateOrderStatus(orderId, 'cancelled', userId, reason);
};

// ─────────────────────────────────────────────────────────────────
// Добавить товар в существующий заказ (Admin)
// ─────────────────────────────────────────────────────────────────
const addItemToOrder = async (orderId, itemData, userId, role) => {
    const { error, value } = addOrderItemSchema.validate(itemData);
    if (error) throw new AppError(error.details[0].message, 400);

    if (role !== 'admin' && role !== 'manager') {
        throw new AppError('Только администратор может добавлять товары в заказы', 403);
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const order = await orderModel.getOrderById(orderId);
        if (!order) throw new AppError('Заказ не найден', 404);

        const productRes = await client.query(
            'SELECT * FROM product_products WHERE id = $1 AND is_active = TRUE',
            [value.product_id]
        );
        if (productRes.rowCount === 0) throw new AppError('Товар не найден или недоступен', 404);
        const product  = productRes.rows[0];
        const variantId = value.variant_id ?? null;

        const check = await orderModel.checkInventory(
            client, value.product_id, value.quantity, variantId
        );
        if (!check.sufficient) {
            throw new AppError('Недостаточно товаров на складе.', 400, {
                insufficientItems: [{
                    product_id: value.product_id,
                    variant_id: variantId,
                    name:       product.name,
                    sku:        product.sku,
                    available:  check.available,
                    required:   value.quantity,
                    shortage:   check.shortage,
                }],
            });
        }

        await orderModel.addOrderItem(client, {
            order_id:      orderId,
            product_id:    value.product_id,
            quantity:      value.quantity,
            price:         product.retail_price,
            discount_price:product.discount_price,
            variant_id:    variantId,
        });

        await orderModel.decreaseInventory(client, value.product_id, value.quantity, variantId);
        await orderModel.recalculateOrderTotal(client, orderId);

        await client.query('COMMIT');

        const updatedOrder = await orderModel.getOrderById(orderId);
        return { success: true, message: 'Товар добавлен в заказ', data: { order: updatedOrder } };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('Не удалось добавить товар в заказ', 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Удалить товар из заказа (Admin)
// ─────────────────────────────────────────────────────────────────
const removeItemFromOrder = async (orderId, orderItemId, userId, role) => {
    if (role !== 'admin' && role !== 'manager') {
        throw new AppError('Только администратор может удалять товары из заказов', 403);
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const order = await orderModel.getOrderById(orderId);
        if (!order) throw new AppError('Заказ не найден', 404);

        const item = order.items.find(i => i.id === parseInt(orderItemId, 10));
        if (!item) throw new AppError('Товар не найден в заказе', 404);

        await orderModel.removeOrderItem(client, orderItemId);

        // Возвращаем на склад с variant_id
        await orderModel.returnInventory(
            client,
            item.product_id,
            item.quantity,
            item.variant_id ?? null
        );

        await orderModel.recalculateOrderTotal(client, orderId);
        await client.query('COMMIT');

        const updatedOrder = await orderModel.getOrderById(orderId);
        return { success: true, message: 'Товар удален из заказа', data: { order: updatedOrder } };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('Не удалось удалить товар из заказа', 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Статистика
// ─────────────────────────────────────────────────────────────────
const getOrderStatistics = async () => {
    const stats = await orderModel.getOrderStats();
    return { success: true, stats: stats.overall, daily_stats: stats.daily };
};

// ─────────────────────────────────────────────────────────────────
// Удалить заказ (Admin, только pending/cancelled)
// ─────────────────────────────────────────────────────────────────
const deleteOrder = async (orderId, userId, role) => {
    if (role !== 'admin' && role !== 'manager') {
        throw new AppError('Только администратор может удалять заказы', 403);
    }

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const order = await orderModel.getOrderById(orderId);
        if (!order) throw new AppError('Заказ не найден', 404);

        if (!DELETABLE_STATUSES.includes(order.status)) {
            throw new AppError(
                `Нельзя удалить заказ в статусе "${order.status}". ` +
                `Удаление возможно только для: ${DELETABLE_STATUSES.join(', ')}`,
                400
            );
        }

        // Если не отменён — возвращаем товары с variant_id
        if (order.status !== 'cancelled') {
            for (const item of (order.items || [])) {
                await orderModel.returnInventory(
                    client, item.product_id, item.quantity, item.variant_id ?? null
                );
            }
        }

        await orderModel.deleteOrder(client, orderId);
        await client.query('COMMIT');

        return { success: true, message: 'Заказ успешно удален' };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;
        throw new AppError('Не удалось удалить заказ', 500);
    } finally {
        client.release();
    }
};

module.exports = {
    createOrder,
    createAdminOrder,
    createOrderWithPayment,
    getUserOrders,
    getAllOrders,
    getOrderDetails,
    updateOrderStatus,
    updateOrder,
    cancelOrder,
    addItemToOrder,
    removeItemFromOrder,
    getOrderStatistics,
    deleteOrder,
    ORDER_STATUSES,
    CANCELLABLE_STATUSES,
    DELETABLE_STATUSES,
};