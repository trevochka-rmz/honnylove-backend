// src/models/userModel.js
const db = require('../config/db');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Получить пользователя по ID
const getUserById = async (id) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
};

// Получить пользователя по username
const getUserByUsername = async (username) => {
  const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  return rows[0];
};

// Получить пользователя по ID без конфиденциальных полей
const getUserByIdSafe = async (id) => {
  const { rows } = await db.query(`
    SELECT id, username, email, role, first_name, last_name, phone, address,
           is_active, created_at, updated_at, discount_percentage
    FROM users WHERE id = $1
  `, [id]);
  return rows[0];
};

// Получить пользователя по email
const getUserByEmail = async (email) => {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
};

// Создать нового пользователя
const createUser = async (data) => {
  data.discount_percentage = data.discount_percentage ?? 0.0;
  data.is_verified = data.is_verified ?? false;
  
  const {
    username,
    email,
    password_hash,
    role,
    first_name,
    last_name,
    phone,
    address,
    discount_percentage,
    is_verified,
  } = data;
  
  const { rows } = await db.query(
    `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, address, discount_percentage, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
    [
      username,
      email,
      password_hash,
      role,
      first_name,
      last_name,
      phone,
      address,
      discount_percentage,
      is_verified,
    ]
  );
  return rows[0];
};

// Обновить пользователя
const updateUser = async (id, data) => {
  const fields = Object.keys(data)
    .map((key, idx) => `${key} = $${idx + 2}`)
    .join(', ');
  const values = Object.values(data);
  const { rows } = await db.query(
    `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return rows[0];
};

// Удалить пользователя и связанные данные
const deleteUser = async (id) => {
  await db.query('DELETE FROM cart_items WHERE user_id = $1', [id]);
  await db.query('DELETE FROM wishlist_items WHERE user_id = $1', [id]);
  await db.query('DELETE FROM product_reviews WHERE user_id = $1', [id]);
  await db.query('DELETE FROM orders WHERE user_id = $1', [id]);
  await db.query('DELETE FROM users WHERE id = $1', [id]);
};

// Обновить refresh_token пользователя
const updateRefreshToken = async (id, token) => {
  return updateUser(id, { refresh_token: token });
};

// Получить всех пользователей с пагинацией и фильтром по роли
const getAllUsers = async ({ page = 1, limit = 10, role }) => {
  let query = `
    SELECT id, username, email, role, first_name, last_name, phone, address,
           is_active, created_at, updated_at, discount_percentage
    FROM users
  `;
  const params = [];
  if (role) {
    query += ' WHERE role = $1';
    params.push(role);
  }
  query += ` ORDER BY id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  params.push(limit, (page - 1) * limit);
  const { rows } = await db.query(query, params);
  return rows;
};

// Получить профиль пользователя с дополнительной статистикой
const getUserProfile = async (id) => {
  const user = await getUserById(id);
  if (!user) return null;
  const profile = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    first_name: user.first_name,
    last_name: user.last_name,
    phone: user.phone,
    address: user.address,
    discount_percentage: user.discount_percentage,
    is_active: user.is_active,
    is_verified: user.is_verified,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
  if (user.role === 'customer') {
    const { rows: orderRows } = await db.query(
      'SELECT COUNT(*) FROM orders WHERE user_id = $1',
      [id]
    );
    profile.orderCount = parseInt(orderRows[0].count, 10);
    const { rows: cartRows } = await db.query(
      'SELECT SUM(quantity) FROM cart_items WHERE user_id = $1',
      [id]
    );
    profile.cartCount = parseInt(cartRows[0].sum || 0, 10);
    const { rows: wishlistRows } = await db.query(
      'SELECT COUNT(*) FROM wishlist_items WHERE user_id = $1',
      [id]
    );
    profile.wishlistCount = parseInt(wishlistRows[0].count, 10);
    const { rows: reviewRows } = await db.query(
      'SELECT COUNT(*) FROM product_reviews WHERE user_id = $1',
      [id]
    );
    profile.reviewCount = parseInt(reviewRows[0].count, 10);
  } else if (['admin', 'manager'].includes(user.role)) {
    const { rows: totalUsers } = await db.query(
      'SELECT COUNT(*) FROM users'
    );
    profile.totalUsers = parseInt(totalUsers[0].count, 10);
    const { rows: activeOrders } = await db.query(
      "SELECT COUNT(*) FROM orders WHERE status != 'completed' AND status != 'cancelled'"
    );
    profile.activeOrdersCount = parseInt(activeOrders[0].count, 10);
  }
  return profile;
};

// Генерация verification code (6 цифр, expires in 15 min)
const generateVerificationCode = async (userId) => {
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await updateUser(userId, { verification_code: code, verification_expires: expires });
  return code;
};

// Верификация email по коду
const verifyEmail = async (email, code) => {
  const user = await getUserByEmail(email);
  if (!user || user.verification_code !== code || user.verification_expires < new Date()) {
    return false;
  }
  await updateUser(user.id, { is_verified: true, verification_code: null, verification_expires: null });
  return true;
};

// Генерация reset code (аналогично)
const generateResetCode = async (email) => {
  const user = await getUserByEmail(email);
  if (!user) return null;
  const code = crypto.randomBytes(3).toString('hex').toUpperCase();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await updateUser(user.id, { reset_code: code, reset_expires: expires });
  return { code, user };
};

// Сброс пароля по коду
const resetPassword = async (email, code, newPassword) => {
  const user = await getUserByEmail(email);
  if (!user || user.reset_code !== code || user.reset_expires < new Date()) {
    return false;
  }
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await updateUser(user.id, { password_hash: hashedPassword, reset_code: null, reset_expires: null });
  return true;
};

// Для OAuth: Получить по Google ID
const getUserByGoogleId = async (googleId) => {
  const { rows } = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);
  return rows[0];
};

// Создать пользователя из OAuth данных (если не существует)
const createUserFromOAuth = async (profile, provider) => {
  let email = profile.emails[0].value;
  let username = profile.displayName || email.split('@')[0];
  let first_name = profile.name?.givenName || '';
  let last_name = profile.name?.familyName || '';
  
  const existing = await getUserByEmail(email);
  if (existing) {
    if (provider === 'google') {
      await updateUser(existing.id, { 
        google_id: profile.id,
        is_verified: true
      });
    }
    return getUserById(existing.id);
  }
  
  const newUser = await createUser({
    username,
    email,
    password_hash: '',
    role: 'customer',
    first_name,
    last_name,
    is_verified: true,
  });
  
  if (provider === 'google') {
    await updateUser(newUser.id, { google_id: profile.id });
  }
  
  return getUserById(newUser.id);
};

module.exports = {
  getUserById,
  getUserByIdSafe,
  getUserByEmail,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  updateRefreshToken,
  getAllUsers,
  getUserProfile,
  generateVerificationCode,
  verifyEmail,
  generateResetCode,
  resetPassword,
  getUserByGoogleId,
  createUserFromOAuth,
};