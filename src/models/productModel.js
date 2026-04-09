// src/models/productModel.js
const db = require('../config/db');
const {
    uploadImage,
    deleteEntityImages,
    deleteImageByUrl,
    uploadProductGalleryImages,
    deleteProductGallery,
    deleteVariantGallery,
} = require('../utils/s3Uploader');

// ─────────────────────────────────────────────────────────────────
// Выбор view в зависимости от региона и роли
//
//  region='ru' (по умолчанию):
//    публичный  → product_view       (цены RUB, inStock = location_id=1)
//    админ      → admin_product_view  (все цены RUB+KGS, оба остатка)
//
//  region='kg':
//    публичный  → product_view_kg    (цены KGS, inStock = location_id=4)
//    админ      → admin_product_view  (admin всегда видит всё)
//
// ─────────────────────────────────────────────────────────────────
const resolveView = (isAdmin, region = 'ru') => {
    if (isAdmin) return 'admin_product_view';
    return region === 'kg' ? 'product_view_kg' : 'product_view';
};

// admin_product_view не имеет "inStock" — только "inStockRu" / "inStockKg" / "inStockTotal"
const resolveInStockField = (isAdmin) => {
    return isAdmin ? '"inStockTotal"' : '"inStock"';
};

// ─────────────────────────────────────────────────────────────────
// Вспомогательная: upsert инвентаря варианта по локации
// ─────────────────────────────────────────────────────────────────
const upsertVariantInventory = async (variantId, productId, quantity, locationId = 1) => {
    const { rows } = await db.query(
        `SELECT id FROM product_inventory WHERE variant_id = $1 AND location_id = $2`,
        [variantId, locationId]
    );
    if (rows.length > 0) {
        await db.query(
            `UPDATE product_inventory
             SET quantity = $1, last_updated = CURRENT_TIMESTAMP
             WHERE variant_id = $2 AND location_id = $3`,
            [quantity, variantId, locationId]
        );
    } else {
        await db.query(
            `INSERT INTO product_inventory
                (product_id, location_id, variant_id, quantity, min_stock_level, last_updated)
             VALUES ($1, $2, $3, $4, 0, CURRENT_TIMESTAMP)`,
            [productId, locationId, variantId, quantity]
        );
    }
};

// Нулевые числовые поля → NULL
const nullifyZero = (val) =>
    val === '' || val === '0' || val === 0 || val == null ? null : val;

// Нормализация: bigint из postgres → number JS
const normalizeProduct = (product) => {
    if (!product) return null;
    ['stockQuantity', 'stockQuantityRu', 'stockQuantityKg', 'stockQuantityTotal'].forEach(f => {
        if (product[f] !== undefined) product[f] = Number(product[f]) || 0;
    });
    return product;
};

