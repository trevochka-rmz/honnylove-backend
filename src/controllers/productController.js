const productService = require('../services/productService'); // Путь к service, скорректируй если нужно

const getProducts = async (req, res, next, isAdmin = false) => {
  try {
    let data = await productService.getAllProducts(req.query, isAdmin);
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

const getProductById = async (req, res, next, isAdmin = false) => {
  try {
    let product = await productService.getProductById(req.params.id, isAdmin);
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
    const product = await productService.createProduct(req.body);
    res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

const updateProduct = async (req, res, next) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.body);
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
    const products = await productService.searchProducts(req.query.query);
    res.json(products);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
};