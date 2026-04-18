// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const variantController = require('../controllers/variantController');
const productExportController = require('../controllers/productExportController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// =====================================
// ПУБЛИЧНЫЕ МАРШРУТЫ (без авторизации)
// =====================================

/**
 * Поиск товаров
 * GET /api/products/search
 * Доступ: Public
 *
 * Query параметры:
 * - query: строка, поисковый запрос (обязательно)
 * - page: число, номер страницы (по умолчанию 1)
 * - limit: число, количество на странице (по умолчанию 20)
 *
 * Ответ 200:
 * {
 *   "products": [...],
 *   "total": 100,
 *   "page": 1,
 *   "pages": 5,
 *   "limit": 20,
 *   "hasMore": true
 * }
 */
router.get('/search', productController.searchProducts);

/**
 * Получить список товаров с фильтрами и пагинацией
 * GET /api/products
 * Доступ: Public
 *
 * Query параметры (все опциональные):
 * - page: число, по умолчанию 1
 * - limit: число от 1 до 50, по умолчанию 9
 * - categoryId: число, ID категории (включает подкатегории)
 * - brandId: строка, ID бренда или несколько через запятую "1,2,3"
 * - search: строка, полнотекстовый поиск
 * - minPrice: число, минимальная цена (учитывает скидку)
 * - maxPrice: число, максимальная цена (учитывает скидку)
 * - isFeatured: boolean, рекомендуемые товары
 * - isNew: boolean, новинки
 * - isBestseller: boolean, бестселлеры
 * - isOnSale: boolean, товары со скидкой
 * - sort: строка, вариант сортировки:
 *     id_desc | newest | price_asc | price_desc | popularity | rating | new_random | relevance
 *
 * Ответ 200:
 * {
 *   "products": [{ "id", "name", "slug", "price", "discountPrice", ... }],
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
// АДМИНСКИЕ МАРШРУТЫ (требуют авторизации)
// =====================================

/**
 * Экспорт товаров в PDF
 * GET /api/products/export/pdf
 * Доступ: Admin
 *
 * Query параметры (все опциональные):
 * - brandId: число, фильтр по бренду
 * - categoryId: число, фильтр по категории
 * - search: строка, поиск
 * - inStock: boolean, только товары в наличии
 * - showStatus: boolean, показать статус is_active в PDF
 *
 * Ответ: PDF файл (скачивание)
 */
router.get(
  '/export/pdf',
  authenticate,
  requireRole(['admin']),
  productExportController.exportProductsToPDF
);

/**
 * Экспорт товаров в CSV
 * GET /api/products/export/csv
 * Доступ: Admin
 *
 * Query параметры (все опциональные):
 * - brandId: число, фильтр по бренду
 * - categoryId: число, фильтр по категории
 * - search: строка, поиск
 * - inStock: boolean, только товары в наличии
 * - showStatus: boolean, показать статус is_active в CSV
 *
 * Ответ: CSV файл (скачивание)
 */
router.get(
  '/export/csv',
  authenticate,
  requireRole(['admin']),
  productExportController.exportProductsToCSV
);

/**
 * Получить список товаров для админки
 * GET /api/products/admin/all
 * Доступ: Admin, Manager
 *
 * Query параметры: те же что у GET /api/products
 *
 * Отличия от публичного:
 * - Возвращает все товары включая неактивные (is_active = false)
 * - Для Admin: включает поле purchasePrice (закупочная цена)
 * - Для Manager: purchasePrice скрыт
 *
 * Ответ 200: такой же формат как GET /api/products
 */
router.get(
  '/admin/all',
  authenticate,
  requireRole(['admin', 'manager']),
  (req, res, next) => productController.getProducts(req, res, next, true)
);

/**
 * Получить один товар для админки по ID или slug
 * GET /api/products/admin/:identifier
 * Доступ: Admin, Manager
 *
 * Параметры URL:
 * - identifier: число (ID) или строка (slug)
 *
 * Отличия от публичного:
 * - Возвращает даже неактивные товары
 * - Для Admin: включает purchasePrice
 * - Для Manager: purchasePrice скрыт
 *
 * Ответ 200: объект товара
 * Ответ 404: { "message": "Продукт не найден" }
 */
router.get(
  '/admin/:identifier',
  authenticate,
  requireRole(['admin', 'manager']),
  (req, res, next) => productController.getProductByIdentifier(req, res, next, true)
);

/**
 * Создать новый товар
 * POST /api/products
 * Доступ: Admin
 * Content-Type: multipart/form-data
 *
 * Обязательные поля (строки через FormData):
 * - name: строка, название товара
 * - purchase_price: строка с числом, закупочная цена
 * - retail_price: строка с числом, розничная цена
 * - brand_id: строка с числом, ID бренда
 * - category_id: строка с числом, ID категории
 * - product_type: строка, тип товара (например "Крем")
 *
 * Опциональные поля:
 * - description: строка
 * - discount_price: строка с числом, цена со скидкой ("0" или "" чтобы убрать)
 * - supplier_id: строка с числом
 * - target_audience: "male" | "female" | "unisex" (по умолчанию "unisex")
 * - skin_type: строка до 100 символов
 * - weight_grams, length_cm, width_cm, height_cm: строки с числами
 * - is_active: "true" | "false" (по умолчанию "true")
 * - is_featured: "true" | "false" (по умолчанию "false")
 * - is_new: "true" | "false" (по умолчанию "true")
 * - is_bestseller: "true" | "false" (по умолчанию "false")
 * - stockQuantity: строка с числом, количество на складе
 * - meta_title: строка
 * - meta_description: строка
 * - attributes: JSON строка вида:
 *     '{"ingredients":"Aqua","usage":"Наносить","variants":[{"name":"Объём","value":"50мл"}]}'
 *
 * Файлы:
 * - mainImage: 1 файл, jpg/jpeg/png/webp, максимум 5MB
 * - gallery: до 10 файлов, jpg/jpeg/png/webp, максимум 5MB каждый
 *
 * Ответ 201: объект созданного товара
 * Ответ 400: { "message": "текст ошибки валидации" }
 */
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  productController.createProduct
);

