// src/models/productVariantModel.js
const db = require('../config/db');
const { uploadImage, deleteImageByUrl } = require('../utils/s3Uploader');

// Получить все варианты товара по ID продукта (только активные)
const getVariantsByProductId = async (productId) => {
    const { rows } = await db.query(
        `SELECT
            id,
            product_id AS "productId",
            name,
            options,
            sku,
            main_image_url AS "mainImageUrl",
            image_urls AS "imageUrls",
            price_override AS "priceOverride",
            discount_override AS "discountOverride",
            price_override_kg AS "priceOverrideKg",
            discount_override_kg AS "discountOverrideKg",
            stock_quantity AS "stockQuantity",
            is_active AS "isActive",
            is_available AS "isAvailable",
            sort_order AS "sortOrder",
            created_at AS "createdAt",
            updated_at AS "updatedAt"
        FROM product_variants
        WHERE product_id = $1 AND is_active = TRUE
        ORDER BY sort_order ASC, id ASC`,
        [productId]
    );
    return rows;
};

// Получить вариант по ID с проверкой принадлежности к продукту
const getVariantById = async (variantId, productId) => {
    const { rows } = await db.query(
        `SELECT * FROM product_variants WHERE id = $1 AND product_id = $2`,
        [variantId, productId]
    );
    return rows[0] || null;
};

// Создать новый вариант товара с загрузкой изображений
const createVariant = async (productId, data, mainImageFile, galleryFiles) => {
    const {
        name,
        options = {},
        priceOverride = null,
        discountOverride = null,
        priceOverrideKg = null,
        discountOverrideKg = null,
        stockQuantity = 0,
        isAvailable = true,
        sortOrder = 0,
    } = data;

    // Вставка основного варианта
    const { rows } = await db.query(
        `INSERT INTO product_variants
            (product_id, name, options, price_override, discount_override,
             price_override_kg, discount_override_kg, stock_quantity,
             is_active, is_available, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10)
         RETURNING *`,
        [
            productId, name, JSON.stringify(options),
            priceOverride, discountOverride,
            priceOverrideKg, discountOverrideKg,
            stockQuantity, isAvailable, sortOrder,
        ]
    );
    const variant = rows[0];

    // Загрузка главного изображения (если предоставлено)
    if (mainImageFile) {
        const imageUrl = await uploadImage(
            mainImageFile.buffer,
            mainImageFile.originalname,
            'variants',
            variant.id,
            'main'
        );
        await db.query(
            'UPDATE product_variants SET main_image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [imageUrl, variant.id]
        );
        variant.main_image_url = imageUrl;
    }

    // Загрузка галереи изображений (если предоставлена)
    if (galleryFiles && galleryFiles.length > 0) {
        const galleryUrls = [];
        for (let i = 0; i < galleryFiles.length; i++) {
            const url = await uploadImage(
                galleryFiles[i].buffer,
                galleryFiles[i].originalname,
                'variants',
                variant.id,
                `gallery-${i + 1}`
            );
            galleryUrls.push(url);
        }
        await db.query(
            'UPDATE product_variants SET image_urls = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
            [JSON.stringify(galleryUrls), variant.id]
        );
        variant.image_urls = galleryUrls;
    }

    return variant;
};

// Обновить вариант с возможной заменой изображений
const updateVariant = async (variantId, productId, data, newMainImageFile, newGalleryFiles) => {
    const current = await getVariantById(variantId, productId);
    if (!current) return null;

    // Маппинг полей для динамического обновления
    const fieldMap = {
        name:                 'name',
        options:              'options',
        priceOverride:        'price_override',
        discountOverride:     'discount_override',
        priceOverrideKg:      'price_override_kg',
        discountOverrideKg:   'discount_override_kg',
        stockQuantity:        'stock_quantity',
        isActive:             'is_active',
        isAvailable:          'is_available',
        sortOrder:            'sort_order',
    };

    const setClauses = [];
    const values = [];
    let idx = 1;

    // Формирование SET-части запроса из переданных полей
    for (const [inputKey, dbColumn] of Object.entries(fieldMap)) {
        if (data[inputKey] !== undefined) {
            const val = inputKey === 'options'
                ? JSON.stringify(data[inputKey])
                : data[inputKey];
            setClauses.push(`${dbColumn} = $${idx}`);
            values.push(val);
            idx++;
        }
    }

    // Обновление главного изображения (старое удаляется)
    if (newMainImageFile) {
        if (current.main_image_url) {
            await deleteImageByUrl(current.main_image_url).catch(() => {});
        }
        const imageUrl = await uploadImage(
            newMainImageFile.buffer,
            newMainImageFile.originalname,
            'variants',
            variantId,
            'main'
        );
        setClauses.push(`main_image_url = $${idx}`);
        values.push(imageUrl);
        idx++;
    }

    // Обновление галереи изображений (старые удаляются)
    if (newGalleryFiles && newGalleryFiles.length > 0) {
        if (current.image_urls && current.image_urls.length > 0) {
            for (const url of current.image_urls) {
                await deleteImageByUrl(url).catch(() => {});
            }
        }
        const galleryUrls = [];
        for (let i = 0; i < newGalleryFiles.length; i++) {
            const url = await uploadImage(
                newGalleryFiles[i].buffer,
                newGalleryFiles[i].originalname,
                'variants',
                variantId,
                `gallery-${i + 1}`
            );
            galleryUrls.push(url);
        }
        setClauses.push(`image_urls = $${idx}`);
        values.push(JSON.stringify(galleryUrls));
        idx++;
    }

    // Если ничего не обновляется — возвращаем текущий вариант
    if (setClauses.length === 0) return current;

    // Выполнение обновления
    values.push(variantId, productId);
    const { rows } = await db.query(
        `UPDATE product_variants
         SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${idx} AND product_id = $${idx + 1}
         RETURNING *`,
        values
    );
    return rows[0] || null;
};

// Мягкое удаление варианта (is_active = FALSE) с очисткой изображений
const deleteVariant = async (variantId, productId) => {
    const current = await getVariantById(variantId, productId);
    if (!current) return null;

    // Удаление главного изображения
    if (current.main_image_url) {
        await deleteImageByUrl(current.main_image_url).catch(() => {});
    }
    // Удаление изображений галереи
    if (current.image_urls && current.image_urls.length > 0) {
        for (const url of current.image_urls) {
            await deleteImageByUrl(url).catch(() => {});
        }
    }

    // Мягкое удаление: просто деактивируем
    await db.query(
        'UPDATE product_variants SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND product_id = $2',
        [variantId, productId]
    );
    return { id: variantId };
};

module.exports = {
    getVariantsByProductId,
    getVariantById,
    createVariant,
    updateVariant,
    deleteVariant,
};