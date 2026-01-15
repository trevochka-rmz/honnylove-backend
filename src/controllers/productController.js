// controllers/productController.js
const productService = require('../services/productService');
const { addFullImageUrls } = require('../utils/imageUtils'); // НОВОЕ: Импорт утилиты для добавления полных URL к изображениям

const getProducts = async (req, res, next, isAdmin = false) => {
  try {
    let data = await productService.getAllProducts(req.query, isAdmin);
    
    // НОВОЕ: Добавляем полные URL к изображениям (image, images) во всех продуктах
    // Это обработает структуру { products: [...], total, page, ... }
    data = addFullImageUrls(data, req);
    
    if (isAdmin && req.user && req.user.role === 'manager') {
      // Фильтрация purchasePrice для manager в админ-роутах
      data.products = data.products.map(product => {
        const { purchasePrice, ...rest } = product;
        return rest;
      });
    }
    res.json(data);
  } catch (err) {
    next(err);
  }
};

const getProductByIdentifier = async (req, res, next, isAdmin = false) => {
  try {
    let product = await productService.getProductByIdentifier(req.params.identifier, isAdmin);
    
    // НОВОЕ: Добавляем полные URL к изображениям (image, images) для одиночного продукта
    product = addFullImageUrls(product, req);
    
    if (isAdmin && req.user && req.user.role === 'manager') {
      // Фильтрация для manager
      const { purchasePrice, ...rest } = product;
      product = rest;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

const createProduct = async (req, res, next) => {
  try {
    let product = await productService.createProduct(req.body);
    
    // НОВОЕ: Добавляем полные URL к изображениям после создания
    product = addFullImageUrls(product, req);
    
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    let product = await productService.updateProduct(req.params.id, req.body);
    
    // НОВОЕ: Добавляем полные URL к изображениям после обновления
    product = addFullImageUrls(product, req);
    
    res.json(product);
  } catch (err) {
    next(err);
  }
};

const deleteProduct = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

const searchProducts = async (req, res, next) => {
  try {
    let products = await productService.searchProducts(req.query.query);
    
    // НОВОЕ: Добавляем полные URL к изображениям в массиве продуктов
    // imageUtils обработает простой массив [...]
    products = addFullImageUrls(products, req);
    
    res.json(products);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getProductByIdentifier, // Изменили имя
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
};