// src/services/orderService.js 
const Joi = require('joi');
const db = require('../config/db');
const orderModel = require('../models/orderModel');
const AppError = require('../utils/errorUtils');

// Схема создания заказа от Админа
const createAdminOrderSchema = Joi.object({
  user_id: Joi.number().integer().positive().required()
    .messages({
      'number.base': 'ID пользователя должен быть числом',
      'any.required': 'Укажите ID пользователя'
    }),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().positive().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  ).min(1).required()
    .messages({
      'array.min': 'Должен быть хотя бы один товар',
      'any.required': 'Укажите товары для заказа'
    }),
  shipping_address: Joi.string().min(10).max(500).required()
    .messages({
      'string.empty': 'Укажите адрес доставки',
      'string.min': 'Адрес должен содержать минимум 10 символов',
      'string.max': 'Адрес не должен превышать 500 символов'
    }),
  payment_method: Joi.string()
    .valid('card', 'cash', 'online', 'bank_transfer')
    .required()
    .messages({
      'any.only': 'Неверный способ оплаты. Доступны: card, cash, online, bank_transfer',
      'any.required': 'Укажите способ оплаты'
    }),
  notes: Joi.string().max(1000).optional().allow(''),
  shipping_cost: Joi.number().min(0).default(0),
  tax_amount: Joi.number().min(0).default(0),
  discount_amount: Joi.number().min(0).default(0),
  tracking_number: Joi.string().max(100).optional().allow(null, '')
});

// Схема для оформления заказа
const checkoutSchema = Joi.object({
  shipping_address: Joi.string().min(10).max(500).required()
    .messages({
      'string.empty': 'Укажите адрес доставки',
      'any.required': 'Адрес доставки обязателен'
    }),
  payment_method: Joi.string()
    .valid('card', 'cash', 'online', 'sbp')
    .required()
    .messages({
      'any.only': 'Неверный способ оплаты. Доступны: card, cash, online, sbp',
      'any.required': 'Укажите способ оплаты'
    }),
  notes: Joi.string().max(1000).optional().allow(''),
  shipping_cost: Joi.number().min(0).default(0),
  tax_amount: Joi.number().min(0).default(0),
  discount_amount: Joi.number().min(0).default(0),
  selected_items: Joi.array()
    .items(Joi.number().integer().positive())
    .min(1)
    .required()
    .messages({
      'array.min': 'Выберите хотя бы один товар для оформления',
      'any.required': 'Не указаны товары для оформления'
    })
});

// Схема для обновления заказа
const updateOrderSchema = Joi.object({
  shipping_address: Joi.string().min(10).max(500).optional(),
  payment_method: Joi.string().valid('card', 'cash', 'online', 'sbp').optional(),
  shipping_cost: Joi.number().min(0).optional(),
  tax_amount: Joi.number().min(0).optional(),
  discount_amount: Joi.number().min(0).optional(),
  tracking_number: Joi.string().max(100).optional().allow(null, ''),
  notes: Joi.string().max(1000).optional().allow(''),
});

// Схема для добавления товара в заказ
const addOrderItemSchema = Joi.object({
  product_id: Joi.number().integer().positive().required(),
  quantity: Joi.number().integer().min(1).required(),
});


//ДОСТУПНЫЕ СТАТУСЫ ЗАКАЗОВ
const ORDER_STATUSES = [
  'pending',      // Ожидает обработки
  'paid',         // Оплачен
  'processing',   // В обработке
  'shipped',      // Отправлен
  'delivered',    // Доставлен
  'cancelled',    // Отменен
  'returned',     // Возвращен
  'completed'     // Завершен
];

// Статусы, из которых можно отменить заказ
const CANCELLABLE_STATUSES = ['pending', 'paid', 'processing'];

// Статусы, которые можно удалить
const DELETABLE_STATUSES = ['pending', 'cancelled'];

