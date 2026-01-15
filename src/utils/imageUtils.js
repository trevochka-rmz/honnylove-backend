// utils/imageUtils.js

/**
 * Добавляет полный URL к изображениям продукта, категории или бренда
 * @param {Object|Array} data - Данные продукта/категории/бренда или массив
 * @param {Object} req - Объект запроса Express (опционально для dev)
 * @returns {Object|Array} - Обработанные данные с полными URL
 */
const addFullImageUrls = (data, req) => {
    if (!data) return data;
  
    // ===== ГЛАВНОЕ ИЗМЕНЕНИЕ: Два разных baseUrl =====
    
    // 1. Для статических файлов (изображения) используем Yandex Cloud
    const imageBaseUrl = 'https://honnylove-images.website.yandexcloud.net';
    
    // 2. Для API endpoints используем основной домен (если понадобится в будущем)
    let apiBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3050';
    
    // Если в dev и есть req — используем динамический URL для API
    if (process.env.NODE_ENV !== 'production' && req) {
      apiBaseUrl = `${req.protocol}://${req.get('host')}`;
    }
  
    /**
     * Функция для добавления базового URL к пути изображения
     * Всегда использует imageBaseUrl (Yandex Cloud) для путей с /
     */
    const addBaseUrl = (imagePath) => {
      if (!imagePath || typeof imagePath !== 'string') {
        return null;
      }
  
      // Если уже полный URL (начинается с http:// или https://), оставляем как есть
      if (
        imagePath.startsWith('http://') ||
        imagePath.startsWith('https://')
      ) {
        return imagePath;
      }
  
      // Если путь начинается с /, добавляем imageBaseUrl (Yandex Cloud)
      if (imagePath.startsWith('/')) {
        return `${imageBaseUrl}${imagePath}`;
      }
  
      // Если путь без начального /, добавляем его и imageBaseUrl
      return `${imageBaseUrl}/${imagePath}`;
    };
  
    /**
     * Функция для обработки одного объекта
     * Проходит по всем полям и добавляет URL к изображениям
     */
    const processItem = (item) => {
      if (!item || typeof item !== 'object') {
        return item;
      }
  
      // Создаем копию объекта, чтобы не мутировать оригинал
      const processed = { ...item };
  
      // ===== Обрабатываем ОСНОВНЫЕ ИЗОБРАЖЕНИЯ для разных типов объектов =====
  
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
  
      // 4. Для БАННЕРОВ (поле 'image_url')
      // (баннеры также используют image_url, как и категории)
  
      // 5. Для БЛОГОВ (поле 'image')
      // (блоги используют поле 'image', как и продукты)
  
      // ===== Обрабатываем МАССИВЫ изображений =====
  
      // 6. Обрабатываем галерею продуктов (поле 'images' - массив строк)
      if (item.images && Array.isArray(item.images)) {
        processed.images = item.images.map(addBaseUrl);
      }
  
      // 7. Обрабатываем image_urls для продуктов (если используется в БД)
      if (item.image_urls && Array.isArray(item.image_urls)) {
        processed.image_urls = item.image_urls.map(addBaseUrl);
      }
  
      // ===== Обрабатываем ВЛОЖЕННЫЕ структуры =====
  
      // 8. Обрабатываем дочерние элементы (для категорий с children)
      if (item.children && Array.isArray(item.children)) {
        processed.children = item.children.map(processItem);
      }
  
      // 9. Обрабатываем продукты внутри бренда (если есть)
      if (item.products && Array.isArray(item.products)) {
        processed.products = item.products.map(processItem);
      }
  
      return processed;
    };
  
    // ===== Обрабатываем данные в зависимости от структуры ответа =====
  
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
    } else if (data.categories && Array.isArray(data.categories)) {
      // Структура: { categories: [...], total, page, ... } - для списка категорий
      return {
        ...data,
        categories: data.categories.map(processItem),
      };
    } else if (data.banners && Array.isArray(data.banners)) {
      // Структура: { banners: [...], ... } - для списка баннеров
      return {
        ...data,
        banners: data.banners.map(processItem),
      };
    } else if (data.posts && Array.isArray(data.posts)) {
      // Структура: { posts: [...], ... } - для списка блог-постов
      return {
        ...data,
        posts: data.posts.map(processItem),
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
      // Одиночный объект (продукт, бренд, категория, баннер, пост и т.д.)
      return processItem(data);
    }
  };
  
  module.exports = {
    addFullImageUrls,
  };