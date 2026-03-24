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
  attributes: Joi.alternatives().try(
    Joi.object()
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
    Joi.string().allow('') 
  ).optional(),
  meta_title: Joi.string().allow('').optional(),
  meta_description: Joi.string().allow('').optional(),
  stockQuantity: Joi.number().integer().min(0).optional(),
});

// Схема валидации для запроса списка продуктов
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(9),
  categoryId: Joi.number().integer().optional(),
  brandId: Joi.string().optional(),
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
  const parsed = {
    ...data,
    purchase_price: data.purchase_price ? Number(data.purchase_price) : undefined,
    retail_price: data.retail_price ? Number(data.retail_price) : undefined,
    discount_price: data.discount_price !== undefined && data.discount_price !== ''
      ? Number(data.discount_price)
      : null,
    brand_id: data.brand_id ? Number(data.brand_id) : undefined,
    category_id: data.category_id ? Number(data.category_id) : undefined,
    supplier_id: data.supplier_id ? Number(data.supplier_id) : null,
    weight_grams: data.weight_grams ? Number(data.weight_grams) : undefined,
    length_cm: data.length_cm ? Number(data.length_cm) : undefined,
    width_cm: data.width_cm ? Number(data.width_cm) : undefined,
    height_cm: data.height_cm ? Number(data.height_cm) : undefined,
    stockQuantity: data.stockQuantity ? Number(data.stockQuantity) : undefined,
    is_active: data.is_active === 'true' || data.is_active === true,
    is_featured: data.is_featured === 'true' || data.is_featured === true,
    is_new: data.is_new === 'true' || data.is_new === true,
    is_bestseller: data.is_bestseller === 'true' || data.is_bestseller === true,
  };

  // Парсим attributes ДО валидации — Joi ожидает объект, а не строку
  if (parsed.attributes && typeof parsed.attributes === 'string') {
    try {
      parsed.attributes = JSON.parse(parsed.attributes);
    } catch {
      parsed.attributes = {};
    }
  }

  const { error } = productSchema.validate(parsed);
  if (error) throw new AppError(error.details[0].message, 400);

  validateImageFile(mainImageFile);
  if (galleryFiles && galleryFiles.length > 0) {
    galleryFiles.forEach(file => validateImageFile(file));
  }

  return productModel.createProduct(parsed, mainImageFile, galleryFiles);
};


// Обновить продукт с валидацией
const updateProduct = async (id, data, mainImageFile, galleryFiles) => {
  const parsed = { ...data };

  if (data.purchase_price !== undefined) parsed.purchase_price = Number(data.purchase_price);
  if (data.retail_price !== undefined) parsed.retail_price = Number(data.retail_price);
  if (data.discount_price !== undefined && data.discount_price !== '') {
    parsed.discount_price = Number(data.discount_price);
  } else if (data.discount_price === '' || data.discount_price === '0') {
    parsed.discount_price = null;
  }
  if (data.brand_id !== undefined) parsed.brand_id = Number(data.brand_id);
  if (data.category_id !== undefined) parsed.category_id = Number(data.category_id);
  if (data.supplier_id !== undefined) parsed.supplier_id = data.supplier_id ? Number(data.supplier_id) : null;
  if (data.weight_grams !== undefined) parsed.weight_grams = data.weight_grams ? Number(data.weight_grams) : null;
  if (data.length_cm !== undefined) parsed.length_cm = data.length_cm ? Number(data.length_cm) : null;
  if (data.width_cm !== undefined) parsed.width_cm = data.width_cm ? Number(data.width_cm) : null;
  if (data.height_cm !== undefined) parsed.height_cm = data.height_cm ? Number(data.height_cm) : null;
  if (data.stockQuantity !== undefined) parsed.stockQuantity = Number(data.stockQuantity);
  if (data.is_active !== undefined) parsed.is_active = data.is_active === 'true' || data.is_active === true;
  if (data.is_featured !== undefined) parsed.is_featured = data.is_featured === 'true' || data.is_featured === true;
  if (data.is_new !== undefined) parsed.is_new = data.is_new === 'true' || data.is_new === true;
  if (data.is_bestseller !== undefined) parsed.is_bestseller = data.is_bestseller === 'true' || data.is_bestseller === true;

  // Парсим attributes ДО валидации
  if (parsed.attributes && typeof parsed.attributes === 'string') {
    try {
      parsed.attributes = JSON.parse(parsed.attributes);
    } catch {
      parsed.attributes = {};
    }
  }

  const { error } = updateSchema.validate(parsed, { allowUnknown: true });
  if (error) throw new AppError(error.details[0].message, 400);

  validateImageFile(mainImageFile);
  if (galleryFiles && galleryFiles.length > 0) {
    galleryFiles.forEach(file => validateImageFile(file));
  }

  const product = await getProductByIdentifier(id);
  if (!product) throw new AppError('Продукт не найден', 404);

  return productModel.updateProduct(id, parsed, mainImageFile, galleryFiles);
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