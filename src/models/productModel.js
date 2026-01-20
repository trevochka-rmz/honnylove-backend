// src/models/productModel.js
const db = require('../config/db');
const { uploadImage, deleteEntityImages, deleteImageByUrl, uploadProductGalleryImages, deleteProductGallery } = require('../utils/s3Uploader');

// Получить все продукты с пагинацией и фильтрами
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
  
  if (data.discount_price === 0) {
      data.discount_price = null;
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
      `UPDATE product_products SET 
          main_image_url = $1,
          image_urls = $2,
          updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [mainImageUrl, JSON.stringify(galleryUrls), productId]
  );
  
  if (stockQuantity !== undefined) {
    const quantity = parseInt(stockQuantity, 10);
    if (isNaN(quantity) || quantity < 0) {
        throw new Error('Invalid stockQuantity');
    }
    await db.query(
        'UPDATE product_inventory SET quantity = $1, last_updated = CURRENT_TIMESTAMP WHERE product_id = $2 AND location_id = $3',
        [quantity, productId, 1]
    );
}
  
  return getProductByIdentifier(productId, true);
};

// Обновить продукт
const updateProduct = async (id, data, newMainImageFile, newGalleryFiles) => {
  const currentProduct = await getProductByIdentifier(id, true);
  if (!currentProduct) throw new Error('Продукт не найден');
  
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
      delete data.stockQuantity;
  }
  
  if (data.attributes) {
      const { rows: currentRows } = await db.query(
          'SELECT attributes FROM product_products WHERE id = $1',
          [id]
      );
      if (currentRows.length === 0) {
          throw new Error('Product not found');
      }
      let currentAttrs = currentRows[0].attributes || {};
      const updatedAttrs = { ...currentAttrs, ...data.attributes };
      data.attributes = JSON.stringify(updatedAttrs);
  }
  
  let mainImageUrl = data.main_image_url || currentProduct.main_image_url;
  let galleryUrls = data.image_urls || currentProduct.image_urls;
  
  if (newMainImageFile) {
      if (currentProduct.main_image_url && !currentProduct.main_image_url.startsWith('/uploads/products/')) {
          await deleteImageByUrl(currentProduct.main_image_url);
      }
      
      mainImageUrl = await uploadImage(
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
      
      galleryUrls = await uploadProductGalleryImages(newGalleryFiles, id);
      data.image_urls = JSON.stringify(galleryUrls);
  }
  
  if (data.discount_price === 0) {
      data.discount_price = null;
  }
  
  if (data.image_urls && typeof data.image_urls === 'object') {
      data.image_urls = JSON.stringify(data.image_urls);
  }
  
  const fields = Object.keys(data)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');
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
  const product = await getProductByIdentifier(id);
  if (product) {
      if (product.main_image_url && !product.main_image_url.startsWith('/uploads/products/')) {
          await deleteEntityImages('products', id);
      }
      if (product.image_urls && product.image_urls.length > 0) {
          await deleteProductGallery(id);
      }
  }
  
  await db.query('DELETE FROM product_inventory WHERE product_id = $1', [id]);
  await db.query('DELETE FROM product_products WHERE id = $1', [id]);
};

// Поиск продуктов
const searchProducts = async (query) => {
  const { rows } = await db.query(
    'SELECT * FROM product_view WHERE name ILIKE $1 OR description ILIKE $1' +
    ' OR brand ILIKE $1 OR category_name ILIKE $1',
    [`%${query}%`]
  );
  return rows;
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