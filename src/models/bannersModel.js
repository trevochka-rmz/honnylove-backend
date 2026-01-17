// src/models/bannersModel.js
const db = require('../config/db');

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
const createBanner = async (data) => {
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
      image_url,
      button_text,
      button_link,
      display_order || 0,
      is_active !== undefined ? is_active : true,
    ]
  );
  return rows[0];
};

// Обновить баннер
const updateBanner = async (id, data) => {
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