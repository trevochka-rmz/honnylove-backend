// src/models/sessionModel.js
const db = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const SESSION_EXPIRY_DAYS = 7;

const createSession = async (userId, userAgent, ipAddress) => {
  // Генерируем случайный refresh token
  const refreshToken = crypto.randomBytes(64).toString('hex');
  const refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  
  const { rows } = await db.query(
    `INSERT INTO user_sessions 
     (user_id, refresh_token_hash, user_agent, ip_address, expires_at) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING id, created_at`,
    [userId, refreshTokenHash, userAgent, ipAddress, expiresAt]
  );
  
  return {
    sessionId: rows[0].id,
    refreshToken, // Отдаем ТОЛЬКО ОДИН РАЗ при создании
    expiresAt
  };
};

const validateSession = async (userId, refreshToken) => {
  // Находим все активные сессии пользователя
  const { rows } = await db.query(
    `SELECT * FROM user_sessions 
     WHERE user_id = $1 AND is_active = true AND expires_at > NOW()
     ORDER BY last_refreshed_at DESC`,
    [userId]
  );
  
  // Проверяем хеши всех сессий
  for (const session of rows) {
    const isValid = await bcrypt.compare(refreshToken, session.refresh_token_hash);
    if (isValid) {
      // Обновляем время последнего использования
      await db.query(
        `UPDATE user_sessions SET last_refreshed_at = NOW() WHERE id = $1`,
        [session.id]
      );
      return { valid: true, session };
    }
  }
  
  return { valid: false };
};

const revokeSession = async (sessionId) => {
  await db.query(
    `UPDATE user_sessions SET is_active = false WHERE id = $1`,
    [sessionId]
  );
};

const revokeAllUserSessions = async (userId) => {
  await db.query(
    `UPDATE user_sessions SET is_active = false WHERE user_id = $1`,
    [userId]
  );
};

const cleanupExpiredSessions = async () => {
  await db.query(
    `DELETE FROM user_sessions WHERE expires_at < NOW() OR is_active = false`
  );
};

module.exports = {
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  cleanupExpiredSessions
};