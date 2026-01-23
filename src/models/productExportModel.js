// src/models/productExportModel.js
const db = require('../config/db');

/**
 * Получить все продукты для экспорта в PDF
 * @param {Object} filters - Фильтры
 * @returns {Promise<Array>} - Массив продуктов
 */
const getAllProductsForExport = async (filters = {}) => {
  let query = `
    SELECT 
      p.id,
      p.name,
      p.main_image_url as image,
      b.name as brand_name,
      pc.name as category_name,
      p.retail_price as price,
      p.discount_price as discount_price,
      p.is_active,
      p.is_featured,
      p.is_new,
      p.is_bestseller,
      COALESCE(pi.quantity, 0) as stock_quantity,
      p.created_at
    FROM product_products p
    LEFT JOIN product_brands b ON p.brand_id = b.id
    LEFT JOIN product_categories pc ON p.category_id = pc.id
    LEFT JOIN product_inventory pi ON p.id = pi.product_id AND pi.location_id = 1
    WHERE 1=1
  `;
  
  const params = [];
  let paramIndex = 1;
  
  // Фильтры
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
  
  query += ` ORDER BY p.id DESC`;
  
  const { rows } = await db.query(query, params);
  return rows;
};

module.exports = {
  getAllProductsForExport
};