// src/models/productModel.js
const db = require('../config/db');
const { uploadImage, deleteEntityImages, deleteImageByUrl, uploadProductGalleryImages, deleteProductGallery } = require('../utils/s3Uploader');

// Получить все продукты с пагинацией и фильтрами
// Улучшенный полнотекстовый поиск с поддержкой русского языка
const getAllProducts = async ({
    page = 1,
    limit = 9,
    categoryId,
    brandId,
    search,
    minPrice,
    maxPrice,
    isFeatured,
    isNew,
    isBestseller,
    isOnSale,
    sort = 'id_desc',
    isAdmin = false,
}) => {
    // Выбираем view в зависимости от isAdmin
    const viewName = isAdmin ? 'admin_product_view' : 'product_view';

    let baseQuery = `FROM ${viewName}`;
    const params = [];
    let where = '';
    let cte = '';

    // CTE для подкатегорий (рекурсивно собираем все вложенные категории)
    if (categoryId) {
        cte = `
            WITH RECURSIVE subcats AS (
                SELECT id FROM product_categories WHERE id = $${params.length + 1}
                UNION
                SELECT c.id FROM product_categories c 
                JOIN subcats s ON c.parent_id = s.id
            )
        `;
        params.push(categoryId);
        where += (where ? ' AND' : '') + ` category_id IN (SELECT id FROM subcats)`;
    }

    // Обработка нескольких брендов (можно передать brandId=1,2,3)
    let brandIds = [];
    if (brandId) {
        const idsStr = brandId.toString();
        brandIds = idsStr.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    }
    if (brandIds.length > 0) {
        where += (where ? ' AND' : '') + ` brand_id = ANY($${params.length + 1}::int[])`;
        params.push(`{${brandIds.join(',')}}`);
    }

    // ====================== УЛУЧШЕННЫЙ ПОЛНОТЕКСТОВЫЙ ПОИСК ======================
    // Используем ТОЛЬКО те колонки, которые реально существуют в product_view и admin_product_view
    let searchCondition = '';
    let rankExpression = '1'; // по умолчанию без ранжирования

    if (search && search.trim()) {
        const searchTerm = search.trim();

        // Полнотекстовый поиск по всем доступным полям
        searchCondition = `
            to_tsvector('russian', 
                COALESCE(name, '') || ' ' ||
                COALESCE(description, '') || ' ' ||
                COALESCE(brand, '') || ' ' ||
                COALESCE(category_name, '') || ' ' ||
                COALESCE(sku, '') || ' ' ||
                COALESCE(skin_type, '') || ' ' ||
                COALESCE(target_audience, '') || ' ' ||
                COALESCE(ingredients, '') || ' ' ||
                COALESCE(usage, '') || ' ' ||
                COALESCE(variants::text, '')
            ) @@ plainto_tsquery('russian', $${params.length + 1})
        `;
        params.push(searchTerm);

        // Ранжирование по релевантности (используем основные поля)
        rankExpression = `
            ts_rank(
                to_tsvector('russian', 
                    COALESCE(name, '') || ' ' || 
                    COALESCE(description, '') || ' ' ||
                    COALESCE(brand, '') || ' ' || 
                    COALESCE(sku, '') || ' ' ||
                    COALESCE(ingredients, '')
                ),
                plainto_tsquery('russian', $${params.length})
            )
        `;
    }

    if (searchCondition) {
        where += (where ? ' AND ' : '') + searchCondition;
    }

    // ====================== Остальные фильтры ======================
    if (minPrice) {
        where += (where ? ' AND' : '') + `
          CASE 
            WHEN "discountPrice" IS NOT NULL AND "discountPrice" > 0 
            THEN "discountPrice" 
            ELSE price 
          END >= $${params.length + 1}`;
        params.push(minPrice);
      }
      if (maxPrice) {
        where += (where ? ' AND' : '') + `
          CASE 
            WHEN "discountPrice" IS NOT NULL AND "discountPrice" > 0 
            THEN "discountPrice" 
            ELSE price 
          END <= $${params.length + 1}`;
        params.push(maxPrice);
      }
    if (isFeatured !== undefined) {
        where += (where ? ' AND' : '') + ` "isFeatured" = $${params.length + 1}`;
        params.push(isFeatured);
    }
    if (isNew !== undefined) {
        where += (where ? ' AND' : '') + ` "isNew" = $${params.length + 1}`;
        params.push(isNew);
    }
    if (isBestseller !== undefined) {
        where += (where ? ' AND' : '') + ` "isBestseller" = $${params.length + 1}`;
        params.push(isBestseller);
    }
    if (isOnSale !== undefined) {
        if (isOnSale) {
            where += (where ? ' AND' : '') +
                ` "discountPrice" IS NOT NULL AND "discountPrice" > 0`;
        } else {
            where += (where ? ' AND' : '') +
                ` ("discountPrice" IS NULL OR "discountPrice" = 0)`;
        }
    }

    // Если выбрана случайная новинка — принудительно фильтруем isNew=true
    if (sort === 'new_random' && isNew === undefined) {
        where += (where ? ' AND' : '') + ` "isNew" = $${params.length + 1}`;
        params.push(true);
    }

    if (where) baseQuery += ' WHERE' + where;

    // ====================== СОРТИРОВКА ======================
    let secondarySort = 'id DESC';

    switch (sort) {
        case 'popularity':
            secondarySort = '"reviewCount" DESC, id DESC';
            break;
        case 'price_asc':
            secondarySort = `CASE 
                WHEN "discountPrice" IS NOT NULL AND "discountPrice" > 0 
                THEN "discountPrice" 
                ELSE price 
            END ASC, id DESC`;
            break;
        case 'price_desc':
            secondarySort = `CASE 
                WHEN "discountPrice" IS NOT NULL AND "discountPrice" > 0 
                THEN "discountPrice" 
                ELSE price 
            END DESC, id DESC`;
            break;
        case 'rating':
            secondarySort = 'rating DESC, id DESC';
            break;
        case 'new_random':
            secondarySort = 'RANDOM()';
            break;
        case 'id_desc':
            secondarySort = 'id DESC';
            break;
        case 'newest':
            secondarySort = 'created_at DESC, id DESC';
            break;
        case 'relevance':
            secondarySort = `${rankExpression} DESC, id DESC`;
            break;
        default:
            secondarySort = 'id DESC';
    }

    // Если идёт поиск — всегда добавляем ранжирование по релевантности + наличие сверху
    const fullOrderBy = search
        ? ` ORDER BY "inStock" DESC, ${rankExpression} DESC, ${secondarySort}`
        : ` ORDER BY "inStock" DESC, ${secondarySort}`;

    // ====================== Основной запрос с пагинацией ======================
    const dataQuery = `${cte} SELECT * ${baseQuery}${fullOrderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, (page - 1) * limit];

    const { rows: products } = await db.query(dataQuery, dataParams);

    // Подсчёт общего количества
    const countQuery = `${cte} SELECT COUNT(*) ${baseQuery}`;
    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count, 10);

    const pages = limit > 0 ? Math.ceil(total / limit) : 0;
    const hasMore = page < pages;

    // Приводим stockQuantity к числу
    products.forEach(product => {
        if (product.stockQuantity !== undefined) {
            product.stockQuantity = Number(product.stockQuantity) || 0;
        }
    });

    return { products, total, page, pages, limit, hasMore };
};

// Получить продукт по идентификатору (id или slug)
const getProductByIdentifier = async (identifier, isAdmin = false) => {
    const viewName = isAdmin ? 'admin_product_view' : 'product_view';
    let query;
    let param = identifier;
    const idNum = parseInt(identifier, 10);
    if (!isNaN(idNum)) {
        query = `SELECT * FROM ${viewName} WHERE id = $1`;
        param = idNum;
    } else {
        query = `SELECT * FROM ${viewName} WHERE slug = $1`;
    }
    const { rows } = await db.query(query, [param]);
    let product = rows[0];
    if (product && product.stockQuantity !== undefined) {
        product.stockQuantity = Number(product.stockQuantity) || 0;
    }
    return product;
};

// Создать новый продукт
const createProduct = async (data, mainImageFile, galleryFiles) => {
    const defaultAttributes = {
        usage: 'Скоро будет',
        variants: [{ name: 'Объём', value: '50мл' }],
        ingredients: 'Скоро будет',
    };
    data.attributes = { ...defaultAttributes, ...(data.attributes || {}) };
    data.attributes = JSON.stringify(data.attributes);

    if (data.discount_price === 0 || data.discount_price === '0' || data.discount_price === '') {
        data.discount_price = null;
    }
    if (data.retail_price_kg === 0 || data.retail_price_kg === '0' || data.retail_price_kg === '') {
        data.retail_price_kg = null;
    }
    if (data.discount_price_kg === 0 || data.discount_price_kg === '0' || data.discount_price_kg === '') {
        data.discount_price_kg = null;
    }

    const stockQuantity = data.stockQuantity;
    delete data.stockQuantity;

    const fields = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');

    const { rows } = await db.query(
        `INSERT INTO product_products (${fields}) VALUES (${placeholders}) RETURNING *`,
        values
    );
    const created = rows[0];
    const productId = created.id;

    let mainImageUrl = `/uploads/products/${productId}/main.jpg`;
    let galleryUrls = [
        `/uploads/products/${productId}/gallery/1.jpg`,
        `/uploads/products/${productId}/gallery/2.jpg`,
    ];

    if (mainImageFile) {
        mainImageUrl = await uploadImage(
            mainImageFile.buffer,
            mainImageFile.originalname,
            'products',
            productId,
            'main'
        );
    }
    if (galleryFiles && galleryFiles.length > 0) {
        galleryUrls = await uploadProductGalleryImages(galleryFiles, productId);
    }

    await db.query(
        `UPDATE product_products SET main_image_url = $1, image_urls = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
        [mainImageUrl, JSON.stringify(galleryUrls), productId]
    );

    const quantity = stockQuantity ? parseInt(stockQuantity, 10) : 1;

    await db.query(
        'UPDATE product_inventory SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2 AND location_id = $3',
        [quantity, productId, 1]
    );

    await db.query(
        `UPDATE product_variants SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE product_id = $2`,
        [quantity, productId]
    );

    return getProductByIdentifier(productId, true);
};

