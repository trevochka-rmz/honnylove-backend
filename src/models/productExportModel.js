// src/models/productExportModel.js
const db = require('../config/db');

// ─────────────────────────────────────────────────────────────────
// Получить все продукты для экспорта
//
// ИСПРАВЛЕНО: старый запрос делал
//   LEFT JOIN product_inventory pi ON p.id = pi.product_id AND pi.location_id = 1
// Это legacy-вариант без учёта вариантов — всегда возвращал 0 для товаров с вариантами,
// потому что все записи инвентаря теперь хранятся с variant_id.
//
// Новый запрос считает остаток через product_variants → product_inventory,
// суммируя по всем активным вариантам на складе Россия (location_id = 1).
// ─────────────────────────────────────────────────────────────────
const getAllProductsForExport = async (filters = {}) => {
    let query = `
        SELECT
            p.id,
            p.name,
            p.main_image_url                        AS image,
            b.name                                  AS brand_name,
            pc.name                                 AS category_name,
            p.retail_price                          AS price,
            p.discount_price,
            p.retail_price_kg,
            p.discount_price_kg,
            p.is_active,
            p.is_featured,
            p.is_new,
            p.is_bestseller,
            p.sku,
            p.created_at,

            -- ИСПРАВЛЕНО: остаток через варианты (location_id = 1, Россия)
            -- Для товаров без вариантов — 0 (у всех есть хотя бы "Стандарт")
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_variants pv
                 JOIN product_inventory pi ON pv.id = pi.variant_id
                 WHERE pv.product_id = p.id
                   AND pv.is_active = TRUE
                   AND pi.location_id = 1),
                0
            )::integer                              AS stock_quantity,

            -- Количество вариантов (для информации)
            COALESCE(
                (SELECT COUNT(*)
                 FROM product_variants pv
                 WHERE pv.product_id = p.id AND pv.is_active = TRUE),
                0
            )::integer                              AS variant_count

        FROM product_products p
        LEFT JOIN product_brands b ON p.brand_id = b.id
        LEFT JOIN product_categories pc ON p.category_id = pc.id
        WHERE 1 = 1
    `;

    const params = [];
    let paramIndex = 1;

    if (filters.brandId) {
        query += ` AND p.brand_id = $${paramIndex}`;
        params.push(filters.brandId);
        paramIndex++;
    }
    if (filters.categoryId) {
        query += ` AND p.category_id = $${paramIndex}`;
        params.push(filters.categoryId);
        paramIndex++;
    }
    if (filters.search) {
        query += ` AND (p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
    }
    if (filters.inStock) {
        // Фильтруем через подзапрос — WHERE после GROUP BY не нужен
        query += `
            AND EXISTS (
                SELECT 1
                FROM product_variants pv
                JOIN product_inventory pi ON pv.id = pi.variant_id
                WHERE pv.product_id = p.id
                  AND pv.is_active = TRUE
                  AND pi.location_id = 1
                  AND pi.quantity > 0
            )
        `;
    }

    query += ` ORDER BY p.id DESC`;

    const { rows } = await db.query(query, params);
    return rows;
};

module.exports = {
    getAllProductsForExport,
};