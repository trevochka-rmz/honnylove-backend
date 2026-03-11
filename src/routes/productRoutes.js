// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const productExportController = require('../controllers/productExportController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// =====================================================================================================
// ⚠️ КРИТИЧЕСКИ ВАЖНО: ПОРЯДОК МАРШРУТОВ ИМЕЕТ ЗНАЧЕНИЕ!
// =====================================================================================================
// Express обрабатывает маршруты СВЕРХУ ВНИЗ по порядку объявления.
// Статичные пути (вроде /search, /admin/all, /export/pdf) ДОЛЖНЫ идти ПЕРЕД динамическими (/:identifier)
// Иначе динамический маршрут /:identifier перехватит все запросы и вызовется БЕЗ authenticate!
// =====================================================================================================

// =====================================
// ПУБЛИЧНЫЕ СТАТИЧНЫЕ МАРШРУТЫ
// (Эти маршруты НЕ требуют авторизации)
// =====================================

/**
 * Поиск продуктов
 * GET /api/products/search?query=search_string&page=1&limit=20
 * Доступ: Публичный
 * 
 * Query параметры:
 * - query: поисковый запрос (обязательно)
 * - page: номер страницы (опционально, по умолчанию 1)
 * - limit: количество на странице (опционально, по умолчанию 20)
 * 
 * Ответ:
 * {
 *   "products": [...],
 *   "total": 100,
 *   "page": 1,
 *   "pages": 10,
 *   "limit": 20,
 *   "hasMore": true
 * }
 */
router.get('/search', productController.searchProducts);

/**
 * Получить список продуктов с пагинацией и фильтрами
 * GET /api/products?page=1&limit=9&categoryId=1&brandId=2&search=query&minPrice=100&maxPrice=500&isFeatured=true&isNew=true&isBestseller=true&isOnSale=true&sort=popularity
 * Доступ: Публичный
 *
 * Query параметры:
 * - page: номер страницы (по умолчанию 1)
 * - limit: количество на странице (по умолчанию 9, max 50)
 * - categoryId: ID категории (опционально)
 * - brandId: ID бренда или несколько через запятую (опционально, например: brandId=1,2,3)
 * - search: поиск по имени, описанию, бренду, категории, SKU и т.д. (опционально)
 * - minPrice: минимальная цена (опционально)
 * - maxPrice: максимальная цена (опционально)
 * - isFeatured: избранные товары (true/false, опционально)
 * - isNew: новинки (true/false, опционально)
 * - isBestseller: бестселлеры (true/false, опционально)
 * - isOnSale: товары со скидкой (true/false, опционально)
 * - sort: сортировка (опционально)
 *   Доступные значения:
 *   - popularity: по популярности (количество отзывов)
 *   - price_asc: по цене (возрастание)
 *   - price_desc: по цене (убывание)
 *   - rating: по рейтингу
 *   - new_random: случайные новинки
 *   - id_desc: по ID (по умолчанию)
 *   - newest: по дате создания (новые первыми)
 *   - relevance: по релевантности (только при поиске)
 * 
 * Ответ:
 * {
 *   "products": [
 *     {
 *       "id": 1,
 *       "name": "Название товара",
 *       "slug": "nazvanie-tovara",
 *       "description": "Описание",
 *       "price": 1000,
 *       "discountPrice": 800,
 *       "mainImageUrl": "https://...",
 *       "imageUrls": ["https://..."],
 *       "brand": "Бренд",
 *       "brandId": 1,
 *       "categoryName": "Категория",
 *       "categoryId": 1,
 *       "sku": "SKU-123",
 *       "rating": 4.5,
 *       "reviewCount": 10,
 *       "stockQuantity": 50,
 *       "inStock": true,
 *       "isFeatured": false,
 *       "isNew": true,
 *       "isBestseller": false,
 *       "skinType": "Все типы",
 *       "targetAudience": "unisex",
 *       "ingredients": "Состав",
 *       "usage": "Применение",
 *       "variants": [{"name": "Объём", "value": "50мл"}],
 *       "createdAt": "2025-01-15T10:30:00.000Z",
 *       "updatedAt": "2025-02-20T15:45:00.000Z"
 *     }
 *   ],
 *   "total": 100,
 *   "page": 1,
 *   "pages": 12,
 *   "limit": 9,
 *   "hasMore": true
 * }
 */
