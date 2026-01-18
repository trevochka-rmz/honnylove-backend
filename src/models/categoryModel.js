// src/models/categoryModel.js
const db = require('../config/db');

// Рассчитать уровень категории на основе родителя
const calculateLevel = async (parent_id) => {
  if (!parent_id) return 1; // Корневая категория
  const { rows } = await db.query(
    'SELECT level FROM product_categories WHERE id = $1',
    [parent_id]
  );
  if (rows.length === 0) throw new Error('Родительская категория не найдена');
  const parentLevel = rows[0].level;
  const newLevel = parentLevel + 1;
  if (newLevel > 3)
    throw new Error('Максимальная вложенность категорий - 3 уровня');
  return newLevel;
};

// Рассчитать порядок отображения (max +1 среди siblings)
const calculateDisplayOrder = async (parent_id, currentId = null) => {
  let query =
    'SELECT MAX(display_order) as max_order FROM product_categories WHERE parent_id';
  const params = [];
  if (parent_id === null) {
    query += ' IS NULL';
  } else {
    query += ' = $1';
    params.push(parent_id);
  }
  if (currentId) {
    query += ' AND id != $' + (params.length + 1);
    params.push(currentId);
  }
  const { rows } = await db.query(query, params);
  return (rows[0].max_order || 0) + 1;
};

// Получить все категории в формате дерева для фронтенда
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

// Получить категорию по идентификатору (id или slug) с подкатегориями
const getCategoryByIdentifier = async (identifier) => {
  let query = `
        SELECT
            id,
            name,
            slug,
            COALESCE(image_url, '/uploads/categories/' || id || '/main.jpg') as image_url,
            display_order,
            parent_id,
            level,
            description,
            is_active
        FROM product_categories
        WHERE `;
  let param = identifier;
  const idNum = parseInt(identifier, 10);
  if (!isNaN(idNum)) {
    query += 'id = $1';
    param = idNum;
  } else {
    query += 'slug = $1';
  }
  const { rows: categoryRows } = await db.query(query, [param]);
  if (categoryRows.length === 0) {
    return null;
  }
  const category = categoryRows[0];

  const countQuery = `
        SELECT COUNT(*) as count
        FROM product_products
        WHERE category_id = $1 AND is_active = true
    `;
  const { rows: countRows } = await db.query(countQuery, [category.id]);
  category.product_count = parseInt(countRows[0].count, 10);
 
  const childrenQuery = `
        SELECT
            id,
            name,
            slug,
            COALESCE(image_url, '/uploads/categories/' || id || '/main.jpg') as image_url,
            display_order,
            level
        FROM product_categories
        WHERE parent_id = $1 AND is_active = true
        ORDER BY display_order, name
    `;
  const { rows: childrenRows } = await db.query(childrenQuery, [category.id]);
  
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
      child.product_count = parseInt(childCountRows[0].count, 10);
      return child;
    })
  );
  category.children = childrenWithCounts;
  return category;
};

// Получить простую категорию по идентификатору (без детей)
const getCategorySimple = async (identifier) => {
  let query = 'SELECT * FROM product_categories WHERE ';
  let param = identifier;
  const idNum = parseInt(identifier, 10);
  if (!isNaN(idNum)) {
    query += 'id = $1';
    param = idNum;
  } else {
    query += 'slug = $1';
  }
  const { rows } = await db.query(query, [param]);
  return rows[0];
};

// Получить категорию по имени
const getCategoryByName = async (name) => {
  const { rows } = await db.query(
    'SELECT * FROM product_categories WHERE name = $1',
    [name]
  );
  return rows[0];
};

