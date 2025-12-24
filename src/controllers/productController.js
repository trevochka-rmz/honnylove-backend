const productService = require('../services/productService');

// Функция для добавления полного URL к изображениям
const addFullImageUrls = (req, data) => {
    if (!data || !req) return data;

    // Получаем базовый URL сервера (http://localhost:3050)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    // req.protocol = 'http', req.get('host') = 'localhost:3050'

    // Функция для добавления базового URL к пути
    const addBaseUrl = (imagePath) => {
        if (!imagePath || typeof imagePath !== 'string') {
            return null;
        }

        // Если уже полный URL (начинается с http), оставляем как есть
        if (
            imagePath.startsWith('http://') ||
            imagePath.startsWith('https://')
        ) {
            return imagePath;
        }

        // Если путь начинается с /, добавляем baseUrl
        if (imagePath.startsWith('/')) {
            return `${baseUrl}${imagePath}`;
        }

        // Если путь без начального /, добавляем его
        return `${baseUrl}/${imagePath}`;
    };

    // Функция для обработки одного продукта
    const processProduct = (product) => {
        if (!product || typeof product !== 'object') {
            return product;
        }

        // Создаем копию продукта
        const processed = { ...product };

        // Обрабатываем основное изображение (поле 'image')
        if (product.image) {
            processed.image = addBaseUrl(product.image);
        }

        // Обрабатываем галерею (поле 'images')
        if (product.images && Array.isArray(product.images)) {
            processed.images = product.images.map(addBaseUrl);
        }

        return processed;
    };

    // Обрабатываем данные в зависимости от структуры
    if (data.products && Array.isArray(data.products)) {
        // Структура: { products: [...], total, page, ... }
        return {
            ...data,
            products: data.products.map(processProduct),
        };
    } else if (Array.isArray(data)) {
        // Структура: [...products] (например, для поиска)
        return data.map(processProduct);
    } else {
        // Одиночный продукт
        return processProduct(data);
    }
};

const getProducts = async (req, res, next) => {
    try {
        // Получаем данные из сервиса
        const result = await productService.getAllProducts(req.query);

        // Добавляем полные URL к изображениям
        const processedResult = addFullImageUrls(req, result);

        // Отправляем ответ
        res.json(processedResult);
    } catch (err) {
        next(err);
    }
};

const getProductById = async (req, res, next) => {
    try {
        // Получаем продукт из сервиса
        const product = await productService.getProductById(req.params.id);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }

        // Добавляем полные URL к изображениям
        const processedProduct = addFullImageUrls(req, product);

        // Отправляем ответ
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