// Обновить продукт
const updateProduct = async (id, data, newMainImageFile, newGalleryFiles) => {
    const currentProduct = await getProductByIdentifier(id, true);
    if (!currentProduct) throw new Error('Продукт не найден');

    if (data.stockQuantity !== undefined) {
        const quantity = parseInt(data.stockQuantity, 10);
        if (isNaN(quantity) || quantity < 0) throw new Error('Invalid stockQuantity');

        const { rows: inventoryCheck } = await db.query(
            'SELECT * FROM product_inventory WHERE product_id = $1 AND location_id = $2',
            [id, 1]
        );
        if (inventoryCheck.length > 0) {
            await db.query(
                'UPDATE product_inventory SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2 AND location_id = $3',
                [quantity, id, 1]
            );
        } else {
            await db.query(
                'INSERT INTO product_inventory (product_id, location_id, quantity, min_stock_level) VALUES ($1, $2, $3, $4)',
                [id, 1, quantity, 0]
            );
        }

        const { rows: variantRows } = await db.query(
            'SELECT id FROM product_variants WHERE product_id = $1 ORDER BY sort_order ASC, id ASC LIMIT 1',
            [id]
        );
        if (variantRows.length > 0) {
            await db.query(
                'UPDATE product_variants SET stock_quantity = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
                [quantity, variantRows[0].id]
            );
        }

        delete data.stockQuantity;
    }

    if (data.retail_price_kg === '' || data.retail_price_kg === '0') data.retail_price_kg = null;
    if (data.discount_price_kg === '' || data.discount_price_kg === '0') data.discount_price_kg = null;

    if (data.attributes) {
        const { rows: currentRows } = await db.query(
            'SELECT attributes FROM product_products WHERE id = $1',
            [id]
        );
        if (currentRows.length === 0) throw new Error('Product not found');
        const currentAttrs = currentRows[0].attributes || {};
        const updatedAttrs = { ...currentAttrs, ...data.attributes };
        data.attributes = JSON.stringify(updatedAttrs);
    }

    if (newMainImageFile) {
        if (currentProduct.image && !currentProduct.image.startsWith('/uploads/products/')) {
            await deleteImageByUrl(currentProduct.image);
        }
        const mainImageUrl = await uploadImage(
            newMainImageFile.buffer,
            newMainImageFile.originalname,
            'products',
            id,
            'main'
        );
        data.main_image_url = mainImageUrl;
    }

    if (newGalleryFiles && newGalleryFiles.length > 0) {
        await deleteProductGallery(id);
        const galleryUrls = await uploadProductGalleryImages(newGalleryFiles, id);
        data.image_urls = JSON.stringify(galleryUrls);
    }

    if (data.discount_price === 0) data.discount_price = null;
    if (data.image_urls && typeof data.image_urls === 'object') {
        data.image_urls = JSON.stringify(data.image_urls);
    }

    const fields = Object.keys(data).map((key, idx) => `${key} = $${idx + 2}`).join(', ');
    const values = Object.values(data);

    if (fields) {
        await db.query(
            `UPDATE product_products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id, ...values]
        );
    }

    return getProductByIdentifier(id, true);
};

// Удалить продукт
const deleteProduct = async (id) => {
    const product = await getProductByIdentifier(id, true);
    if (product) {
        if (product.image && !product.image.startsWith('/uploads/products/')) {
            await deleteEntityImages('products', id);
        }
        if (product.images && product.images.length > 0) {
            await deleteProductGallery(id);
        }
        const { rows: variants } = await db.query(
            'SELECT id, main_image_url, image_urls FROM product_variants WHERE product_id = $1',
            [id]
        );
        for (const variant of variants) {
            if (variant.main_image_url) {
                await deleteImageByUrl(variant.main_image_url).catch(() => {});
            }
            if (variant.image_urls && variant.image_urls.length > 0) {
                for (const url of variant.image_urls) {
                    await deleteImageByUrl(url).catch(() => {});
                }
            }
        }
    }
    await db.query('DELETE FROM product_inventory WHERE product_id = $1', [id]);
    await db.query('DELETE FROM product_products WHERE id = $1', [id]);
};

// Поиск продуктов (улучшенная версия)
const searchProducts = async (query, page = 1, limit = 20) => {
    if (!query || !query.trim()) {
        return { products: [], total: 0, page: 1, pages: 0, limit, hasMore: false };
    }
    return getAllProducts({
        search: query.trim(),
        page,
        limit,
        sort: 'relevance'
    });
};

// Получить продукты по бренду
const getProductsByBrand = async (brandId) => {
    const { rows } = await db.query(
        'SELECT * FROM product_view WHERE brand_id = $1',
        [brandId]
    );
    return rows;
};

module.exports = {
    getAllProducts,
    getProductByIdentifier,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
    getProductsByBrand,
};