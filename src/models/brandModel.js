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
    // Featured filter убрали, если не нужен (или добавь колонку)
    if (where) baseQuery += ' WHERE' + where;
    let orderBy = ' ORDER BY name ASC';
    if (filter === 'popular') {
        orderBy =
            ' ORDER BY (SELECT COUNT(*) FROM product_products p WHERE p.brand_id = b.id) DESC';
    } else if (filter === 'new') {
        orderBy = ' ORDER BY created_at DESC';
    }
    const dataQuery = `
    SELECT b.*,
           (SELECT COUNT(*) FROM product_products p WHERE p.brand_id = b.id) AS "productsCount"
    ${baseQuery}
    ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
    const dataParams = [...params, limit, (page - 1) * limit];
    const { rows: brands } = await db.query(dataQuery, dataParams);
    const mappedBrands = brands.map((brand) => ({
        id: brand.id,
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
    const countQuery = `SELECT COUNT(*) ${baseQuery}`;
    const { rows: countRows } = await db.query(countQuery, params);
    const total = parseInt(countRows[0].count, 10);
    const pages = limit > 0 ? Math.ceil(total / limit) : 0;
    const hasMore = page < pages;
    return { brands: mappedBrands, total, page, pages, limit, hasMore };
};

const getBrandById = async (id) => {
    const isNumericId = !isNaN(id) && !isNaN(parseFloat(id));
    let query;
    let params;
    if (isNumericId) {
        query =
            'SELECT b.*, (SELECT COUNT(*) FROM product_products p WHERE p.brand_id = b.id) AS "productsCount" FROM product_brands b WHERE b.id = $1';
        params = [parseInt(id)];
    } else {
        query =
            'SELECT b.*, (SELECT COUNT(*) FROM product_products p WHERE p.brand_id = b.id) AS "productsCount" FROM product_brands b WHERE b.slug = $1';
        params = [id];
    }
    const { rows } = await db.query(query, params);
    const brand = rows[0];
    if (!brand) return null;
    return {
        id: brand.id,
        slug: brand.slug || brand.id.toString(),
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

const getAllBrandsBrief = async () => {
    const { rows } = await db.query(
        'SELECT id, name, logo_url, slug FROM product_brands WHERE is_active = true ORDER BY name ASC'
    );
    return rows.map((brand) => ({
        id: brand.id,
        slug: brand.slug || brand.id.toString(),
        name: brand.name,
        logo: brand.logo_url,
    }));
};

const createBrand = async (data) => {
    // Дефолты перед INSERT
    data.is_active = data.is_active !== undefined ? data.is_active : true;
    data.country = data.country || 'Южная Корея';
    data.highlights = data.highlights || [];
    data.highlights = JSON.stringify(data.highlights);

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
    } = data;
    const { rows } = await db.query(
        `INSERT INTO product_brands (name, description, website, logo_url, is_active, full_description, country, founded, philosophy, highlights)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`, // Убрали is_featured
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
        ]
    );
    const created = rows[0];
    const brandId = created.id;

    // Генерируем logo_url если не указан
    const updates = {};
    if (!created.logo_url) {
        updates.logo_url = `/uploads/brands/${brandId}/main.jpg`;
    }

    if (Object.keys(updates).length > 0) {
        const updateFields = Object.keys(updates)
            .map((key, idx) => `${key} = $${idx + 2}`)
            .join(', ');
        const updateValues = Object.values(updates);
        await db.query(
            `UPDATE product_brands SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
            [brandId, ...updateValues]
        );
    }

    return getBrandById(brandId);
};

const updateBrand = async (id, data) => {
    if (data.highlights) {
        data.highlights = JSON.stringify(data.highlights);
    }
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
    getAllBrandsBrief,
    createBrand,
    updateBrand,
    deleteBrand,
};
