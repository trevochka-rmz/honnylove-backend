// src/services/refundService.js - НОВЫЙ ФАЙЛ
const Joi = require('joi');
const db = require('../config/db');
const orderModel = require('../models/orderModel');
const paymentModel = require('../models/paymentModel');
const AppError = require('../utils/errorUtils');
const { YooCheckout } = require('@a2seven/yoo-checkout');

// Инициализация ЮKassa
const yooKassa = new YooCheckout({
  shopId: process.env.YOOKASSA_SHOP_ID,
  secretKey: process.env.YOOKASSA_SECRET_KEY
});

// Схема для создания возврата
const createRefundSchema = Joi.object({
  amount: Joi.number().positive().optional(),
  reason: Joi.string().max(1000).required()
    .messages({
      'string.empty': 'Укажите причину возврата',
      'any.required': 'Причина возврата обязательна'
    })
});

/**
 * Создать возврат средств (полный или частичный)
 */
const createRefund = async (orderId, refundData, userId, role) => {
  const { error, value } = createRefundSchema.validate(refundData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Получаем заказ
    const order = await orderModel.getOrderById(orderId);
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    // 2. Проверяем права доступа
    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAdmin && order.user_id !== userId) {
      throw new AppError('У вас нет доступа к этому заказу', 403);
    }

    // 3. Проверяем статус заказа
    if (!['paid', 'processing', 'shipped', 'delivered'].includes(order.status)) {
      throw new AppError(
        `Нельзя сделать возврат для заказа в статусе "${order.status}". ` +
        `Возврат возможен только для оплаченных заказов.`,
        400
      );
    }

    // 4. Находим платеж
    const payment = await paymentModel.findPaymentByOrderId(orderId);
    if (!payment) {
      throw new AppError('Платеж не найден для этого заказа', 404);
    }

    if (payment.status !== 'succeeded') {
      throw new AppError(
        `Нельзя сделать возврат для платежа в статусе "${payment.status}"`,
        400
      );
    }

    // 5. Определяем сумму возврата
    const refundAmount = value.amount || parseFloat(order.total_amount);

    // Проверяем, что сумма не превышает оплаченную
    const alreadyRefunded = parseFloat(payment.refund_amount || 0);
    const maxRefundable = parseFloat(payment.amount) - alreadyRefunded;

    if (refundAmount > maxRefundable) {
      throw new AppError(
        `Сумма возврата ${refundAmount} ₽ превышает доступную для возврата ` +
        `${maxRefundable} ₽ (уже возвращено: ${alreadyRefunded} ₽)`,
        400
      );
    }

    console.log('═══════════════════════════════════════');
    console.log('💰 СОЗДАНИЕ ВОЗВРАТА');
    console.log('═══════════════════════════════════════');
    console.log('Заказ:', orderId);
    console.log('Платеж ЮKassa:', payment.yookassa_payment_id);
    console.log('Сумма возврата:', refundAmount, '₽');
    console.log('Причина:', value.reason);

    // 6. Создаем возврат в ЮKassa
    const yookassaRefund = await yooKassa.createRefund({
      payment_id: payment.yookassa_payment_id,
      amount: {
        value: refundAmount.toFixed(2),
        currency: 'RUB'
      },
      description: value.reason
    });

    console.log('✅ Возврат создан в ЮKassa:', {
      id: yookassaRefund.id,
      status: yookassaRefund.status
    });

    // 7. Сохраняем возврат в нашу БД
    const dbRefundRes = await client.query(`
      INSERT INTO refunds (
        payment_id,
        yookassa_refund_id,
        amount,
        status,
        reason,
        metadata,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      payment.id,
      yookassaRefund.id,
      refundAmount,
      yookassaRefund.status,
      value.reason,
      JSON.stringify(yookassaRefund)
    ]);

    const dbRefund = dbRefundRes.rows[0];

    // 8. Обновляем информацию о возврате в платеже
    const newRefundAmount = alreadyRefunded + refundAmount;
    await client.query(`
      UPDATE payments
      SET 
        refund_amount = $1,
        refund_reason = $2,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `, [newRefundAmount, value.reason, payment.id]);

    // 9. Обновляем статус заказа
    const isFullRefund = newRefundAmount >= parseFloat(payment.amount);
    const newOrderStatus = isFullRefund ? 'returned' : order.status;

    if (newOrderStatus !== order.status) {
      await orderModel.updateOrderStatus(client, orderId, newOrderStatus);
      await orderModel.addStatusHistory(client, orderId, newOrderStatus, userId);
      console.log(`✅ Статус заказа изменен: ${order.status} → ${newOrderStatus}`);
    }

    // 10. Возвращаем товары на склад (если полный возврат)
    if (isFullRefund) {
      console.log('📦 Возврат товаров на склад...');
      for (const item of order.items) {
        await orderModel.returnInventory(client, item.product_id, item.quantity);
        console.log(`  ✅ ${item.product_name}: +${item.quantity} шт`);
      }
    }

    await client.query('COMMIT');

    console.log('═══════════════════════════════════════');
    console.log('✅ ВОЗВРАТ УСПЕШНО СОЗДАН');
    console.log('═══════════════════════════════════════\n');

    // 11. Получаем обновленный заказ
    const updatedOrder = await orderModel.getOrderById(orderId);

    return {
      success: true,
      message: isFullRefund 
        ? 'Полный возврат средств оформлен. Товары возвращены на склад.'
        : `Частичный возврат оформлен: ${refundAmount} ₽`,
      data: {
        refund: {
          id: dbRefund.id,
          yookassa_refund_id: yookassaRefund.id,
          amount: refundAmount,
          status: yookassaRefund.status,
          reason: value.reason,
          created_at: dbRefund.created_at
        },
        order: updatedOrder,
        is_full_refund: isFullRefund,
        total_refunded: newRefundAmount
      }
    };

  } catch (err) {
    await client.query('ROLLBACK');

    if (err instanceof AppError) {
      throw err;
    }

    console.error('═══════════════════════════════════════');
    console.error('❌ ОШИБКА СОЗДАНИЯ ВОЗВРАТА');
    console.error('═══════════════════════════════════════');
    console.error('Ошибка:', err.message);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════\n');

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

/**
 * Получить список возвратов для заказа
 */
const getOrderRefunds = async (orderId, userId, role) => {
  try {
    // Проверяем доступ к заказу
    const order = await orderModel.getOrderById(orderId);
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAdmin && order.user_id !== userId) {
      throw new AppError('У вас нет доступа к этому заказу', 403);
    }

    // Получаем платеж
    const payment = await paymentModel.findPaymentByOrderId(orderId);
    if (!payment) {
      return {
        success: true,
        refunds: [],
        total_refunded: 0
      };
    }

    // Получаем все возвраты для платежа
    const res = await db.query(`
      SELECT 
        r.*,
        p.amount as payment_amount
      FROM refunds r
      INNER JOIN payments p ON r.payment_id = p.id
      WHERE r.payment_id = $1
      ORDER BY r.created_at DESC
    `, [payment.id]);

    const totalRefunded = res.rows.reduce(
      (sum, refund) => sum + parseFloat(refund.amount),
      0
    );

    return {
      success: true,
      refunds: res.rows,
      total_refunded: totalRefunded,
      payment_amount: parseFloat(payment.amount),
      can_refund_more: totalRefunded < parseFloat(payment.amount)
    };

  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка получения возвратов:', err);
    throw new AppError('Не удалось получить список возвратов', 500);
  }
};

/**
 * Отменить ОПЛАЧЕННЫЙ заказ (с возвратом средств)
 */
const cancelPaidOrder = async (orderId, reason, userId, role) => {
  try {
    // 1. Проверяем заказ
    const order = await orderModel.getOrderById(orderId);
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    // 2. Проверяем права
    const isAdmin = role === 'admin' || role === 'manager';
    if (!isAdmin && order.user_id !== userId) {
      throw new AppError('У вас нет доступа к этому заказу', 403);
    }

    // 3. Проверяем статус
    if (order.status !== 'paid') {
      throw new AppError(
        `Этот метод только для оплаченных заказов. ` +
        `Текущий статус: "${order.status}"`,
        400
      );
    }

    // 4. Создаем возврат (полный)
    const refundResult = await createRefund(
      orderId,
      {
        reason: reason || 'Отмена оплаченного заказа'
      },
      userId,
      role
    );

    // 5. Возврат автоматически переведет заказ в статус "returned"
    // и вернет товары на склад

    return {
      success: true,
      message: 'Оплаченный заказ отменен. Средства будут возвращены в течение 3-5 рабочих дней.',
      data: refundResult.data
    };

  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка отмены оплаченного заказа:', err);
    throw new AppError('Не удалось отменить заказ', 500);
  }
};

module.exports = {
  createRefund,
  getOrderRefunds,
  cancelPaidOrder
};