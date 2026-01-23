// src/services/productExportService.js
const productExportModel = require('../models/productExportModel');
const AppError = require('../utils/errorUtils');
const Joi = require('joi');

// Схема валидации фильтров
const exportFilterSchema = Joi.object({
  brandId: Joi.number().integer().optional(),
  categoryId: Joi.number().integer().optional(),
  search: Joi.string().optional(),
});

/**
 * Получить продукты для экспорта
 */
const getProductsForExport = async (filters = {}) => {
  const { error, value } = exportFilterSchema.validate(filters);
  if (error) throw new AppError(error.details[0].message, 400);
  
  return productExportModel.getAllProductsForExport(value);
};

/**
 * Генерация PDF
 */
const generateProductsPDF = async (filters = {}) => {
  const products = await getProductsForExport(filters);
  
  // Форматируем данные для PDF
  const pdfData = products.map(product => ({
    id: product.id,
    name: product.name,
    brand: product.brand_name,
    category: product.category_name,
    price: parseFloat(product.price).toFixed(2),
    discountPrice: product.discount_price ? parseFloat(product.discount_price).toFixed(2) : null,
    priceDisplay: product.discount_price 
      ? `${parseFloat(product.discount_price).toFixed(2)} (скидка)`
      : parseFloat(product.price).toFixed(2),
    status: [
      product.is_active ? 'Активен' : null,
      product.is_featured ? 'Рекомендуем' : null,
      product.is_new ? 'Новинка' : null,
      product.is_bestseller ? 'Бестселлер' : null
    ].filter(Boolean).join(', '),
    stock: product.stock_quantity,
    imageUrl: product.image
  }));
  
  return pdfData;
};

module.exports = {
  getProductsForExport,
  generateProductsPDF
};