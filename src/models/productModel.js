const db = require('../config/db');

const getAllProducts = async ({
    page = 1,
    limit = 9,
    categoryId, // Новый: заменил subcategoryId и category
    brandId,
    search,
    minPrice,
    maxPrice,
    isFeatured,
    isNew,
    isBestseller,
    isOnSale,
    sort = 'id_desc',
}) => {
    let baseQuery = 'FROM product_view';
    const params = [];
    let where = '';
    // Если categoryId задан, добавляем рекурсивный CTE для подкатегорий
    let cte = '';
    if (categoryId) {
        cte = `
            WITH RECURSIVE subcats AS (
                SELECT id FROM product_categories WHERE id = $${
                    params.length + 1
                }
                UNION
                SELECT c.id FROM product_categories c JOIN subcats s ON c.parent_id = s.id
            )
        `;
        params.push(categoryId);
        where +=
            (where ? ' AND' : '') + ` category_id IN (SELECT id FROM subcats)`;
    }
    // Остальные фильтры (без изменений)
    if (brandId) {
        where += (where ? ' AND' : '') + ` brand_id = $${params.length + 1}`;
        params.push(brandId);
    }
    if (search) {
        where +=
            (where ? ' AND' : '') +
            ` (name ILIKE $${params.length + 1} OR description ILIKE $${
                params.length + 1
            }` +
            ` OR brand ILIKE $${params.length + 1} OR category_name ILIKE $${
                params.length + 1
            })`;
        params.push(`%${search}%`);
    }
    if (minPrice) {
        where +=
            (where ? ' AND' : '') +
            ` COALESCE("discountPrice", price) >= $${params.length + 1}`;
        params.push(minPrice);
    }
    if (maxPrice) {
        where +=
            (where ? ' AND' : '') +
            ` COALESCE("discountPrice", price) <= $${params.length + 1}`;
        params.push(maxPrice);
    }
    if (isFeatured !== undefined) {
        where +=
            (where ? ' AND' : '') + ` "isFeatured" = $${params.length + 1}`;
        params.push(isFeatured);
    }
    if (isNew !== undefined) {
        where += (where ? ' AND' : '') + ` "isNew" = $${params.length + 1}`;
        params.push(isNew);
    }
    if (isBestseller !== undefined) {
        where +=
            (where ? ' AND' : '') + ` "isBestseller" = $${params.length + 1}`;
        params.push(isBestseller);
    }
    if (isOnSale !== undefined) {
        if (isOnSale) {
            where +=
                (where ? ' AND' : '') +
                ` "discountPrice" IS NOT NULL AND "discountPrice" > 0`;
        } else {
            where +=
                (where ? ' AND' : '') +
                ` ("discountPrice" IS NULL OR "discountPrice" = 0)`;
        }
    }
    // Для sort='new_random' добавляем isNew=true, если не указано
    if (sort === 'new_random' && isNew === undefined) {
        where += (where ? ' AND' : '') + ` "isNew" = $${params.length + 1}`;
        params.push(true);
    }
    if (where) baseQuery += ' WHERE' + where;
    // Определяем ORDER BY в зависимости от sort (добавили 'newest')
    let orderBy = ' ORDER BY id DESC'; // По умолчанию
    switch (sort) {
        case 'popularity':
            orderBy = ' ORDER BY "reviewCount" DESC, id DESC';
            break;
        case 'price_asc':
            orderBy = ' ORDER BY COALESCE("discountPrice", price) ASC, id DESC';
            break;
        case 'price_desc':
            orderBy =
                ' ORDER BY COALESCE("discountPrice", price) DESC, id DESC';
            break;
        case 'rating':
            orderBy = ' ORDER BY rating DESC';
            break;
        case 'new_random':
            orderBy = ' ORDER BY RANDOM()';
            break;
        case 'id_desc':
            orderBy = ' ORDER BY id DESC';
            break;
        case 'newest': // Новая сортировка: по дате создания desc
            orderBy = ' ORDER BY created_at DESC, id DESC';
            break;
        default:
            orderBy = ' ORDER BY id DESC';
    }
    // Запрос для продуктов (с CTE если нужно)
    const dataQuery = `${cte} SELECT * ${baseQuery}${orderBy} LIMIT $${
        params.length + 1
    } OFFSET $${params.length + 2}`;
    const dataParams = [...params, limit, (page - 1) * limit];
    const { rows: products } = await db.query(dataQuery, dataParams);
    // Запрос для total (с CTE если нужно)
    const countQuery = `${cte} SELECT COUNT(*) ${baseQuery}`;
    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count, 10);
    // Рассчитываем pages (если limit > 0, иначе 0)
    const pages = limit > 0 ? Math.ceil(total / limit) : 0;
    // Рассчитываем hasMore
    const hasMore = page < pages;
    return { products, total, page, pages, limit, hasMore };
};

const getProductById = async (id) => {
    const { rows } = await db.query(
        'SELECT * FROM product_view WHERE id = $1',
        [id]
    );
    return rows[0];
};

const createProduct = async (data) => {
    const fields = Object.keys(data).join(', ');
    const values = Object.values(data);
    const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
    const { rows } = await db.query(
        `INSERT INTO product_products (${fields}) VALUES (${placeholders}) RETURNING *`,
        values
    );
    const created = rows[0];
    return getProductById(created.id);
};

const updateProduct = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE product_products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );
    return getProductById(id);
};

const deleteProduct = async (id) => {
    await db.query('DELETE FROM product_products WHERE id = $1', [id]);
};

const searchProducts = async (query) => {
    const { rows } = await db.query(
        'SELECT * FROM product_view WHERE name ILIKE $1 OR description ILIKE $1' +
            ' OR brand ILIKE $1 OR category_name ILIKE $1',
        [`%${query}%`]
    );
    return rows;
};

const getProductsByBrand = async (brandId) => {
    const { rows } = await db.query(
        'SELECT * FROM product_view WHERE brand_id = $1',
        [brandId]
    );
    return rows;
};

module.exports = {
    getAllProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
    getProductsByBrand,
};
