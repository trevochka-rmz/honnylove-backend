// src/services/categoryService.js
const Joi = require('joi');
const categoryModel = require('../models/categoryModel');
const AppError = require('../utils/errorUtils');

const categorySchema = Joi.object({
    name: Joi.string().required(),
    parent_id: Joi.number().integer().allow(null).optional(),
    description: Joi.string().optional(),
    slug: Joi.string().optional(),
    is_active: Joi.boolean().default(true),
    display_order: Joi.number().integer().default(0),
    image_url: Joi.string().optional(),
});

// Схема для update (все optional)
const updateSchema = Joi.object({
    name: Joi.string().optional(),
    parent_id: Joi.number().integer().allow(null).optional(),
    description: Joi.string().optional(),
    slug: Joi.string().optional(),
    is_active: Joi.boolean().optional(),
    display_order: Joi.number().integer().optional(),
    image_url: Joi.string().optional(),
});

const querySchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(50).default(10),
    isActive: Joi.boolean().optional(),
    search: Joi.string().optional(),
    filter: Joi.string().valid('popular', 'new').optional(),
});

// Построить дерево из плоских rows (3 уровня)
const getAllCategoriesForFrontend = async () => {
    const rows = await categoryModel.getAllCategoriesForFrontend();

    const categoryTree = {};

    rows.forEach((row) => {
        // Level 1
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

        // Level 2
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

            // Level 3
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

    // Преобразуем в массив и сортируем children
    return Object.values(categoryTree).map((cat) => ({
        ...cat,
        children: Object.values(cat.children).map((subCat) => ({
            ...subCat,
            children: Object.values(subCat.children),
        })),
    }));
};

// Получить категорию по ID
const getCategoryById = async (id) => {
    const category = await categoryModel.getCategoryById(id);
    if (!category) throw new AppError('Категория не найдена', 404);
    return category;
};

// Получить список категорий с пагинацией и фильтрами
const getAllCategories = async (query) => {
    const { error, value } = querySchema.validate(query);
    if (error) throw new AppError(error.details[0].message, 400);
    return categoryModel.getAllCategories(value);
};

// Создать категорию
const createCategory = async (data) => {
    const { error, value } = categorySchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);

    // Проверка уникальности имени (опционально, но рекомендуется)
    const existing = await categoryModel.getCategoryByName(value.name);
    if (existing) throw new AppError('Имя категории уже существует', 409);

    return categoryModel.createCategory(value);
};

// Обновить категорию
const updateCategory = async (id, data) => {
    const { error, value } = updateSchema.validate(data, {
        stripUnknown: true,
    });
    if (error) throw new AppError(error.details[0].message, 400);

    const category = await categoryModel.getCategorySimple(id);
    if (!category) throw new AppError('Категория не найдена', 404);

    // Если меняем name, проверяем уникальность (кроме себя)
    if (value.name && value.name !== category.name) {
        const existing = await categoryModel.getCategoryByName(value.name);
        if (existing) throw new AppError('Имя категории уже существует', 409);
    }

    return categoryModel.updateCategory(id, value);
};

// Удалить категорию
const deleteCategory = async (id) => {
    const category = await categoryModel.getCategorySimple(id);
    if (!category) throw new AppError('Категория не найдена', 404);

    // Проверки уже в модели, но здесь можно добавить дополнительные
    try {
        await categoryModel.deleteCategory(id);
    } catch (err) {
        throw new AppError(err.message, 409);
    }
};

module.exports = {
    getAllCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategoriesForFrontend,
};
