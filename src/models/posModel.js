// src/models/posModel.js
const db = require('../config/db');

/**
 * 🛒 БЫСТРОЕ СОЗДАНИЕ ЗАКАЗА ПО ID ТОВАРОВ (для POS-терминала/кассира)
 * Получить информацию о товарах по массиву ID для быстрого оформления
 */
const getProductsForCheckout = async (client, productIds) => {
  if (!productIds || productIds.length === 0) {
    return [];
  }

  const placeholders = productIds.map((_, i) => `$${i + 1}`).join(',');

  const res = await client.query(`
    SELECT 
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
      
      COALESCE(
        (SELECT SUM(quantity) 
         FROM product_inventory pi 
         JOIN product_locations pl ON pi.location_id = pl.id
         WHERE pi.product_id = pp.id AND pl.is_active = true),
        0
      ) as available_stock
      
    FROM product_products pp
    LEFT JOIN product_brands pb ON pp.brand_id = pb.id
    LEFT JOIN product_categories pc ON pp.category_id = pc.id
    WHERE pp.id IN (${placeholders})
      AND pp.is_active = true
    ORDER BY pp.id
  `, productIds);

  return res.rows;
};

/**
 * 📊 ПОЛУЧИТЬ ЗАКАЗЫ С РАСШИРЕННЫМИ ФИЛЬТРАМИ ДЛЯ POS
 */
const getPOSOrders = async (filters = {}, limit = 50, offset = 0) => {
  const { 
    status, 
    payment_method,
    created_by, 
    date_from, 
    date_to,
    today_only,
    this_week,
    this_month,
    search,
    is_pos_order // фильтр только для POS заказов
  } = filters;

  let whereConditions = [];
  let params = [];
  let paramCount = 1;

  // Фильтр только POS заказов (созданные через POS-терминал)
  if (is_pos_order) {
    whereConditions.push(`o.notes ILIKE '%[POS]%'`);
  }

  if (status) {
    whereConditions.push(`o.status = $${paramCount}`);
    params.push(status);
    paramCount++;
  }

  if (payment_method) {
    whereConditions.push(`o.payment_method = $${paramCount}`);
    params.push(payment_method);
    paramCount++;
  }

  if (created_by) {
    whereConditions.push(`o.user_id = $${paramCount}`);
    params.push(created_by);
    paramCount++;
  }

  // Фильтры по дате
  if (today_only) {
    whereConditions.push(`DATE(o.created_at) = CURRENT_DATE`);
  } else if (this_week) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
  } else if (this_month) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
  } else {
    if (date_from) {
      whereConditions.push(`o.created_at >= $${paramCount}`);
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      whereConditions.push(`o.created_at <= $${paramCount}`);
      params.push(date_to + ' 23:59:59'); // включаем весь день
      paramCount++;
    }
  }

  if (search) {
    whereConditions.push(`(
      o.id::text ILIKE $${paramCount} OR
      o.tracking_number ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount}
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
      o.payment_method,
      o.shipping_cost,
      o.tax_amount,
      o.discount_amount,
      o.tracking_number,
      o.notes,
      o.created_at,
      o.updated_at,
      
      u.email as cashier_email,
      u.first_name as cashier_first_name,
      u.last_name as cashier_last_name,
      
      COUNT(DISTINCT oi.id) as items_count,
      COALESCE(SUM(oi.quantity), 0) as total_items_quantity,
      
      -- Агрегируем товары
      COALESCE(
        json_agg(
          json_build_object(
            'id', oi.id,
            'product_id', pp.id,
            'product_name', pp.name,
            'product_sku', pp.sku,
            'quantity', oi.quantity,
            'price', oi.price,
            'discount_price', oi.discount_price,
            'line_total', oi.quantity * COALESCE(oi.discount_price, oi.price)
          ) ORDER BY oi.id
        ) FILTER (WHERE oi.id IS NOT NULL),
        '[]'::json
      ) as items
      
    FROM orders o
    LEFT JOIN users u ON o.user_id = u.id
    LEFT JOIN order_items oi ON o.id = oi.order_id
    LEFT JOIN product_products pp ON oi.product_id = pp.id
    ${whereClause}
    GROUP BY o.id, u.id
    ORDER BY o.created_at DESC
    LIMIT $${paramCount} OFFSET $${paramCount + 1}
  `, [...params, limit, offset]);

  return ordersRes.rows;
};