/**
 * Обновить товар
 * PUT /api/products/:id
 * Доступ: Admin
 * Content-Type: multipart/form-data
 *
 * Параметры URL:
 * - id: число, ID товара
 *
 * Поля: те же что при создании, все опциональные.
 * Передавай только те поля которые нужно изменить.
 *
 * Особенности:
 * - discount_price "0" или "" — убирает скидку
 * - attributes — объединяются с существующими, не заменяют полностью
 * - mainImage — если передан, старое фото удаляется из хранилища
 * - gallery — если переданы, вся старая галерея удаляется. Максимум 2 файла
 * - name — при изменении slug обновляется автоматически
 *
 * Ответ 200: объект обновлённого товара
 * Ответ 404: { "message": "Продукт не найден" }
 */
router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  productController.updateProduct
);

/**
 * Удалить товар
 * DELETE /api/products/:id
 * Доступ: Admin
 *
 * Параметры URL:
 * - id: число, ID товара
 *
 * При удалении:
 * - Удаляются все изображения из S3
 * - Удаляются записи из product_inventory
 * - Каскадно удаляются: отзывы, корзина, wishlist
 *
 * Ответ 204: пустое тело
 * Ответ 404: { "message": "Продукт не найден" }
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  productController.deleteProduct
);

/**
 * Получить один товар по ID или slug
 * GET /api/products/:identifier
 * Доступ: Public
 *
 * Параметры URL:
 * - identifier: число (ID) или строка (slug)
 *
 * Примеры:
 * - GET /api/products/123
 * - GET /api/products/krem-dlya-lica
 *
 * Только активные товары (is_active = true).
 * Без закупочной цены.
 *
 * Ответ 200: объект товара
 * Ответ 404: { "message": "Продукт не найден" }
 */
router.get('/:identifier', (req, res, next) =>
  productController.getProductByIdentifier(req, res, next, false)
);

// =====================================
// МАРШРУТЫ ДЛЯ УПРАВЛЕНИЯ ВАРИАНТАМИ ТОВАРОВ
// =====================================

