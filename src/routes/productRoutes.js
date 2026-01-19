// src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// ПУБЛИЧНЫЕ МАРШРУТЫ

/**
 * Получить список продуктов с пагинацией и фильтрами
 * GET /api/products?page=1&limit=9&categoryId=1&brandId=2&search=query&minPrice=100&maxPrice=500&isFeatured=true&isNew=true&isBestseller=true&isOnSale=true&sort=popularity
 * Доступ: Публичный
 *
 * Query параметры:
 * - page: номер страницы (по умолчанию 1)
 * - limit: количество на странице (по умолчанию 9, max 50)
 * - categoryId: ID категории (опционально)
 * - brandId: ID бренда (опционально)
 * - search: поиск по имени, описанию и т.д. (опционально)
 * - minPrice: минимальная цена (опционально)
 * - maxPrice: максимальная цена (опционально)
 * - isFeatured: избранные (true/false, опционально)
 * - isNew: новые (true/false, опционально)
 * - isBestseller: бестселлеры (true/false, опционально)
 * - isOnSale: со скидкой (true/false, опционально)
 * - sort: popularity|price_asc|price_desc|rating|new_random|id_desc|newest (по умолчанию id_desc)
 */
router.get('/', (req, res, next) =>
  productController.getProducts(req, res, next, false)
);

/**
 * Поиск продуктов
 * GET /api/products/search?query=search_string
 * Доступ: Публичный
 *
 * Query параметры:
 * - query: поисковый запрос (обязательно)
 */
router.get('/search', productController.searchProducts);

/**
 * Получить продукт по идентификатору (id или slug)
 * GET /api/products/:identifier
 * Доступ: Публичный
 */
router.get('/:identifier', (req, res, next) =>
  productController.getProductByIdentifier(req, res, next, false)
);

// АДМИНСКИЕ МАРШРУТЫ

/**
 * Получить все продукты для админа
 * GET /api/products/admin/all?page=1&limit=9&... (все те же параметры)
 * Доступ: Admin, Manager
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
 */
router.get(
  '/admin/:identifier',
  authenticate,
  requireRole(['admin', 'manager']),
  (req, res, next) => productController.getProductByIdentifier(req, res, next, true)
);

/**
 * Создать новый продукт
 * POST /api/products
 * Доступ: Admin
 * Multipart form-data
 * 
 * Body fields (текстовые поля):
 * - name: "Название" (обязательно)
 * - description: "Описание" (опционально)
 * - purchase_price: 100 (обязательно, положительное число)
 * - retail_price: 200 (обязательно, положительное число)
 * - discount_price: 150 (опционально, min 0 или null)
 * - brand_id: 1 (обязательно)
 * - category_id: 1 (обязательно)
 * - supplier_id: 1 (опционально)
 * - product_type: "Тип" (обязательно)
 * - target_audience: "unisex" (по умолчанию unisex)
 * - skin_type: "Тип кожи" (опционально)
 * - weight_grams: 100 (опционально)
 * - length_cm: 10 (опционально)
 * - width_cm: 10 (опционально)
 * - height_cm: 10 (опционально)
 * - is_active: true (по умолчанию true)
 * - is_featured: false (по умолчанию false)
 * - is_new: true (по умолчанию true)
 * - is_bestseller: false (по умолчанию false)
 * - attributes: {"ingredients": "Ингредиенты", "usage": "Использование"} (опционально)
 * - meta_title: "Meta заголовок" (опционально)
 * - meta_description: "Meta описание" (опционально)
 * - stockQuantity: 10 (опционально, min 0)
 * 
 * Files (файлы):
 * - mainImage: файл главного изображения (опционально, 1 файл, max 5MB)
 * - gallery[]: массив файлов для галереи (опционально, до 2 файлов, каждый max 5MB)
 * 
 * Формат: multipart/form-data
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
* Multipart form-data
* 
* Body: (все поля опциональны)
* - name: "Новое название" (опционально)
* - description: "Новое описание" (опционально)
* - purchase_price: 120 (опционально)
* - и т.д. (все поля как в схеме создания)
* 
* Files:
* - mainImage: новый файл главного изображения (опционально, 1 файл)
* - gallery[]: новые файлы для галереи (опционально, до 10 файлов)
* 
* Формат: multipart/form-data
* 
* Примечание: Если передаются новые файлы галереи, старая галерея полностью удаляется и заменяется новой.
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
 */
router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  productController.deleteProduct
);

module.exports = router;