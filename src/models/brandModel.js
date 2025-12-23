const db = require('../config/db');

const getAllBrands = async ({
    page = 1,
    limit = 8,
    isActive,
    search,
    filter,
}) => {
    let baseQuery = 'FROM product_brands b';
    const params = [];
    let where = '';

    if (isActive !== undefined) {
        where += (where ? ' AND' : '') + ` is_active = $${params.length + 1}`;
        params.push(isActive);
    }
    if (search) {
        where +=
            (where ? ' AND' : '') +
            ` (name ILIKE $${params.length + 1} OR description ILIKE $${
                params.length + 1
            } OR full_description ILIKE $${params.length + 1})`;
        params.push(`%${search}%`);
    }
    // if (filter === 'featured') {
    //     where += (where ? ' AND' : '') + ` is_featured = $${params.length + 1}`;
    //     params.push(true);
    // }

    if (where) baseQuery += ' WHERE' + where;

    // ORDER BY в зависимости от filter
    let orderBy = ' ORDER BY name ASC'; // Дефолт
    if (filter === 'popular') {
        orderBy =
            ' ORDER BY (SELECT COUNT(*) FROM product_products p WHERE p.brand_id = b.id) DESC';
    } else if (filter === 'new') {
        orderBy = ' ORDER BY created_at DESC';
    }

    // Запрос для брендов
    const dataQuery = `
    SELECT b.*, 
           (SELECT COUNT(*) FROM product_products p WHERE p.brand_id = b.id) AS "productsCount"
    ${baseQuery}
    ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
    const dataParams = [...params, limit, (page - 1) * limit];
    const { rows: brands } = await db.query(dataQuery, dataParams);

    // Маппинг
    const mappedBrands = brands.map((brand) => ({
        id: brand.slug,
        name: brand.name,
        logo: brand.logo_url,
        description: brand.description,
        fullDescription: brand.full_description,
        country: brand.country,
        founded: brand.founded,
        philosophy: brand.philosophy,
        highlights: brand.highlights,
        productsCount: brand.productsCount,
    }));

    // Запрос для total
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count, 10);

    const pages = limit > 0 ? Math.ceil(total / limit) : 0;
    const hasMore = page < pages;

    return { brands: mappedBrands, total, page, pages, limit, hasMore };
};

const getBrandById = async (id) => {
    const { rows } = await db.query(
        'SELECT b.*, (SELECT COUNT(*) FROM product_products p WHERE p.brand_id = b.id) AS "productsCount" FROM product_brands b WHERE b.id = $1 OR b.slug = $1',
        [id]
    );
    const brand = rows[0];
    if (!brand) return null;
    return {
        id: brand.slug,
        name: brand.name,
        logo: brand.logo_url,
        description: brand.description,
        fullDescription: brand.full_description,
        country: brand.country,
        founded: brand.founded,
        philosophy: brand.philosophy,
        highlights: brand.highlights,
        productsCount: brand.productsCount,
    };
};

const getBrandByName = async (name) => {
    const { rows } = await db.query(
        'SELECT * FROM product_brands WHERE name = $1',
        [name]
    );
    return rows[0];
};

const createBrand = async (data) => {
    const {
        name,
        description,
        website,
        logo_url,
        is_active,
        full_description,
        country,
        founded,
        philosophy,
        highlights,
        is_featured,
    } = data;
    const { rows } = await db.query(
        `INSERT INTO product_brands (name, description, website, logo_url, is_active, full_description, country, founded, philosophy, highlights, is_featured)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
            name,
            description,
            website,
            logo_url,
            is_active,
            full_description,
            country,
            founded,
            philosophy,
            highlights,
            is_featured || false,
        ]
    );
    return getBrandById(rows[0].id);
};

const updateBrand = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');
    const values = Object.values(data);
    const { rows } = await db.query(
        `UPDATE product_brands SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );
    return getBrandById(id);
};

const deleteBrand = async (id) => {
    await db.query('DELETE FROM product_brands WHERE id = $1', [id]);
};

module.exports = {
    getAllBrands,
    getBrandById,
    getBrandByName,
    createBrand,
    updateBrand,
    deleteBrand,
};
