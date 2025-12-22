// src/services/categoryService.js
const Joi = require('joi');
const categoryModel = require('../models/categoryModel');
const AppError = require('../utils/errorUtils'); // Импорт AppError

const categorySchema = Joi.object({
    name: Joi.string().required(),
    parent_id: Joi.number().integer().optional(),
    description: Joi.string().optional(),
    slug: Joi.string().optional(), // Генерируется триггером
    is_active: Joi.boolean().default(true),
    display_order: Joi.number().integer().default(0),
});

const getAllCategories = async (query) => {
    const { page = 1, limit = 10, isActive } = query;
    return categoryModel.getAllCategories({ page, limit, isActive });
};

const getCategoryById = async (id) => {
    const category = await categoryModel.getCategoryById(id);
    if (!category) throw new AppError('Category not found', 404);
    return category;
};

const createCategory = async (data) => {
    const { error } = categorySchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    return categoryModel.createCategory(data);
};

const updateCategory = async (id, data) => {
    const { error } = categorySchema.validate(data, { stripUnknown: true });
    if (error) throw new AppError(error.details[0].message, 400);
    const category = await categoryModel.getCategoryById(id);
    if (!category) throw new AppError('Category not found', 404);
    return categoryModel.updateCategory(id, data);
};

const deleteCategory = async (id) => {
    const category = await categoryModel.getCategoryById(id);
    if (!category) throw new AppError('Category not found', 404);
    // Проверить подкатегории и продукты (добавь если нужно, e.g., check subcats)
    return categoryModel.deleteCategory(id);
};

const getCategoriesTree = async () => {
    return categoryModel.getCategoriesTree();
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getCategoriesTree,
};
