const productService = require('../services/productService');
const { addFullImageUrls } = require('../utils/imageUtils');

const getProducts = async (req, res, next) => {
    try {
        const result = await productService.getAllProducts(req.query);
        const processedResult = addFullImageUrls(result, req);
        res.json(processedResult);
    } catch (err) {
        next(err);
    }
};

const getProductById = async (req, res, next) => {
    try {
        const product = await productService.getProductById(req.params.id);
        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        const processedProduct = addFullImageUrls(product, req);
        res.json(processedProduct);
    } catch (err) {
        next(err);
    }
};

const createProduct = async (req, res, next) => {
    try {
        const product = await productService.createProduct(req.body);

        // Добавляем полные URL к изображениям
        const processedProduct = addFullImageUrls(req, product);

        res.status(201).json(processedProduct);
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

        // Добавляем полные URL к изображениям
        const processedProduct = addFullImageUrls(req, product);

        res.json(processedProduct);
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

        // Добавляем полные URL к изображениям
        const processedResults = addFullImageUrls(req, results);

        res.json(processedResults);
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
