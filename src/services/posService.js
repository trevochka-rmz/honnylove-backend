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
  
  customer_name: Joi.string().max(200).optional().allow(''),
  customer_phone: Joi.string().max(20).optional().allow(''),
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
        item.quantity
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

    // 5. Формируем примечания с меткой [POS]
    let notes = '[POS]';
    if (value.customer_name) {
      notes += ` | Клиент: ${value.customer_name}`;
    }
    if (value.customer_phone) {
      notes += ` | Тел: ${value.customer_phone}`;
    }
    if (value.notes) {
      notes += ` | ${value.notes}`;
    }

    // 6. Создаем заказ
    const newOrder = await orderModel.createOrder(client, {
      user_id: cashierId,
      total_amount,
      shipping_address: 'Самовывоз (POS)',
      payment_method: value.payment_method,
      shipping_cost: 0,
      tax_amount: 0,
      discount_amount: value.discount_amount || 0,
      notes
    });

    // 7. Добавляем товары в заказ и списываем со склада
    for (const item of orderItems) {
      await orderModel.addOrderItem(client, {
        order_id: newOrder.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: item.price,
        discount_price: item.discount_price
      });

      await orderModel.decreaseInventory(
        client,
        item.product_id,
        item.quantity
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

module.exports = {
  createPOSOrder,
  getPOSOrders,
  getSalesStatistics,
  previewProductsForCheckout
};