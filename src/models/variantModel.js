// src/models/variantModel.js
const db = require('../config/db');
const {
    uploadImage,
    deleteImageByUrl,
    uploadVariantGalleryImages,
    deleteVariantGallery,
} = require('../utils/s3Uploader');

// ─────────────────────────────────────────────────────────────────
// ВАЖНО:
//   - Локации: 1 = Россия (RU), 4 = Кыргызстан (KG)
// ─────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────
// Получить все активные варианты товара
// ─────────────────────────────────────────────────────────────────
const getVariantsByProductId = async (productId) => {
    const { rows } = await db.query(
        `SELECT
            pv.id,
            pv.product_id               AS "productId",
            pv.name,
            pv.options,
            pv.sku,
            pv.main_image_url           AS "mainImageUrl",
            pv.image_urls               AS "imageUrls",
            pv.price_override_rf        AS "priceOverride",
            pv.discount_override_rf     AS "discountOverride",
            pv.purchase_override_rf     AS "purchaseOverride",
            pv.price_override_kg        AS "priceOverrideKg",
            pv.discount_override_kg     AS "discountOverrideKg",
            pv.purchase_override_kg     AS "purchaseOverrideKg",
            pv.is_active                AS "isActive",
            pv.sort_order               AS "sortOrder",
            pv.created_at               AS "createdAt",
            pv.updated_at               AS "updatedAt",
            -- Суммарный остаток по всем складам
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_inventory pi
                 WHERE pi.variant_id = pv.id),
                0
            )::integer AS "stockQuantity",
            -- Остаток Россия (location_id = 1)
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_inventory pi
                 WHERE pi.variant_id = pv.id AND pi.location_id = 1),
                0
            )::integer AS "stockQuantityRu",
            -- Остаток Кыргызстан (location_id = 4)
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_inventory pi
                 WHERE pi.variant_id = pv.id AND pi.location_id = 4),
                0
            )::integer AS "stockQuantityKg"
        FROM product_variants pv
        WHERE pv.product_id = $1 AND pv.is_active = TRUE
        ORDER BY pv.sort_order ASC, pv.id ASC`,
        [productId]
    );
    return rows;
};

// ─────────────────────────────────────────────────────────────────
// Получить вариант по ID с остатками (для внутренних нужд)
// ─────────────────────────────────────────────────────────────────
const getVariantById = async (variantId, productId) => {
    const { rows } = await db.query(
        `SELECT
            pv.*,
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_inventory pi WHERE pi.variant_id = pv.id),
                0
            )::integer AS stock_quantity,
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_inventory pi
                 WHERE pi.variant_id = pv.id AND pi.location_id = 1),
                0
            )::integer AS stock_quantity_ru,
            COALESCE(
                (SELECT SUM(pi.quantity)
                 FROM product_inventory pi
                 WHERE pi.variant_id = pv.id AND pi.location_id = 4),
                0
            )::integer AS stock_quantity_kg
        FROM product_variants pv
        WHERE pv.id = $1 AND pv.product_id = $2`,
        [variantId, productId]
    );
    return rows[0] || null;
};

// ─────────────────────────────────────────────────────────────────
// Подсчитать количество активных вариантов у товара
// ─────────────────────────────────────────────────────────────────
const countActiveVariants = async (productId) => {
    const { rows } = await db.query(
        `SELECT COUNT(*)::integer AS cnt
         FROM product_variants WHERE product_id = $1 AND is_active = TRUE`,
        [productId]
    );
    return rows[0].cnt;
};

// ─────────────────────────────────────────────────────────────────
// Получить единственный активный вариант (если он один)
// ─────────────────────────────────────────────────────────────────
const getSingleVariant = async (productId) => {
    const { rows } = await db.query(
        `SELECT id FROM product_variants
         WHERE product_id = $1 AND is_active = TRUE
         ORDER BY sort_order ASC, id ASC`,
        [productId]
    );
    return rows.length === 1 ? rows[0] : null;
};

// ─────────────────────────────────────────────────────────────────
// Upsert инвентаря варианта по локации
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

