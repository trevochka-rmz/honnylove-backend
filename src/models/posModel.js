// src/models/posModel.js
const db = require('../config/db');

// ─────────────────────────────────────────────────────────────────
// Получить информацию о товарах для предпросмотра чека
//
// ИСПРАВЛЕНО: остаток считается только по location_id = 1 (Россия),
// т.к. POS-продажи идут с основного склада
// ─────────────────────────────────────────────────────────────────
const getProductsForCheckout = async (client, productIds) => {
    if (!productIds || productIds.length === 0) return [];

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

            pb.name   AS brand_name,
            pc.name   AS category_name,

            CASE
                WHEN pp.discount_price IS NOT NULL AND pp.discount_price > 0
                THEN pp.discount_price
                ELSE pp.retail_price
            END       AS final_price,

            -- ИСПРАВЛЕНО: только основной склад (location_id = 1)
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_inventory pi
                 JOIN product_locations pl ON pi.location_id = pl.id
                 WHERE pi.product_id = pp.id
                   AND pi.location_id = 1
                   AND pl.is_active = TRUE),
                0
            )         AS available_stock

        FROM product_products pp
        LEFT JOIN product_brands pb ON pp.brand_id = pb.id
        LEFT JOIN product_categories pc ON pp.category_id = pc.id
        WHERE pp.id IN (${placeholders})
          AND pp.is_active = TRUE
        ORDER BY pp.id
    `, productIds);

    return res.rows;
};

// ─────────────────────────────────────────────────────────────────
// Получить остаток конкретного варианта на основном складе
// Используется в posService при проверке наличия варианта
// ─────────────────────────────────────────────────────────────────
const getVariantStock = async (client, variantId) => {
    const res = await client.query(`
        SELECT COALESCE(SUM(pi.quantity), 0)::integer AS available_stock
        FROM product_inventory pi
        JOIN product_locations pl ON pi.location_id = pl.id
        WHERE pi.variant_id = $1
          AND pi.location_id = 1
          AND pl.is_active = TRUE
    `, [variantId]);
    return parseInt(res.rows[0]?.available_stock ?? 0, 10);
};

// ─────────────────────────────────────────────────────────────────
// Получить POS заказы с фильтрами
// ИСПРАВЛЕНО: добавлен LEFT JOIN product_variants для variant_id/name в items
// ─────────────────────────────────────────────────────────────────
const getPOSOrders = async (filters = {}, limit = 50, offset = 0) => {
    const {
        status, payment_method, created_by,
        date_from, date_to,
        today_only, this_week, this_month,
        search, is_pos_order,
    } = filters;

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (is_pos_order) conditions.push(`o.notes ILIKE '%[POS]%'`);
    if (status)        { conditions.push(`o.status = $${p++}`);          params.push(status); }
    if (payment_method){ conditions.push(`o.payment_method = $${p++}`);  params.push(payment_method); }
    if (created_by)    { conditions.push(`o.user_id = $${p++}`);         params.push(created_by); }

    if (today_only) {
        conditions.push(`DATE(o.created_at) = CURRENT_DATE`);
    } else if (this_week) {
        conditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
    } else if (this_month) {
        conditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
    } else {
        if (date_from) { conditions.push(`o.created_at >= $${p++}`);             params.push(date_from); }
        if (date_to)   { conditions.push(`o.created_at <= $${p++}`);             params.push(date_to + ' 23:59:59'); }
    }

    if (search) {
        conditions.push(`(
            o.id::text ILIKE $${p} OR
            o.tracking_number ILIKE $${p} OR
            u.email ILIKE $${p} OR
            u.first_name ILIKE $${p} OR
            u.last_name ILIKE $${p} OR
            o.customer_first_name ILIKE $${p} OR
            o.customer_last_name ILIKE $${p} OR
            o.customer_phone ILIKE $${p}
        )`);
        params.push(`%${search}%`);
        p++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const res = await db.query(`
        SELECT
            o.id, o.user_id, o.status, o.total_amount,
            o.payment_method, o.shipping_cost, o.tax_amount, o.discount_amount,
            o.tracking_number, o.notes,
            o.created_at, o.updated_at,
            o.customer_first_name, o.customer_last_name, o.customer_phone,

            u.email       AS cashier_email,
            u.first_name  AS cashier_first_name,
            u.last_name   AS cashier_last_name,

            COUNT(DISTINCT oi.id)         AS items_count,
            COALESCE(SUM(oi.quantity), 0) AS total_items_quantity,

            -- ИСПРАВЛЕНО: добавлены variant_id и variant_name
            COALESCE(
                json_agg(
                    json_build_object(
                        'id',             oi.id,
                        'product_id',     pp.id,
                        'product_name',   pp.name,
                        'product_sku',    pp.sku,
                        'variant_id',     oi.variant_id,
                        'variant_name',   pv.name,
                        'variant_options',pv.options,
                        'quantity',       oi.quantity,
                        'price',          oi.price,
                        'discount_price', oi.discount_price,
                        'line_total',     oi.quantity * CASE
                            WHEN oi.discount_price IS NOT NULL AND oi.discount_price > 0
                            THEN oi.discount_price ELSE oi.price END
                    ) ORDER BY oi.id
                ) FILTER (WHERE oi.id IS NOT NULL),
                '[]'::json
            )                             AS items

        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN product_products pp ON oi.product_id = pp.id
        LEFT JOIN product_variants pv ON oi.variant_id = pv.id    -- ДОБАВЛЕН
        ${where}
        GROUP BY o.id, u.id
        ORDER BY o.created_at DESC
        LIMIT $${p} OFFSET $${p + 1}
    `, [...params, limit, offset]);

    return res.rows;
};

// ─────────────────────────────────────────────────────────────────
// Подсчёт POS заказов (для пагинации)
// ─────────────────────────────────────────────────────────────────
const getPOSOrdersCount = async (filters = {}) => {
    const {
        status, payment_method, created_by,
        date_from, date_to,
        today_only, this_week, this_month,
        search, is_pos_order,
    } = filters;

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (is_pos_order) conditions.push(`o.notes ILIKE '%[POS]%'`);
    if (status)        { conditions.push(`o.status = $${p++}`);         params.push(status); }
    if (payment_method){ conditions.push(`o.payment_method = $${p++}`); params.push(payment_method); }
    if (created_by)    { conditions.push(`o.user_id = $${p++}`);        params.push(created_by); }

    if (today_only) {
        conditions.push(`DATE(o.created_at) = CURRENT_DATE`);
    } else if (this_week) {
        conditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
    } else if (this_month) {
        conditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
    } else {
        if (date_from) { conditions.push(`o.created_at >= $${p++}`);            params.push(date_from); }
        if (date_to)   { conditions.push(`o.created_at <= $${p++}`);            params.push(date_to + ' 23:59:59'); }
    }

    if (search) {
        conditions.push(`(
            o.id::text ILIKE $${p} OR
            o.tracking_number ILIKE $${p} OR
            u.email ILIKE $${p} OR
            u.first_name ILIKE $${p} OR
            u.last_name ILIKE $${p} OR
            o.customer_first_name ILIKE $${p} OR
            o.customer_last_name ILIKE $${p} OR
            o.customer_phone ILIKE $${p}
        )`);
        params.push(`%${search}%`);
        p++;
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const res = await db.query(`
        SELECT COUNT(DISTINCT o.id) AS total
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ${where}
    `, params);

    return parseInt(res.rows[0].total, 10);
};

// ─────────────────────────────────────────────────────────────────
// Статистика продаж за период
// ─────────────────────────────────────────────────────────────────
const getSalesStatistics = async (filters = {}) => {
    const { date_from, date_to, today_only, this_week, this_month, cashier_id, is_pos_order } = filters;

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (is_pos_order) conditions.push(`o.notes ILIKE '%[POS]%'`);
    if (cashier_id)   { conditions.push(`o.user_id = $${p++}`); params.push(cashier_id); }

    if (today_only) {
        conditions.push(`DATE(o.created_at) = CURRENT_DATE`);
    } else if (this_week) {
        conditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
    } else if (this_month) {
        conditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
    } else {
        if (date_from) { conditions.push(`o.created_at >= $${p++}`);            params.push(date_from); }
        if (date_to)   { conditions.push(`o.created_at <= $${p++}`);            params.push(date_to + ' 23:59:59'); }
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const res = await db.query(`
        SELECT
            COUNT(*)                                                          AS total_orders,
            COUNT(CASE WHEN status = 'completed' THEN 1 END)                 AS completed_orders,
            COUNT(CASE WHEN status = 'paid'      THEN 1 END)                 AS paid_orders,
            COUNT(CASE WHEN status = 'cancelled' THEN 1 END)                 AS cancelled_orders,
            COALESCE(SUM(total_amount), 0)                                   AS total_revenue,
            COALESCE(AVG(total_amount), 0)                                   AS avg_order_value,
            COALESCE(MAX(total_amount), 0)                                   AS max_order_value,
            COALESCE(MIN(total_amount), 0)                                   AS min_order_value,
            COUNT(CASE WHEN payment_method = 'cash' THEN 1 END)              AS cash_orders,
            COUNT(CASE WHEN payment_method = 'card' THEN 1 END)              AS card_orders,
            COALESCE(SUM(CASE WHEN payment_method = 'cash' THEN total_amount ELSE 0 END), 0) AS cash_revenue,
            COALESCE(SUM(CASE WHEN payment_method = 'card' THEN total_amount ELSE 0 END), 0) AS card_revenue
        FROM orders o
        ${where}
    `, params);

    return res.rows[0];
};

// ─────────────────────────────────────────────────────────────────
// Топ товаров за период
// ─────────────────────────────────────────────────────────────────
const getTopProducts = async (filters = {}, limit = 10) => {
    const { date_from, date_to, today_only, this_week, this_month, is_pos_order } = filters;

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (is_pos_order) conditions.push(`o.notes ILIKE '%[POS]%'`);
    if (today_only) {
        conditions.push(`DATE(o.created_at) = CURRENT_DATE`);
    } else if (this_week) {
        conditions.push(`o.created_at >= DATE_TRUNC('week', CURRENT_DATE)`);
    } else if (this_month) {
        conditions.push(`o.created_at >= DATE_TRUNC('month', CURRENT_DATE)`);
    } else {
        if (date_from) { conditions.push(`o.created_at >= $${p++}`);            params.push(date_from); }
        if (date_to)   { conditions.push(`o.created_at <= $${p++}`);            params.push(date_to + ' 23:59:59'); }
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const res = await db.query(`
        SELECT
            pp.id,
            pp.name,
            pp.sku,
            pp.main_image_url,
            COUNT(oi.id)                                                          AS times_ordered,
            SUM(oi.quantity)                                                      AS total_quantity_sold,
            SUM(oi.quantity * CASE
                WHEN oi.discount_price IS NOT NULL AND oi.discount_price > 0
                THEN oi.discount_price ELSE oi.price END)                         AS total_revenue
        FROM order_items oi
        INNER JOIN product_products pp ON oi.product_id = pp.id
        INNER JOIN orders o ON oi.order_id = o.id
        ${where}
        GROUP BY pp.id
        ORDER BY total_quantity_sold DESC
        LIMIT $${p}
    `, [...params, limit]);

    return res.rows;
};

// ─────────────────────────────────────────────────────────────────
// Статистика по дням
// ─────────────────────────────────────────────────────────────────
const getDailySalesStats = async (filters = {}) => {
    const { date_from, date_to, is_pos_order } = filters;

    const conditions = [];
    const params     = [];
    let   p          = 1;

    if (is_pos_order) conditions.push(`o.notes ILIKE '%[POS]%'`);

    if (date_from) {
        conditions.push(`o.created_at >= $${p++}`);
        params.push(date_from);
    } else {
        conditions.push(`o.created_at >= CURRENT_DATE - INTERVAL '30 days'`);
    }
    if (date_to) {
        conditions.push(`o.created_at <= $${p++}`);
        params.push(date_to + ' 23:59:59');
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const res = await db.query(`
        SELECT
            DATE(o.created_at)              AS date,
            COUNT(*)                        AS orders_count,
            COALESCE(SUM(o.total_amount), 0) AS daily_revenue,
            COALESCE(AVG(o.total_amount), 0) AS avg_order_value,
            COUNT(CASE WHEN o.payment_method = 'cash' THEN 1 END) AS cash_orders,
            COUNT(CASE WHEN o.payment_method = 'card' THEN 1 END) AS card_orders
        FROM orders o
        ${where}
        GROUP BY DATE(o.created_at)
        ORDER BY date DESC
    `, params);

    return res.rows;
};

// ─────────────────────────────────────────────────────────────────
// Список кассиров
// ─────────────────────────────────────────────────────────────────
const getCashiers = async (currentUserRole) => {
    let roleFilter;
    if (currentUserRole === 'manager') roleFilter = `u.role = 'manager'`;
    else if (currentUserRole === 'admin') roleFilter = `u.role IN ('manager', 'admin')`;
    else return [];

    const res = await db.query(`
        SELECT
            u.id, u.email, u.first_name, u.last_name, u.role,
            u.phone, u.is_active, u.created_at,
            COUNT(DISTINCT o.id)            AS total_orders,
            COALESCE(SUM(o.total_amount), 0) AS total_revenue,
            COALESCE(AVG(o.total_amount), 0) AS avg_order_value,
            MAX(o.created_at)               AS last_order_date
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.notes ILIKE '%[POS]%'
        WHERE ${roleFilter} AND u.is_active = TRUE
        GROUP BY u.id
        ORDER BY u.first_name, u.last_name
    `);
    return res.rows;
};

const getCashierById = async (cashierId) => {
    const res = await db.query(`
        SELECT
            u.id, u.email, u.first_name, u.last_name, u.role,
            u.phone, u.is_active, u.created_at,
            COUNT(DISTINCT o.id)            AS total_orders,
            COALESCE(SUM(o.total_amount), 0) AS total_revenue,
            COALESCE(AVG(o.total_amount), 0) AS avg_order_value,
            COALESCE(MAX(o.total_amount), 0) AS max_order_value,
            COUNT(CASE WHEN o.payment_method = 'cash' THEN 1 END) AS cash_orders,
            COUNT(CASE WHEN o.payment_method = 'card' THEN 1 END) AS card_orders,
            MIN(o.created_at)               AS first_order_date,
            MAX(o.created_at)               AS last_order_date
        FROM users u
        LEFT JOIN orders o ON u.id = o.user_id AND o.notes ILIKE '%[POS]%'
        WHERE u.id = $1
        GROUP BY u.id
    `, [cashierId]);
    return res.rows[0] || null;
};

// ─────────────────────────────────────────────────────────────────
// Вспомогательные (используются в posService)
// ─────────────────────────────────────────────────────────────────
const deletePOSOrder = async (client, orderId) => {
    const res = await client.query(
        `SELECT id, notes FROM orders WHERE id = $1`,
        [orderId]
    );
    if (res.rowCount === 0) return null;
    const order = res.rows[0];
    if (!order.notes?.includes('[POS]')) throw new Error('Это не POS заказ');
    return order;
};

const updatePOSOrder = async (client, orderId, updateData) => {
    const allowed = [
        'payment_method','discount_amount','notes',
        'customer_first_name','customer_last_name','customer_phone',
    ];
    const updates = [];
    const values  = [];
    let   p       = 1;

    Object.keys(updateData).forEach(key => {
        if (allowed.includes(key) && updateData[key] !== undefined) {
            updates.push(`${key} = $${p++}`);
            values.push(updateData[key]);
        }
    });

    if (updates.length === 0) return null;

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(orderId);

    const res = await client.query(`
        UPDATE orders SET ${updates.join(', ')}
        WHERE id = $${p} AND notes ILIKE '%[POS]%'
        RETURNING *
    `, values);

    return res.rows[0] || null;
};

module.exports = {
    getProductsForCheckout,
    getVariantStock,
    getPOSOrders,
    getPOSOrdersCount,
    getSalesStatistics,
    getTopProducts,
    getDailySalesStats,
    getCashiers,
    getCashierById,
    deletePOSOrder,
    updatePOSOrder,
};