// СОЗДАНИЕ ЗАКАЗА
// Оформить заказ из корзины
const createOrder = async (userId, orderData) => {
  const { error, value } = checkoutSchema.validate(orderData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Получаем ТОЛЬКО выбранные товары из корзины
    const cartItems = await orderModel.getSelectedCartItemsWithDetails(
      client, 
      userId, 
      value.selected_items
    );
    
    if (!cartItems || cartItems.length === 0) {
      throw new AppError('Выбранные товары не найдены в корзине', 400);
    }
    
    // Проверяем активность товаров и наличие на складе
    const insufficientItems = [];
    for (const item of cartItems) {
      if (!item.is_active) {
        throw new AppError(
          `Товар "${item.name}" больше недоступен для заказа`,
          400
        );
      }
      const inventoryCheck = await orderModel.checkInventory(
        client,
        item.product_id,
        item.cart_quantity
      );
      if (!inventoryCheck.sufficient) {
        insufficientItems.push({
          product_id: item.product_id,
          name: item.name,
          sku: item.sku,
          available: inventoryCheck.available,
          required: item.cart_quantity,
          shortage: inventoryCheck.shortage
        });
      }
    }
    if (insufficientItems.length > 0) {
      throw new AppError(
        'Недостаточно товаров на складе. Смотрите детали.',
        400,
        { insufficientItems }
      );
    }
    
    // Рассчитываем итоговую сумму
    const subtotal = cartItems.reduce((sum, item) => {
      return sum + (item.final_price * item.cart_quantity);
    }, 0);
    
    const total_amount = 
      subtotal + 
      value.shipping_cost + 
      value.tax_amount - 
      value.discount_amount;
    
    if (total_amount < 0) {
      throw new AppError('Итоговая сумма заказа не может быть отрицательной', 400);
    }
    
    // Создаем заказ
    const newOrder = await orderModel.createOrder(client, {
      user_id: userId,
      total_amount,
      shipping_address: value.shipping_address,
      payment_method: value.payment_method,
      shipping_cost: value.shipping_cost,
      tax_amount: value.tax_amount,
      discount_amount: value.discount_amount,
      notes: value.notes || ''
    });
    
    // Добавляем товары в заказ и списываем со склада
    for (const item of cartItems) {
      await orderModel.addOrderItem(client, {
        order_id: newOrder.id,
        product_id: item.product_id,
        quantity: item.cart_quantity,
        price: item.retail_price,
        discount_price: item.discount_price
      });
      
      await orderModel.decreaseInventory(
        client, 
        item.product_id, 
        item.cart_quantity
      );
    }
    
    // Добавляем запись в историю статусов
    await orderModel.addStatusHistory(client, newOrder.id, 'pending', userId);
    
    // ✅ Удаляем ТОЛЬКО выбранные товары из корзины
    await orderModel.removeSelectedCartItems(client, userId, value.selected_items);
    
    await client.query('COMMIT');
    
    // Получаем полную информацию о созданном заказе
    const fullOrder = await orderModel.getOrderById(newOrder.id);
    
    return {
      success: true,
      message: 'Заказ успешно оформлен',
      data: {
        order: fullOrder,
        order_number: `ORD-${String(newOrder.id).padStart(6, '0')}`,
        items_count: cartItems.length,
        needs_payment: ['card', 'online', 'sbp'].includes(value.payment_method)
      }
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при создании заказа:', err);
    throw new AppError(
      'Произошла ошибка при оформлении заказа: ' + err.message, 
      500
    );
  } finally {
    client.release();
  }
};

/**
 * ✅ НОВЫЙ МЕТОД: Оформить заказ с немедленной оплатой
 * Для способов оплаты: card, online, sbp
 */
const createOrderWithPayment = async (userId, orderData) => {
  try {
    // 1. Проверяем способ оплаты
    if (!['card', 'online', 'sbp'].includes(orderData.payment_method)) {
      throw new AppError(
        'Этот метод только для онлайн-оплаты (card, online, sbp). ' +
        'Для оплаты наличными используйте обычное оформление заказа.',
        400
      );
    }
    
    // 2. Создаем заказ
    const orderResult = await createOrder(userId, orderData);
    
    if (!orderResult.success) {
      return orderResult;
    }
    
    const orderId = orderResult.data.order.id;
    const orderAmount = orderResult.data.order.total_amount;
    
    // 3. Создаем платеж через paymentService
    const paymentService = require('./paymentService');
    
    const payment = await paymentService.createYookassaPayment({
      order_id: orderId,
      amount: orderAmount,
      description: `Оплата заказа №${orderId}`,
      metadata: {
        user_id: userId,
        order_number: orderResult.data.order_number
      }
    });
    
    return {
      success: true,
      message: 'Заказ оформлен. Перейдите к оплате.',
      data: {
        order: orderResult.data.order,
        order_number: orderResult.data.order_number,
        payment: {
          confirmation_url: payment.confirmation_url,
          payment_id: payment.payment_id,
          yookassa_payment_id: payment.yookassa_payment_id,
          status: payment.status,
          amount: payment.amount
        }
      }
    };
    
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при создании заказа с оплатой:', err);
    throw new AppError('Не удалось оформить заказ с оплатой: ' + err.message, 500);
  }
};


// Создать заказ от имени администратора
const createAdminOrder = async (adminUserId, orderData) => {
  const { error, value } = createAdminOrderSchema.validate(orderData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Проверяем существование пользователя
    const userRes = await client.query('SELECT id FROM users WHERE id = $1 AND is_active = true', [value.user_id]);
    if (userRes.rowCount === 0) {
      throw new AppError('Пользователь не найден или неактивен', 404);
    }

    // 2. Получаем детали товаров (аналогично getCartItemsWithDetails, но по items)
    const items = [];
    let subtotal = 0;
    for (const item of value.items) {
      const productRes = await client.query(`
        SELECT
          id,
          name,
          sku,
          retail_price,
          discount_price,
          is_active,
          COALESCE(discount_price, retail_price) as final_price
        FROM product_products
        WHERE id = $1 AND is_active = true
      `, [item.product_id]);
      if (productRes.rowCount === 0) {
        throw new AppError(`Товар с ID ${item.product_id} не найден или недоступен`, 404);
      }
      const product = productRes.rows[0];
      const lineTotal = product.final_price * item.quantity;
      subtotal += lineTotal;
      items.push({
        ...product,
        cart_quantity: item.quantity, // для совместимости с checkInventory
        final_price: product.final_price
      });
    }
    if (items.length === 0) {
      throw new AppError('Нет товаров для заказа', 400);
    }

    // 3. Проверяем наличие на складе
    const insufficientItems = [];
    for (const item of items) {
      const inventoryCheck = await orderModel.checkInventory(client, item.id, item.cart_quantity);
      if (!inventoryCheck.sufficient) {
        insufficientItems.push({
          product_id: item.id,
          name: item.name,
          sku: item.sku,
          available: inventoryCheck.available,
          required: item.cart_quantity,
          shortage: inventoryCheck.shortage
        });
      }
    }
    if (insufficientItems.length > 0) {
      throw new AppError(
        'Недостаточно товаров на складе. Смотрите детали.',
        400,
        { insufficientItems }
      );
    }

    // 4. Рассчитываем итоговую сумму
    const total_amount = subtotal + value.shipping_cost + value.tax_amount - value.discount_amount;
    if (total_amount < 0) {
      throw new AppError('Итоговая сумма заказа не может быть отрицательной', 400);
    }

    // 5. Создаем заказ
    const newOrder = await orderModel.createOrder(client, {
      user_id: value.user_id,
      total_amount,
      shipping_address: value.shipping_address,
      payment_method: value.payment_method,
      shipping_cost: value.shipping_cost,
      tax_amount: value.tax_amount,
      discount_amount: value.discount_amount,
      notes: value.notes || '',
      tracking_number: value.tracking_number
    });

    // 6. Добавляем товары в заказ и списываем со склада
    for (const item of items) {
      await orderModel.addOrderItem(client, {
        order_id: newOrder.id,
        product_id: item.id,
        quantity: item.cart_quantity,
        price: item.retail_price,
        discount_price: item.discount_price
      });
      await orderModel.decreaseInventory(client, item.id, item.cart_quantity);
    }

    // 7. Добавляем запись в историю статусов (от имени админа)
    await orderModel.addStatusHistory(client, newOrder.id, 'pending', adminUserId);

    await client.query('COMMIT');

    // 8. Получаем полную информацию о созданном заказе
    const fullOrder = await orderModel.getOrderById(newOrder.id);
    return {
      success: true,
      message: 'Заказ успешно создан администратором',
      data: {
        order: fullOrder,
        order_number: `ORD-${String(newOrder.id).padStart(6, '0')}`
      }
    };
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при создании заказа администратором:', err);
    throw new AppError('Произошла ошибка при создании заказа: ' + err.message, 500);
  } finally {
    client.release();
  }
};


// ПОЛУЧЕНИЕ ЗАКАЗОВ
// Получить заказы пользователя с пагинацией
const getUserOrders = async (userId, page = 1, limit = 10) => {
  try {
    const offset = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      orderModel.getUserOrders(userId, limit, offset),
      orderModel.getUserOrdersCount(userId)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages,
        hasMore: page < totalPages
      }
    };
  } catch (err) {
    console.error('Ошибка при получении заказов пользователя:', err);
    throw new AppError('Не удалось получить список заказов', 500);
  }
};