/**
 * 📊 ПОЛУЧИТЬ КОЛИЧЕСТВО ЗАКАЗОВ С ФИЛЬТРАМИ
 */
const getPOSOrdersCount = async (filters = {}) => {
  const { 
    status, 
    payment_method,
    created_by, 
    date_from, 
    date_to,
    today_only,
    this_week,
    this_month,
    search,
    is_pos_order
  } = filters;

  let whereConditions = [];
  let params = [];
  let paramCount = 1;

  if (is_pos_order) {
    whereConditions.push(`o.notes ILIKE '%[POS]%'`);
  }

  if (status) {
    whereConditions.push(`o.status = $${paramCount}`);
    params.push(status);
    paramCount++;
  }

  if (payment_method) {
    whereConditions.push(`o.payment_method = $${paramCount}`);
    params.push(payment_method);
    paramCount++;
  }

  if (created_by) {
    whereConditions.push(`o.user_id = $${paramCount}`);
    params.push(created_by);
    paramCount++;
  }

  if (today_only) {
    whereConditions.push(`DATE(o.created_at) = CURRENT_DATE`);
  } else if (this_week) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
  } else if (this_month) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
  } else {
    if (date_from) {
      whereConditions.push(`o.created_at >= $${paramCount}`);
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      whereConditions.push(`o.created_at <= $${paramCount}`);
      params.push(date_to + ' 23:59:59');
      paramCount++;
    }
  }

  if (search) {
    whereConditions.push(`(
      o.id::text ILIKE $${paramCount} OR
      o.tracking_number ILIKE $${paramCount} OR
      u.email ILIKE $${paramCount} OR
      u.first_name ILIKE $${paramCount} OR
      u.last_name ILIKE $${paramCount}
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

/**
 * 📈 ПОЛУЧИТЬ СТАТИСТИКУ ПО ПРОДАЖАМ ЗА ПЕРИОД
 */
const getSalesStatistics = async (filters = {}) => {
  const { 
    date_from, 
    date_to,
    today_only,
    this_week,
    this_month,
    cashier_id,
    is_pos_order
  } = filters;

  let whereConditions = [];
  let params = [];
  let paramCount = 1;

  if (is_pos_order) {
    whereConditions.push(`o.notes ILIKE '%[POS]%'`);
  }

  if (cashier_id) {
    whereConditions.push(`o.user_id = $${paramCount}`);
    params.push(cashier_id);
    paramCount++;
  }

  if (today_only) {
    whereConditions.push(`DATE(o.created_at) = CURRENT_DATE`);
  } else if (this_week) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
  } else if (this_month) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
  } else {
    if (date_from) {
      whereConditions.push(`o.created_at >= $${paramCount}`);
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      whereConditions.push(`o.created_at <= $${paramCount}`);
      params.push(date_to + ' 23:59:59');
      paramCount++;
    }
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ') 
    : '';

  const res = await db.query(`
    SELECT 
      COUNT(*) as total_orders,
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_orders,
      COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_orders,
      COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_orders,
      
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(AVG(total_amount), 0) as avg_order_value,
      COALESCE(MAX(total_amount), 0) as max_order_value,
      COALESCE(MIN(total_amount), 0) as min_order_value,
      
      COUNT(CASE WHEN payment_method = 'cash' THEN 1 END) as cash_orders,
      COUNT(CASE WHEN payment_method = 'card' THEN 1 END) as card_orders,
      
      COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) as cash_revenue,
      COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) as card_revenue
      
    FROM orders o
    ${whereClause}
  `, params);

  return res.rows[0];
};

/**
 * 🏆 ПОЛУЧИТЬ ТОП ТОВАРЫ ЗА ПЕРИОД
 */
const getTopProducts = async (filters = {}, limit = 10) => {
  const { 
    date_from, 
    date_to,
    today_only,
    this_week,
    this_month,
    is_pos_order
  } = filters;

  let whereConditions = [];
  let params = [];
  let paramCount = 1;

  if (is_pos_order) {
    whereConditions.push(`o.notes ILIKE '%[POS]%'`);
  }

  if (today_only) {
    whereConditions.push(`DATE(o.created_at) = CURRENT_DATE`);
  } else if (this_week) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
  } else if (this_month) {
    whereConditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
  } else {
    if (date_from) {
      whereConditions.push(`o.created_at >= $${paramCount}`);
      params.push(date_from);
      paramCount++;
    }

    if (date_to) {
      whereConditions.push(`o.created_at <= $${paramCount}`);
      params.push(date_to + ' 23:59:59');
      paramCount++;
    }
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ') 
    : '';

  const res = await db.query(`
    SELECT 
      pp.id,
      pp.name,
      pp.sku,
      pp.main_image_url,
      
      COUNT(oi.id) as times_ordered,
      SUM(oi.quantity) as total_quantity_sold,
      SUM(oi.quantity * COALESCE(oi.discount_price, oi.price)) as total_revenue
      
    FROM order_items oi
    INNER JOIN product_products pp ON oi.product_id = pp.id
    INNER JOIN orders o ON oi.order_id = o.id
    ${whereClause}
    GROUP BY pp.id
    ORDER BY total_quantity_sold DESC
    LIMIT $${paramCount}
  `, [...params, limit]);

  return res.rows;
};

/**
 * 📅 ПОЛУЧИТЬ СТАТИСТИКУ ПО ДНЯМ
 */
const getDailySalesStats = async (filters = {}) => {
  const { 
    date_from, 
    date_to,
    is_pos_order
  } = filters;

  let whereConditions = [];
  let params = [];
  let paramCount = 1;

  if (is_pos_order) {
    whereConditions.push(`o.notes ILIKE '%[POS]%'`);
  }

  // По умолчанию последние 30 дней
  const defaultDateFrom = date_from || 'CURRENT_DATE - INTERVAL \'30 days\'';
  
  if (date_from) {
    whereConditions.push(`o.created_at >= $${paramCount}`);
    params.push(date_from);
    paramCount++;
  } else {
    whereConditions.push(`o.created_at >= CURRENT_DATE - INTERVAL '30 days'`);
  }

  if (date_to) {
    whereConditions.push(`o.created_at <= $${paramCount}`);
    params.push(date_to + ' 23:59:59');
    paramCount++;
  }

  const whereClause = whereConditions.length > 0 
    ? 'WHERE ' + whereConditions.join(' AND ') 
    : '';

  const res = await db.query(`
    SELECT 
      DATE(o.created_at) as date,
      COUNT(*) as orders_count,
      COALESCE(SUM(o.total_amount), 0) as daily_revenue,
      COALESCE(AVG(o.total_amount), 0) as avg_order_value,
      
      COUNT(CASE WHEN o.payment_method = 'cash' THEN 1 END) as cash_orders,
      COUNT(CASE WHEN o.payment_method = 'card' THEN 1 END) as card_orders
      
    FROM orders o
    ${whereClause}
    GROUP BY DATE(o.created_at)
    ORDER BY date DESC
  `, params);

  return res.rows;
};

module.exports = {
  getProductsForCheckout,
  getPOSOrders,
  getPOSOrdersCount,
  getSalesStatistics,
  getTopProducts,
  getDailySalesStats
};