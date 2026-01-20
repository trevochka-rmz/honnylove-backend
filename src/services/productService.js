// src/services/productService.js
const Joi = require('joi');
const productModel = require('../models/productModel');
const AppError = require('../utils/errorUtils');
const { validateImageFile } = require('../utils/imageUtils');

// Схема валидации для создания продукта
const productSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  purchase_price: Joi.number().positive().required(),
  retail_price: Joi.number().positive().required(),
  discount_price: Joi.number().min(0).allow(null).optional(),
  brand_id: Joi.number().integer().required(),
  category_id: Joi.number().integer().required(),
  supplier_id: Joi.number().integer().allow(null).optional(),
  product_type: Joi.string().required(),
  target_audience: Joi.string().default('unisex'),
  main_image_url: Joi.string().allow('').optional(),
  image_urls: Joi.array().items(Joi.string()).default([]),
  skin_type: Joi.string().max(100).allow('').optional(),
  weight_grams: Joi.number().integer().allow(null).optional(),
  length_cm: Joi.number().integer().allow(null).optional(),
  width_cm: Joi.number().integer().allow(null).optional(),
  height_cm: Joi.number().integer().allow(null).optional(),
  is_active: Joi.boolean().default(true),
  is_featured: Joi.boolean().default(false),
  is_new: Joi.boolean().default(true),
  is_bestseller: Joi.boolean().default(false),
  attributes: Joi.object()
    .keys({
      ingredients: Joi.string().allow('').optional(),
      usage: Joi.string().allow('').optional(),
      variants: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().allow(''),
            value: Joi.string().allow(''),
          })
        )
        .optional(),
    })
    .default({}),
  meta_title: Joi.string().allow('').optional(),
  meta_description: Joi.string().allow('').optional(),
  stockQuantity: Joi.number().integer().min(0).optional(),
});

// Схема валидации для обновления продукта
const updateSchema = Joi.object({
  name: Joi.string().allow('').optional(),
  description: Joi.string().allow('').optional(),
  purchase_price: Joi.number().positive().optional(),
  retail_price: Joi.number().positive().optional(),
  discount_price: Joi.number().min(0).allow(null).optional(),
  brand_id: Joi.number().integer().optional(),
  category_id: Joi.number().integer().optional(),
  supplier_id: Joi.number().integer().allow(null).optional(),
  product_type: Joi.string().allow('').optional(),
  target_audience: Joi.string().allow('').optional(),
  main_image_url: Joi.string().allow('').optional(),
  image_urls: Joi.array().items(Joi.string()).optional(),
  skin_type: Joi.string().max(100).allow('').optional(),
  weight_grams: Joi.number().integer().allow(null).optional(),
  length_cm: Joi.number().integer().allow(null).optional(),
  width_cm: Joi.number().integer().allow(null).optional(),
  height_cm: Joi.number().integer().allow(null).optional(),
  is_active: Joi.boolean().optional(),
  is_featured: Joi.boolean().optional(),
  is_new: Joi.boolean().optional(),
  is_bestseller: Joi.boolean().optional(),
  attributes: Joi.object()
    .keys({
      ingredients: Joi.string().allow('').optional(),
      usage: Joi.string().allow('').optional(),
      variants: Joi.array()
        .items(
          Joi.object({
            name: Joi.string().allow(''),
            value: Joi.string().allow(''),
          })
        )
        .optional(),
    })
    .optional(),
  meta_title: Joi.string().allow('').optional(),
  meta_description: Joi.string().allow('').optional(),
  stockQuantity: Joi.number().integer().min(0).optional(),
});

// Схема валидации для запроса списка продуктов
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(9),
  categoryId: Joi.number().integer().optional(),
  brandId: Joi.number().integer().optional(),
  search: Joi.string().optional(),
  minPrice: Joi.number().positive().optional(),
  maxPrice: Joi.number().positive().optional(),
  isFeatured: Joi.boolean().optional(),
  isNew: Joi.boolean().optional(),
  isBestseller: Joi.boolean().optional(),
  isOnSale: Joi.boolean().optional(),
  sort: Joi.string()
    .valid(
      'popularity',
      'price_asc',
      'price_desc',
      'rating',
      'new_random',
      'id_desc',
      'newest'
    )
    .default('id_desc'),
});

// Получить все продукты с валидацией запроса
const getAllProducts = async (query, isAdmin = false) => {
  const { error, value } = querySchema.validate(query);
  if (error) throw new AppError(error.details[0].message, 400);
  return productModel.getAllProducts({ ...value, isAdmin });
};

// Получить продукт по идентификатору
const getProductByIdentifier = async (identifier, isAdmin = false) => {
  const product = await productModel.getProductByIdentifier(identifier, isAdmin);
  if (!product) throw new AppError('Продукт не найден', 404);
  return product;
};

// Создать новый продукт с валидацией
const createProduct = async (data, mainImageFile, galleryFiles) => {
  const { error } = productSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  
  validateImageFile(mainImageFile);
  if (galleryFiles && galleryFiles.length > 0) {
      galleryFiles.forEach(file => validateImageFile(file));
  }
  
  return productModel.createProduct(data, mainImageFile, galleryFiles);
};

// Обновить продукт с валидацией
const updateProduct = async (id, data, mainImageFile, galleryFiles) => {
  const { error } = updateSchema.validate(data, { allowUnknown: true });
  if (error) throw new AppError(error.details[0].message, 400);
  
  validateImageFile(mainImageFile);
  if (galleryFiles && galleryFiles.length > 0) {
      galleryFiles.forEach(file => validateImageFile(file));
  }
  
  const product = await getProductByIdentifier(id);
  if (!product) throw new AppError('Продукт не найден', 404);
  
  return productModel.updateProduct(id, data, mainImageFile, galleryFiles);
};

// Удалить продукт
const deleteProduct = async (id) => {
  const product = await getProductByIdentifier(id);
  if (!product) throw new AppError('Продукт не найден', 404);
  return productModel.deleteProduct(id);
};

// Поиск продуктов
const searchProducts = async (query) => {
  if (!query) throw new AppError('Не указан поисковый запрос', 400);
  return productModel.searchProducts(query);
};

module.exports = {
  getAllProducts,
  getProductByIdentifier,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
};