router.get('/', (req, res, next) =>
  productController.getProducts(req, res, next, false)
);

// =====================================
// АДМИНСКИЕ СТАТИЧНЫЕ МАРШРУТЫ
// (Эти маршруты требуют авторизации)
// =====================================

/**
 * Экспорт продуктов в PDF
 * GET /api/products/export/pdf?brandId=1&categoryId=2&search=query&inStock=true&showStatus=true
 * Доступ: Admin
 * 
 * Query параметры (все опциональны):
 * - brandId: фильтр по ID бренда
 * - categoryId: фильтр по ID категории
 * - search: поиск по имени, описанию и т.д.
 * - inStock: только товары в наличии (true/false)
 * - showStatus: показать статус товаров в PDF (true/false)
 * 
 * Ответ: PDF файл для скачивания
 */
router.get(
  '/export/pdf',
  authenticate,
  requireRole(['admin']),
  productExportController.exportProductsToPDF
);

/**
 * Экспорт продуктов в CSV
 * GET /api/products/export/csv?brandId=1&categoryId=2&search=query&inStock=true&showStatus=true
 * Доступ: Admin
 * 
 * Query параметры (все опциональны):
 * - brandId: фильтр по ID бренда
 * - categoryId: фильтр по ID категории
 * - search: поиск по имени, описанию и т.д.
 * - inStock: только товары в наличии (true/false)
 * - showStatus: показать статус товаров в CSV (true/false)
 * 
 * Ответ: CSV файл для скачивания
 */
router.get(
  '/export/csv',
  authenticate,
  requireRole(['admin']),
  productExportController.exportProductsToCSV
);

/**
 * Получить все продукты для админа (с закупочными ценами)
 * GET /api/products/admin/all?page=1&limit=9&categoryId=1&brandId=2&search=query&minPrice=100&maxPrice=500&isFeatured=true&isNew=true&isBestseller=true&isOnSale=true&sort=popularity
 * Доступ: Admin, Manager
 * 
 * Query параметры: те же что и для публичного списка товаров (см. выше)
 * 
 * Отличие от публичного эндпоинта:
 * - Возвращает данные из admin_product_view (включает закупочную цену purchasePrice)
 * - Для менеджеров purchasePrice скрывается на уровне контроллера
 * - Показывает все товары (даже неактивные is_active = false)
 * 
 * Ответ: аналогичен публичному, но с дополнительным полем purchasePrice (только для админов)
 */
router.get(
  '/admin/all',
  authenticate,
  requireRole(['admin', 'manager']),
  (req, res, next) => productController.getProducts(req, res, next, true)
);

/**
 * Получить продукт по идентификатору для админа
 * GET /api/products/admin/:identifier
 * Доступ: Admin, Manager
 * 
 * Параметры:
 * - identifier: ID товара (число) или slug товара (строка)
 * 
 * Отличие от публичного эндпоинта:
 * - Возвращает данные из admin_product_view (включает purchasePrice)
 * - Для менеджеров purchasePrice скрывается на уровне контроллера
 * - Показывает даже неактивные товары
 * 
 * Ответ:
 * {
 *   "id": 1,
 *   "name": "Название товара",
 *   "purchasePrice": 500,  // только для админов
 *   ... (все остальные поля как в публичном эндпоинте)
 * }
 */
router.get(
  '/admin/:identifier',
  authenticate,
  requireRole(['admin', 'manager']),
  (req, res, next) => productController.getProductByIdentifier(req, res, next, true)
);

// =====================================
// АДМИНСКИЕ МЕТОДЫ МОДИФИКАЦИИ
// =====================================