// Получить все заказы (для админа) с фильтрацией
const getAllOrders = async (filters = {}, page = 1, limit = 20) => {
  try {
    const offset = (page - 1) * limit;
    
    const [orders, total] = await Promise.all([
      orderModel.getAllOrders(filters, limit, offset),
      orderModel.getAllOrdersCount(filters)
    ]);
    
    const totalPages = Math.ceil(total / limit);
    
    return {
      success: true,
      orders,
      pagination: {
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages,
        hasMore: page < totalPages
      }
    };
  } catch (err) {
    console.error('Ошибка при получении всех заказов:', err);
    throw new AppError('Не удалось получить список заказов', 500);
  }
};

// Получить детали заказа
const getOrderDetails = async (orderId, userId = null, role = 'customer') => {
  try {
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }

    const isAdmin = role === 'admin' || role === 'manager';
    const isOwner = order.user_id === userId;
    
    if (!isAdmin && !isOwner) {
      throw new AppError('У вас нет доступа к этому заказу', 403);
    }
    
    return {
      success: true,
      order,
      accessible: true
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при получении деталей заказа:', err);
    throw new AppError('Не удалось получить детали заказа', 500);
  }
};

// ОБНОВЛЕНИЕ ЗАКАЗА
// Обновить статус заказа
const updateOrderStatus = async (orderId, newStatus, changerUserId, notes = '') => {
  if (!ORDER_STATUSES.includes(newStatus)) {
    throw new AppError(
      `Недопустимый статус. Доступные: ${ORDER_STATUSES.join(', ')}`,
      400
    );
  }
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Получаем текущий заказ
    const currentOrder = await orderModel.getOrderById(orderId);
    
    if (!currentOrder) {
      throw new AppError('Заказ не найден', 404);
    }
    
    const oldStatus = currentOrder.status;
    
    // Если статус не изменился
    if (oldStatus === newStatus) {
      throw new AppError('Новый статус совпадает с текущим', 400);
    }
    
    // Обновляем статус
    const updatedOrder = await orderModel.updateOrderStatus(
      client, 
      orderId, 
      newStatus
    );
    
    // Добавляем в историю
    await orderModel.addStatusHistory(
      client, 
      orderId, 
      newStatus, 
      changerUserId
    );
    
    // Если отменяем заказ - возвращаем товары на склад
    if (newStatus === 'cancelled' && oldStatus !== 'cancelled') {
      const items = currentOrder.items || [];
      
      for (const item of items) {
        await orderModel.returnInventory(
          client, 
          item.product_id, 
          item.quantity
        );
      }
    }
    
    // Если восстанавливаем из отмененного - списываем со склада
    if (oldStatus === 'cancelled' && newStatus !== 'cancelled') {
      const items = currentOrder.items || [];
      const insufficientItems = [];
      for (const item of items) {
        const inventoryCheck = await orderModel.checkInventory(
          client,
          item.product_id,
          item.quantity
        );
        if (!inventoryCheck.sufficient) {
          insufficientItems.push({
            product_id: item.product_id,
            name: item.product_name,
            sku: item.product_sku,
            available: inventoryCheck.available,
            required: item.quantity,
            shortage: inventoryCheck.shortage
          });
        }
      }
      if (insufficientItems.length > 0) {
        throw new AppError(
          'Недостаточно товаров на складе для восстановления заказа. Смотрите детали.',
          400,
          { insufficientItems }
        );
      }
      for (const item of items) {
        await orderModel.decreaseInventory(
          client,
          item.product_id,
          item.quantity
        );
      }
    }
    
    await client.query('COMMIT');
    
    // Получаем обновленную информацию
    const fullOrder = await orderModel.getOrderById(orderId);
    
    return {
      success: true,
      message: `Статус заказа изменен с "${oldStatus}" на "${newStatus}"`,
      data: {
        order: fullOrder
      }
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при обновлении статуса:', err);
    throw new AppError('Не удалось обновить статус заказа', 500);
  } finally {
    client.release();
  }
};

