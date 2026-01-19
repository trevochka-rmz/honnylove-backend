// src/models/bannersModel.js
const db = require('../config/db');
const { uploadImage, deleteEntityImages, deleteImageByUrl } = require('../utils/s3Uploader');

// Получить все активные баннеры (для фронта, отсортированные)
const getAllBanners = async () => {
  const { rows } = await db.query(
    'SELECT * FROM banners WHERE is_active = true ORDER BY display_order ASC, id ASC'
  );
  return rows;
};

// Получить все баннеры с пагинацией (для админки)
const getAllBannersAdmin = async ({ page = 1, limit = 10 }) => {
  const offset = (page - 1) * limit;
  const { rows } = await db.query(
    'SELECT * FROM banners ORDER BY display_order ASC, id ASC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  const { rows: countRows } = await db.query('SELECT COUNT(*) FROM banners');
  const total = parseInt(countRows[0].count, 10);
  const pages = Math.ceil(total / limit);
  return { banners: rows, total, page, pages, limit };
};

// Получить баннер по ID
const getBannerById = async (id) => {
  const { rows } = await db.query('SELECT * FROM banners WHERE id = $1', [
    id,
  ]);
  return rows[0];
};

// Создать баннер
const createBanner = async (data, imageFile) => {
  const {
      preheader,
      title,
      subtitle,
      image_url,
      button_text,
      button_link,
      display_order,
      is_active,
  } = data;
  
  const { rows } = await db.query(
      `INSERT INTO banners (preheader, title, subtitle, image_url, button_text, button_link, display_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
          preheader,
          title,
          subtitle,
          image_url || 'pending',
          button_text,
          button_link,
          display_order || 0,
          is_active !== undefined ? is_active : true,
      ]
  );
  
  const bannerId = rows[0].id;
  let finalImageUrl = image_url || 'pending';
  
  if (imageFile) {
      finalImageUrl = await uploadImage(
          imageFile.buffer, 
          imageFile.originalname, 
          'banners', 
          bannerId, 
          'main'
      );
      await db.query(`UPDATE banners SET image_url = $1 WHERE id = $2`, [finalImageUrl, bannerId]);
  }
  
  return getBannerById(bannerId);
};

// Обновить баннер
const updateBanner = async (id, data, newImageFile) => {
  const oldBanner = await getBannerById(id);
  if (!oldBanner) return null;
  
  let finalImageUrl = oldBanner.image_url;
  
  if (newImageFile) {
      if (oldBanner.image_url && oldBanner.image_url !== 'pending') {
          await deleteImageByUrl(oldBanner.image_url);
      }
      
      finalImageUrl = await uploadImage(
          newImageFile.buffer, 
          newImageFile.originalname, 
          'banners', 
          id, 
          'main'
      );
      data.image_url = finalImageUrl;
  }
  
  const fields = Object.keys(data)
      .map((key, idx) => `${key} = $${idx + 2}`)
      .join(', ');
  const values = Object.values(data);
  
  const { rows } = await db.query(
      `UPDATE banners SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
      [id, ...values]
  );
  
  return rows[0];
};

// Удалить баннер
const deleteBanner = async (id) => {
  const banner = await getBannerById(id);
  if (banner && banner.image_url && banner.image_url !== 'pending') {
      await deleteEntityImages('banners', id);
  }
  await db.query('DELETE FROM banners WHERE id = $1', [id]);
};

module.exports = {
  getAllBanners,
  getAllBannersAdmin,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};