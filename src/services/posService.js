// src/services/posService.js
const Joi = require('joi');
const db = require('../config/db');
const posModel = require('../models/posModel');
const orderModel = require('../models/orderModel');
const AppError = require('../utils/errorUtils');

// =====================================
// СХЕМЫ ВАЛИДАЦИИ
// =====================================

/**
 * Схема для быстрого создания POS заказа (чека)
 */
const createPOSOrderSchema = Joi.object({
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().positive().required()
        .messages({
          'number.base': 'ID товара должен быть числом',
          'any.required': 'Укажите ID товара'
        }),
        variant_id: Joi.number().integer().positive().allow(null).optional(), 
      quantity: Joi.number().integer().min(1).required()
        .messages({
          'number.min': 'Количество должно быть минимум 1',
          'any.required': 'Укажите количество'
        })
    })
  ).min(1).required()
    .messages({
      'array.min': 'Должен быть хотя бы один товар',
      'any.required': 'Укажите товары для заказа'
    }),
  
  payment_method: Joi.string()
    .valid('cash', 'card')
    .required()
    .messages({
      'any.only': 'Способ оплаты должен быть: cash или card',
      'any.required': 'Укажите способ оплаты'
    }),
  customer_first_name: Joi.string().max(100).optional().allow(''),
  customer_last_name:  Joi.string().max(100).optional().allow(''),
  customer_phone:      Joi.string().max(20).optional().allow(''),
  notes: Joi.string().max(1000).optional().allow(''),
  discount_amount: Joi.number().min(0).default(0)
});

/**
 * Схема для фильтрации заказов
 */
const posFiltersSchema = Joi.object({
  status: Joi.string().valid(
    'pending', 'paid', 'processing', 'shipped', 
    'delivered', 'cancelled', 'returned', 'completed'
  ).optional(),
  
  payment_method: Joi.string().valid('cash', 'card', 'online', 'sbp').optional(),
  created_by: Joi.number().integer().positive().optional(),
  
  date_from: Joi.date().iso().optional(),
  date_to: Joi.date().iso().optional(),
  
  today_only: Joi.boolean().optional(),
  this_week: Joi.boolean().optional(),
  this_month: Joi.boolean().optional(),
  
  search: Joi.string().max(200).optional(),
  is_pos_order: Joi.boolean().optional(),
  
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50)
});

// =====================================
// ОСНОВНЫЕ ФУНКЦИИ
// =====================================

/**
 * 🛒 БЫСТРОЕ СОЗДАНИЕ POS ЗАКАЗА (ЧЕК)
 * Создает заказ по списку ID товаров для кассира
 */
