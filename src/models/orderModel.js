// src/models/orderModel.js
const db = require('../config/db');

/**
 * Получить товары из корзины пользователя с полной информацией о продуктах
 */
const getCartItemsWithDetails = async (userId) => {
  const res = await db.query(`
    SELECT 
      ci.*,
      pp.id as product_id,
      pp.name as product_name,
      pp.sku as product_sku,
      pp.retail_price,
      pp.discount_price,
      pp.main_image_url as product_image,
      COALESCE(pp.discount_price, pp.retail_price) as final_price,
      (ci.quantity * COALESCE(pp.discount_price, pp.retail_price)) as subtotal
    FROM cart_items ci
    INNER JOIN product_products pp ON ci.product_id = pp.id
    WHERE ci.user_id = $1
    ORDER BY ci.created_at DESC
  `, [userId]);
  
  return res.rows;
};

/**
 * Создать новый заказ
 */
const createOrder = async (client, orderData) => {
  const { 
    user_id, 
    total_amount, 
    shipping_address, 
    payment_method, 
    shipping_cost, 
    tax_amount, 
    discount_amount, 
    notes,
    tracking_number
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
      tracking_number
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [
    user_id, 
    'pending',  // начальный статус
    total_amount, 
    shipping_address, 
    payment_method, 
    shipping_cost || 0, 
    tax_amount || 0, 
    discount_amount || 0, 
    notes || '',
    tracking_number || null
  ]);
  
  return res.rows[0];
};

/**
 * Добавить товар в заказ
 */
const addOrderItem = async (client, orderItemData) => {
  const { order_id, product_id, quantity, price, discount_price } = orderItemData;
  
  const res = await client.query(`
    INSERT INTO order_items (
      order_id, 
      product_id, 
      quantity, 
      price, 
      discount_price
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *
  `, [order_id, product_id, quantity, price, discount_price || null]);
  
  return res.rows[0];
};

/**
 * Получить заказы пользователя с деталями товаров
 */
const getUserOrders = async (userId) => {
  const res = await db.query(`
    SELECT 
      o.*,
      json_agg(
        json_build_object(
          'id', oi.id,
          'product_id', oi.product_id,
          'product_name', pp.name,
          'product_sku', pp.sku,
          'product_image', pp.main_image_url,
          'quantity', oi.quantity,
          'price', oi.price,
          'discount_price', oi.discount_price,
          'subtotal', oi.quantity * COALESCE(oi.discount_price, oi.price),
          'created_at', oi.created_at
        )
      ) as items,
      (
        SELECT json_agg(
          json_build_object(
            'status', osh.status,
            'created_at', osh.created_at,
            'user_id', osh.user_id
          )
          ORDER BY osh.created_at DESC
        )
        FROM order_status_history osh
        WHERE osh.order_id = o.id
      ) as status_history
    FROM orders o
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN product_products pp ON oi.product_id = pp.id
    WHERE o.user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
  `, [userId]);
  
  return res.rows;
};

/**
 * Получить все заказы (для админа)
 */
const getAllOrders = async (status = null, page = 1, limit = 20) => {
  const offset = (page - 1) * limit;
  
  let whereClause = '';
  let params = [];
  
  if (status) {
    whereClause = 'WHERE o.status = $1';
    params.push(status);
  }
  
  // Получаем заказы
  const ordersRes = await db.query(`
    SELECT 
      o.*,
      u.email as user_email,
      u.first_name,
      u.last_name,
      u.phone
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    ${whereClause}
    ORDER BY o.created_at DESC
    LIMIT ${params.length > 0 ? '$2' : '$1'} OFFSET ${params.length > 0 ? '$3' : '$2'}
  `, params.length > 0 ? [...params, limit, offset] : [limit, offset]);
  
  // Получаем общее количество для пагинации
  const countRes = await db.query(`
    SELECT COUNT(*) as total FROM orders o
    ${whereClause}
  `, params);
  
  const total = parseInt(countRes.rows[0].total, 10);
  const pages = Math.ceil(total / limit);
  
  return {
    orders: ordersRes.rows,
    pagination: {
      total,
      page: parseInt(page, 10),
      pages,
      limit: parseInt(limit, 10),
      hasMore: page < pages
    }
  };
};

/**
 * Получить заказ по ID с полной информацией
 */
const getOrderById = async (orderId) => {
  // Получаем основную информацию о заказе
  const orderRes = await db.query(`
    SELECT 
      o.*,
      u.email as user_email,
      u.first_name,
      u.last_name,
      u.phone,
      u.address as user_address
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    WHERE o.id = $1
  `, [orderId]);
  
  if (!orderRes.rows[0]) return null;
  
  // Получаем товары в заказе
  const itemsRes = await db.query(`
    SELECT 
      oi.*,
      pp.name as product_name,
      pp.sku as product_sku,
      pp.main_image_url as product_image,
      pp.description as product_description,
      (oi.quantity * COALESCE(oi.discount_price, oi.price)) as subtotal
    FROM order_items oi
    LEFT JOIN product_products pp ON oi.product_id = pp.id
    WHERE oi.order_id = $1
    ORDER BY oi.created_at
  `, [orderId]);
  
  // Получаем историю статусов
  const historyRes = await db.query(`
    SELECT 
      osh.*,
      u.email as changed_by_email,
      u.first_name as changed_by_first_name,
      u.last_name as changed_by_last_name
    FROM order_status_history osh
    LEFT JOIN users u ON osh.user_id = u.id
    WHERE osh.order_id = $1
    ORDER BY osh.created_at DESC
  `, [orderId]);
  
  return { 
    ...orderRes.rows[0], 
    items: itemsRes.rows,
    status_history: historyRes.rows
  };
};

