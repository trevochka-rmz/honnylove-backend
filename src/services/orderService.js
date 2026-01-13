// src/services/orderService.js (ИСПРАВЛЕННАЯ ВЕРСИЯ)
const Joi = require('joi');
const db = require('../config/db');
const AppError = require('../utils/errorUtils');

// Схема валидации
const checkoutSchema = Joi.object({
  shipping_address: Joi.string().min(10).required(),
  payment_method: Joi.string().valid('card', 'cash', 'online').required(),
  notes: Joi.string().optional().allow(''),
  shipping_cost: Joi.number().min(0).default(0),
  tax_amount: Joi.number().min(0).default(0),
  discount_amount: Joi.number().min(0).default(0),
});

// Создание заказа из корзины
const createOrder = async (userId, data) => {
  const { error, value } = checkoutSchema.validate(data);
  if (error) {
    throw new AppError(error.details[0].message, 400);
  }

  try {
    // 1. Получаем товары из корзины с ценами
    const cartItems = await db.query(`
      SELECT 
        ci.*,
        pp.retail_price,
        pp.discount_price,
        pp.name as product_name,
        COALESCE(pp.discount_price, pp.retail_price) as final_price
      FROM cart_items ci
      JOIN product_products pp ON ci.product_id = pp.id
      WHERE ci.user_id = $1
    `, [userId]);

    if (!cartItems.rows || cartItems.rows.length === 0) {
      throw new AppError('Корзина пуста', 400);
    }

    // 2. Проверяем наличие товаров на складе
    for (const item of cartItems.rows) {
      const inventoryRes = await db.query(`
        SELECT COALESCE(SUM(quantity), 0) as total 
        FROM product_inventory 
        WHERE product_id = $1
      `, [item.product_id]);

      const available = parseInt(inventoryRes.rows[0].total, 10);
      if (available < item.quantity) {
        throw new AppError(`Недостаточно товара "${item.product_name}" на складе. Доступно: ${available}, нужно: ${item.quantity}`, 400);
      }
    }

    // 3. Расчет суммы
    let subtotal = 0;
    cartItems.rows.forEach(item => {
      subtotal += item.final_price * item.quantity;
    });

    const total_amount = subtotal + value.shipping_cost + value.tax_amount - value.discount_amount;

    // 4. Создаем заказ
    const orderRes = await db.query(`
      INSERT INTO orders (
        user_id, status, total_amount, shipping_address, 
        payment_method, shipping_cost, tax_amount, 
        discount_amount, notes, created_at, updated_at
      ) VALUES ($1, 'pending', $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      userId, total_amount, value.shipping_address, 
      value.payment_method, value.shipping_cost, 
      value.tax_amount, value.discount_amount, value.notes || ''
    ]);

    const order = orderRes.rows[0];

    // 5. Добавляем товары в заказ
    for (const item of cartItems.rows) {
      await db.query(`
        INSERT INTO order_items (
          order_id, product_id, quantity, price, discount_price
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        order.id, item.product_id, item.quantity, 
        item.retail_price, item.discount_price
      ]);

      // 6. Уменьшаем количество на складе
      await db.query(`
        UPDATE product_inventory 
        SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP
        WHERE product_id = $2 AND location_id = 1
      `, [item.quantity, item.product_id]);
    }

    // 7. Добавляем в историю статусов
    await db.query(`
      INSERT INTO order_status_history (order_id, status, user_id)
      VALUES ($1, 'pending', $2)
    `, [order.id, userId]);

    // 8. Очищаем корзину
    await db.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);

    // 9. Получаем детали созданного заказа
    const orderDetails = await db.query(`
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'productId', oi.product_id,
            'productName', pp.name,
            'productImage', pp.main_image_url,
            'quantity', oi.quantity,
            'price', oi.price,
            'discountPrice', oi.discount_price,
            'subtotal', oi.quantity * COALESCE(oi.discount_price, oi.price)
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN product_products pp ON oi.product_id = pp.id
      WHERE o.id = $1
      GROUP BY o.id
    `, [order.id]);

    return {
      success: true,
      message: 'Заказ успешно оформлен',
      order: orderDetails.rows[0],
      order_number: `ORD-${String(order.id).padStart(6, '0')}`
    };

  } catch (err) {
    console.error('Ошибка при создании заказа:', err);
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError('Произошла ошибка при оформлении заказа: ' + err.message, 500);
  }
};

// Получить заказы пользователя
const getUserOrders = async (userId) => {
  try {
    const ordersRes = await db.query(`
      SELECT 
        o.*,
        json_agg(
          json_build_object(
            'productId', oi.product_id,
            'productName', pp.name,
            'productImage', pp.main_image_url,
            'quantity', oi.quantity,
            'price', oi.price,
            'discountPrice', oi.discount_price,
            'subtotal', oi.quantity * COALESCE(oi.discount_price, oi.price)
          )
        ) as items
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN product_products pp ON oi.product_id = pp.id
      WHERE o.user_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `, [userId]);


    return {
      success: true,
      orders: ordersRes.rows,
      count: ordersRes.rows.length
    };
  } catch (err) {
    console.error('Ошибка при получении заказов:', err);
    throw new AppError('Не удалось получить заказы', 500);
  }
};

