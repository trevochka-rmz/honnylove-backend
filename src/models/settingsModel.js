// src/models/settingsModel.js
const db = require('../config/db');

// Получить настройки сайта
const getSettings = async () => {
  const { rows } = await db.query('SELECT * FROM site_settings WHERE id = 1');
  return rows[0] || {}; 
};

// Обновить настройки сайта
const updateSettings = async (data) => {
  const fields = Object.keys(data)
    .map((key, idx) => `${key} = $${idx + 1}`)
    .join(', ');
  const values = Object.values(data);
  const { rows } = await db.query(
    `INSERT INTO site_settings (id, ${Object.keys(data).join(', ')})
     VALUES (1, ${values.map((_, idx) => `$${idx + 1}`).join(', ')})
     ON CONFLICT (id) DO UPDATE SET ${fields}, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    values
  );
  return rows[0];
};

module.exports = {
  getSettings,
  updateSettings,
};