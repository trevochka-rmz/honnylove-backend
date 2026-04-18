// src/services/paymentService.js
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const orderModel = require('../models/orderModel');
const paymentModel = require('../models/paymentModel');
const AppError = require('../utils/errorUtils');
const emailService = require('./emailService');        
const telegramService = require('./telegramService');
const { YooCheckout } = require('@a2seven/yoo-checkout');

const yooKassa = new YooCheckout({
    shopId:    process.env.YOOKASSA_SHOP_ID,
    secretKey: process.env.YOOKASSA_SECRET_KEY,
});

// ─────────────────────────────────────────────────────────────────
// Создать платёж в ЮKassa
// ─────────────────────────────────────────────────────────────────
const createPaymentSchema = Joi.object({
    order_id:    Joi.number().integer().positive().required(),
    amount:      Joi.number().positive().required(),
    description: Joi.string().max(500).optional(),
    metadata:    Joi.object().optional(),
});

const createYookassaPayment = async (paymentData) => {
    const { error, value } = createPaymentSchema.validate(paymentData);
    if (error) throw new AppError(error.details[0].message, 400);

    try {
        const order = await orderModel.getOrderById(value.order_id);
        if (!order) throw new AppError('Заказ не найден', 404);

        const idempotenceKey = uuidv4();

        const paymentPayload = {
            amount: {
                value:    value.amount.toFixed(2),
                currency: 'RUB',
            },
            capture:     true,
            description: value.description || `Оплата заказа №${value.order_id}`,
            metadata: {
                order_id: value.order_id.toString(),
                user_id:  order.user_id?.toString() || '0',
                ...value.metadata,
            },
            confirmation: {
                type:       'redirect',
                return_url: `${process.env.APP_BASE_URL || 'https://honnylove.ru'}/api/payments/success/${value.order_id}`,
            },
            receipt: {
                customer: { email: order.user_email },
                items: (order.items || []).map(item => ({
                    description:     item.product_name,
                    quantity:        String(item.quantity),
                    amount: {
                        value:    Number(item.discount_price || item.price).toFixed(2),
                        currency: 'RUB',
                    },
                    vat_code:        1,
                    payment_mode:    'full_payment',
                    payment_subject: 'commodity',
                })),
            },
        };

        const yookassaPayment = await yooKassa.createPayment(paymentPayload, idempotenceKey);

        console.log('✅ Платеж создан в ЮKassa:', {
            id:               yookassaPayment.id,
            status:           yookassaPayment.status,
            confirmation_url: yookassaPayment.confirmation?.confirmation_url,
        });

        const dbPayment = await paymentModel.createPayment({
            order_id:            value.order_id,
            yookassa_payment_id: yookassaPayment.id,
            amount:              value.amount,
            status:              yookassaPayment.status,
            payment_method:      yookassaPayment.payment_method?.type || 'bank_card',
            description:         yookassaPayment.description,
            metadata:            yookassaPayment.metadata || {},
            confirmation_url:    yookassaPayment.confirmation?.confirmation_url,
        });

        await paymentModel.updateOrderPaymentId(value.order_id, dbPayment.id);

        return {
            payment_id:          dbPayment.id,
            yookassa_payment_id: yookassaPayment.id,
            status:              yookassaPayment.status,
            confirmation_url:    yookassaPayment.confirmation?.confirmation_url,
            amount:              value.amount,
            description:         yookassaPayment.description,
        };

    } catch (err) {
        console.error('❌ Ошибка создания платежа ЮKassa:', err);
        if (err.response?.data) {
            throw new AppError(`Ошибка ЮKassa: ${err.response.data.description || 'Неизвестная ошибка'}`, 400);
        }
        throw new AppError(`Ошибка при создании платежа: ${err.message || 'Неизвестная ошибка'}`, 500);
    }
};

// ─────────────────────────────────────────────────────────────────
// Получить статус платежа (обновляет только payment, не заказ)
// ─────────────────────────────────────────────────────────────────
const getPaymentStatus = async (paymentId) => {
    try {
        const payment = await yooKassa.getPayment(paymentId);

        const dbPayment = await paymentModel.findPaymentByYookassaId(paymentId);
        if (dbPayment) {
            await paymentModel.updatePaymentStatus(
                dbPayment.id,
                payment.status,
                payment.captured_at || null
            );
        }

        return payment;
    } catch (err) {
        console.error('❌ Ошибка получения статуса платежа:', err);
        throw new AppError('Не удалось получить статус платежа', 500);
    }
};

