// src/models/refreshTokenModel.js
const db = require('../config/db');

/**
 * Сохранить новый refresh token в БД
 * @param {number} userId - ID пользователя
 * @param {string} token - Refresh token
 * @param {object} deviceInfo - Информация об устройстве
 * @returns {object} - Созданная запись
 */
const createRefreshToken = async (userId, token, deviceInfo = {}) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 дней
  
  const { rows } = await db.query(
    `INSERT INTO refresh_tokens (user_id, token, device_info, ip_address, user_agent, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [
      userId,
      token,
      deviceInfo.deviceName || null,
      deviceInfo.ipAddress || null,
      deviceInfo.userAgent || null,
      expiresAt
    ]
  );
  
  return rows[0];
};

/**
 * Найти refresh token
 * @param {string} token - Refresh token
 * @returns {object|null} - Найденная запись или null
 */
const findRefreshToken = async (token) => {
  const { rows } = await db.query(
    'SELECT * FROM refresh_tokens WHERE token = $1',
    [token]
  );
  return rows[0] || null;
};

/**
 * Обновить время последнего использования токена
 * @param {string} token - Refresh token
 */
const updateLastUsed = async (token) => {
  await db.query(
    'UPDATE refresh_tokens SET last_used_at = CURRENT_TIMESTAMP WHERE token = $1',
    [token]
  );
};

/**
 * Удалить конкретный refresh token (logout с одного устройства)
 * @param {string} token - Refresh token
 */
const deleteRefreshToken = async (token) => {
  await db.query('DELETE FROM refresh_tokens WHERE token = $1', [token]);
};

/**
 * Удалить все refresh токены пользователя (logout со всех устройств)
 * @param {number} userId - ID пользователя
 */
const deleteAllUserTokens = async (userId) => {
  await db.query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
};

/**
 * Удалить истёкшие токены (можно запускать по расписанию)
 */
const deleteExpiredTokens = async () => {
  const { rowCount } = await db.query(
    'DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP'
  );
  return rowCount;
};

/**
 * Получить все активные сессии пользователя
 * @param {number} userId - ID пользователя
 * @returns {array} - Массив активных сессий
 */
const getUserActiveSessions = async (userId) => {
  const { rows } = await db.query(
    `SELECT id, device_info, ip_address, created_at, last_used_at 
     FROM refresh_tokens 
     WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
     ORDER BY last_used_at DESC`,
    [userId]
  );
  return rows;
};

/**
 * Ограничение количества одновременных сессий
 * Удаляет самые старые сессии, если их больше maxSessions
 * @param {number} userId - ID пользователя
 * @param {number} maxSessions - Максимальное количество сессий (по умолчанию 5)
 */
const limitUserSessions = async (userId, maxSessions = 5) => {
  const { rows } = await db.query(
    `SELECT id FROM refresh_tokens 
     WHERE user_id = $1 AND expires_at > CURRENT_TIMESTAMP
     ORDER BY last_used_at DESC
     OFFSET $2`,
    [userId, maxSessions]
  );
  
  if (rows.length > 0) {
    const idsToDelete = rows.map(row => row.id);
    await db.query(
      'DELETE FROM refresh_tokens WHERE id = ANY($1)',
      [idsToDelete]
    );
  }
};

module.exports = {
  createRefreshToken,
  findRefreshToken,
  updateLastUsed,
  deleteRefreshToken,
  deleteAllUserTokens,
  deleteExpiredTokens,
  getUserActiveSessions,
  limitUserSessions,
};