/**
 * Получить все варианты товара
 * GET /api/products/:productId/variants
 * Доступ: Public
 *
 * Параметры URL:
 * - productId: число, ID товара
 *
 * Возвращает только активные варианты (is_active = TRUE)
 * Отсортированы по sort_order ASC, id ASC
 *
 * Ответ 200: массив объектов вариантов
 * [
 *   {
 *     "id": 1,
 *     "productId": 123,
 *     "name": "50 мл",
 *     "options": {"color": "red"},
 *     "sku": "SKU-001",
 *     "mainImageUrl": "https://...",
 *     "imageUrls": ["https://...", "https://..."],
 *     "priceOverride": null,
 *     "discountOverride": null,
 *     "stockQuantity": 10,
 *     "isActive": true,
 *     "isAvailable": true,
 *     "sortOrder": 0
 *   }
 * ]
 * Ответ 400: { "message": "Неверный ID товара" }
 */
router.get('/:productId/variants', variantController.getVariants);

/**
 * Создать новый вариант товара
 * POST /api/products/:productId/variants
 * Доступ: Admin
 * Content-Type: multipart/form-data
 *
 * Параметры URL:
 * - productId: число, ID товара
 *
 * Поля FormData:
 * - name: строка, название варианта (обязательно)
 * - options: JSON строка, дополнительные опции (по умолчанию {})
 * - priceOverride: число, переопределение цены (по умолчанию null)
 * - discountOverride: число, переопределение скидки (по умолчанию null)
 * - priceOverrideKg: число, цена за кг (по умолчанию null)
 * - discountOverrideKg: число, скидка за кг (по умолчанию null)
 * - stockQuantity: число, количество на складе (по умолчанию 0)
 * - isAvailable: "true" | "false" (по умолчанию "true")
 * - sortOrder: число, порядок сортировки (по умолчанию 0)
 *
 * Файлы:
 * - variantMainImage: 1 файл, главное изображение варианта (опционально)
 * - variantGallery: до 5 файлов, галерея изображений (опционально)
 *
 * Ответ 201: объект созданного варианта
 * Ответ 400: { "message": "Поле name обязательно" } или "Неверный формат options"
 */
router.post('/:productId/variants', authenticate, requireRole(['admin']), variantController.createVariant);

/**
 * Обновить вариант товара
 * PUT /api/products/:productId/variants/:variantId
 * Доступ: Admin
 * Content-Type: multipart/form-data
 *
 * Параметры URL:
 * - productId: число, ID товара
 * - variantId: число, ID варианта
 *
 * Поля FormData (все опциональные):
 * - name: строка, название варианта
 * - options: JSON строка, дополнительные опции
 * - priceOverride: число или "" или "0" (null убирает переопределение)
 * - discountOverride: число или "" или "0" (null убирает переопределение)
 * - priceOverrideKg: число или "" или "0" (null убирает переопределение)
 * - discountOverrideKg: число или "" или "0" (null убирает переопределение)
 * - stockQuantity: число, количество на складе
 * - isActive: "true" | "false", активен ли вариант
 * - isAvailable: "true" | "false", доступен ли для продажи
 * - sortOrder: число, порядок сортировки
 *
 * Файлы (опционально):
 * - variantMainImage: 1 файл (если передан — старое удаляется)
 * - variantGallery: до 5 файлов (если переданы — старая галерея полностью заменяется)
 *
 * Ответ 200: объект обновлённого варианта
 * Ответ 404: { "message": "Вариант не найден" }
 * Ответ 400: { "message": "Неверный ID" } или "Неверный формат options"
 */
router.put('/:productId/variants/:variantId', authenticate, requireRole(['admin']), variantController.updateVariant);

/**
 * Удалить вариант товара (мягкое удаление)
 * DELETE /api/products/:productId/variants/:variantId
 * Доступ: Admin
 *
 * Параметры URL:
 * - productId: число, ID товара
 * - variantId: число, ID варианта
 *
 * Особенности:
 * - Не удаляет запись из БД, а устанавливает is_active = FALSE
 * - Изображения варианта удаляются из S3
 *
 * Ответ 204: пустое тело
 * Ответ 404: { "message": "Вариант не найден" }
 * Ответ 400: { "message": "Неверный ID" }
 */
router.delete('/:productId/variants/:variantId', authenticate, requireRole(['admin']), variantController.deleteVariant);

module.exports = router;