// ─────────────────────────────────────────────────────────────────
// Обработать вебхук от ЮKassa
// ─────────────────────────────────────────────────────────────────
const handleWebhook = async (webhookData) => {
    const client = await db.pool.connect();

    try {
        const { type, event, object } = webhookData;
        const paymentEvent  = event || type;
        const paymentObject = object || webhookData;

        console.log('═══════════════════════════════════════');
        console.log('📥 WEBHOOK ОТ ЮKASSA');
        console.log('Событие:', paymentEvent);
        console.log('ID платежа:', paymentObject.id);
        console.log('Статус:', paymentObject.status);
        console.log('═══════════════════════════════════════');

        // ── Успешная оплата ────────────────────────────────────────
        if (paymentEvent === 'payment.succeeded' || paymentObject.status === 'succeeded') {
            console.log('✅ Обработка успешного платежа...');

            const dbPayment = await paymentModel.findPaymentByYookassaId(paymentObject.id);
            if (!dbPayment) {
                console.error('❌ Платеж не найден в БД:', paymentObject.id);
                return { success: false, message: 'Payment not found' };
            }

            await client.query('BEGIN');
            try {
                await client.query(`
                    UPDATE payments
                    SET status = $1, captured_at = $2, updated_at = CURRENT_TIMESTAMP
                    WHERE id = $3
                `, ['succeeded', paymentObject.captured_at || new Date(), dbPayment.id]);

                const order = await orderModel.getOrderById(dbPayment.order_id);
                if (!order) {
                    console.error('❌ Заказ не найден:', dbPayment.order_id);
                    await client.query('ROLLBACK');
                    return { success: false, message: 'Order not found' };
                }

                const wasUpdated = order.status === 'pending';
                if (wasUpdated) {
                    await orderModel.updateOrderStatus(client, dbPayment.order_id, 'paid');
                    await orderModel.addStatusHistory(client, dbPayment.order_id, 'paid', order.user_id);
                    console.log('✅ Заказ переведен в статус "paid"');
                }

                await client.query('COMMIT');

                if (wasUpdated) {
                    const fullOrder    = await orderModel.getOrderById(dbPayment.order_id);
                    const orderNumber  = `ORD-${String(dbPayment.order_id).padStart(6, '0')}`;

                    telegramService
                        .sendNewOrderNotification(fullOrder, orderNumber)
                        .catch(err => console.error('[Telegram]', err));

                    emailService.sendOrderConfirmation(fullOrder.user_email, {
                        orderNumber,
                        order: fullOrder,
                    }).catch(err => console.error('[Email]', err));
                }

            } catch (txErr) {
                await client.query('ROLLBACK');
                console.error('❌ Ошибка в транзакции:', txErr);
                throw txErr;
            }
        }

        // ── Отменённый платёж ──────────────────────────────────────
        // ИСПРАВЛЕНО: returnInventory и returnItemsToCart теперь с variant_id
        if (paymentEvent === 'payment.canceled' || paymentObject.status === 'canceled') {
            console.log('❌ Обработка отменённого платежа...');

            const dbPayment = await paymentModel.findPaymentByYookassaId(paymentObject.id);
            if (dbPayment) {
                await client.query('BEGIN');
                try {
                    await paymentModel.updatePaymentStatus(dbPayment.id, 'canceled');

                    const order = await orderModel.getOrderById(dbPayment.order_id);

                    if (order && order.status === 'pending') {
                        // Возвращаем каждый товар с его variant_id
                        // item.variant_id теперь есть в getOrderById (после нашего исправления)
                        for (const item of (order.items || [])) {
                            await orderModel.returnInventory(
                                client,
                                item.product_id,
                                item.quantity,
                                item.variant_id ?? null   // ← ИСПРАВЛЕНО
                            );
                        }

                        // Возвращаем в корзину (тоже с variant_id — orderModel уже исправлен)
                        await orderModel.returnItemsToCart(client, order.user_id, order.items || []);

                        await orderModel.updateOrderStatus(client, dbPayment.order_id, 'cancelled');
                        await orderModel.addStatusHistory(client, dbPayment.order_id, 'cancelled', null);

                        await client.query('COMMIT');
                        console.log(`✅ Заказ #${dbPayment.order_id} отменён, товары возвращены в корзину`);

                        const fullOrder   = await orderModel.getOrderById(dbPayment.order_id);
                        const orderNumber = `ORD-${String(dbPayment.order_id).padStart(6, '0')}`;

                        telegramService
                            .sendPaymentCancelledNotification(fullOrder, orderNumber)
                            .catch(err => console.error('[Telegram]', err));

                    } else {
                        await client.query('ROLLBACK');
                        console.log(`⚠️ Заказ уже в статусе "${order?.status}", пропускаем`);
                    }

                } catch (txErr) {
                    await client.query('ROLLBACK');
                    console.error('❌ Ошибка при отмене заказа:', txErr.message);
                }
            }
        }

        if (paymentEvent === 'payment.waiting_for_capture') {
            console.log('⏳ Платеж ожидает подтверждения');
        }

        console.log('✅ Webhook обработан успешно\n');
        return { success: true };

    } catch (err) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА В WEBHOOK:', err.message);
        try { await client.query('ROLLBACK'); } catch {}
        return { success: false, error: err.message };
    } finally {
        client.release();
    }
};

// ─────────────────────────────────────────────────────────────────
// Проверить платёж и обновить статус заказа
// ─────────────────────────────────────────────────────────────────
const checkAndUpdatePayment = async (orderId) => {
    try {
        const payment = await paymentModel.findPaymentByOrderId(orderId);
        if (!payment) throw new AppError('Платеж не найден', 404);

        const yookassaPayment = await getPaymentStatus(payment.yookassa_payment_id);

        return {
            payment:      yookassaPayment,
            order_status: await orderModel.getOrderById(orderId).then(o => o?.status),
        };
    } catch (err) {
        console.error('❌ Ошибка проверки платежа:', err);
        throw new AppError('Не удалось проверить статус платежа', 500);
    }
};

module.exports = {
    createYookassaPayment,
    getPaymentStatus,
    handleWebhook,
    checkAndUpdatePayment,
};