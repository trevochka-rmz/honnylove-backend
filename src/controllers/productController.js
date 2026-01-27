// src/controllers/productController.js
const productService = require('../services/productService');
const upload = require('../middleware/uploadMiddleware');

// Получить список продуктов
const getProducts = async (req, res, next, isAdmin = false) => {
  try {
    let data = await productService.getAllProducts(req.query, isAdmin);
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
const createProduct = [
  upload.fields([
      { name: 'mainImage', maxCount: 1 },
      { name: 'gallery', maxCount: 10 }
  ]),
  async (req, res, next) => {
      try {
          const mainImageFile = req.files?.mainImage ? req.files.mainImage[0] : null;
          const galleryFiles = req.files?.gallery || [];
          
          let product = await productService.createProduct(
              req.body, 
              mainImageFile, 
              galleryFiles
          );
          res.status(201).json(product);
      } catch (err) {
          next(err);
      }
  }
];

// Обновить продукт
const updateProduct = [
  upload.fields([
      { name: 'mainImage', maxCount: 1 },
      { name: 'gallery', maxCount: 2 }
  ]),
  async (req, res, next) => {
      try {
          const mainImageFile = req.files?.mainImage ? req.files.mainImage[0] : null;
          const galleryFiles = req.files?.gallery || [];
          
          let product = await productService.updateProduct(
              req.params.id, 
              req.body, 
              mainImageFile, 
              galleryFiles
          );
          res.json(product);
      } catch (err) {
          next(err);
      }
  }
];

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