/**
 * Создать новый продукт
 * POST /api/products
 * Доступ: Admin
 * Content-Type: multipart/form-data
 * 
 * Body fields (текстовые поля в form-data):
 * - name: "Название товара" (обязательно, строка)
 * - description: "Описание товара" (опционально, строка)
 * - purchase_price: 100 (обязательно, положительное число, закупочная цена)
 * - retail_price: 200 (обязательно, положительное число, розничная цена)
 * - discount_price: 150 (опционально, число >= 0 или null, цена со скидкой)
 * - brand_id: 1 (обязательно, целое число, ID бренда)
 * - category_id: 1 (обязательно, целое число, ID категории)
 * - supplier_id: 1 (опционально, целое число, ID поставщика)
 * - product_type: "Крем" (обязательно, строка, тип товара)
 * - target_audience: "unisex" (опционально, по умолчанию "unisex", варианты: male/female/unisex)
 * - skin_type: "Все типы кожи" (опционально, строка, max 100 символов)
 * - weight_grams: 100 (опционально, целое число, вес в граммах)
 * - length_cm: 10 (опционально, целое число, длина в см)
 * - width_cm: 10 (опционально, целое число, ширина в см)
 * - height_cm: 10 (опционально, целое число, высота в см)
 * - is_active: true (опционально, boolean, по умолчанию true, активен ли товар)
 * - is_featured: false (опционально, boolean, по умолчанию false, рекомендуемый товар)
 * - is_new: true (опционально, boolean, по умолчанию true, новинка)
 * - is_bestseller: false (опционально, boolean, по умолчанию false, бестселлер)
 * - attributes: '{"ingredients": "Состав", "usage": "Применение", "variants": [{"name": "Объём", "value": "50мл"}]}' 
 *   (опционально, JSON строка или объект, дополнительные атрибуты товара)
 * - meta_title: "SEO заголовок" (опционально, строка, мета-заголовок для SEO)
 * - meta_description: "SEO описание" (опционально, строка, мета-описание для SEO)
 * - stockQuantity: 10 (опционально, целое число >= 0, количество на складе с location_id = 1)
 * 
 * Files (файлы в form-data):
 * - mainImage: файл главного изображения товара (опционально, 1 файл, max 5MB, форматы: jpg, jpeg, png, webp)
 * - gallery: массив файлов для галереи товара (опционально, до 10 файлов, каждый max 5MB, форматы: jpg, jpeg, png, webp)
 * 
 * Примечание:
 * - Если mainImage не передано, будет использовано изображение-заглушка
 * - Если gallery не передано, будет использована галерея-заглушка
 * - Изображения загружаются в S3 (или локальную папку uploads/)
 * - slug генерируется автоматически на основе name
 * - attributes.variants можно не передавать, будет значение по умолчанию [{"name": "Объём", "value": "50мл"}]
 * 
 * Ответ: объект созданного товара (из admin_product_view)
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  productController.createProduct
);

/**
 * Обновить продукт
 * PUT /api/products/:id
 * Доступ: Admin
 * Content-Type: multipart/form-data
 * 
 * Параметры:
 * - id: ID товара (число в URL)
 * 
 * Body: (все поля опциональны, передавайте только те что нужно изменить)
 * - name: "Новое название" (опционально)
 * - description: "Новое описание" (опционально)
 * - purchase_price: 120 (опционально)
 * - retail_price: 250 (опционально)
 * - discount_price: 200 (опционально)
 * - brand_id: 2 (опционально)
 * - category_id: 3 (опционально)
 * - supplier_id: 2 (опционально)
 * - product_type: "Сыворотка" (опционально)
 * - target_audience: "female" (опционально)
 * - skin_type: "Жирная кожа" (опционально)
 * - weight_grams: 150 (опционально)
 * - length_cm: 12 (опционально)
 * - width_cm: 12 (опционально)
 * - height_cm: 12 (опционально)
 * - is_active: false (опционально)
 * - is_featured: true (опционально)
 * - is_new: false (опционально)
 * - is_bestseller: true (опционально)
 * - attributes: '{"ingredients": "Новый состав"}' (опционально, объединяется с существующими атрибутами)
 * - meta_title: "Новый SEO заголовок" (опционально)
 * - meta_description: "Новое SEO описание" (опционально)
 * - stockQuantity: 20 (опционально)
 * 
 * Files:
 * - mainImage: новый файл главного изображения (опционально, 1 файл, заменяет старое изображение)
 * - gallery: новые файлы для галереи (опционально, до 2 файлов, ПОЛНОСТЬЮ заменяет старую галерею)
 * 
 * Примечание:
 * - Если передаётся новый mainImage - старое изображение удаляется из S3
 * - Если передаётся новая gallery - вся старая галерея удаляется из S3
 * - attributes объединяются с существующими (не заменяют полностью)
 * - slug автоматически обновляется если изменяется name
 * 
 * Ответ: объект обновлённого товара (из admin_product_view)
 */
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  productController.updateProduct
);

