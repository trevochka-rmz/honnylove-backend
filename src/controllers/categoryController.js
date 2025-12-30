// src/controllers/categoryController.js
const categoryService = require('../services/categoryService');
const { addFullImageUrls } = require('../utils/imageUtils');

// Получить все категории в формате дерева
const getAllCategoriesForFrontend = async (req, res, next) => {
    try {
        const categories = await categoryService.getAllCategoriesForFrontend();
        const processedCategories = addFullImageUrls(categories, req);

        res.json({
            success: true,
            data: processedCategories,
        });
    } catch (err) {
        next(err);
    }
};

// Получить категорию по ID (с детьми)
const getCategoryById = async (req, res, next) => {
    try {
        const category = await categoryService.getCategoryById(req.params.id);
        const processedCategory = addFullImageUrls(category, req);

        res.json({
            success: true,
            data: processedCategory,
        });
    } catch (err) {
        next(err);
    }
};

// Получить список категорий (админка)
const getCategories = async (req, res, next) => {
    try {
        const result = await categoryService.getAllCategories(req.query);
        const processedResult = addFullImageUrls(result, req);

        res.json({
            success: true,
            data: processedResult,
            meta: {
                page: parseInt(req.query.page) || 1,
                limit: parseInt(req.query.limit) || 10,
            },
        });
    } catch (err) {
        next(err);
    }
};

// Создать категорию
const createCategory = async (req, res, next) => {
    try {
        const category = await categoryService.createCategory(req.body);

        res.status(201).json({
            success: true,
            message: 'Категория создана',
            data: category,
        });
    } catch (err) {
        next(err);
    }
};

// Обновить категорию
const updateCategory = async (req, res, next) => {
    try {
        const category = await categoryService.updateCategory(
            req.params.id,
            req.body
        );

        res.json({
            success: true,
            message: 'Категория обновлена',
            data: category,
        });
    } catch (err) {
        next(err);
    }
};

// Удалить категорию
const deleteCategory = async (req, res, next) => {
    try {
        await categoryService.deleteCategory(req.params.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getCategories,
    getCategoryById,
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategoriesForFrontend,
};
