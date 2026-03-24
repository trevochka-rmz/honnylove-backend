// src/services/productExportService.js
const productExportModel = require('../models/productExportModel');
const AppError = require('../utils/errorUtils');
const Joi = require('joi');

// Схема валидации фильтров
const exportFilterSchema = Joi.object({
  brandId: Joi.number().integer().optional(),
  categoryId: Joi.number().integer().optional(),
  search: Joi.string().optional(),
  inStock: Joi.boolean().optional().default(true),
  showStatus: Joi.boolean().optional().default(false),
});

/**
 * Получить продукты для экспорта
 */
const getProductsForExport = async (filters = {}) => {
  // Преобразуем строковые булевы из query параметров
  const normalized = {
    ...filters,
    inStock: filters.inStock === 'true' || filters.inStock === true,
    showStatus: filters.showStatus === 'true' || filters.showStatus === true,
    brandId: filters.brandId ? Number(filters.brandId) : undefined,
    categoryId: filters.categoryId ? Number(filters.categoryId) : undefined,
  };

  const { error, value } = exportFilterSchema.validate(normalized);
  if (error) throw new AppError(error.details[0].message, 400);

  return productExportModel.getAllProductsForExport(value);
};

/**
 * Генерация данных для PDF/CSV
 */
const generateExportData = async (filters = {}) => {
  // используем оригинальный filters.showStatus напрямую
  const showStatus = filters.showStatus === 'true' || filters.showStatus === true;
  const products = await getProductsForExport(filters);

  const exportData = products.map(product => ({
    id: product.id,
    name: product.name,
    brand: product.brand_name || 'Нет бренда',
    category: product.category_name || 'Нет категории',
    price: parseFloat(product.price).toFixed(2),
    discountPrice: (product.discount_price && Number(product.discount_price) > 0)
      ? parseFloat(product.discount_price).toFixed(2)
      : null,
    priceDisplay: (product.discount_price && Number(product.discount_price) > 0)
      ? `${parseFloat(product.price).toFixed(2)} / ${parseFloat(product.discount_price).toFixed(2)} (скидка)`
      : parseFloat(product.price).toFixed(2),
    status: [
      product.is_active ? 'Активен' : null,
      product.is_featured ? 'Рекомендуем' : null,
      product.is_new ? 'Новинка' : null,
      product.is_bestseller ? 'Бестселлер' : null,
    ].filter(Boolean).join(', '),
    stock: product.stock_quantity,
    imageUrl: product.image,
    showStatus,  // используем преобразованный булев
  }));

  return exportData;
};

module.exports = {
  getProductsForExport,
  generateExportData
};