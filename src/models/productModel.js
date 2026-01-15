const db = require('../config/db');

// Универсальная функция для получения продуктов (с параметром isAdmin для выбора view)
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
  isAdmin = false, // НОВОЕ: Флаг для админ-версии
}) => {
  // Выбираем view в зависимости от isAdmin
  const viewName = isAdmin ? 'admin_product_view' : 'product_view';
  let baseQuery = `FROM ${viewName}`;
  const params = [];
  let where = '';
  let cte = '';
  if (categoryId) {
    cte = `
      WITH RECURSIVE subcats AS (
        SELECT id FROM product_categories WHERE id = $${params.length + 1}
        UNION
        SELECT c.id FROM product_categories c JOIN subcats s ON c.parent_id = s.id
      )
    `;
    params.push(categoryId);
    where += (where ? ' AND' : '') + ` category_id IN (SELECT id FROM subcats)`;
  }
  if (brandId) {
    where += (where ? ' AND' : '') + ` brand_id = $${params.length + 1}`;
    params.push(brandId);
  }
  if (search) {
    where += (where ? ' AND' : '') +
    ` (name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1}` +
    ` OR brand ILIKE $${params.length + 1} OR category_name ILIKE $${params.length + 1})`;
    params.push(`%${search}%`);
  }
  if (minPrice) {
    where += (where ? ' AND' : '') +
    ` COALESCE("discountPrice", price) >= $${params.length + 1}`;
    params.push(minPrice);
  }
  if (maxPrice) {
    where += (where ? ' AND' : '') +
    ` COALESCE("discountPrice", price) <= $${params.length + 1}`;
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
  if (sort === 'new_random' && isNew === undefined) {
    where += (where ? ' AND' : '') + ` "isNew" = $${params.length + 1}`;
    params.push(true);
  }
  if (where) baseQuery += ' WHERE' + where;
  let orderBy = ' ORDER BY id DESC';
  switch (sort) {
    case 'popularity':
      orderBy = ' ORDER BY "reviewCount" DESC, id DESC';
      break;
    case 'price_asc':
      orderBy = ' ORDER BY COALESCE("discountPrice", price) ASC, id DESC';
      break;
    case 'price_desc':
      orderBy = ' ORDER BY COALESCE("discountPrice", price) DESC, id DESC';
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
    case 'newest':
      orderBy = ' ORDER BY created_at DESC, id DESC';
      break;
    default:
      orderBy = ' ORDER BY id DESC';
  }
  const dataQuery = `${cte} SELECT * ${baseQuery}${orderBy} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const dataParams = [...params, limit, (page - 1) * limit];
  const { rows: products } = await db.query(dataQuery, dataParams);
  const countQuery = `${cte} SELECT COUNT(*) ${baseQuery}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].count, 10);
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  const hasMore = page < pages;
  products.forEach(product => {
    if (product.stockQuantity !== undefined) {
      product.stockQuantity = Number(product.stockQuantity) || 0; // String -> number, null -> 0
    }
  });
  return { products, total, page, pages, limit, hasMore };
};

const getProductById = async (id, isAdmin = false) => {
  const viewName = isAdmin ? 'admin_product_view' : 'product_view';
  const { rows } = await db.query(`SELECT * FROM ${viewName} WHERE id = $1`, [id]);
  let product = rows[0];
  // Преобразование stockQuantity в number, если поле существует
  if (product && product.stockQuantity !== undefined) {
    product.stockQuantity = Number(product.stockQuantity) || 0;
  }
  return product;
};