// Получить детали заказа
const getOrderDetails = async (orderId, userId = null, role = 'customer') => {
  try {
    const orderRes = await db.query(`
      SELECT 
        o.*,
        u.email as user_email,
        u.first_name as user_first_name,
        u.last_name as user_last_name,
        json_agg(
          json_build_object(
            'productId', oi.product_id,
            'productName', pp.name,
            'productImage', pp.main_image_url,
            'quantity', oi.quantity,
            'price', oi.price,
            'discountPrice', oi.discount_price,
            'subtotal', oi.quantity * COALESCE(oi.discount_price, oi.price)
          )
        ) as items
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
      LEFT JOIN product_products pp ON oi.product_id = pp.id
      WHERE o.id = $1
      GROUP BY o.id, u.id
    `, [orderId]);

    if (!orderRes.rows[0]) {
      throw new AppError('Заказ не найден', 404);
    }

    const order = orderRes.rows[0];
    
    // Проверка прав доступа
    const isAdmin = role === 'admin' || role === 'manager';
    const isOwner = order.user_id === userId;
    
    if (!isAdmin && !isOwner) {
      throw new AppError('У вас нет доступа к этому заказу', 403);
    }

    return {
      success: true,
      order: order
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при получении деталей заказа:', err);
    throw new AppError('Не удалось получить детали заказа', 500);
  }
};

// Получить все заказы (для админа)
const getAllOrders = async (status = null) => {
  try {
    let query = `
      SELECT 
        o.*,
        u.email as user_email,
        u.first_name,
        u.last_name,
        COUNT(oi.id) as items_count,
        SUM(oi.quantity) as total_quantity
      FROM orders o
      LEFT JOIN users u ON o.user_id = u.id
      LEFT JOIN order_items oi ON o.id = oi.order_id
    `;
    
    let params = [];
    
    if (status) {
      query += ` WHERE o.status = $1`;
      params.push(status);
    }
    
    query += ` GROUP BY o.id, u.id ORDER BY o.created_at DESC`;
    
    const ordersRes = await db.query(query, params);

    return {
      success: true,
      orders: ordersRes.rows,
      count: ordersRes.rows.length
    };
  } catch (err) {
    console.error('Ошибка при получении всех заказов:', err);
    throw new AppError('Не удалось получить заказы', 500);
  }
};

// Обновить статус заказа (для админа)
const updateOrderStatus = async (orderId, newStatus, changerUserId, notes = '') => {
  const allowedStatuses = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'completed'];
  
  if (!allowedStatuses.includes(newStatus)) {
    throw new AppError(`Недопустимый статус. Допустимые: ${allowedStatuses.join(', ')}`, 400);
  }

  try {
    // Получаем текущий заказ
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!orderRes.rows[0]) {
      throw new AppError('Заказ не найден', 404);
    }

    const currentOrder = orderRes.rows[0];

    // Обновляем статус
    const updateRes = await db.query(`
      UPDATE orders 
      SET status = $1, updated_at = CURRENT_TIMESTAMP 
      WHERE id = $2 
      RETURNING *
    `, [newStatus, orderId]);

    // Добавляем в историю
    await db.query(`
      INSERT INTO order_status_history (order_id, status, user_id)
      VALUES ($1, $2, $3)
    `, [orderId, newStatus, changerUserId]);

    // Если отменяем - возвращаем товары на склад
    if (newStatus === 'cancelled' && currentOrder.status !== 'cancelled') {
      const itemsRes = await db.query('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
      
      for (const item of itemsRes.rows) {
        await db.query(`
          UPDATE product_inventory 
          SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP
          WHERE product_id = $2 AND location_id = 1
        `, [item.quantity, item.product_id]);
      }
    }

    return {
      success: true,
      message: `Статус заказа обновлен на "${newStatus}"`,
      order: updateRes.rows[0]
    };
  } catch (err) {
    console.error('Ошибка при обновлении статуса:', err);
    throw new AppError('Не удалось обновить статус заказа', 500);
  }
};

// Отменить заказ (для пользователя)
const cancelOrder = async (userId, orderId, reason = '') => {
  try {
    // Проверяем права
    const orderRes = await db.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (!orderRes.rows[0] || orderRes.rows[0].user_id !== userId) {
      throw new AppError('Заказ не найден или доступ запрещен', 404);
    }

    const order = orderRes.rows[0];
    
    // Проверяем возможность отмены
    const cancellableStatuses = ['pending', 'paid', 'processing'];
    if (!cancellableStatuses.includes(order.status)) {
      throw new AppError(`Нельзя отменить заказ в статусе "${order.status}"`, 400);
    }

    // Отменяем
    return await updateOrderStatus(orderId, 'cancelled', userId, reason);
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    console.error('Ошибка при отмене заказа:', err);
    throw new AppError('Не удалось отменить заказ', 500);
  }
};

module.exports = {
  createOrder,
  getUserOrders,
  getAllOrders,
  getOrderDetails,
  updateOrderStatus,
  cancelOrder,
  ORDER_STATUSES: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'completed']
};