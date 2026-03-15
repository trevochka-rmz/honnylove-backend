// src/services/paymentService.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
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

// Схема для создания платежа
const createPaymentSchema = Joi.object({
  order_id: Joi.number().integer().positive().required(),
  amount: Joi.number().positive().required(),
  description: Joi.string().max(500).optional(),
  metadata: Joi.object().optional()
});

// Создать платеж в ЮKassa
const createYookassaPayment = async (paymentData) => {
  const { error, value } = createPaymentSchema.validate(paymentData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  try {
    // Получаем данные заказа
    const order = await orderModel.getOrderById(value.order_id);
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    // Генерируем ключ идемпотентности
    const idempotenceKey = uuidv4();

    // Подготавливаем данные для ЮKassa
    const paymentPayload = {
      amount: {
        value: value.amount.toFixed(2),
        currency: 'RUB'
      },
      capture: true, // Автоматическое списание
      description: value.description || `Оплата заказа №${value.order_id}`,
      metadata: {
        order_id: value.order_id.toString(),
        user_id: order.user_id?.toString() || '0',
        ...value.metadata
      },
      confirmation: {
        type: 'redirect',
        return_url: `${process.env.APP_BASE_URL || 'https://honnylove.ru'}/api/payments/success/${value.order_id}`
      }
    };

    // Создаем платеж в ЮKassa
    const yookassaPayment = await yooKassa.createPayment(
      paymentPayload,
      idempotenceKey
    );

    console.log('✅ Платеж создан в ЮKassa:', {
      id: yookassaPayment.id,
      status: yookassaPayment.status,
      confirmation_url: yookassaPayment.confirmation?.confirmation_url
    });

    // Сохраняем в нашу БД
    const dbPayment = await paymentModel.createPayment({
      order_id: value.order_id,
      yookassa_payment_id: yookassaPayment.id,
      amount: value.amount,
      status: yookassaPayment.status,
      payment_method: yookassaPayment.payment_method?.type || 'bank_card',
      description: yookassaPayment.description,
      metadata: yookassaPayment.metadata || {},
      confirmation_url: yookassaPayment.confirmation?.confirmation_url
    });

    // Связываем платеж с заказом
    await paymentModel.updateOrderPaymentId(value.order_id, dbPayment.id);

    return {
      payment_id: dbPayment.id,
      yookassa_payment_id: yookassaPayment.id,
      status: yookassaPayment.status,
      confirmation_url: yookassaPayment.confirmation?.confirmation_url,
      amount: value.amount,
      description: yookassaPayment.description
    };

  } catch (err) {
    console.error('❌ Ошибка создания платежа ЮKassa:', err);
    
    if (err.response?.data) {
      console.error('Детали ошибки ЮKassa:', JSON.stringify(err.response.data, null, 2));
      throw new AppError(`Ошибка ЮKassa: ${err.response.data.description || 'Неизвестная ошибка'}`, 400);
    }
    
    throw new AppError(`Ошибка при создании платежа: ${err.message || 'Неизвестная ошибка'}`, 500);
  }
};

// Получить статус платежа
// const getPaymentStatus = async (paymentId) => {
//   try {
//     const payment = await yooKassa.getPayment(paymentId);
    
//     // Обновляем статус в нашей БД
//     const dbPayment = await paymentModel.findPaymentByYookassaId(paymentId);
//     if (dbPayment) {
//       await paymentModel.updatePaymentStatus(
//         dbPayment.id, 
//         payment.status,
//         payment.captured_at || new Date()
//       );
      
//       // ✅ ИСПРАВЛЕНО: Если платеж успешен, обновляем статус заказа
//       if (payment.status === 'succeeded') {
//         const order = await orderModel.getOrderById(dbPayment.order_id);
//         if (order && order.status === 'pending') {
//           const client = await db.pool.connect();
          
//           try {
//             await client.query('BEGIN');
            
//             await orderModel.updateOrderStatus(client, dbPayment.order_id, 'paid');
//             await orderModel.addStatusHistory(client, dbPayment.order_id, 'paid', order.user_id);
            
//             await client.query('COMMIT');
            
//             console.log(`✅ Заказ ${dbPayment.order_id} переведен в статус "paid"`);
//           } catch (error) {
//             await client.query('ROLLBACK');
//             console.error('❌ Ошибка при обновлении статуса заказа:', error);
//           } finally {
//             client.release();
//           }
//         }
//       }
//     }
    
//     return payment;
//   } catch (err) {
//     console.error('❌ Ошибка получения статуса платежа:', err);
//     throw new AppError('Не удалось получить статус платежа', 500);
//   }
// };
const getPaymentStatus = async (paymentId) => {
  try {
    const payment = await yooKassa.getPayment(paymentId);
    
    // Обновляем только статус платежа в нашей БД
    // Заказ НЕ трогаем — это делает только вебхук
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

// ✅ ИСПРАВЛЕНО: Обработать вебхук от ЮKassa
const handleWebhook = async (webhookData) => {
  const client = await db.pool.connect();
  
  try {
    // ШАГ 1: Извлекаем данные
    const { type, event, object } = webhookData;
    const paymentEvent = event || type;
    const paymentObject = object || webhookData;
    
    console.log('═══════════════════════════════════════');
    console.log('📥 WEBHOOK ОТ ЮKASSA');
    console.log('═══════════════════════════════════════');
    console.log('Событие:', paymentEvent);
    console.log('ID платежа:', paymentObject.id);
    console.log('Статус:', paymentObject.status);
    console.log('Сумма:', paymentObject.amount?.value, paymentObject.amount?.currency);
    console.log('Метаданные:', paymentObject.metadata);
    
    // ШАГ 2: Обрабатываем успешный платеж
    if (paymentEvent === 'payment.succeeded' || paymentObject.status === 'succeeded') {
      console.log('✅ Обработка успешного платежа...');
      
      // Находим платеж в БД
      const dbPayment = await paymentModel.findPaymentByYookassaId(paymentObject.id);
      
      if (!dbPayment) {
        console.error('❌ Платеж не найден в БД:', paymentObject.id);
        return { success: false, message: 'Payment not found' };
      }
      
      console.log('Найден платеж:', {
        id: dbPayment.id,
        order_id: dbPayment.order_id,
        current_status: dbPayment.status
      });
      
      // ✅ НАЧИНАЕМ ТРАНЗАКЦИЮ
      await client.query('BEGIN');
      
      try {
        // Обновляем статус платежа
        await client.query(`
          UPDATE payments 
          SET status = $1, captured_at = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $3
        `, ['succeeded', paymentObject.captured_at || new Date(), dbPayment.id]);
        
        console.log('✅ Статус платежа обновлен на "succeeded"');
        
        // Получаем заказ
        const order = await orderModel.getOrderById(dbPayment.order_id);
        
        if (!order) {
          console.error('❌ Заказ не найден:', dbPayment.order_id);
          await client.query('ROLLBACK');
          return { success: false, message: 'Order not found' };
        }
        
        console.log('Найден заказ:', {
          id: order.id,
          current_status: order.status,
          total_amount: order.total_amount
        });
        
        // Обновляем статус заказа (только если pending)
        if (order.status === 'pending') {
          await orderModel.updateOrderStatus(client, dbPayment.order_id, 'paid');
          await orderModel.addStatusHistory(client, dbPayment.order_id, 'paid', order.user_id);
          
          console.log('✅ Заказ переведен в статус "paid"');
        } else {
          console.log(`⚠️ Заказ уже в статусе "${order.status}", пропускаем обновление`);
        }
        
        // Фиксируем транзакцию
        await client.query('COMMIT');
        console.log('✅ Транзакция успешно завершена');
        
        if (order.status === 'pending') {
          const telegramService = require('./telegramService');
          const fullOrder = await orderModel.getOrderById(dbPayment.order_id);
          const orderNumber = `ORD-${String(dbPayment.order_id).padStart(6, '0')}`;
        
          telegramService
            .sendNewOrderNotification(fullOrder, orderNumber)
            .catch(err => console.error('[Telegram] Ошибка уведомления после оплаты:', err));
        }
        // ЗДЕСЬ МОЖНО ДОБАВИТЬ:
        // - Отправку email пользователю
        // - Уведомление менеджера
        // - Webhook в CRM
        
      } catch (transactionError) {
        await client.query('ROLLBACK');
        console.error('❌ Ошибка в транзакции:', transactionError);
        throw transactionError;
      }
    }
    
    // ШАГ 3: Обрабатываем отмененный платеж
    // Обрабатываем отмененный платеж
    if (paymentEvent === 'payment.canceled' || paymentObject.status === 'canceled') {
      console.log('❌ Обработка отмененного платежа...');

      const dbPayment = await paymentModel.findPaymentByYookassaId(paymentObject.id);

      if (dbPayment) {
        await client.query('BEGIN');

        try {
          // Обновляем статус платежа
          await paymentModel.updatePaymentStatus(dbPayment.id, 'canceled');

          // Получаем заказ с товарами
          const order = await orderModel.getOrderById(dbPayment.order_id);

          if (order && order.status === 'pending') {
            // Возвращаем товары на склад
            for (const item of order.items) {
              await orderModel.returnInventory(client, item.product_id, item.quantity);
            }

            // Возвращаем товары в корзину
            await orderModel.returnItemsToCart(client, order.user_id, order.items);

            // Отменяем заказ
            await orderModel.updateOrderStatus(client, dbPayment.order_id, 'cancelled');
            await orderModel.addStatusHistory(client, dbPayment.order_id, 'cancelled', null);

            await client.query('COMMIT');

            console.log(`✅ Заказ #${dbPayment.order_id} отменён, товары возвращены в корзину`);
          } else {
            await client.query('ROLLBACK');
            console.log(`⚠️ Заказ уже в статусе "${order?.status}", пропускаем`);
          }

        } catch (err) {
          await client.query('ROLLBACK');
          console.error('❌ Ошибка при отмене заказа:', err.message);
        }
      }
    }
    
    // ШАГ 4: Ожидание подтверждения
    if (paymentEvent === 'payment.waiting_for_capture') {
      console.log('⏳ Платеж ожидает подтверждения');
    }
    
    console.log('═══════════════════════════════════════');
    console.log('✅ Webhook обработан успешно');
    console.log('═══════════════════════════════════════\n');
    
    return { success: true };
    
  } catch (err) {
    console.error('═══════════════════════════════════════');
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА В WEBHOOK');
    console.error('═══════════════════════════════════════');
    console.error('Ошибка:', err.message);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════\n');
    
    // Откатываем транзакцию если она была начата
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('Ошибка отката:', rollbackError);
    }
    
    return { success: false, error: err.message };
    
  } finally {
    client.release();
  }
};

// Проверить платеж и обновить статус заказа
const checkAndUpdatePayment = async (orderId) => {
  try {
    // Находим платеж для заказа
    const payment = await paymentModel.findPaymentByOrderId(orderId);
    
    if (!payment) {
      throw new AppError('Платеж не найден', 404);
    }
    
    // Получаем актуальный статус от ЮKassa
    const yookassaPayment = await getPaymentStatus(payment.yookassa_payment_id);
    
    return {
      payment: yookassaPayment,
      order_status: await orderModel.getOrderById(orderId).then(o => o?.status)
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
  checkAndUpdatePayment
};