// src/services/paymentService.js
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');
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

    // Подготавливаем данные для ЮKassa (упрощенная версия без чека)
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
        return_url: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/orders/${value.order_id}/success`
      }
    };

    // Создаем платеж в ЮKassa
    const yookassaPayment = await yooKassa.createPayment(
      paymentPayload,
      idempotenceKey
    );

    console.log('Платеж создан в ЮKassa:', {
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
    console.error('Ошибка создания платежа ЮKassa:', err);
    
    // Более подробный лог ошибки
    if (err.response?.data) {
      console.error('Детали ошибки ЮKassa:', JSON.stringify(err.response.data, null, 2));
      throw new AppError(`Ошибка ЮKassa: ${err.response.data.description || 'Неизвестная ошибка'}`, 400);
    }
    
    if (err.message) {
      console.error('Сообщение ошибки:', err.message);
    }
    
    throw new AppError(`Ошибка при создании платежа: ${err.message || 'Неизвестная ошибка'}`, 500);
  }
};

// Получить статус платежа
const getPaymentStatus = async (paymentId) => {
  try {
    const payment = await yooKassa.getPayment(paymentId);
    
    // Обновляем статус в нашей БД
    const dbPayment = await paymentModel.findPaymentByYookassaId(paymentId);
    if (dbPayment) {
      await paymentModel.updatePaymentStatus(
        dbPayment.id, 
        payment.status,
        payment.captured_at || new Date()
      );
      
      // Если платеж успешен, обновляем статус заказа
      if (payment.status === 'succeeded') {
        const order = await orderModel.getOrderById(dbPayment.order_id);
        if (order && order.status === 'pending') {
          // Используем транзакцию для обновления статуса заказа
          const db = require('../config/db');
          const client = await db.pool.connect();
          
          try {
            await client.query('BEGIN');
            
            await orderModel.updateOrderStatus(client, dbPayment.order_id, 'paid');
            await orderModel.addStatusHistory(client, dbPayment.order_id, 'paid', order.user_id);
            
            await client.query('COMMIT');
            
            console.log(`Заказ ${dbPayment.order_id} переведен в статус "paid"`);
          } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка при обновлении статуса заказа:', error);
          } finally {
            client.release();
          }
        }
      }
    }
    
    return payment;
  } catch (err) {
    console.error('Ошибка получения статуса платежа:', err);
    throw new AppError('Не удалось получить статус платежа', 500);
  }
};

// Обработать вебхук от ЮKassa
const handleWebhook = async (webhookData) => {
  try {
    const { type, event, object } = webhookData;
    
    // ЮKassa может отправлять данные в разном формате
    const paymentEvent = event || type;
    const paymentObject = object || webhookData;
    
    console.log('Получен вебхук от ЮKassa:', {
      event: paymentEvent,
      paymentId: paymentObject.id,
      status: paymentObject.status
    });
    
    if (paymentEvent === 'payment.waiting_for_capture') {
      // Платеж ожидает подтверждения (захвата)
      console.log(`Платеж ${paymentObject.id} ожидает подтверждения`);
    }
    
    if (paymentEvent === 'payment.succeeded' || paymentObject.status === 'succeeded') {
      // Платеж успешно завершен
      const dbPayment = await paymentModel.findPaymentByYookassaId(paymentObject.id);
      
      if (dbPayment) {
        // Обновляем статус платежа
        await paymentModel.updatePaymentStatus(
          dbPayment.id, 
          'succeeded',
          paymentObject.captured_at || new Date()
        );
        
        // Обновляем статус заказа
        const order = await orderModel.getOrderById(dbPayment.order_id);
        if (order && order.status === 'pending') {
          const db = require('../config/db');
          const client = await db.pool.connect();
          
          try {
            await client.query('BEGIN');
            
            await orderModel.updateOrderStatus(client, dbPayment.order_id, 'paid');
            await orderModel.addStatusHistory(client, dbPayment.order_id, 'paid', order.user_id);
            
            await client.query('COMMIT');
            
            console.log(`Заказ ${dbPayment.order_id} переведен в статус "paid"`);
          } catch (error) {
            await client.query('ROLLBACK');
            console.error('Ошибка при обновлении статуса заказа:', error);
          } finally {
            client.release();
          }
        }
      }
    }
    
    if (paymentEvent === 'payment.canceled' || paymentObject.status === 'canceled') {
      // Платеж отменен
      const dbPayment = await paymentModel.findPaymentByYookassaId(paymentObject.id);
      
      if (dbPayment) {
        await paymentModel.updatePaymentStatus(dbPayment.id, 'canceled');
        console.log(`Платеж ${paymentObject.id} отменен`);
      }
    }
    
    return { success: true };
    
  } catch (err) {
    console.error('Ошибка обработки вебхука:', err);
    throw err;
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
    console.error('Ошибка проверки платежа:', err);
    throw new AppError('Не удалось проверить статус платежа', 500);
  }
};

module.exports = {
  createYookassaPayment,
  getPaymentStatus,
  handleWebhook,
  checkAndUpdatePayment
};