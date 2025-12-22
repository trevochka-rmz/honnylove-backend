// src/controllers/productController.js
const productService = require('../services/productService');

const getProducts = async (req, res, next) => {
    try {
        const products = await productService.getAllProducts(req.query);
        res.json(products);
    } catch (err) {
        next(err);
    }
};

const getProductById = async (req, res, next) => {
    try {
        const product = await productService.getProductById(req.params.id);
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
        const product = await productService.updateProduct(
            req.params.id,
            req.body
        );
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
        const results = await productService.searchProducts(req.query.q);
        res.json(results);
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
