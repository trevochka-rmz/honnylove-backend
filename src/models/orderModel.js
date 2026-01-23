// src/models/orderModel.js - ИСПРАВЛЕННАЯ ВЕРСИЯ
const db = require('../config/db');

// Получить товары из корзины пользователя с полной информацией о товарах
const getCartItemsWithDetails = async (client, userId) => {
  const res = await client.query(`
    SELECT 
      ci.id as cart_item_id,
      ci.user_id,
      ci.product_id,
      ci.quantity as cart_quantity,
      ci.created_at as added_to_cart_at,
      
      pp.id,
      pp.name,
      pp.sku,
      pp.description,
      pp.retail_price,
      pp.discount_price,
      pp.main_image_url,
      pp.is_active,
      
      pb.name as brand_name,
      pc.name as category_name,
      
      COALESCE(pp.discount_price, pp.retail_price) as final_price,
      
      (ci.quantity * COALESCE(pp.discount_price, pp.retail_price)) as line_total,
      
      COALESCE(
        (SELECT SUM(quantity) 
         FROM product_inventory pi 
         JOIN product_locations pl ON pi.location_id = pl.id
         WHERE pi.product_id = pp.id AND pl.is_active = true),
        0
      ) as available_stock
      
    FROM cart_items ci
    INNER JOIN product_products pp ON ci.product_id = pp.id
    LEFT JOIN product_brands pb ON pp.brand_id = pb.id
    LEFT JOIN product_categories pc ON pp.category_id = pc.id
    WHERE ci.user_id = $1
      AND pp.is_active = true
    ORDER BY ci.created_at DESC
  `, [userId]);
  
  return res.rows;
};

// Создать новый заказ в базе данных
const createOrder = async (client, orderData) => {
  const { 
    user_id, 
    total_amount, 
    shipping_address, 
    payment_method, 
    shipping_cost = 0, 
    tax_amount = 0, 
    discount_amount = 0, 
    notes = '',
    tracking_number = null
  } = orderData;
  
  const res = await client.query(`
    INSERT INTO orders (
      user_id, 
      status, 
      total_amount, 
      shipping_address, 
      payment_method, 
      shipping_cost, 
      tax_amount, 
      discount_amount, 
      notes,
      tracking_number,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    RETURNING *
  `, [
    user_id, 
    'pending',
    total_amount, 
    shipping_address, 
    payment_method, 
    shipping_cost, 
    tax_amount, 
    discount_amount, 
    notes,
    tracking_number
  ]);
  
  return res.rows[0];
};

// Добавить товарную позицию в заказ
const addOrderItem = async (client, orderItemData) => {
  const { order_id, product_id, quantity, price, discount_price = null } = orderItemData;
  
  const res = await client.query(`
    INSERT INTO order_items (
      order_id, 
      product_id, 
      quantity, 
      price, 
      discount_price,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    RETURNING *
  `, [order_id, product_id, quantity, price, discount_price]);
  
  return res.rows[0];
};

// Добавить запись в историю изменения статусов заказа
const addStatusHistory = async (client, orderId, status, changerUserId = null) => {
  await client.query(`
    INSERT INTO order_status_history (order_id, status, user_id, created_at)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
  `, [orderId, status, changerUserId]);
};