/**
 * Удалить продукт
 * DELETE /api/products/:id
 * Доступ: Admin
 * 
 * Параметры:
 * - id: ID товара (число в URL)
 * 
 * Действия при удалении:
 * - Удаляются все изображения товара из S3 (main_image_url и image_urls)
 * - Удаляются все записи из product_inventory для этого товара
 * - Удаляется запись товара из product_products
 * - Связанные данные (отзывы, корзина, wishlist) удаляются каскадно через ON DELETE CASCADE в БД
 * 
 * Ответ: статус 204 No Content (без тела ответа)
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  productController.deleteProduct
);

// =====================================================================================================
// ⚠️ КРИТИЧЕСКИ ВАЖНО: ДИНАМИЧЕСКИЙ МАРШРУТ ДОЛЖЕН БЫТЬ САМЫМ ПОСЛЕДНИМ!
// =====================================================================================================
// Этот маршрут использует динамический параметр :identifier
// Если поставить его выше, он перехватит все запросы вроде /search, /admin/all, /export/pdf
// Express подумает что "search", "admin", "export" это значения параметра identifier
// И вызовет этот обработчик БЕЗ middleware authenticate, что приведёт к ошибкам
// =====================================================================================================

/**
 * Получить продукт по идентификатору (id или slug)
 * GET /api/products/:identifier
 * Доступ: Публичный
 * 
 * Параметры:
 * - identifier: ID товара (число) или slug товара (строка)
 * 
 * Примеры:
 * - GET /api/products/123 - получить товар с id = 123
 * - GET /api/products/krem-dlya-lica - получить товар со slug = "krem-dlya-lica"
 * 
 * Особенности:
 * - Возвращает данные из product_view (БЕЗ закупочной цены)
 * - Показывает только активные товары (is_active = true)
 * - Если товар не найден - ошибка 404
 * 
 * Ответ:
 * {
 *   "id": 1,
 *   "name": "Название товара",
 *   "slug": "nazvanie-tovara",
 *   "description": "Описание",
 *   "price": 1000,
 *   "discountPrice": 800,
 *   "mainImageUrl": "https://...",
 *   "imageUrls": ["https://..."],
 *   "brand": "Бренд",
 *   "brandId": 1,
 *   "categoryName": "Категория",
 *   "categoryId": 1,
 *   "sku": "SKU-123",
 *   "rating": 4.5,
 *   "reviewCount": 10,
 *   "stockQuantity": 50,
 *   "inStock": true,
 *   "isFeatured": false,
 *   "isNew": true,
 *   "isBestseller": false,
 *   "skinType": "Все типы",
 *   "targetAudience": "unisex",
 *   "ingredients": "Состав",
 *   "usage": "Применение",
 *   "variants": [{"name": "Объём", "value": "50мл"}],
 *   "createdAt": "2025-01-15T10:30:00.000Z",
 *   "updatedAt": "2025-02-20T15:45:00.000Z"
 * }
 */
router.get('/:identifier', (req, res, next) =>
  productController.getProductByIdentifier(req, res, next, false)
);

module.exports = router;