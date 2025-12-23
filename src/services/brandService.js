const Joi = require('joi');
const brandModel = require('../models/brandModel');
const productModel = require('../models/productModel');
const AppError = require('../utils/errorUtils');

const brandSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    website: Joi.string().uri().optional(),
    logo_url: Joi.string().optional(),
    is_active: Joi.boolean().default(true),
    full_description: Joi.string().optional(),
    country: Joi.string().optional(),
    founded: Joi.string().optional(),
    philosophy: Joi.string().optional(),
    highlights: Joi.array().items(Joi.string()).default([]),
    is_featured: Joi.boolean().default(false),
});

const querySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(8),
    isActive: Joi.boolean().optional(),
    search: Joi.string().optional(),
    filter: Joi.string().valid('featured', 'popular', 'new').optional(),
});

const getAllBrands = async (query) => {
    const { error, value } = querySchema.validate(query);
    if (error) throw new AppError(error.details[0].message, 400);
    return brandModel.getAllBrands(value);
};

const getBrandById = async (id) => {
    const brand = await brandModel.getBrandById(id);
    if (!brand) throw new AppError('Brand not found', 404);
    return brand;
};

const createBrand = async (data) => {
    const { error } = brandSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    const existing = await brandModel.getBrandByName(data.name);
    if (existing) throw new AppError('Brand name already exists', 409);
    return brandModel.createBrand(data);
};

const updateBrand = async (id, data) => {
    const { error } = brandSchema.validate(data, { stripUnknown: true });
    if (error) throw new AppError(error.details[0].message, 400);
    const brand = await brandModel.getBrandById(id);
    if (!brand) throw new AppError('Brand not found', 404);
    return brandModel.updateBrand(id, data);
};

const deleteBrand = async (id) => {
    const brand = await brandModel.getBrandById(id);
    if (!brand) throw new AppError('Brand not found', 404);
    const products = await productModel.getProductsByBrand(id);
    if (products.length > 0)
        throw new AppError('Brand is in use and cannot be deleted', 409);
    return brandModel.deleteBrand(id);
};

module.exports = {
    getAllBrands,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand,
};
