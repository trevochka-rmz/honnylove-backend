// src/controllers/paymentController.js
const paymentService = require('../services/paymentService');
const orderService = require('../services/orderService');

// Создать платеж для заказа
const createPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    // Проверяем доступ к заказу
    const orderCheck = await orderService.getOrderDetails(orderId, userId, role);
    
    if (!orderCheck.success || !orderCheck.accessible) {
      return res.status(403).json({ 
        error: 'У вас нет доступа к этому заказу' 
      });
    }
    
    const order = orderCheck.order;
    
    // Проверяем, не создан ли уже платеж
    const paymentModel = require('../models/paymentModel');
    const existingPayment = await paymentModel.findPaymentByOrderId(orderId);
    
    if (existingPayment) {
      // Если платеж уже создан, возвращаем его данные
      return res.json({
        success: true,
        payment_id: existingPayment.id,
        yookassa_payment_id: existingPayment.yookassa_payment_id,
        status: existingPayment.status,
        confirmation_url: existingPayment.confirmation_url,
        order_status: order.status
      });
    }
    
    // Проверяем, что сумма заказа > 0
    if (order.total_amount <= 0) {
      return res.status(400).json({ 
        error: 'Сумма заказа должна быть больше 0' 
      });
    }
    
    // Создаем платеж
    const payment = await paymentService.createYookassaPayment({
      order_id: parseInt(orderId),
      amount: parseFloat(order.total_amount),
      description: `Оплата заказа №${orderId}`,
      metadata: {
        user_id: userId,
        user_email: order.user_email
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Платеж создан',
      ...payment
    });
    
  } catch (err) {
    next(err);
  }
};

// Получить статус платежа
const getPaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;
    const role = req.user.role;
    
    // Проверяем доступ к заказу
    const orderCheck = await orderService.getOrderDetails(orderId, userId, role);
    
    if (!orderCheck.success || !orderCheck.accessible) {
      return res.status(403).json({ 
        error: 'У вас нет доступа к этому заказу' 
      });
    }
    
    // Проверяем и обновляем статус платежа
    const result = await paymentService.checkAndUpdatePayment(orderId);
    
    res.json({
      success: true,
      payment_status: result.payment.status,
      order_status: result.order_status,
      payment_details: result.payment
    });
    
  } catch (err) {
    next(err);
  }
};

// Обработать вебхук от ЮKassa (не требует аутентификации!)
const handleWebhook = async (req, res, next) => {
  try {
    // ВАЖНО: ЮKassa отправляет вебхуки без заголовков авторизации
    // Здесь можно добавить проверку подписи вебхука
    
    const webhookData = req.body;
    
    // Обрабатываем вебхук
    await paymentService.handleWebhook(webhookData);
    
    // Всегда возвращаем 200 OK ЮKassa
    res.status(200).send('OK');
    
  } catch (err) {
    console.error('Webhook error:', err);
    // Все равно возвращаем 200, чтобы ЮKassa не пыталась отправить повторно
    res.status(200).send('OK');
  }
};

// Страница успешной оплаты (редирект от ЮKassa)
const paymentSuccess = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    // Обновляем статус платежа
    await paymentService.checkAndUpdatePayment(orderId);
    
    // Редирект на фронтенд с параметром
    const frontendUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/orders/${orderId}?payment=success`);
    
  } catch (err) {
    console.error('Payment success error:', err);
    // Даже при ошибке редиректим пользователя
    const frontendUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/orders?payment=error`);
  }
};

module.exports = {
  createPayment,
  getPaymentStatus,
  handleWebhook,
  paymentSuccess
};