// ─────────────────────────────────────────────────────────────────
// Получить все продукты с пагинацией и фильтрами
// ─────────────────────────────────────────────────────────────────
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
    region = 'ru',
}) => {
    const viewName     = resolveView(isAdmin, region);
    const inStockField = resolveInStockField(isAdmin);

    let baseQuery = `FROM ${viewName}`;
    const params  = [];
    let where     = '';
    let cte       = '';

    // Рекурсивный обход подкатегорий
    if (categoryId) {
        cte = `
            WITH RECURSIVE subcats AS (
                SELECT id FROM product_categories WHERE id = $${params.length + 1}
                UNION ALL
                SELECT c.id FROM product_categories c
                JOIN subcats s ON c.parent_id = s.id
            )
        `;
        params.push(categoryId);
        where += ` category_id IN (SELECT id FROM subcats)`;
    }

    // Фильтр по брендам ("1,2,3")
    if (brandId) {
        const brandIds = brandId.toString().split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(id => !isNaN(id));
        if (brandIds.length > 0) {
            where += (where ? ' AND' : '') + ` brand_id = ANY($${params.length + 1}::int[])`;
            params.push(`{${brandIds.join(',')}}`);
        }
    }

    // Полнотекстовый поиск
    let rankExpression = '1';
    if (search && search.trim()) {
        const searchTerm = search.trim();
        where += (where ? ' AND ' : '') + `
            to_tsvector('russian',
                COALESCE(name, '') || ' ' ||
                COALESCE(description, '') || ' ' ||
                COALESCE(brand, '') || ' ' ||
                COALESCE(category_name, '') || ' ' ||
                COALESCE(sku, '') || ' ' ||
                COALESCE(skin_type, '') || ' ' ||
                COALESCE(target_audience, '') || ' ' ||
                COALESCE(ingredients, '') || ' ' ||
                COALESCE(usage, '')
            ) @@ plainto_tsquery('russian', $${params.length + 1})
        `;
        params.push(searchTerm);
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

    // Цена (view уже отдаёт нужную валюту через поля price / discountPrice)
    const priceExpr = `CASE WHEN "discountPrice" IS NOT NULL AND "discountPrice" > 0 THEN "discountPrice" ELSE price END`;
    if (minPrice) {
        where += (where ? ' AND' : '') + ` ${priceExpr} >= $${params.length + 1}`;
        params.push(minPrice);
    }
    if (maxPrice) {
        where += (where ? ' AND' : '') + ` ${priceExpr} <= $${params.length + 1}`;
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
        where += (where ? ' AND' : '') + (isOnSale
            ? ` "discountPrice" IS NOT NULL AND "discountPrice" > 0`
            : ` ("discountPrice" IS NULL OR "discountPrice" = 0)`);
    }
    if (sort === 'new_random' && isNew === undefined) {
        where += (where ? ' AND' : '') + ` "isNew" = $${params.length + 1}`;
        params.push(true);
    }

    if (where) baseQuery += ' WHERE' + where;

    // Сортировка
    let orderBy;
    switch (sort) {
        case 'popularity':  orderBy = '"reviewCount" DESC, id DESC'; break;
        case 'price_asc':   orderBy = `${priceExpr} ASC, id DESC`;  break;
        case 'price_desc':  orderBy = `${priceExpr} DESC, id DESC`; break;
        case 'rating':      orderBy = 'rating DESC, id DESC';        break;
        case 'new_random':  orderBy = 'RANDOM()';                    break;
        case 'newest':      orderBy = 'created_at DESC, id DESC';    break;
        case 'relevance':   orderBy = `${rankExpression} DESC, id DESC`; break;
        default:            orderBy = 'id DESC';
    }

    const fullOrderBy = search
        ? ` ORDER BY ${inStockField} DESC, ${rankExpression} DESC, ${orderBy}`
        : ` ORDER BY ${inStockField} DESC, ${orderBy}`;

    // ─── Список: НЕ включаем stockVariants (тяжёлый JSONB) ─────────────
    // Выбираем только нужные для карточек товаров поля
    const listColumns = `
        id, name, description, slug,
        price, "discountPrice",
        brand, brand_id, brand_slug,
        top_category_name, top_category_id, top_category_slug,
        parent_category_name, parent_category_id, parent_category_slug,
        category_name, category_id, category_slug, category_level,
        subcategory, subcategory_id,
        image, images,
        ingredients, usage,
        "isActive", "isNew", "isBestseller", "isFeatured",
        rating, "reviewCount",
        created_at, updated_at,
        sku, product_type, target_audience, skin_type,
        "variantCount"
        ${isAdmin ? `, "purchasePrice", "priceKg", "discountPriceKg",
            supplier_id, weight_grams, length_cm, width_cm, height_cm,
            meta_title, meta_description,
            "inStockRu", "inStockKg", "inStockTotal",
            "stockQuantityRu", "stockQuantityKg", "stockQuantityTotal"` : ''}
        ${!isAdmin ? `, "inStock", "stockQuantity"` : ''}
    `;

    const dataQuery  = `${cte} SELECT ${listColumns} ${baseQuery}${fullOrderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const countQuery = `${cte} SELECT COUNT(*) ${baseQuery}`;

    const [dataResult, countResult] = await Promise.all([
        db.query(dataQuery, [...params, limit, (page - 1) * limit]),
        db.query(countQuery, params),
    ]);

    const products = dataResult.rows.map(normalizeProduct);
    const total    = parseInt(countResult.rows[0].count, 10);
    const pages    = limit > 0 ? Math.ceil(total / limit) : 0;

    return { products, total, page, pages, limit, hasMore: page < pages };
};

// ─────────────────────────────────────────────────────────────────
// Получить один продукт (полные данные включая stockVariants)
// ─────────────────────────────────────────────────────────────────
const getProductByIdentifier = async (identifier, isAdmin = false, region = 'ru') => {
    const viewName = resolveView(isAdmin, region);
    const idNum    = parseInt(identifier, 10);
    const isId     = !isNaN(idNum);

    const { rows } = await db.query(
        `SELECT * FROM ${viewName} WHERE ${isId ? 'id' : 'slug'} = $1`,
        [isId ? idNum : identifier]
    );

    return rows[0] ? normalizeProduct(rows[0]) : null;
};

// ─────────────────────────────────────────────────────────────────
// Создать продукт + дефолтный вариант "Стандарт"
// ─────────────────────────────────────────────────────────────────
const createProduct = async (data, mainImageFile, galleryFiles) => {
    const defaultAttributes = {
        usage: 'Скоро будет',
        variants: [],
        ingredients: 'Скоро будет',
    };
    data.attributes = JSON.stringify({ ...defaultAttributes, ...(data.attributes || {}) });

    data.discount_price    = nullifyZero(data.discount_price);
    data.retail_price_kg   = nullifyZero(data.retail_price_kg);
    data.discount_price_kg = nullifyZero(data.discount_price_kg);

    const stockQuantityRu = parseInt(data.stockQuantity   ?? 0, 10);
    const stockQuantityKg = parseInt(data.stockQuantityKg ?? 0, 10);
    delete data.stockQuantity;
    delete data.stockQuantityKg;

    const fields       = Object.keys(data).join(', ');
    const values       = Object.values(data);
    const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

    const { rows } = await db.query(
        `INSERT INTO product_products (${fields}) VALUES (${placeholders}) RETURNING *`,
        values
    );
    const productId = rows[0].id;

    // ── Изображения продукта ─────────────────────────────────────
    // S3 путь: uploads/products/{productId}/main.jpg
    //          uploads/products/{productId}/gallery/1.jpg
    let mainImageUrl = null;
    let galleryUrls  = [];

    if (mainImageFile) {
        mainImageUrl = await uploadImage(
            mainImageFile.buffer,
            mainImageFile.originalname,
            'products',
            productId,
            'main'
        );
    }
    if (galleryFiles?.length) {
        galleryUrls = await uploadProductGalleryImages(galleryFiles, productId);
    }

    await db.query(
        `UPDATE product_products
         SET main_image_url = $1, image_urls = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [mainImageUrl, JSON.stringify(galleryUrls), productId]
    );

    // ── Дефолтный вариант "Стандарт" ────────────────────────────
    const { rows: variantRows } = await db.query(
        `INSERT INTO product_variants
            (product_id, name, options, is_active, is_available, sort_order)
         VALUES ($1, 'Стандарт', '{}', TRUE, TRUE, 0)
         RETURNING id`,
        [productId]
    );
    const defaultVariantId = variantRows[0].id;

    await upsertVariantInventory(defaultVariantId, productId, stockQuantityRu, 1);
    if (stockQuantityKg > 0) {
        await upsertVariantInventory(defaultVariantId, productId, stockQuantityKg, 4);
    }

    return getProductByIdentifier(productId, true);
};

