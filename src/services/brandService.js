// src/services/brandService.js
const Joi = require('joi');
const brandModel = require('../models/brandModel');
const productModel = require('../models/productModel'); // Для проверки использования
const AppError = require('../utils/errorUtils'); // Импорт AppError

const brandSchema = Joi.object({
    name: Joi.string().required(),
    description: Joi.string().optional(),
    website: Joi.string().uri().optional(),
    logo_url: Joi.string().optional(),
    is_active: Joi.boolean().default(true),
});

const getAllBrands = async (query) => {
    const { page = 1, limit = 10, isActive } = query;
    return brandModel.getAllBrands({ page, limit, isActive });
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
    if (existing) throw new AppError('Brand name already exists', 409); // 409 Conflict
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
    // Проверить использование в продуктах
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