const createPOSOrder = async (cashierId, orderData) => {
  const { error, value } = createPOSOrderSchema.validate(orderData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Получаем информацию о товарах
    const productIds = value.items.map(item => item.product_id);
    const products = await posModel.getProductsForCheckout(client, productIds);

    if (products.length === 0) {
      throw new AppError('Товары не найдены', 404);
    }

    // 2. Создаем карту товаров для быстрого доступа
    const productMap = {};
    products.forEach(p => {
      productMap[p.id] = p;
    });

    // 3. Валидация наличия и расчет суммы
    const orderItems = [];
    let subtotal = 0;
    const insufficientItems = [];

    for (const item of value.items) {
      const product = productMap[item.product_id];

      if (!product) {
        throw new AppError(`Товар с ID ${item.product_id} не найден`, 404);
      }

      if (!product.is_active) {
        throw new AppError(`Товар "${product.name}" недоступен`, 400);
      }

      // Проверяем наличие на складе
      const inventoryCheck = await orderModel.checkInventory(
        client,
        item.product_id,
        item.quantity,
        item.variant_id || null  
      );

      if (!inventoryCheck.sufficient) {
        insufficientItems.push({
          product_id: item.product_id,
          name: product.name,
          sku: product.sku,
          available: inventoryCheck.available,
          required: item.quantity,
          shortage: inventoryCheck.shortage
        });
      }

      const lineTotal = product.final_price * item.quantity;
      subtotal += lineTotal;

      orderItems.push({
        product_id: item.product_id,
        quantity: item.quantity,
        price: product.retail_price,
        discount_price: product.discount_price,
        line_total: lineTotal,
        product_name: product.name,
        product_sku: product.sku
      });
    }

    // Если есть недостаток товаров
    if (insufficientItems.length > 0) {
      throw new AppError(
        'Недостаточно товаров на складе',
        400,
        { insufficientItems }
      );
    }

    // 4. Рассчитываем итоговую сумму
    const total_amount = subtotal - (value.discount_amount || 0);

    if (total_amount < 0) {
      throw new AppError('Итоговая сумма не может быть отрицательной', 400);
    }

    // ШАГ 5 — убираем customer данные из notes, оставляем только метку и доп. примечание
    let notes = '[POS]';
    if (value.notes) {
      notes += ` | ${value.notes}`;
    }

    // ШАГ 6 — передаём customer данные в отдельные поля
    const newOrder = await orderModel.createOrder(client, {
      user_id: cashierId,
      total_amount,
      shipping_address: 'Самовывоз (POS)',
      payment_method: value.payment_method,
      shipping_cost: 0,
      tax_amount: 0,
      discount_amount: value.discount_amount || 0,
      notes,
      customer_first_name: value.customer_first_name || null,
      customer_last_name:  value.customer_last_name  || null,
      customer_phone:      value.customer_phone      || null,
    });

    // 7. Добавляем товары в заказ и списываем со склада
    for (const item of orderItems) {
      await orderModel.addOrderItem(client, {
        order_id: newOrder.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        discount_price: item.discount_price,
        variant_id: item.variant_id || null,        // ← добавить
        variant_snapshot: item.variant_snapshot || null,
      });

      await orderModel.decreaseInventory(
        client,
        item.product_id,
        item.quantity,
        item.variant_id || null 
      );
    }

    // 8. Устанавливаем статус в зависимости от способа оплаты
    let initialStatus = 'paid'; // Для наличных и карты сразу оплачено
    if (value.payment_method === 'cash' || value.payment_method === 'card') {
      initialStatus = 'completed'; // Сразу завершаем POS заказы
    }

    await orderModel.updateOrderStatus(client, newOrder.id, initialStatus);
    await orderModel.addStatusHistory(client, newOrder.id, initialStatus, cashierId);

    await client.query('COMMIT');

    // 9. Получаем полную информацию о созданном заказе
    const fullOrder = await orderModel.getOrderById(newOrder.id);

    return {
      success: true,
      message: 'Чек успешно создан',
      data: {
        order: fullOrder,
        receipt_number: `CHK-${String(newOrder.id).padStart(6, '0')}`,
        items_count: orderItems.length,
        total_quantity: orderItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        discount: value.discount_amount || 0,
        total: total_amount,
        payment_method: value.payment_method
      }
    };

  } catch (err) {
    await client.query('ROLLBACK');

    if (err instanceof AppError) {
      throw err;
    }

    console.error('Ошибка при создании POS заказа:', err);
    throw new AppError(
      'Произошла ошибка при создании чека: ' + err.message,
      500
    );
  } finally {
    client.release();
  }
};

/**
 * 📋 ПОЛУЧИТЬ СПИСОК POS ЗАКАЗОВ С ФИЛЬТРАМИ
 */
const getPOSOrders = async (filters = {}) => {
  const { error, value } = posFiltersSchema.validate(filters);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  try {
    const { page, limit, ...filterParams } = value;
    const offset = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      posModel.getPOSOrders(filterParams, limit, offset),
      posModel.getPOSOrdersCount(filterParams)
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      success: true,
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasMore: page < totalPages
      }
    };
  } catch (err) {
    console.error('Ошибка при получении POS заказов:', err);
    throw new AppError('Не удалось получить список заказов', 500);
  }
};

