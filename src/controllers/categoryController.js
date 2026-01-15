// src/controllers/categoryController.js
const categoryService = require('../services/categoryService');
const { addFullImageUrls } = require('../utils/imageUtils');

// Получить все категории в формате дерева для фронта
const getAllCategoriesForFrontend = async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategoriesForFrontend();
    const processedCategories = addFullImageUrls(categories, req); // Добавляем full URLs к image_url
    res.json({
      success: true,
      count: categories.length,
      data: processedCategories,
    });
  } catch (err) {
    next(err);
  }
};

// Получить категорию по identifier (с детьми)
const getCategoryByIdentifier = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryByIdentifier(req.params.identifier);
    const processedCategory = addFullImageUrls(category, req); // Full URLs для image_url и children
    res.json({
      success: true,
      data: processedCategory,
    });
  } catch (err) {
    next(err);
  }
};

// Получить список категорий (с пагинацией для админки)
const getCategories = async (req, res, next) => {
  try {
    const { categories, total, page, pages, limit, hasMore } =
      await categoryService.getAllCategories(req.query);
    const processedResult = addFullImageUrls(
      { categories, total, page, pages, limit, hasMore },
      req
    ); // Full URLs
    res.json(processedResult);
  } catch (err) {
    next(err);
  }
};

// Создать категорию
const createCategory = async (req, res, next) => {
  try {
    const category = await categoryService.createCategory(req.body);
    const processedCategory = addFullImageUrls(category, req);
    res.status(201).json({
      success: true,
      message: 'Категория создана успешно',
      data: processedCategory,
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
    const processedCategory = addFullImageUrls(category, req);
    res.json({
      success: true,
      message: 'Категория обновлена успешно',
      data: processedCategory,
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
  getCategoryByIdentifier, // Изменили имя
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategoriesForFrontend,
};