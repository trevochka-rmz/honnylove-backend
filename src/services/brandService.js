// src/services/brandService.js
const Joi = require('joi');
const brandModel = require('../models/brandModel');
const productModel = require('../models/productModel');
const AppError = require('../utils/errorUtils');

// Схема валидации для создания бренда
const brandSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().optional(),
  website: Joi.string().uri().optional(),
  logo_url: Joi.string().optional(),
  is_active: Joi.boolean().default(true),
  full_description: Joi.string().optional(),
  country: Joi.string().default('Южная Корея'),
  founded: Joi.string().optional(),
  philosophy: Joi.string().optional(),
  highlights: Joi.array().items(Joi.string()).default([]),
});

// Схема валидации для обновления бренда (все поля опциональные)
const updateSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().optional(),
  website: Joi.string().uri().optional(),
  logo_url: Joi.string().optional(),
  is_active: Joi.boolean().optional(),
  full_description: Joi.string().optional(),
  country: Joi.string().optional(),
  founded: Joi.string().optional(),
  philosophy: Joi.string().optional(),
  highlights: Joi.array().items(Joi.string()).optional(),
});

// Схема валидации для запросов списка брендов
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(8),
  isActive: Joi.boolean().optional(),
  search: Joi.string().optional(),
  filter: Joi.string().valid('popular', 'new', 'recommended').optional(),
});

// Получить все бренды с валидацией запроса
const getAllBrands = async (query) => {
  const { error, value } = querySchema.validate(query);
  if (error) throw new AppError(error.details[0].message, 400);
  return brandModel.getAllBrands(value);
};

// Получить краткий список всех брендов
const getAllBrandsBrief = async () => {
  return brandModel.getAllBrandsBrief();
};

// Получить бренд по идентификатору
const getBrandByIdentifier = async (identifier) => {
  const brand = await brandModel.getBrandByIdentifier(identifier);
  if (!brand) throw new AppError('Бренд не найден', 404);
  return brand;
};

// Создать новый бренд с валидацией
const createBrand = async (data) => {
  const { error, value } = brandSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  const existing = await brandModel.getBrandByName(value.name);
  if (existing) throw new AppError('Название бренда уже существует', 409);
  return brandModel.createBrand(value);
};

// Обновить бренд с валидацией
const updateBrand = async (id, data) => {
  const { error } = updateSchema.validate(data, { stripUnknown: true });
  if (error) throw new AppError(error.details[0].message, 400);
  const brand = await brandModel.getBrandByIdentifier(id);
  if (!brand) throw new AppError('Бренд не найден', 404);
  return brandModel.updateBrand(id, data);
};

// Удалить бренд с проверкой на связанные продукты
const deleteBrand = async (id) => {
  const brand = await brandModel.getBrandByIdentifier(id);
  if (!brand) throw new AppError('Бренд не найден', 404);
  const products = await productModel.getProductsByBrand(id);
  if (products.length > 0)
    throw new AppError(
      'Бренд содержит связанные продукты. Пожалуйста, сначала обновите бренд продуктов (установите другой бренд или удалите бренд) или удалите продукты, ассоциированные с этим брендом, перед его удалением.',
      409
    );
  return brandModel.deleteBrand(id);
};

module.exports = {
  getAllBrands,
  getAllBrandsBrief,
  getBrandByIdentifier,
  createBrand,
  updateBrand,
  deleteBrand,
};