/**
 * 📊 ПОЛУЧИТЬ СТАТИСТИКУ ПРОДАЖ
 */
const getSalesStatistics = async (filters = {}) => {
  try {
    const stats = await posModel.getSalesStatistics(filters);
    const topProducts = await posModel.getTopProducts(filters, 10);
    const dailyStats = await posModel.getDailySalesStats(filters);

    return {
      success: true,
      data: {
        summary: stats,
        top_products: topProducts,
        daily_stats: dailyStats
      }
    };
  } catch (err) {
    console.error('Ошибка при получении статистики:', err);
    throw new AppError('Не удалось получить статистику продаж', 500);
  }
};

/**
 * 🔍 ПРЕДПРОСМОТР ТОВАРОВ ДЛЯ ЧЕК
 * Получить информацию о товарах перед созданием заказа
 */
const previewProductsForCheckout = async (productIds) => {
  if (!productIds || productIds.length === 0) {
    throw new AppError('Укажите ID товаров', 400);
  }

  const client = await db.pool.connect();
  try {
    const products = await posModel.getProductsForCheckout(client, productIds);

    if (products.length === 0) {
      throw new AppError('Товары не найдены', 404);
    }

    // Рассчитываем предварительную сумму
    let subtotal = 0;
    const unavailableProducts = [];

    products.forEach(p => {
      subtotal += p.final_price;

      if (!p.is_active) {
        unavailableProducts.push({
          id: p.id,
          name: p.name,
          reason: 'Товар неактивен'
        });
      }

      if (p.available_stock <= 0) {
        unavailableProducts.push({
          id: p.id,
          name: p.name,
          reason: 'Нет в наличии'
        });
      }
    });

    return {
      success: true,
      products,
      summary: {
        total_items: products.length,
        subtotal,
        unavailable_count: unavailableProducts.length,
        unavailable_products: unavailableProducts
      }
    };
  } catch (err) {
    console.error('Ошибка при предпросмотре товаров:', err);
    throw new AppError('Не удалось получить информацию о товарах', 500);
  } finally {
    client.release();
  }
};

/**
 * 👥 ПОЛУЧИТЬ СПИСОК КАССИРОВ
 * Менеджеры видят только менеджеров
 * Админы видят менеджеров + админов
 */