// ─────────────────────────────────────────────────────────────────
// Обновить продукт
// ─────────────────────────────────────────────────────────────────
const updateProduct = async (id, data, newMainImageFile, newGalleryFiles) => {
    const currentProduct = await getProductByIdentifier(id, true);
    if (!currentProduct) throw new Error('Продукт не найден');

    // Обновляем инвентарь через первый активный вариант (Россия)
    if (data.stockQuantity !== undefined) {
        const quantity = parseInt(data.stockQuantity, 10);
        if (!isNaN(quantity) && quantity >= 0) {
            const { rows: variantRows } = await db.query(
                `SELECT id FROM product_variants
                 WHERE product_id = $1 AND is_active = TRUE
                 ORDER BY sort_order ASC, id ASC LIMIT 1`,
                [id]
            );
            if (variantRows.length > 0) {
                await upsertVariantInventory(variantRows[0].id, id, quantity, 1);
            }
        }
        delete data.stockQuantity;
    }

    data.retail_price_kg   = nullifyZero(data.retail_price_kg);
    data.discount_price_kg = nullifyZero(data.discount_price_kg);
    data.discount_price    = nullifyZero(data.discount_price);

    // Сливаем attributes (не заменяем полностью)
    if (data.attributes) {
        const { rows: cur } = await db.query(
            'SELECT attributes FROM product_products WHERE id = $1', [id]
        );
        data.attributes = JSON.stringify({
            ...(cur[0]?.attributes || {}),
            ...data.attributes,
        });
    }

    // ── Замена главного изображения ─────────────────────────────
    // Алгоритм: удалить старое из S3 → загрузить новое → записать URL в БД
    if (newMainImageFile) {
        if (currentProduct.image) {
            await deleteImageByUrl(currentProduct.image).catch(() => {});
        }
        data.main_image_url = await uploadImage(
            newMainImageFile.buffer,
            newMainImageFile.originalname,
            'products',
            id,
            'main'
        );
    }

    // ── Замена галереи ───────────────────────────────────────────
    // Алгоритм: удалить все старые из S3 → загрузить новые → записать URLs в БД
    if (newGalleryFiles?.length) {
        const existingGallery = Array.isArray(currentProduct.images) ? currentProduct.images : [];
        if (existingGallery.length > 0) {
            await deleteProductGallery(id, existingGallery).catch(() => {});
        }
        data.image_urls = JSON.stringify(
            await uploadProductGalleryImages(newGalleryFiles, id)
        );
    }

    if (data.image_urls && typeof data.image_urls === 'object') {
        data.image_urls = JSON.stringify(data.image_urls);
    }

    if (Object.keys(data).length > 0) {
        const fields = Object.keys(data).map((key, i) => `${key} = $${i + 2}`).join(', ');
        await db.query(
            `UPDATE product_products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [id, ...Object.values(data)]
        );
    }

    return getProductByIdentifier(id, true);
};

// ─────────────────────────────────────────────────────────────────
// Удалить продукт + очистить S3
// ─────────────────────────────────────────────────────────────────
const deleteProduct = async (id) => {
    const product = await getProductByIdentifier(id, true);
    if (product) {
        if (product.image) await deleteEntityImages('products', id).catch(() => {});

        const existingGallery = Array.isArray(product.images) ? product.images : [];
        if (existingGallery.length > 0) {
            await deleteProductGallery(id, existingGallery).catch(() => {});
        }

        const { rows: variants } = await db.query(
            'SELECT id, main_image_url, image_urls FROM product_variants WHERE product_id = $1',
            [id]
        );
        for (const v of variants) {
            if (v.main_image_url) await deleteImageByUrl(v.main_image_url).catch(() => {});
            const vg = Array.isArray(v.image_urls) ? v.image_urls : [];
            if (vg.length > 0) await deleteVariantGallery(v.id, vg).catch(() => {});
        }
    }

    // FK каскад удалит: variants, inventory, reviews, cart, wishlist
    await db.query('DELETE FROM product_products WHERE id = $1', [id]);
};

const searchProducts = async (query, page = 1, limit = 20, region = 'ru') => {
    if (!query?.trim()) return { products: [], total: 0, page: 1, pages: 0, limit, hasMore: false };
    return getAllProducts({ search: query.trim(), page, limit, sort: 'relevance', region });
};

const getProductsByBrand = async (brandId, region = 'ru') => {
    const viewName = resolveView(false, region);
    const { rows } = await db.query(
        `SELECT id, name, slug, price, "discountPrice", image, "isNew", "isFeatured",
                "isBestseller", brand, brand_id, brand_slug, category_name,
                rating, "reviewCount", sku, "variantCount", "inStock", "stockQuantity"
         FROM ${viewName} WHERE brand_id = $1`,
        [brandId]
    );
    return rows.map(normalizeProduct);
};

module.exports = {
    getAllProducts,
    getProductByIdentifier,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
    getProductsByBrand,
    upsertVariantInventory,
};