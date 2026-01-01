const Joi = require('joi');
const productModel = require('../models/productModel');
const AppError = require('../utils/errorUtils');

// Схема для создания/обновления (без изменений)
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
    skin_type: Joi.string().max(100).optional(),
    weight_grams: Joi.number().integer().optional(),
    length_cm: Joi.number().integer().optional(),
    width_cm: Joi.number().integer().optional(),
    height_cm: Joi.number().integer().optional(),
    is_active: Joi.boolean().default(true),
    is_featured: Joi.boolean().default(false),
    is_new: Joi.boolean().default(true),
    is_bestseller: Joi.boolean().default(false),
    attributes: Joi.object()
        .keys({
            ingredients: Joi.string().optional(),
            usage: Joi.string().optional(),
            variants: Joi.array()
                .items(
                    Joi.object({
                        name: Joi.string(),
                        value: Joi.string(),
                    })
                )
                .optional(),
        })
        .default({}),
    meta_title: Joi.string().optional(),
    meta_description: Joi.string().optional(),
});

// Обновлённая схема для query: добавили categoryId, убрали category (string), subcategoryId теперь categoryId
const querySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(9),
    categoryId: Joi.number().integer().optional(), // Новый: id категории (с подкатегориями)
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
            'id_desc'
        )
        .default('id_desc'),
});

const getAllProducts = async (query) => {
    const { error, value } = querySchema.validate(query);
    if (error) throw new AppError(error.details[0].message, 400);
    return productModel.getAllProducts(value);
};

const getProductById = async (id) => {
    const product = await productModel.getProductById(id);
    if (!product) throw new AppError('Product not found', 404);
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
