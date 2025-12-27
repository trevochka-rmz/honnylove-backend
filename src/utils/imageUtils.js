// utils/imageUtils.js

/**
 * Добавляет полный URL к изображениям продукта
 * @param {Object|Array} data - Данные продукта или массив продуктов
 * @param {Object} req - Объект запроса Express
 * @returns {Object|Array} - Обработанные данные с полными URL
 */
const addFullImageUrls = (data, req) => {
    if (!data || !req) return data;

    // Получаем базовый URL сервера (http://localhost:3050)
    const baseUrl = `${req.protocol}://${req.get('host')}`;

    // Функция для добавления базового URL к пути
    const addBaseUrl = (imagePath) => {
        if (!imagePath || typeof imagePath !== 'string') {
            return null;
        }

        // Если уже полный URL, оставляем как есть
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
        // Структура: [...products]
        return data.map(processProduct);
    } else {
        // Одиночный продукт
        return processProduct(data);
    }
};

module.exports = {
    addFullImageUrls,
};
