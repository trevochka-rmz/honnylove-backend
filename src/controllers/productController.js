// src/controllers/productController.js
const productService = require('../services/productService');
const { addFullImageUrls } = require('../utils/imageUtils');

// Получить список продуктов
const getProducts = async (req, res, next, isAdmin = false) => {
  try {
    let data = await productService.getAllProducts(req.query, isAdmin);
    data = addFullImageUrls(data, req);
    if (isAdmin && req.user && req.user.role === 'manager') {
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

// Получить продукт по идентификатору
const getProductByIdentifier = async (req, res, next, isAdmin = false) => {
  try {
    let product = await productService.getProductByIdentifier(req.params.identifier, isAdmin);
    product = addFullImageUrls(product, req);
    if (isAdmin && req.user && req.user.role === 'manager') {
      const { purchasePrice, ...rest } = product;
      product = rest;
    }
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// Создать новый продукт
const createProduct = async (req, res, next) => {
  try {
    let product = await productService.createProduct(req.body);
    product = addFullImageUrls(product, req);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

// Обновить продукт
const updateProduct = async (req, res, next) => {
  try {
    let product = await productService.updateProduct(req.params.id, req.body);
    product = addFullImageUrls(product, req);
    res.json(product);
  } catch (err) {
    next(err);
  }
};

// Удалить продукт
const deleteProduct = async (req, res, next) => {
  try {
    await productService.deleteProduct(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

// Поиск продуктов
const searchProducts = async (req, res, next) => {
  try {
    let products = await productService.searchProducts(req.query.query);
    products = addFullImageUrls(products, req);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getProductByIdentifier,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
};