// src/models/categoryModel.js
const db = require('../config/db');

// Получить все категории в формате дерева (3 уровня)
const getAllCategoriesForFrontend = async () => {
    const query = `
        SELECT 
            c1.id as l1_id,
            c1.name as l1_name,
            c1.slug as l1_slug,
            COALESCE(c1.image_url, '/uploads/categories/' || c1.id || '/main.jpg') as l1_image_url,
            c1.display_order as l1_order,
            
            c2.id as l2_id,
            c2.name as l2_name,
            c2.slug as l2_slug,
            COALESCE(c2.image_url, '/uploads/categories/' || c2.id || '/main.jpg') as l2_image_url,
            c2.display_order as l2_order,
            
            c3.id as l3_id,
            c3.name as l3_name,
            c3.slug as l3_slug,
            COALESCE(c3.image_url, '/uploads/categories/' || c3.id || '/main.jpg') as l3_image_url,
            c3.display_order as l3_order,
            
            (SELECT COUNT(*) FROM product_products p WHERE p.category_id = c1.id AND p.is_active = true) as l1_product_count,
            (SELECT COUNT(*) FROM product_products p WHERE p.category_id = c2.id AND p.is_active = true) as l2_product_count,
            (SELECT COUNT(*) FROM product_products p WHERE p.category_id = c3.id AND p.is_active = true) as l3_product_count

        FROM product_categories c1
        LEFT JOIN product_categories c2 ON c2.parent_id = c1.id AND c2.is_active = true
        LEFT JOIN product_categories c3 ON c3.parent_id = c2.id AND c3.is_active = true
        WHERE c1.parent_id IS NULL 
        AND c1.is_active = true
        ORDER BY 
            c1.display_order,
            c1.name,
            COALESCE(c2.display_order, 999),
            COALESCE(c2.name, ''),
            COALESCE(c3.display_order, 999),
            COALESCE(c3.name, '');
    `;

    const { rows } = await db.query(query);
    return rows;
};

// Получить категорию по ID с подкатегориями (только 1 уровень вниз)
const getCategoryById = async (id) => {
    // 1. Получаем основную категорию
    const categoryQuery = `
        SELECT 
            id,
            name,
            slug,
            COALESCE(image_url, '/uploads/categories/' || id || '/main.jpg') as image_url,
            display_order,
            parent_id
        FROM product_categories 
        WHERE id = $1 AND is_active = true
    `;

    const { rows: categoryRows } = await db.query(categoryQuery, [id]);

    if (categoryRows.length === 0) {
        return null;
    }

    const category = categoryRows[0];

    // 2. Добавляем количество товаров для этой категории
    const countQuery = `
        SELECT COUNT(*) as count 
        FROM product_products 
        WHERE category_id = $1 AND is_active = true
    `;

    const { rows: countRows } = await db.query(countQuery, [id]);
    category.product_count = countRows[0].count;

    // 3. Получаем только прямых детей (без внуков)
    const childrenQuery = `
        SELECT 
            id,
            name,
            slug,
            COALESCE(image_url, '/uploads/categories/' || id || '/main.jpg') as image_url,
            display_order
        FROM product_categories 
        WHERE parent_id = $1 AND is_active = true
        ORDER BY display_order, name
    `;

    const { rows: childrenRows } = await db.query(childrenQuery, [id]);

    // 4. Добавляем количество товаров для каждого ребенка
    const childrenWithCounts = await Promise.all(
        childrenRows.map(async (child) => {
            const childCountQuery = `
                SELECT COUNT(*) as count 
                FROM product_products 
                WHERE category_id = $1 AND is_active = true
            `;

            const { rows: childCountRows } = await db.query(childCountQuery, [
                child.id,
            ]);
            child.product_count = childCountRows[0].count;

            // НЕ получаем внуков!
            // child.children = []; // Можно явно указать пустой массив

            return child;
        })
    );

    category.children = childrenWithCounts;
    return category;
};
// Получить простую категорию без детей (для update/delete)
const getCategorySimple = async (id) => {
    const { rows } = await db.query(
        'SELECT * FROM product_categories WHERE id = $1',
        [id]
    );
    return rows[0];
};

// Получить список категорий с пагинацией (админка)
const getAllCategories = async ({ page = 1, limit = 10, isActive }) => {
    let query = 'SELECT * FROM product_categories';
    const params = [];

    if (isActive !== undefined) {
        query += ' WHERE is_active = $1';
        params.push(isActive);
    }

    query += ` ORDER BY display_order, id LIMIT $${params.length + 1} OFFSET $${
        params.length + 2
    }`;
    params.push(limit, (page - 1) * limit);

    const { rows } = await db.query(query, params);
    return rows;
};

// Создать категорию
const createCategory = async (data) => {
    const { name, parent_id, description, is_active, display_order } = data;

    const { rows } = await db.query(
        `INSERT INTO product_categories (name, parent_id, description, is_active, display_order)
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [name, parent_id, description, is_active, display_order]
    );

    return rows[0];
};

// Обновить категорию
const updateCategory = async (id, data) => {
    const fields = Object.keys(data)
        .map((key, idx) => `${key} = $${idx + 2}`)
        .join(', ');

    const values = Object.values(data);

    const { rows } = await db.query(
        `UPDATE product_categories SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
        [id, ...values]
    );

    return rows[0];
};

// Удалить категорию
const deleteCategory = async (id) => {
    await db.query('DELETE FROM product_categories WHERE id = $1', [id]);
};

module.exports = {
    getAllCategories,
    getCategoryById, // Только дети (без внуков)
    // getCategoryByIdWithGrandchildren, // Со внуками (если понадобится)
    getCategorySimple,
    createCategory,
    updateCategory,
    deleteCategory,
    getAllCategoriesForFrontend,
};
