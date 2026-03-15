// src/controllers/paymentController.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
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
    if (existingPayment && existingPayment.status === 'pending') {
      // Проверяем не истёк ли час
      const createdAt = new Date(existingPayment.created_at);
      const now = new Date();
      const diffMinutes = (now - createdAt) / 1000 / 60;

      if (diffMinutes < 55) {
        // Ссылка ещё живая — отдаём её
        return res.json({
          success: true,
          payment_id: existingPayment.id,
          yookassa_payment_id: existingPayment.yookassa_payment_id,
          status: existingPayment.status,
          confirmation_url: existingPayment.confirmation_url,
          order_status: order.status
        });
      }
      // Если прошло больше 55 минут — создаём новый платёж ниже
    }
    
    // Проверяем сумму
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

// ✅ ИСПРАВЛЕНО: Обработать вебхук от ЮKassa
const handleWebhook = async (req, res, next) => {
  try {
    const webhookData = req.body;
    
    console.log('═══════════════════════════════════════');
    console.log('📨 ПОЛУЧЕН WEBHOOK ОТ ЮKASSA');
    console.log('═══════════════════════════════════════');
    console.log('Полные данные:', JSON.stringify(webhookData, null, 2));
    
    // Обрабатываем webhook
    const result = await paymentService.handleWebhook(webhookData);
    
    console.log('Результат обработки:', result);
    console.log('═══════════════════════════════════════\n');
    
    // ✅ ВСЕГДА возвращаем 200 OK ЮKassa
    res.status(200).send('OK');
    
  } catch (err) {
    console.error('═══════════════════════════════════════');
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА В WEBHOOK КОНТРОЛЛЕРЕ');
    console.error('═══════════════════════════════════════');
    console.error('Ошибка:', err.message);
    console.error('Stack:', err.stack);
    console.error('═══════════════════════════════════════\n');
    
    // ✅ ВСЁ РАВНО возвращаем 200 OK
    res.status(200).send('OK');
  }
};

// Страница успешной оплаты (редирект от ЮKassa)
const paymentSuccess = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    
    console.log('═══════════════════════════════════════');
    console.log('🔄 РЕДИРЕКТ ОТ ЮKASSA');
    console.log('═══════════════════════════════════════');
    console.log('Order ID:', orderId);
    
    // Обновляем статус платежа
    await paymentService.checkAndUpdatePayment(orderId);
    
    // Редирект на фронтенд
    const frontendUrl = process.env.FRONTEND_URL || 'https://honnylove.ru';
    const redirectUrl = `${frontendUrl}/order/${orderId}`;
    
    console.log('Редирект на:', redirectUrl);
    console.log('═══════════════════════════════════════\n');
    
    res.redirect(redirectUrl);
    
  } catch (err) {
    console.error('═══════════════════════════════════════');
    console.error('❌ ОШИБКА В PAYMENT SUCCESS');
    console.error('═══════════════════════════════════════');
    console.error('Ошибка:', err.message);
    console.error('═══════════════════════════════════════\n');
    
    // Даже при ошибке редиректим пользователя
    const frontendUrl = process.env.FRONTEND_URL || 'https://honnylove.ru';
    res.redirect(`${frontendUrl}/orders?payment=error`);
  }
};

module.exports = {
  createPayment,
  getPaymentStatus,
  handleWebhook,
  paymentSuccess
};