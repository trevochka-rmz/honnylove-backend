// src/services/refundService.js
const Joi = require('joi');
const db = require('../config/db');
const orderModel = require('../models/orderModel');
const paymentModel = require('../models/paymentModel');
const AppError = require('../utils/errorUtils');
const { YooCheckout } = require('@a2seven/yoo-checkout');

const yooKassa = new YooCheckout({
    shopId:    process.env.YOOKASSA_SHOP_ID,
    secretKey: process.env.YOOKASSA_SECRET_KEY,
});

const createRefundSchema = Joi.object({
    amount: Joi.number().positive().optional(),
    reason: Joi.string().max(1000).required()
        .messages({
            'string.empty': 'Укажите причину возврата',
            'any.required': 'Причина возврата обязательна',
        }),
});

// ─────────────────────────────────────────────────────────────────
// Создать возврат средств (полный или частичный)
//
// ИСПРАВЛЕНО: returnInventory теперь получает variant_id из позиции заказа.
// item.variant_id доступен потому что getOrderById (после наших правок)
// возвращает variant_id в каждой позиции через LEFT JOIN product_variants.
// ─────────────────────────────────────────────────────────────────
const createRefund = async (orderId, refundData, userId, role) => {
    const { error, value } = createRefundSchema.validate(refundData);
    if (error) throw new AppError(error.details[0].message, 400);

    const client = await db.pool.connect();
    try {
        await client.query('BEGIN');

        const order = await orderModel.getOrderById(orderId);
        if (!order) throw new AppError('Заказ не найден', 404);

        const isAdmin = role === 'admin' || role === 'manager';
        if (!isAdmin && order.user_id !== userId) {
            throw new AppError('У вас нет доступа к этому заказу', 403);
        }

        if (!['paid','processing','shipped','delivered'].includes(order.status)) {
            throw new AppError(
                `Нельзя сделать возврат для заказа в статусе "${order.status}". ` +
                `Возврат возможен только для оплаченных заказов.`,
                400
            );
        }

        const payment = await paymentModel.findPaymentByOrderId(orderId);
        if (!payment) throw new AppError('Платеж не найден для этого заказа', 404);

        if (payment.status !== 'succeeded') {
            throw new AppError(
                `Нельзя сделать возврат для платежа в статусе "${payment.status}"`,
                400
            );
        }

        const refundAmount     = value.amount || parseFloat(order.total_amount);
        const alreadyRefunded  = parseFloat(payment.refund_amount || 0);
        const maxRefundable    = parseFloat(payment.amount) - alreadyRefunded;

        if (refundAmount > maxRefundable) {
            throw new AppError(
                `Сумма возврата ${refundAmount} ₽ превышает доступную для возврата ` +
                `${maxRefundable} ₽ (уже возвращено: ${alreadyRefunded} ₽)`,
                400
            );
        }

        console.log('═══════════════════════════════════════');
        console.log('💰 СОЗДАНИЕ ВОЗВРАТА');
        console.log('Заказ:', orderId);
        console.log('Платеж ЮKassa:', payment.yookassa_payment_id);
        console.log('Сумма возврата:', refundAmount, '₽');

        // Создаём возврат в ЮKassa
        const yookassaRefund = await yooKassa.createRefund({
            payment_id: payment.yookassa_payment_id,
            amount: {
                value:    refundAmount.toFixed(2),
                currency: 'RUB',
            },
            description: value.reason,
        });

        console.log('✅ Возврат создан в ЮKassa:', yookassaRefund.id);

        // Сохраняем возврат в БД
        const dbRefundRes = await client.query(`
            INSERT INTO refunds
                (payment_id, yookassa_refund_id, amount, status, reason, metadata, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
            RETURNING *
        `, [
            payment.id,
            yookassaRefund.id,
            refundAmount,
            yookassaRefund.status,
            value.reason,
            JSON.stringify(yookassaRefund),
        ]);
        const dbRefund = dbRefundRes.rows[0];

        // Обновляем сумму возврата в платеже
        const newRefundAmount = alreadyRefunded + refundAmount;
        await client.query(`
            UPDATE payments
            SET refund_amount = $1, refund_reason = $2, updated_at = CURRENT_TIMESTAMP
            WHERE id = $3
        `, [newRefundAmount, value.reason, payment.id]);

        // Обновляем статус заказа при полном возврате
        const isFullRefund  = newRefundAmount >= parseFloat(payment.amount);
        const newOrderStatus = isFullRefund ? 'returned' : order.status;

        if (newOrderStatus !== order.status) {
            await orderModel.updateOrderStatus(client, orderId, newOrderStatus);
            await orderModel.addStatusHistory(client, orderId, newOrderStatus, userId);
            console.log(`✅ Статус заказа: ${order.status} → ${newOrderStatus}`);
        }

        // При полном возврате — возвращаем товары на склад С variant_id
        if (isFullRefund) {
            console.log('📦 Возврат товаров на склад...');
            for (const item of (order.items || [])) {
                // ИСПРАВЛЕНО: передаём variant_id из позиции заказа
                await orderModel.returnInventory(
                    client,
                    item.product_id,
                    item.quantity,
                    item.variant_id ?? null   // ← ключевое исправление
                );
                console.log(`  ✅ ${item.product_name} (variant_id=${item.variant_id ?? 'нет'}): +${item.quantity} шт`);
            }
        }

        await client.query('COMMIT');
        console.log('✅ ВОЗВРАТ УСПЕШНО СОЗДАН\n');

        const updatedOrder = await orderModel.getOrderById(orderId);

        return {
            success: true,
            message: isFullRefund
                ? 'Полный возврат средств оформлен. Товары возвращены на склад.'
                : `Частичный возврат оформлен: ${refundAmount} ₽`,
            data: {
                refund: {
                    id:                  dbRefund.id,
                    yookassa_refund_id:  yookassaRefund.id,
                    amount:              refundAmount,
                    status:              yookassaRefund.status,
                    reason:              value.reason,
                    created_at:          dbRefund.created_at,
                },
                order:           updatedOrder,
                is_full_refund:  isFullRefund,
                total_refunded:  newRefundAmount,
            },
        };

    } catch (err) {
        await client.query('ROLLBACK');
        if (err instanceof AppError) throw err;

        console.error('❌ ОШИБКА СОЗДАНИЯ ВОЗВРАТА:', err.message);

        if (err.response?.data) {
            throw new AppError(
                `Ошибка ЮKassa: ${err.response.data.description || err.message}`,
                400
            );
        }
        throw new AppError(`Не удалось создать возврат: ${err.message}`, 500);
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Получить список возвратов для заказа
// ─────────────────────────────────────────────────────────────────
const getOrderRefunds = async (orderId, userId, role) => {
    const order = await orderModel.getOrderById(orderId);
    if (!order) throw new AppError('Заказ не найден', 404);

    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAdmin && order.user_id !== userId) {
        throw new AppError('У вас нет доступа к этому заказу', 403);
    }

    const payment = await paymentModel.findPaymentByOrderId(orderId);
    if (!payment) {
        return { success: true, refunds: [], total_refunded: 0 };
    }

    const res = await db.query(`
        SELECT r.*, p.amount AS payment_amount
        FROM refunds r
        INNER JOIN payments p ON r.payment_id = p.id
        WHERE r.payment_id = $1
        ORDER BY r.created_at DESC
    `, [payment.id]);

    const totalRefunded = res.rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

    return {
        success:        true,
        refunds:        res.rows,
        total_refunded: totalRefunded,
        payment_amount: parseFloat(payment.amount),
        can_refund_more: totalRefunded < parseFloat(payment.amount),
    };
};

// ─────────────────────────────────────────────────────────────────
// Отменить оплаченный заказ с полным возвратом средств
// ─────────────────────────────────────────────────────────────────
const cancelPaidOrder = async (orderId, reason, userId, role) => {
    const order = await orderModel.getOrderById(orderId);
    if (!order) throw new AppError('Заказ не найден', 404);

    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAdmin && order.user_id !== userId) {
        throw new AppError('У вас нет доступа к этому заказу', 403);
    }

    if (order.status !== 'paid') {
        throw new AppError(
            `Этот метод только для оплаченных заказов. Текущий статус: "${order.status}"`,
            400
        );
    }

    const refundResult = await createRefund(
        orderId,
        { reason: reason || 'Отмена оплаченного заказа' },
        userId,
        role
    );

    return {
        success: true,
        message: 'Оплаченный заказ отменён. Средства будут возвращены в течение 3-5 рабочих дней.',
        data:    refundResult.data,
    };
};

module.exports = {
    createRefund,
    getOrderRefunds,
    cancelPaidOrder,
};