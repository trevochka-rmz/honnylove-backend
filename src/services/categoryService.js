// src/services/categoryService.js
const Joi = require('joi');
const categoryModel = require('../models/categoryModel');
const AppError = require('../utils/errorUtils');

const categorySchema = Joi.object({
    name: Joi.string().required(),
    parent_id: Joi.number().integer().optional(),
    description: Joi.string().optional(),
    slug: Joi.string().optional(),
    is_active: Joi.boolean().default(true),
    display_order: Joi.number().integer().default(0),
});

// Получить все категории в формате дерева для фронта
const getAllCategoriesForFrontend = async () => {
    const rows = await categoryModel.getAllCategoriesForFrontend();

    const categoryTree = {};

    rows.forEach((row) => {
        // Уровень 1
        if (!categoryTree[row.l1_id]) {
            categoryTree[row.l1_id] = {
                id: row.l1_id,
                name: row.l1_name,
                slug: row.l1_slug,
                image_url: row.l1_image_url,
                display_order: row.l1_order,
                product_count: row.l1_product_count,
                children: {},
            };
        }

        // Уровень 2
        if (row.l2_id) {
            if (!categoryTree[row.l1_id].children[row.l2_id]) {
                categoryTree[row.l1_id].children[row.l2_id] = {
                    id: row.l2_id,
                    name: row.l2_name,
                    slug: row.l2_slug,
                    image_url: row.l2_image_url,
                    display_order: row.l2_order,
                    product_count: row.l2_product_count,
                    children: {},
                };
            }

            // Уровень 3
            if (row.l3_id) {
                if (
                    !categoryTree[row.l1_id].children[row.l2_id].children[
                        row.l3_id
                    ]
                ) {
                    categoryTree[row.l1_id].children[row.l2_id].children[
                        row.l3_id
                    ] = {
                        id: row.l3_id,
                        name: row.l3_name,
                        slug: row.l3_slug,
                        image_url: row.l3_image_url,
                        display_order: row.l3_order,
                        product_count: row.l3_product_count,
                    };
                }
            }
        }
    });

    return Object.values(categoryTree).map((cat) => ({
        ...cat,
        children: Object.values(cat.children).map((subCat) => ({
            ...subCat,
            children: Object.values(subCat.children),
        })),
    }));
};

// Получить категорию по ID (только дети, без внуков)
const getCategoryById = async (id) => {
    const category = await categoryModel.getCategoryById(id);

    if (!category) {
        throw new AppError('Category not found', 404);
    }

    return category;
};

// Получить список категорий с пагинацией
const getAllCategories = async (query) => {
    const { page = 1, limit = 10, isActive } = query;
    return categoryModel.getAllCategories({ page, limit, isActive });
};

// Создать категорию
const createCategory = async (data) => {
    const { error } = categorySchema.validate(data);

    if (error) {
        throw new AppError(error.details[0].message, 400);
    }

    return categoryModel.createCategory(data);
};

// Обновить категорию
const updateCategory = async (id, data) => {
    const { error } = categorySchema.validate(data, { stripUnknown: true });

    if (error) {
        throw new AppError(error.details[0].message, 400);
    }

    const category = await categoryModel.getCategorySimple(id);

    if (!category) {
        throw new AppError('Category not found', 404);
    }

    return categoryModel.updateCategory(id, data);
};

// Удалить категорию
const deleteCategory = async (id) => {
    const category = await categoryModel.getCategorySimple(id);

    if (!category) {
        throw new AppError('Category not found', 404);
    }

    return categoryModel.deleteCategory(id);
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategoriesForFrontend,
};