/**
 * Обновить данные заказа (адрес, способ оплаты и т.д.)
 */
const updateOrder = async (orderId, updateData, userId, role) => {
  const { error, value } = updateOrderSchema.validate(updateData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем существование заказа и права доступа
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    const isAdmin = role === 'admin' || role === 'manager';
    
    if (!isAdmin) {
      throw new AppError('Только администратор может редактировать заказы', 403);
    }
    
    // Обновляем заказ
    const updatedOrder = await orderModel.updateOrder(client, orderId, value);
    
    await client.query('COMMIT');
    
    // Получаем полную информацию
    const fullOrder = await orderModel.getOrderById(orderId);
    
    return {
      success: true,
      message: 'Заказ успешно обновлен',
      data: {
        order: fullOrder
      }
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при обновлении заказа:', err);
    throw new AppError('Не удалось обновить заказ', 500);
  } finally {
    client.release();
  }
};

// ОТМЕНА ЗАКАЗА
// Отменить заказ (для пользователя)
const cancelOrder = async (userId, orderId, reason = '') => {
  try {
    // Проверяем права и возможность отмены
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    if (order.user_id !== userId) {
      throw new AppError('У вас нет доступа к этому заказу', 403);
    }
    
    if (!CANCELLABLE_STATUSES.includes(order.status)) {
      throw new AppError(
        `Нельзя отменить заказ в статусе "${order.status}". ` +
        `Отмена возможна только для статусов: ${CANCELLABLE_STATUSES.join(', ')}`,
        400
      );
    }
    
    // Отменяем через обновление статуса
    return await updateOrderStatus(orderId, 'cancelled', userId, reason);
    
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при отмене заказа:', err);
    throw new AppError('Не удалось отменить заказ', 500);
  }
};

// РАБОТА С ТОВАРАМИ В ЗАКАЗЕ
// Добавить товар в существующий заказ
const addItemToOrder = async (orderId, itemData, userId, role) => {
  const { error, value } = addOrderItemSchema.validate(itemData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }
  
  const isAdmin = role === 'admin' || role === 'manager';
  
  if (!isAdmin) {
    throw new AppError('Только администратор может добавлять товары в заказы', 403);
  }
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем заказ
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    // Получаем информацию о товаре
    const productRes = await client.query(
      'SELECT * FROM product_products WHERE id = $1 AND is_active = true',
      [value.product_id]
    );
    
    if (productRes.rowCount === 0) {
      throw new AppError('Товар не найден или недоступен', 404);
    }
    
    const product = productRes.rows[0];
    
    // Проверяем наличие на складе
    const insufficientItems = [];
    const inventoryCheck = await orderModel.checkInventory(
      client,
      value.product_id,
      value.quantity
    );
    if (!inventoryCheck.sufficient) {
      insufficientItems.push({
        product_id: value.product_id,
        name: product.name,
        sku: product.sku,
        available: inventoryCheck.available,
        required: value.quantity,
        shortage: inventoryCheck.shortage
      });
    }
    if (insufficientItems.length > 0) {
      throw new AppError(
        'Недостаточно товаров на складе. Смотрите детали.',
        400,
        { insufficientItems }
      );
    }
    
    // Добавляем товар в заказ
    await orderModel.addOrderItem(client, {
      order_id: orderId,
      product_id: value.product_id,
      quantity: value.quantity,
      price: product.retail_price,
      discount_price: product.discount_price
    });
    
    // Списываем со склада
    await orderModel.decreaseInventory(
      client,
      value.product_id,
      value.quantity
    );
    
    // Пересчитываем итоговую сумму заказа
    await orderModel.recalculateOrderTotal(client, orderId);
    
    await client.query('COMMIT');
    
    // Получаем обновленный заказ
    const updatedOrder = await orderModel.getOrderById(orderId);
    
    return {
      success: true,
      message: 'Товар добавлен в заказ',
      data: {
        order: updatedOrder
      }
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при добавлении товара в заказ:', err);
    throw new AppError('Не удалось добавить товар в заказ', 500);
  } finally {
    client.release();
  }
};

// Удалить товар из заказа
const removeItemFromOrder = async (orderId, orderItemId, userId, role) => {
  const isAdmin = role === 'admin' || role === 'manager';
  
  if (!isAdmin) {
    throw new AppError('Только администратор может удалять товары из заказов', 403);
  }
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем заказ
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    // Находим товар в заказе
    const item = order.items.find(i => i.id === parseInt(orderItemId, 10));
    
    if (!item) {
      throw new AppError('Товар не найден в заказе', 404);
    }
    
    // Удаляем товар из заказа
    await orderModel.removeOrderItem(client, orderItemId);
    
    // Возвращаем товар на склад
    await orderModel.returnInventory(
      client,
      item.product_id,
      item.quantity
    );
    
    // Пересчитываем итоговую сумму
    await orderModel.recalculateOrderTotal(client, orderId);
    
    await client.query('COMMIT');
    
    // Получаем обновленный заказ
    const updatedOrder = await orderModel.getOrderById(orderId);
    
    return {
      success: true,
      message: 'Товар удален из заказа',
      data: {
        order: updatedOrder
      }
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при удалении товара из заказа:', err);
    throw new AppError('Не удалось удалить товар из заказа', 500);
  } finally {
    client.release();
  }
};

// СТАТИСТИКА
// Получить статистику заказов
const getOrderStatistics = async () => {
  try {
    const stats = await orderModel.getOrderStats();
    
    return {
      success: true,
      stats: stats.overall,
      daily_stats: stats.daily
    };
  } catch (err) {
    console.error('Ошибка при получении статистики:', err);
    throw new AppError('Не удалось получить статистику заказов', 500);
  }
};

// УДАЛЕНИЕ
// Удалить заказ (только для админа и только определенные статусы)
const deleteOrder = async (orderId, userId, role) => {
  const isAdmin = role === 'admin' || role === 'manager';
  
  if (!isAdmin) {
    throw new AppError('Только администратор может удалять заказы', 403);
  }
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем заказ
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    if (!DELETABLE_STATUSES.includes(order.status)) {
      throw new AppError(
        `Нельзя удалить заказ в статусе "${order.status}". ` +
        `Удаление возможно только для: ${DELETABLE_STATUSES.join(', ')}`,
        400
      );
    }
    
    // Если заказ не был отменен - возвращаем товары на склад
    if (order.status !== 'cancelled') {
      for (const item of order.items) {
        await orderModel.returnInventory(
          client,
          item.product_id,
          item.quantity
        );
      }
    }
    
    // Удаляем заказ (каскадно удалятся order_items и order_status_history)
    await orderModel.deleteOrder(client, orderId);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'Заказ успешно удален'
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при удалении заказа:', err);
    throw new AppError('Не удалось удалить заказ', 500);
  } finally {
    client.release();
  }
};


module.exports = {
  // Создание
  createOrder,
  createAdminOrder,
  createOrderWithPayment,

  // Получение
  getUserOrders,
  getAllOrders,
  getOrderDetails,
  
  // Обновление
  updateOrderStatus,
  updateOrder,
  cancelOrder,
  
  // Работа с товарами
  addItemToOrder,
  removeItemFromOrder,
  
  // Статистика
  getOrderStatistics,
  
  // Удаление
  deleteOrder,
  
  // Константы
  ORDER_STATUSES,
  CANCELLABLE_STATUSES,
  DELETABLE_STATUSES
};