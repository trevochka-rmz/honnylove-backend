// src/services/productService.js
const Joi = require('joi');
const productModel = require('../models/productModel');
const inventoryService = require('./inventoryService'); // Для проверки стока
const AppError = require('../utils/errorUtils'); // Импорт AppError

const productSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    purchase_price: Joi.number().positive().required(),
    retail_price: Joi.number().positive().required(),
    discount_price: Joi.number().positive().optional(),
    brand_id: Joi.number().integer().required(),
    category_id: Joi.number().integer().required(),
    supplier_id: Joi.number().integer().optional(),
    product_type: Joi.string().required(),
    target_audience: Joi.string().default('unisex'),
    main_image_url: Joi.string().optional(),
    image_urls: Joi.array().items(Joi.string()).default([]),
    weight_grams: Joi.number().integer().optional(),
    length_cm: Joi.number().integer().optional(),
    width_cm: Joi.number().integer().optional(),
    height_cm: Joi.number().integer().optional(),
    is_active: Joi.boolean().default(true),
    is_featured: Joi.boolean().default(false),
    is_new: Joi.boolean().default(true),
    is_bestseller: Joi.boolean().default(false),
    attributes: Joi.object().default({}),
    meta_title: Joi.string().optional(),
    meta_description: Joi.string().optional(),
});

const getAllProducts = async (query) => {
    const {
        page = 1,
        limit = 10,
        categoryId,
        brandId,
        search,
        minPrice,
        maxPrice,
        isFeatured,
        isNew,
        isBestseller,
    } = query;
    // Построить фильтры в модели
    return productModel.getAllProducts({
        page,
        limit,
        categoryId,
        brandId,
        search,
        minPrice,
        maxPrice,
        isFeatured,
        isNew,
        isBestseller,
    });
};

const getProductById = async (id) => {
    const product = await productModel.getProductById(id);
    if (!product) throw new AppError('Product not found', 404);
    // Опционально добавить reviews или stock
    return product;
};

const createProduct = async (data) => {
    const { error } = productSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    return productModel.createProduct(data);
};

const updateProduct = async (id, data) => {
    const { error } = productSchema.validate(data, { stripUnknown: true });
    if (error) throw new AppError(error.details[0].message, 400);
    const product = await productModel.getProductById(id);
    if (!product) throw new AppError('Product not found', 404);
    return productModel.updateProduct(id, data);
};

const deleteProduct = async (id) => {
    const product = await productModel.getProductById(id);
    if (!product) throw new AppError('Product not found', 404);
    // Проверить, если в заказах (опционально)
    return productModel.deleteProduct(id);
};

const searchProducts = async (query) => {
    if (!query) throw new AppError('Search query is required', 400);
    return productModel.searchProducts(query);
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
};
