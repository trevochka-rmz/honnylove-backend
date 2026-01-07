// utils/imageUtils.js

/**
 * Добавляет полный URL к изображениям продукта, категории или бренда
 * @param {Object|Array} data - Данные продукта/категории/бренда или массив
 * @param {Object} req - Объект запроса Express (опционально для dev)
 * @returns {Object|Array} - Обработанные данные с полными URL
 */
const addFullImageUrls = (data, req) => {
    if (!data) return data;

    // Берем baseUrl из env (для prod: https://honnylove.ru; для dev: из req)
    let baseUrl = process.env.APP_BASE_URL || 'http://localhost:3050';

    // Если в dev и есть req — используем динамический (для тестов)
    if (process.env.NODE_ENV !== 'production' && req) {
        baseUrl = `${req.protocol}://${req.get('host')}`;
    }

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
    
    // Функция для обработки одного объекта
    const processItem = (item) => {
        if (!item || typeof item !== 'object') {
            return item;
        }

        // Создаем копию объекта
        const processed = { ...item };

        // Обрабатываем ОСНОВНЫЕ ИЗОБРАЖЕНИЯ для разных типов объектов:

        // 1. Для продуктов (поле 'image' или 'main_image_url')
        if (item.image) {
            processed.image = addBaseUrl(item.image);
        }
        if (item.main_image_url) {
            processed.main_image_url = addBaseUrl(item.main_image_url);
        }

        // 2. Для категорий (поле 'image_url')
        if (item.image_url) {
            processed.image_url = addBaseUrl(item.image_url);
        }

        // 3. Для БРЕНДОВ (поле 'logo')
        if (item.logo) {
            processed.logo = addBaseUrl(item.logo);
        }
        // Также обрабатываем logo_url, если используется
        if (item.logo_url) {
            processed.logo_url = addBaseUrl(item.logo_url);
        }

        // 4. Обрабатываем галерею продуктов (поле 'images')
        if (item.images && Array.isArray(item.images)) {
            processed.images = item.images.map(addBaseUrl);
        }

        // 5. Обрабатываем дочерние элементы (для категорий)
        if (item.children && Array.isArray(item.children)) {
            processed.children = item.children.map(processItem);
        }

        // 6. Обрабатываем продукты внутри бренда (если есть)
        if (item.products && Array.isArray(item.products)) {
            processed.products = item.products.map(processItem);
        }

        return processed;
    };

    // Обрабатываем данные в зависимости от структуры
    if (data.products && Array.isArray(data.products)) {
        // Структура: { products: [...], total, page, ... }
        return {
            ...data,
            products: data.products.map(processItem),
        };
    } else if (data.brands && Array.isArray(data.brands)) {
        // Структура: { brands: [...], total, page, ... } - для списка брендов
        return {
            ...data,
            brands: data.brands.map(processItem),
        };
    } else if (data.data && Array.isArray(data.data)) {
        // Структура: { data: [...], success: true, ... }
        return {
            ...data,
            data: data.data.map(processItem),
        };
    } else if (Array.isArray(data)) {
        // Структура: [...items]
        return data.map(processItem);
    } else {
        // Одиночный объект
        return processItem(data);
    }
};

module.exports = {
    addFullImageUrls,
};