// Получить все категории с пагинацией и фильтрами
const getAllCategories = async ({
  page = 1,
  limit = 10,
  isActive,
  search,
  filter,
}) => {
  let baseQuery = 'FROM product_categories c';
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
      })`;
    params.push(`%${search}%`);
  }
  if (where) baseQuery += ' WHERE' + where;
  let orderBy = ' ORDER BY display_order ASC, name ASC';
  if (filter === 'popular') {
    orderBy =
      ' ORDER BY (SELECT COUNT(*) FROM product_products p WHERE p.category_id = c.id) DESC';
  } else if (filter === 'new') {
    orderBy = ' ORDER BY created_at DESC';
  }
  const dataQuery = `
    SELECT c.*,
           (SELECT COUNT(*) FROM product_products p WHERE p.category_id = c.id) AS "productsCount"
    ${baseQuery}
    ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const dataParams = [...params, limit, (page - 1) * limit];
  const { rows: categories } = await db.query(dataQuery, dataParams);
  const mappedCategories = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    image: cat.image_url || `/uploads/categories/${cat.id}/main.jpg`,
    description: cat.description,
    parentId: cat.parent_id,
    level: cat.level,
    displayOrder: cat.display_order,
    isActive: cat.is_active,
    productsCount: cat.productsCount,
  }));
  const countQuery = `SELECT COUNT(*) ${baseQuery}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].count, 10);
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  const hasMore = page < pages;
  return { categories: mappedCategories, total, page, pages, limit, hasMore };
};

// Создать новую категорию
const createCategory = async (data) => {
  data.is_active = data.is_active !== undefined ? data.is_active : true;
  data.display_order = data.display_order || 0; 
  data.parent_id = data.parent_id || null;
  data.description = data.description || null;
  data.slug = data.slug || null; 
  const { name, parent_id, description, slug, is_active, display_order } =
    data;

  const { rows } = await db.query(
    `INSERT INTO product_categories (name, parent_id, description, slug, is_active, display_order)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [name, parent_id, description, slug, is_active, display_order]
  );
  const created = rows[0];
  const categoryId = created.id;

  const level = await calculateLevel(parent_id);
  
  let finalDisplayOrder = display_order;
  if (display_order === 0) {
    finalDisplayOrder = await calculateDisplayOrder(parent_id);
  }

  const image_url =
    created.image_url || `/uploads/categories/${categoryId}/main.jpg`;
 
  await db.query(
    `UPDATE product_categories SET
            level = $1,
            display_order = $2,
            image_url = $3,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $4`,
    [level, finalDisplayOrder, image_url, categoryId]
  );
  return getCategoryByIdentifier(categoryId);
};

// Обновить категорию
const updateCategory = async (id, data) => {
  const current = await getCategorySimple(id);
  if (!current) throw new Error('Категория не найдена');
  
  let needRecalc = false;
  if (data.parent_id !== undefined && data.parent_id !== current.parent_id) {
    needRecalc = true;
    data.level = await calculateLevel(data.parent_id);
    data.display_order = await calculateDisplayOrder(data.parent_id, id);
  }

  const fields = Object.keys(data)
    .map((key, idx) => `${key} = $${idx + 2}`)
    .join(', ');
  const values = Object.values(data);
  if (fields) {
    const { rows } = await db.query(
      `UPDATE product_categories SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, ...values]
    );
   
    if (data.image_url === null || data.image_url === '') {
      await db.query(
        `UPDATE product_categories SET image_url = $1 WHERE id = $2`,
        [`/uploads/categories/${id}/main.jpg`, id]
      );
    }
    return getCategoryByIdentifier(id);
  }
  return current;
};

// Удалить категорию с проверками
const deleteCategory = async (id) => {
  const { rows: children } = await db.query(
    'SELECT COUNT(*) FROM product_categories WHERE parent_id = $1',
    [id]
  );
  if (parseInt(children[0].count) > 0) {
    throw new Error(
      'Категория содержит подкатегории. Пожалуйста, сначала удалите или переместите все подкатегории перед удалением этой категории.'
    );
  }

  const { rows: products } = await db.query(
    'SELECT COUNT(*) FROM product_products WHERE category_id = $1',
    [id]
  );
  if (parseInt(products[0].count) > 0) {
    throw new Error(
      'Категория содержит связанные продукты. Пожалуйста, сначала обновите категорию продуктов (установите другую категорию) или удалите продукты, ассоциированные с этой категорией, перед её удалением.'
    );
  }

  await db.query('DELETE FROM product_categories WHERE id = $1', [id]);
};

module.exports = {
  getAllCategories,
  getCategoryByIdentifier,
  getCategorySimple,
  getCategoryByName,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllCategoriesForFrontend,
};