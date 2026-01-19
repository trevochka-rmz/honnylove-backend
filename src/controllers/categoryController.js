// src/controllers/categoryController.js
const categoryService = require('../services/categoryService');
const { addFullImageUrls } = require('../utils/imageUtils');
const upload = require('../middleware/uploadMiddleware');

// Получить все категории в формате дерева для фронтенда
const getAllCategoriesForFrontend = async (req, res, next) => {
  try {
    const categories = await categoryService.getAllCategoriesForFrontend();
    const processedCategories = addFullImageUrls(categories, req); 
    res.json({
      success: true,
      count: categories.length,
      data: processedCategories,
    });
  } catch (err) {
    next(err);
  }
};

// Получить категорию по идентификатору
const getCategoryByIdentifier = async (req, res, next) => {
  try {
    const category = await categoryService.getCategoryByIdentifier(req.params.identifier);
    const processedCategory = addFullImageUrls(category, req); 
    res.json({
      success: true,
      data: processedCategory,
    });
  } catch (err) {
    next(err);
  }
};

// Получить список категорий с пагинацией
const getCategories = async (req, res, next) => {
  try {
    const { categories, total, page, pages, limit, hasMore } =
      await categoryService.getAllCategories(req.query);
    const processedResult = addFullImageUrls(
      { categories, total, page, pages, limit, hasMore },
      req
    ); 
    res.json(processedResult);
  } catch (err) {
    next(err);
  }
};

// Создать новую категорию
const createCategory = [
  upload.single('image'),
  async (req, res, next) => {
      try {
          const category = await categoryService.createCategory(req.body, req.file);
          const processedCategory = addFullImageUrls(category, req);
          res.status(201).json({
              success: true,
              message: 'Категория создана успешно',
              data: processedCategory,
          });
      } catch (err) {
          next(err);
      }
  }
];

// Обновить категорию
const updateCategory = [
  upload.single('image'),
  async (req, res, next) => {
      try {
          const category = await categoryService.updateCategory(
              req.params.id,
              req.body,
              req.file
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
  }
];

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
  getCategoryByIdentifier,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategoriesForFrontend,
};