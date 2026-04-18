// src/controllers/productController.js
const productService = require('../services/productService');
const upload = require('../middleware/uploadMiddleware');

// ─────────────────────────────────────────────────────────────────
// Получить список продуктов
// GET /api/products?region=ru (по умолчанию) | ?region=kg
// ─────────────────────────────────────────────────────────────────
const getProducts = async (req, res, next, isAdmin = false) => {
    try {
        let data = await productService.getAllProducts(req.query, isAdmin);

        // Менеджер не видит закупочную цену
        if (isAdmin && req.user?.role === 'manager') {
            data.products = data.products.map(({ purchasePrice, ...rest }) => rest);
        }

        res.json(data);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────
// Получить один продукт по ID или slug
// GET /api/products/:identifier?region=ru
// ─────────────────────────────────────────────────────────────────
const getProductByIdentifier = async (req, res, next, isAdmin = false) => {
    try {
        const region = req.query.region === 'kg' ? 'kg' : 'ru';
        let product = await productService.getProductByIdentifier(req.params.identifier, isAdmin, region);

        // Менеджер не видит закупочную цену
        if (isAdmin && req.user?.role === 'manager') {
            const { purchasePrice, ...rest } = product;
            product = rest;
        }

        res.json(product);
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────
// Создать продукт
// POST /api/products
// Content-Type: multipart/form-data
// ─────────────────────────────────────────────────────────────────
const createProduct = [
    upload.fields([
        { name: 'mainImage', maxCount: 1  },
        { name: 'gallery',   maxCount: 2 },
    ]),
    async (req, res, next) => {
        try {
            const mainImageFile = req.files?.mainImage?.[0] || null;
            const galleryFiles  = req.files?.gallery || [];
            const product = await productService.createProduct(req.body, mainImageFile, galleryFiles);
            res.status(201).json(product);
        } catch (err) {
            next(err);
        }
    },
];

// ─────────────────────────────────────────────────────────────────
// Обновить продукт
// PUT /api/products/:id
// Content-Type: multipart/form-data
// ─────────────────────────────────────────────────────────────────
const updateProduct = [
    upload.fields([
        { name: 'mainImage', maxCount: 1  },
        { name: 'gallery',   maxCount: 2 },
    ]),
    async (req, res, next) => {
        try {
            const mainImageFile = req.files?.mainImage?.[0] || null;
            const galleryFiles  = req.files?.gallery || [];
            const product = await productService.updateProduct(
                req.params.id, req.body, mainImageFile, galleryFiles
            );
            res.json(product);
        } catch (err) {
            next(err);
        }
    },
];

// ─────────────────────────────────────────────────────────────────
// Удалить продукт
// DELETE /api/products/:id
// ─────────────────────────────────────────────────────────────────
const deleteProduct = async (req, res, next) => {
    try {
        await productService.deleteProduct(req.params.id);
        res.status(204).send();
    } catch (err) {
        next(err);
    }
};

// ─────────────────────────────────────────────────────────────────
// Поиск продуктов
// GET /api/products/search?query=крем&region=ru
// ─────────────────────────────────────────────────────────────────
const searchProducts = async (req, res, next) => {
    try {
        const region = req.query.region === 'kg' ? 'kg' : 'ru';
        const result = await productService.searchProducts(req.query.query, region);
        res.json(result);
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