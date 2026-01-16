// models/userModel.js
const db = require('../config/db');

// Получение пользователя по id
const getUserById = async (id) => {
  const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
  return rows[0];
};

// Получение пользователя по id без sensitive полей
const getUserByIdSafe = async (id) => {
  const { rows } = await db.query(`
    SELECT id, username, email, role, first_name, last_name, phone, address, 
           is_active, created_at, updated_at, discount_percentage 
    FROM users WHERE id = $1
  `, [id]);
  return rows[0];
};

// Получение пользователя по email
const getUserByEmail = async (email) => {
  const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [email]);
  return rows[0];
};

// Создание пользователя
const createUser = async (data) => {
  data.discount_percentage = data.discount_percentage ?? 0.0;
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
  } = data;
  const { rows } = await db.query(
    `INSERT INTO users (username, email, password_hash, role, first_name, last_name, phone, address, discount_percentage)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
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
    ]
  );
  return rows[0];
};

// Обновление пользователя
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

// Обновление refresh_token
const updateRefreshToken = async (id, token) => {
  return updateUser(id, { refresh_token: token });
};

// Получение всех пользователей
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

// Получение профиля пользователя
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

module.exports = {
  getUserById,
  getUserByIdSafe,
  getUserByEmail,
  createUser,
  updateUser,
  updateRefreshToken,
  getAllUsers,
  getUserProfile,
};