const getCashiers = async (currentUserRole) => {
  try {
    // Проверка роли
    if (!['manager', 'admin'].includes(currentUserRole)) {
      throw new AppError('У вас нет прав для просмотра списка кассиров', 403);
    }

    const cashiers = await posModel.getCashiers(currentUserRole);

    return {
      success: true,
      cashiers,
      total: cashiers.length
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при получении списка кассиров:', err);
    throw new AppError('Не удалось получить список кассиров', 500);
  }
};

/**
 * 👤 ПОЛУЧИТЬ ДЕТАЛЬНУЮ ИНФОРМАЦИЮ О КАССИРЕ
 */
const getCashierDetails = async (cashierId, currentUserRole) => {
  try {
    // Проверка роли
    if (!['manager', 'admin'].includes(currentUserRole)) {
      throw new AppError('У вас нет прав для просмотра информации о кассирах', 403);
    }

    const cashier = await posModel.getCashierById(cashierId);

    if (!cashier) {
      throw new AppError('Кассир не найден', 404);
    }

    // Менеджер может видеть только менеджеров
    if (currentUserRole === 'manager' && cashier.role !== 'manager') {
      throw new AppError('У вас нет прав для просмотра этого пользователя', 403);
    }

    return {
      success: true,
      cashier
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при получении информации о кассире:', err);
    throw new AppError('Не удалось получить информацию о кассире', 500);
  }
};

/**
 * 🗑️ УДАЛИТЬ POS ЗАКАЗ
 */
const deletePOSOrder = async (orderId, userId, userRole) => {
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем существование заказа
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    // Проверяем что это POS заказ
    if (!order.notes || !order.notes.includes('[POS]')) {
      throw new AppError('Это не POS заказ. Используйте обычный API заказов.', 400);
    }
    
    // Проверяем права доступа
    const isAdmin = userRole === 'admin';
    const isOwner = order.user_id === userId;
    
    if (!isAdmin && !isOwner) {
      throw new AppError('У вас нет прав для удаления этого заказа', 403);
    }
    
    // Проверяем статус заказа
    const deletableStatuses = ['pending', 'cancelled'];
    if (!deletableStatuses.includes(order.status)) {
      throw new AppError(
        `Нельзя удалить заказ в статусе "${order.status}". ` +
        `Удаление возможно только для: ${deletableStatuses.join(', ')}`,
        400
      );
    }
    
    // Возвращаем товары на склад если заказ не был отменен
    if (order.status !== 'cancelled') {
      for (const item of order.items) {
        await orderModel.returnInventory(
          client,
          item.product_id,
          item.quantity
        );
      }
    }
    
    // Удаляем заказ
    await orderModel.deleteOrder(client, orderId);
    
    await client.query('COMMIT');
    
    return {
      success: true,
      message: 'POS заказ успешно удален'
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при удалении POS заказа:', err);
    throw new AppError('Не удалось удалить POS заказ: ' + err.message, 500);
  } finally {
    client.release();
  }
};

/**
 * ✏️ ОБНОВИТЬ POS ЗАКАЗ
 */
const updatePOSOrder = async (orderId, updateData, userId, userRole) => {
  // Схема валидации для обновления
  const updateSchema = Joi.object({
    payment_method:      Joi.string().valid('cash', 'card').optional(),
    discount_amount:     Joi.number().min(0).optional(),
    notes:               Joi.string().max(1000).optional().allow(''),
    customer_first_name: Joi.string().max(100).optional().allow(''),
    customer_last_name:  Joi.string().max(100).optional().allow(''),
    customer_phone:      Joi.string().max(20).optional().allow(''),
  });
  
  const { error, value } = updateSchema.validate(updateData);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }
  
  const client = await db.pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Проверяем существование заказа
    const order = await orderModel.getOrderById(orderId);
    
    if (!order) {
      throw new AppError('Заказ не найден', 404);
    }
    
    // Проверяем что это POS заказ
    if (!order.notes || !order.notes.includes('[POS]')) {
      throw new AppError('Это не POS заказ. Используйте обычный API заказов.', 400);
    }
    
    // Проверяем права доступа
    const isAdmin = userRole === 'admin' || userRole === 'manager';
    const isOwner = order.user_id === userId;
    
    if (!isAdmin && !isOwner) {
      throw new AppError('У вас нет прав для изменения этого заказа', 403);
    }
    
    // Проверяем статус заказа
    const editableStatuses = ['pending', 'paid', 'completed'];
    if (!editableStatuses.includes(order.status)) {
      throw new AppError(
        `Нельзя изменить заказ в статусе "${order.status}". ` +
        `Изменение возможно только для: ${editableStatuses.join(', ')}`,
        400
      );
    }
    
    // Обновляем заказ
    const updated = await orderModel.updateOrder(client, orderId, value);
    
    if (!updated) {
      throw new AppError('Нет данных для обновления', 400);
    }
    
    // Если изменилась скидка, пересчитываем сумму
    if (value.discount_amount !== undefined) {
      await orderModel.recalculateOrderTotal(client, orderId);
    }
    
    await client.query('COMMIT');
    
    // Получаем обновленную информацию
    const fullOrder = await orderModel.getOrderById(orderId);
    
    return {
      success: true,
      message: 'POS заказ успешно обновлен',
      data: {
        order: fullOrder
      }
    };
    
  } catch (err) {
    await client.query('ROLLBACK');
    
    if (err instanceof AppError) {
      throw err;
    }
    
    console.error('Ошибка при обновлении POS заказа:', err);
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
  updatePOSOrder
};