const createProduct = async (data) => {
  const defaultAttributes = {
    usage: 'Скоро будет',
    variants: [{ name: 'Объём', value: '50мл' }],
    ingredients: 'Скоро будет',
  };
  data.attributes = { ...defaultAttributes, ...(data.attributes || {}) };
  data.attributes = JSON.stringify(data.attributes);
  if (data.image_urls) {
    data.image_urls = JSON.stringify(data.image_urls);
  }
  // Если discount_price === 0, устанавливаем в null (сброс скидки)
  if (data.discount_price === 0) {
    data.discount_price = null;
  }
  const fields = Object.keys(data).join(', ');
  const values = Object.values(data);
  const placeholders = values.map((_, idx) => `$${idx + 1}`).join(', ');
  const { rows } = await db.query(
    `INSERT INTO product_products (${fields}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  const created = rows[0];
  const productId = created.id;
  const updates = {};
  if (!created.main_image_url) {
    updates.main_image_url = `/uploads/products/${productId}/main.jpg`;
  }
  if (!created.image_urls || created.image_urls.length === 0) {
    updates.image_urls = [
      `/uploads/products/${productId}/gallery/1.jpg`,
      `/uploads/products/${productId}/gallery/2.jpg`,
    ];
  }
  if (Object.keys(updates).length > 0) {
    if (updates.image_urls) {
      updates.image_urls = JSON.stringify(updates.image_urls);
    }
    const updateFields = Object.keys(updates)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');
    const updateValues = Object.values(updates);
    await db.query(
      `UPDATE product_products SET ${updateFields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [productId, ...updateValues]
    );
  }
  // Если stockQuantity передано, обновляем inventory (триггер уже создал запись с 0)
  if (data.stockQuantity !== undefined) {
    const quantity = parseInt(data.stockQuantity, 10);
    if (isNaN(quantity) || quantity < 0) {
      throw new Error('Invalid stockQuantity');
    }
    await db.query(
      'UPDATE product_inventory SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2 AND location_id = $3',
      [quantity, productId, 1]
    );
  }
  // Если не передано — остаётся 0 от триггера
  return getProductById(productId, true); // Возвращаем админ-версию
};

const updateProduct = async (id, data) => {
  // Обработка stockQuantity, если передано
  if (data.stockQuantity !== undefined) {
    const quantity = parseInt(data.stockQuantity, 10);
    if (isNaN(quantity) || quantity < 0) {
      throw new Error('Invalid stockQuantity');
    }
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
    delete data.stockQuantity; // Удаляем, чтобы не обновлять в product_products
  }

  // НОВОЕ: Partial update для attributes — мержим с текущими из БД, без defaults
  if (data.attributes) {
    // Получаем текущие attributes из БД
    const { rows: currentRows } = await db.query(
      'SELECT attributes FROM product_products WHERE id = $1',
      [id]
    );
    if (currentRows.length === 0) {
      throw new Error('Product not found');
    }
    // ИЗМЕНЕНО: Нет JSON.parse — pg уже возвращает object (parsed jsonb)
    let currentAttrs = currentRows[0].attributes || {}; // Если null, пустой объект
    // Мержим с новыми атрибутами (обновляем только указанные ключи)
    const updatedAttrs = { ...currentAttrs, ...data.attributes };
    data.attributes = JSON.stringify(updatedAttrs);
  }

  if (!data.main_image_url) {
    data.main_image_url = `/uploads/products/${id}/main.jpg`;
  }
  if (!data.image_urls || data.image_urls.length === 0) {
    data.image_urls = [
      `/uploads/products/${id}/gallery/1.jpg`,
      `/uploads/products/${id}/gallery/2.jpg`,
    ];
  }
  // Если discount_price === 0, устанавливаем в null (сброс скидки)
  if (data.discount_price === 0) {
    data.discount_price = null;
  }
  if (data.image_urls) {
    data.image_urls = JSON.stringify(data.image_urls);
  }
  const fields = Object.keys(data)
    .map((key, idx) => `${key} = $${idx + 2}`)
    .join(', ');
  const values = Object.values(data);
  const { rows } = await db.query(
    `UPDATE product_products SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return getProductById(id, true); // Возвращаем админ-версию
};

const deleteProduct = async (id) => {
  await db.query('DELETE FROM product_inventory WHERE product_id = $1', [id]);
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