// Получить список заказов пользователя с информацией о товарах
const getUserOrders = async (userId, limit = 10, offset = 0) => {
  const res = await db.query(`
    SELECT 
      o.id,
      o.user_id,
      o.status,
      o.total_amount,
      o.shipping_address,
      o.payment_method,
      o.shipping_cost,
      o.tax_amount,
      o.discount_amount,
      o.tracking_number,
      o.notes,
      o.created_at,
      o.updated_at,
      
      COUNT(DISTINCT oi.id) as items_count,
      
      COALESCE(SUM(oi.quantity), 0) as total_items_quantity,
      
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', pp.id,
            'product_name', pp.name,
            'product_sku', pp.sku,
            'product_image', pp.main_image_url,
            'quantity', oi.quantity,
            'price', oi.price,
            'discount_price', oi.discount_price,
            'line_total', oi.quantity * COALESCE(oi.discount_price, oi.price)
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) as items
      
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN product_products pp ON oi.product_id = pp.id
    WHERE o.user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  
  return res.rows;
};

// Получить общее количество заказов пользователя
const getUserOrdersCount = async (userId) => {
  const res = await db.query(
    'SELECT COUNT(*) as total FROM orders WHERE user_id = $1',
    [userId]
  );
  return parseInt(res.rows[0].total, 10);
};

// Получить все заказы с фильтрами для администратора
const getAllOrders = async (filters = {}, limit = 20, offset = 0) => {
  const { status, user_id, date_from, date_to, search } = filters;
  
  let whereConditions = [];
  let params = [];
  let paramCount = 1;
  
  if (status) {
    whereConditions.push(`o.status = $${paramCount}`);
    params.push(status);
    paramCount++;
  }
  
  if (user_id) {
    whereConditions.push(`o.user_id = $${paramCount}`);
    params.push(user_id);
    paramCount++;
  }
  
  if (date_from) {
    whereConditions.push(`o.created_at >= $${paramCount}`);
    params.push(date_from);
    paramCount++;
  }
  
  if (date_to) {
    whereConditions.push(`o.created_at <= $${paramCount}`);
    params.push(date_to);
    paramCount++;
  }
  
  if (search) {
    whereConditions.push(`(
      o.id::text ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount} OR
      o.tracking_number ILIKE $${paramCount}
    )`);
    params.push(`%${search}%`);
    paramCount++;
  }
  
  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ') 
    : '';
  
  const ordersRes = await db.query(`
    SELECT 
      o.id,
      o.user_id,
      o.status,
      o.total_amount,
      o.shipping_address,
      o.payment_method,
      o.shipping_cost,
      o.tax_amount,
      o.discount_amount,
      o.tracking_number,
      o.notes,
      o.created_at,
      o.updated_at,
      
      u.email as user_email,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.phone as user_phone,
      
      COUNT(DISTINCT oi.id) as items_count,
      COALESCE(SUM(oi.quantity), 0) as total_items_quantity
      
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    ${whereClause}
    GROUP BY o.id, u.id
    ORDER BY o.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `, [...params, limit, offset]);
  
  return ordersRes.rows;
};

// Получить общее количество заказов с фильтрами для администратора
const getAllOrdersCount = async (filters = {}) => {
  const { status, user_id, date_from, date_to, search } = filters;
  
  let whereConditions = [];
  let params = [];
  let paramCount = 1;
  
  if (status) {
    whereConditions.push(`o.status = $${paramCount}`);
    params.push(status);
    paramCount++;
  }
  
  if (user_id) {
    whereConditions.push(`o.user_id = $${paramCount}`);
    params.push(user_id);
    paramCount++;
  }
  
  if (date_from) {
    whereConditions.push(`o.created_at >= $${paramCount}`);
    params.push(date_from);
    paramCount++;
  }
  
  if (date_to) {
    whereConditions.push(`o.created_at <= $${paramCount}`);
    params.push(date_to);
    paramCount++;
  }
  
  if (search) {
    whereConditions.push(`(
      o.id::text ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount} OR
      o.tracking_number ILIKE $${paramCount}
    )`);
    params.push(`%${search}%`);
    paramCount++;
  }
  
  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ') 
    : '';
  
  const res = await db.query(`
    SELECT COUNT(DISTINCT o.id) as total
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    ${whereClause}
  `, params);
  
  return parseInt(res.rows[0].total, 10);
};

// Получить заказ по ID с полной информацией о товарах и истории статусов
const getOrderById = async (orderId) => {
  const orderRes = await db.query(`
    SELECT 
      o.*,
      
      u.email as user_email,
      u.first_name as user_first_name,
      u.last_name as user_last_name,
      u.phone as user_phone,
      u.address as user_default_address,
      
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', pp.id,
            'product_name', pp.name,
            'product_sku', pp.sku,
            'product_image', pp.main_image_url,
            'product_description', pp.description,
            'quantity', oi.quantity,
            'price', oi.price,
            'discount_price', oi.discount_price,
            'line_total', oi.quantity * COALESCE(oi.discount_price, oi.price),
            'created_at', oi.created_at
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) as items,
      
      (
        SELECT json_agg(
          json_build_object(
            'id', osh.id,
            'status', osh.status,
            'created_at', osh.created_at,
            'changed_by_user_id', osh.user_id,
            'changed_by_email', chu.email,
            'changed_by_name', COALESCE(chu.first_name || ' ' || chu.last_name, chu.email)
          ) ORDER BY osh.created_at DESC
        )
        FROM order_status_history osh
        LEFT JOIN users chu ON osh.user_id = chu.id
        WHERE osh.order_id = o.id
      ) as status_history
      
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN product_products pp ON oi.product_id = pp.id
    WHERE o.id = $1
    GROUP BY o.id, u.id
  `, [orderId]);
  
  return orderRes.rows[0] || null;
};

// Обновить статус заказа
const updateOrderStatus = async (client, orderId, status) => {
  const res = await client.query(`
    UPDATE orders
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `, [status, orderId]);
  
  return res.rows[0];
};

// Обновить данные заказа
const updateOrder = async (client, orderId, updateData) => {
  const allowedFields = [
    'shipping_address',
    'payment_method',
    'shipping_cost',
    'tax_amount',
    'discount_amount',
    'tracking_number',
    'notes'
  ];
  
  const updates = [];
  const values = [];
  let paramCount = 1;
  
  Object.keys(updateData).forEach(key => {
    if (allowedFields.includes(key) && updateData[key] !== undefined) {
      updates.push(`${key} = $${paramCount}`);
      values.push(updateData[key]);
      paramCount++;
    }
  });
  
  if (updates.length === 0) {
    throw new Error('Нет данных для обновления');
  }
  
  updates.push(`updated_at = CURRENT_TIMESTAMP`);
  values.push(orderId);
  
  const res = await client.query(`
    UPDATE orders
    SET ${updates.join(', ')}
    WHERE id = $${paramCount}
    RETURNING *
  `, values);
  
  return res.rows[0];
};

// Пересчитать итоговую сумму заказа на основе товаров и дополнительных сборов
const recalculateOrderTotal = async (client, orderId) => {
  const res = await client.query(`
    UPDATE orders o
    SET 
      total_amount = (
        SELECT 
          COALESCE(SUM(oi.quantity * COALESCE(oi.discount_price, oi.price)), 0) +
          o.shipping_cost + 
          o.tax_amount - 
          o.discount_amount
        FROM order_items oi
        WHERE oi.order_id = o.id
      ),
      updated_at = CURRENT_TIMESTAMP
    WHERE o.id = $1
    RETURNING *
  `, [orderId]);
  
  return res.rows[0];
};

// Удалить товарную позицию из заказа
const removeOrderItem = async (client, orderItemId) => {
  const res = await client.query(`
    DELETE FROM order_items
    WHERE id = $1
    RETURNING *
  `, [orderItemId]);
  
  return res.rows[0];
};

// Обновить количество товара в заказе
const updateOrderItemQuantity = async (client, orderItemId, newQuantity) => {
  const res = await client.query(`
    UPDATE order_items
    SET quantity = $1
    WHERE id = $2
    RETURNING *
  `, [newQuantity, orderItemId]);
  
  return res.rows[0];
};

// Проверить наличие товара на складе
const checkInventory = async (client, productId, requiredQuantity) => {
  const res = await client.query(`
    SELECT 
      COALESCE(SUM(pi.quantity), 0) as total_available
    FROM product_inventory pi
    INNER JOIN product_locations pl ON pi.location_id = pl.id
    WHERE pi.product_id = $1 
      AND pl.is_active = true
  `, [productId]);
  
  const available = parseInt(res.rows[0].total_available, 10);
  
  return {
    available,
    sufficient: available >= requiredQuantity,
    shortage: Math.max(0, requiredQuantity - available)
  };
};

// Уменьшить количество товара на складе при резервировании товара
const decreaseInventory = async (client, productId, quantity) => {
  const warehousesRes = await client.query(`
    SELECT pi.id, pi.quantity, pi.location_id, pl.name as location_name
    FROM product_inventory pi
    INNER JOIN product_locations pl ON pi.location_id = pl.id
    WHERE pi.product_id = $1 
      AND pl.is_active = true 
      AND pi.quantity > 0
    ORDER BY pi.quantity DESC
  `, [productId]);
  
  if (warehousesRes.rowCount === 0) {
    throw new Error('Товар не найден на складах');
  }
  
  const totalAvailable = warehousesRes.rows.reduce((sum, w) => sum + w.quantity, 0);
  if (totalAvailable < quantity) {
    throw new Error(`Недостаточно товара. Доступно: ${totalAvailable}, требуется: ${quantity}`);
  }
  
  let remaining = quantity;
  const decreasedFrom = [];
  
  for (const warehouse of warehousesRes.rows) {
    if (remaining === 0) break;
    
    const toTake = Math.min(warehouse.quantity, remaining);
    
    await client.query(`
      UPDATE product_inventory
      SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [toTake, warehouse.id]);
    
    decreasedFrom.push({
      location_id: warehouse.location_id,
      location_name: warehouse.location_name,
      quantity: toTake
    });
    
    remaining -= toTake;
  }
  
  return {
    success: true,
    decreased_from: decreasedFrom,
    total_decreased: quantity
  };
};

