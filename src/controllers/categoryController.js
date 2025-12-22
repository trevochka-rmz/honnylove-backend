// src/controllers/categoryController.js
const categoryService = require('../services/categoryService');

const getCategories = async (req, res, next) => {
    try {
        const categories = await categoryService.getAllCategories(req.query);
        res.json(categories);
    } catch (err) {
        next(err);
    }
};

const getCategoryById = async (req, res, next) => {
    try {
        const category = await categoryService.getCategoryById(req.params.id);
        res.json(category);
    } catch (err) {
        next(err);
    }
};

const createCategory = async (req, res, next) => {
    try {
        const category = await categoryService.createCategory(req.body);
        res.status(201).json(category);
    } catch (err) {
        next(err);
    }
};

const updateCategory = async (req, res, next) => {
    try {
        const category = await categoryService.updateCategory(
            req.params.id,
            req.body
        );
        res.json(category);
    } catch (err) {
        next(err);
    }
};

const deleteCategory = async (req, res, next) => {
    try {
        await categoryService.deleteCategory(req.params.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

const getCategoriesTree = async (req, res, next) => {
    try {
        const tree = await categoryService.getCategoriesTree();
        res.json(tree);
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
    getCategoriesTree,
};