// ─────────────────────────────────────────────────────────────────
// Создать вариант
// ─────────────────────────────────────────────────────────────────
const createVariant = async (productId, data, mainImageFile, galleryFiles) => {
    const {
        name,
        options             = {},
        sku                 = null,
        priceOverride       = null,
        discountOverride    = null,
        purchaseOverride    = null,
        priceOverrideKg     = null,
        discountOverrideKg  = null,
        purchaseOverrideKg  = null,
        stockQuantity       = 0,
        stockQuantityKg     = 0,
        sortOrder           = 0,
    } = data;

    const { rows } = await db.query(
        `INSERT INTO product_variants
            (product_id, name, options, sku,
             price_override_rf, discount_override_rf, purchase_override_rf,
             price_override_kg, discount_override_kg, purchase_override_kg,
             is_active, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,TRUE,$11)
         RETURNING *`,
        [
            productId, name, JSON.stringify(options), sku,
            priceOverride, discountOverride, purchaseOverride,
            priceOverrideKg, discountOverrideKg, purchaseOverrideKg,
            sortOrder,
        ]
    );
    const variant   = rows[0];
    const variantId = variant.id;

    // Инвентарь по локациям
    await upsertVariantInventory(variantId, productId, stockQuantity, 1);
    if (stockQuantityKg > 0) {
        await upsertVariantInventory(variantId, productId, stockQuantityKg, 4);
    }

    // ── Изображения ─────────────────────────────────────────────
    // S3: uploads/variants/{variantId}/main.jpg
    //     uploads/variants/{variantId}/gallery/1.jpg
    //
    // Если файл не передан → main_image_url остаётся NULL в БД.
    // View делает COALESCE(pv.main_image_url, pp.main_image_url) —
    // т.е. фронт автоматически получит изображение товара.
    let mainImageUrl = null;
    let galleryUrls  = [];

    if (mainImageFile) {
        mainImageUrl = await uploadImage(
            mainImageFile.buffer,
            mainImageFile.originalname,
            'variants',
            variantId,
            'main'
        );
    }
    if (galleryFiles?.length) {
        galleryUrls = await uploadVariantGalleryImages(galleryFiles, variantId);
    }
    if (mainImageUrl || galleryUrls.length > 0) {
        await db.query(
            `UPDATE product_variants
             SET main_image_url = $1, image_urls = $2, updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [mainImageUrl, JSON.stringify(galleryUrls), variantId]
        );
        variant.main_image_url = mainImageUrl;
        variant.image_urls     = galleryUrls;
    }

    variant.stock_quantity    = stockQuantity;
    variant.stock_quantity_ru = stockQuantity;
    variant.stock_quantity_kg = stockQuantityKg;

    return formatVariant(variant);
};

// ─────────────────────────────────────────────────────────────────
// Обновить вариант
// ─────────────────────────────────────────────────────────────────
const updateVariant = async (variantId, productId, data, newMainImageFile, newGalleryFiles) => {
    const current = await getVariantById(variantId, productId);
    if (!current) return null;

    const fieldMap = {
        name:               'name',
        options:            'options',
        sku:                'sku',
        priceOverride:      'price_override_rf',
        discountOverride:   'discount_override_rf',
        purchaseOverride:   'purchase_override_rf',
        priceOverrideKg:    'price_override_kg',
        discountOverrideKg: 'discount_override_kg',
        purchaseOverrideKg: 'purchase_override_kg',
        isActive:           'is_active',
        sortOrder:          'sort_order',
    };

    const setClauses = [];
    const values     = [];
    let   idx        = 1;

    for (const [inputKey, dbColumn] of Object.entries(fieldMap)) {
        if (data[inputKey] !== undefined) {
            setClauses.push(`${dbColumn} = $${idx}`);
            values.push(inputKey === 'options' ? JSON.stringify(data[inputKey]) : data[inputKey]);
            idx++;
        }
    }

    // ── Замена главного изображения ─────────────────────────────
    // Удаляем старое из S3 → загружаем новое → пишем URL в БД
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

    // ── Замена галереи ───────────────────────────────────────────
    // Удаляем все старые → загружаем новые → пишем URLs в БД
    if (newGalleryFiles?.length) {
        const existingUrls = Array.isArray(current.image_urls) ? current.image_urls : [];
        await deleteVariantGallery(variantId, existingUrls).catch(() => {});
        const galleryUrls = await uploadVariantGalleryImages(newGalleryFiles, variantId);
        setClauses.push(`image_urls = $${idx}`);
        values.push(JSON.stringify(galleryUrls));
        idx++;
    }

    // Инвентарь по локациям (отдельно от полей варианта)
    if (data.stockQuantity !== undefined) {
        await upsertVariantInventory(variantId, productId, data.stockQuantity, 1);
    }
    if (data.stockQuantityKg !== undefined) {
        await upsertVariantInventory(variantId, productId, data.stockQuantityKg, 4);
    }

    if (setClauses.length === 0 && data.stockQuantity === undefined && data.stockQuantityKg === undefined) {
        return formatVariant(current);
    }

    let updatedVariant = current;
    if (setClauses.length > 0) {
        values.push(variantId, productId);
        const { rows } = await db.query(
            `UPDATE product_variants
             SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${idx} AND product_id = $${idx + 1}
             RETURNING *`,
            values
        );
        updatedVariant = rows[0] || current;
    }

    // Актуальные остатки после изменений
    const { rows: invRows } = await db.query(
        `SELECT
            COALESCE(SUM(quantity), 0)::integer                                          AS qty,
            COALESCE(SUM(CASE WHEN location_id = 1 THEN quantity ELSE 0 END), 0)::integer AS qty_ru,
            COALESCE(SUM(CASE WHEN location_id = 4 THEN quantity ELSE 0 END), 0)::integer AS qty_kg
         FROM product_inventory WHERE variant_id = $1`,
        [variantId]
    );
    updatedVariant.stock_quantity    = invRows[0]?.qty    ?? 0;
    updatedVariant.stock_quantity_ru = invRows[0]?.qty_ru ?? 0;
    updatedVariant.stock_quantity_kg = invRows[0]?.qty_kg ?? 0;

    return formatVariant(updatedVariant);
};

// ─────────────────────────────────────────────────────────────────
// Мягкое удаление (is_active = FALSE, инвентарь → 0, S3 очищается)
// ─────────────────────────────────────────────────────────────────
const deleteVariant = async (variantId, productId) => {
    const current = await getVariantById(variantId, productId);
    if (!current) return null;

    if (current.main_image_url) {
        await deleteImageByUrl(current.main_image_url).catch(() => {});
    }
    const existingUrls = Array.isArray(current.image_urls) ? current.image_urls : [];
    if (existingUrls.length > 0) {
        await deleteVariantGallery(variantId, existingUrls).catch(() => {});
    }

    await db.query(
        `UPDATE product_variants
         SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND product_id = $2`,
        [variantId, productId]
    );
    await db.query(
        `UPDATE product_inventory
         SET quantity = 0, last_updated = CURRENT_TIMESTAMP
         WHERE variant_id = $1`,
        [variantId]
    );

    return { id: variantId };
};

// ─────────────────────────────────────────────────────────────────
// Форматирование объекта варианта для API-ответа
// ─────────────────────────────────────────────────────────────────
const formatVariant = (v) => {
    if (!v) return null;
    return {
        id:                 v.id,
        productId:          v.product_id,
        name:               v.name,
        options:            v.options,
        sku:                v.sku,
        mainImageUrl:       v.main_image_url   ?? null,  // null → фронт берёт фото товара
        imageUrls:          v.image_urls       ?? [],
        // Цены Россия (null → берётся у товара через COALESCE в view)
        priceOverride:      v.price_override_rf    ?? null,
        discountOverride:   v.discount_override_rf ?? null,
        purchaseOverride:   v.purchase_override_rf ?? null,
        // Цены Кыргызстан
        priceOverrideKg:    v.price_override_kg    ?? null,
        discountOverrideKg: v.discount_override_kg ?? null,
        purchaseOverrideKg: v.purchase_override_kg ?? null,
        isActive:           v.is_active,
        sortOrder:          v.sort_order,
        // Остатки
        stockQuantity:      v.stock_quantity    ?? 0,
        stockQuantityRu:    v.stock_quantity_ru ?? 0,
        stockQuantityKg:    v.stock_quantity_kg ?? 0,
        createdAt:          v.created_at,
        updatedAt:          v.updated_at,
    };
};

module.exports = {
    getVariantsByProductId,
    getVariantById,
    countActiveVariants,
    getSingleVariant,
    createVariant,
    updateVariant,
    deleteVariant,
    upsertVariantInventory,
};