// Вернуть товар на склад при отмене заказа или возврате
const returnInventory = async (client, productId, quantity) => {
  const inventoryRes = await client.query(`
    SELECT id FROM product_inventory
    WHERE product_id = $1 AND location_id = 1
  `, [productId]);
  
  if (inventoryRes.rowCount > 0) {
    await client.query(`
      UPDATE product_inventory
      SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [quantity, inventoryRes.rows[0].id]);
  } else {
    await client.query(`
      INSERT INTO product_inventory (product_id, location_id, quantity, min_stock_level, last_updated)
      VALUES ($1, 1, $2, 0, CURRENT_TIMESTAMP)
    `, [productId, quantity]);
  }
};

// Очистить корзину пользователя после оформления заказа
const clearUserCart = async (client, userId) => {
  await client.query('DELETE FROM cart_items WHERE user_id = $1', [userId]);
};

// Получить статистику по заказам: общую и за последние 30 дней
const getOrderStats = async () => {
  const overallRes = await db.query(`
    SELECT 
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(AVG(total_amount), 0) as avg_order_value,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
      COUNT(CASE WHEN status = 'processing' THEN 1 END) as processing_orders,
      COUNT(CASE WHEN status = 'shipped' THEN 1 END) as shipped_orders,
      COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
      COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_orders
    FROM orders
  `);
  
  const dailyRes = await db.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as orders_count,
      COALESCE(SUM(total_amount), 0) as daily_revenue,
      COALESCE(AVG(total_amount), 0) as avg_order_value
    FROM orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);
  
  return {
    overall: overallRes.rows[0],
    daily: dailyRes.rows
  };
};

// Удалить заказ (доступно только для статусов pending или cancelled)
const deleteOrder = async (client, orderId) => {
  const res = await client.query(`
    DELETE FROM orders
    WHERE id = $1
      AND status IN ('pending', 'cancelled')
    RETURNING *
  `, [orderId]);
  
  if (res.rowCount === 0) {
    throw new Error('Заказ не найден или его нельзя удалить в текущем статусе');
  }
  
  return res.rows[0];
};

// Получить выбранные товары из корзины пользователя
const getSelectedCartItemsWithDetails = async (client, userId, selectedItemIds) => {
  if (!selectedItemIds || selectedItemIds.length === 0) {
    return [];
  }

  const placeholders = selectedItemIds.map((_, i) => `$${i + 2}`).join(',');
  
  const res = await client.query(`
    SELECT 
      ci.id as cart_item_id,
      ci.user_id,
      ci.product_id,
      ci.quantity as cart_quantity,
      ci.created_at as added_to_cart_at,
      
      pp.id,
      pp.name,
      pp.sku,
      pp.description,
      pp.retail_price,
      pp.discount_price,
      pp.main_image_url,
      pp.is_active,
      
      pb.name as brand_name,
      pc.name as category_name,
      
      COALESCE(pp.discount_price, pp.retail_price) as final_price,
      
      (ci.quantity * COALESCE(pp.discount_price, pp.retail_price)) as line_total,
      
      COALESCE(
        (SELECT SUM(quantity) 
         FROM product_inventory pi 
         JOIN product_locations pl ON pi.location_id = pl.id
         WHERE pi.product_id = pp.id AND pl.is_active = true),
        0
      ) as available_stock
      
    FROM cart_items ci
    INNER JOIN product_products pp ON ci.product_id = pp.id
    LEFT JOIN product_brands pb ON pp.brand_id = pb.id
    LEFT JOIN product_categories pc ON pp.category_id = pc.id
    WHERE ci.user_id = $1 
      AND ci.id IN (${placeholders})
      AND pp.is_active = true
    ORDER BY ci.created_at DESC
  `, [userId, ...selectedItemIds]);
  
  return res.rows;
};

// Удалить выбранные товары из корзины
const removeSelectedCartItems = async (client, userId, selectedItemIds) => {
  if (!selectedItemIds || selectedItemIds.length === 0) {
    return;
  }

  const placeholders = selectedItemIds.map((_, i) => `$${i + 2}`).join(',');
  
  await client.query(`
    DELETE FROM cart_items 
    WHERE user_id = $1 
      AND id IN (${placeholders})
  `, [userId, ...selectedItemIds]);
};

module.exports = {
  // Корзина
  getCartItemsWithDetails,
  clearUserCart,
  getSelectedCartItemsWithDetails,
  removeSelectedCartItems,

  
  // Создание заказа
  createOrder,
  addOrderItem,
  addStatusHistory,
  
  // Получение заказов
  getUserOrders,
  getUserOrdersCount,
  getAllOrders,
  getAllOrdersCount,
  getOrderById,
  
  // Обновление заказа
  updateOrderStatus,
  updateOrder,
  recalculateOrderTotal,
  
  // Работа с товарами в заказе
  removeOrderItem,
  updateOrderItemQuantity,
  
  // Склад
  checkInventory,
  decreaseInventory,
  returnInventory,
  
  // Статистика
  getOrderStats,
  
  // Удаление
  deleteOrder
};