/**
 * Обновить статус заказа
 */
const updateOrderStatus = async (client, orderId, status) => {
  const res = await client.query(`
    UPDATE orders
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `, [status, orderId]);
  return res.rows[0];
};

/**
 * Добавить запись в историю статусов
 */
const addStatusHistory = async (client, orderId, status, changerUserId = null) => {
  await client.query(`
    INSERT INTO order_status_history (order_id, status, user_id)
    VALUES ($1, $2, $3)
  `, [orderId, status, changerUserId]);
};

/**
 * Проверить наличие товара на складе
 */
const checkInventory = async (client, productId, quantity) => {
  const res = await client.query(`
    SELECT 
      COALESCE(SUM(pi.quantity), 0) as total_quantity
    FROM product_inventory pi
    INNER JOIN product_locations pl ON pi.location_id = pl.id
    WHERE pi.product_id = $1 AND pl.is_active = true
  `, [productId]);
  
  const available = parseInt(res.rows[0].total_quantity, 10);
  return available >= quantity;
};

/**
 * Уменьшить количество товара на складе
 */
const decreaseInventory = async (client, productId, quantity) => {
  // Находим склад с достаточным количеством
  const findRes = await client.query(`
    SELECT pi.id, pi.quantity
    FROM product_inventory pi
    INNER JOIN product_locations pl ON pi.location_id = pl.id
    WHERE pi.product_id = $1 
      AND pl.is_active = true
      AND pi.quantity >= $2
    ORDER BY pi.quantity DESC
    LIMIT 1
  `, [productId, quantity]);
  
  if (findRes.rowCount === 0) {
    // Если нет склада с достаточным количеством, пробуем из нескольких складов
    const totalRes = await client.query(`
      SELECT 
        COALESCE(SUM(pi.quantity), 0) as total_quantity
      FROM product_inventory pi
      INNER JOIN product_locations pl ON pi.location_id = pl.id
      WHERE pi.product_id = $1 AND pl.is_active = true
    `, [productId]);
    
    const totalAvailable = parseInt(totalRes.rows[0].total_quantity, 10);
    if (totalAvailable < quantity) {
      throw new Error(`Недостаточно товара на складе. Требуется: ${quantity}, доступно: ${totalAvailable}`);
    }
    
    // Берем со всех складов по очереди
    const warehousesRes = await client.query(`
      SELECT pi.id, pi.quantity, pi.location_id
      FROM product_inventory pi
      INNER JOIN product_locations pl ON pi.location_id = pl.id
      WHERE pi.product_id = $1 AND pl.is_active = true AND pi.quantity > 0
      ORDER BY pi.quantity DESC
    `, [productId]);
    
    let remaining = quantity;
    for (const warehouse of warehousesRes.rows) {
      const take = Math.min(warehouse.quantity, remaining);
      if (take > 0) {
        await client.query(`
          UPDATE product_inventory
          SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP
          WHERE id = $2
        `, [take, warehouse.id]);
        remaining -= take;
      }
      if (remaining === 0) break;
    }
    
    return { success: true, message: 'Товар списан с нескольких складов' };
  } else {
    // Списать с одного склада
    await client.query(`
      UPDATE product_inventory
      SET quantity = quantity - $1, last_updated = CURRENT_TIMESTAMP
      WHERE id = $2
    `, [quantity, findRes.rows[0].id]);
    
    return { success: true, message: 'Товар списан' };
  }
};

/**
 * Вернуть товар на склад (при отмене заказа)
 */
const returnInventory = async (client, items) => {
  for (const item of items) {
    // Находим основной склад (первый активный)
    const locationRes = await client.query(`
      SELECT pi.id
      FROM product_inventory pi
      INNER JOIN product_locations pl ON pi.location_id = pl.id
      WHERE pi.product_id = $1 AND pl.is_active = true
      ORDER BY pi.quantity DESC
      LIMIT 1
    `, [item.product_id]);
    
    if (locationRes.rowCount > 0) {
      await client.query(`
        UPDATE product_inventory
        SET quantity = quantity + $1, last_updated = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [item.quantity, locationRes.rows[0].id]);
    } else {
      // Если нет записи, создаем новую в основном складе (id=1)
      await client.query(`
        INSERT INTO product_inventory (product_id, location_id, quantity, min_stock_level)
        VALUES ($1, 1, $2, 0)
      `, [item.product_id, item.quantity]);
    }
  }
};

/**
 * Очистить корзину пользователя
 */
const clearUserCart = async (client, userId) => {
  await client.query(`
    DELETE FROM cart_items WHERE user_id = $1
  `, [userId]);
};

/**
 * Получить статистику по заказам
 */
const getOrderStats = async () => {
  const statsRes = await db.query(`
    SELECT 
      COUNT(*) as total_orders,
      SUM(total_amount) as total_revenue,
      AVG(total_amount) as avg_order_value,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders
    FROM orders
  `);
  
  const dailyStatsRes = await db.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as orders_count,
      SUM(total_amount) as daily_revenue
    FROM orders
    WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
    GROUP BY DATE(created_at)
    ORDER BY date DESC
  `);
  
  return {
    overall: statsRes.rows[0],
    daily: dailyStatsRes.rows
  };
};

module.exports = {
  getCartItemsWithDetails,
  createOrder,
  addOrderItem,
  getUserOrders,
  getAllOrders,
  getOrderById,
  updateOrderStatus,
  addStatusHistory,
  checkInventory,
  decreaseInventory,
  returnInventory,
  clearUserCart,
  getOrderStats
};