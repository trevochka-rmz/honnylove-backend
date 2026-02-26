// src/services/authService.js
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const userModel = require('../models/userModel');
const refreshTokenModel = require('../models/refreshTokenModel'); // ← НОВОЕ
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} = require('../utils/jwtUtils');
const AppError = require('../utils/errorUtils');
const emailService = require('./emailService');

// Схемы валидации (БЕЗ ИЗМЕНЕНИЙ)
const userSchema = Joi.object({
  username: Joi.string().min(3).max(255).required().messages({
    'string.min': 'Имя пользователя должно быть не менее 3 символов',
    'string.max': 'Имя пользователя должно быть не более 255 символов',
    'any.required': 'Имя пользователя обязательно',
  }),
  email: Joi.string().email().required().messages({
    'string.email': 'Неверный формат email',
    'any.required': 'Email обязателен',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль должен быть не менее 6 символов',
    'any.required': 'Пароль обязателен',
  }),
  role: Joi.string()
    .valid('customer', 'manager', 'admin')
    .default('customer'),
  first_name: Joi.string().optional(),
  last_name: Joi.string().optional(),
  phone: Joi.string().optional(),
  address: Joi.string().optional(),
  sendVerification: Joi.boolean().default(false),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Неверный формат email',
    'any.required': 'Email обязателен',
  }),
  password: Joi.string().min(6).required().messages({
    'string.min': 'Пароль должен быть не менее 6 символов',
    'any.required': 'Пароль обязателен',
  }),
});

const resetSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Новый пароль должен быть не менее 6 символов',
  }),
});

/**
 * Регистрация нового пользователя
 */
const registerUser = async (data) => {
  const { error, value } = userSchema.validate(data, { abortEarly: false });
  if (error) {
    const messages = error.details.map((d) => d.message).join('; ');
    throw new AppError(messages, 400);
  }

  const existingUser = await userModel.getUserByEmail(value.email);
  if (existingUser) throw new AppError('Email уже используется', 400);

  const hashedPassword = await bcrypt.hash(value.password, 10);
  const newUser = await userModel.createUser({
    ...value,
    password_hash: hashedPassword,
  });

  let message = 'Пользователь создан.';
  if (value.sendVerification) {
    const code = await userModel.generateVerificationCode(newUser.id);
    await emailService.sendVerificationEmail(newUser.email, code);
    message += ' Код для подтверждения отправлен на email.';
  } else {
    message += ' Email не подтверждён (верификация не запрашивалась).';
  }

  return { message };
};

/**
 * Вспомогательная функция для создания токенов и сохранения refresh token
 * @param {object} user - Объект пользователя
 * @param {object} deviceInfo - Информация об устройстве
 * @returns {object} - Access и Refresh токены
 */
const createTokensForUser = async (user, deviceInfo = {}) => {
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  // Сохраняем refresh token в БД
  await refreshTokenModel.createRefreshToken(user.id, refreshToken, deviceInfo);
  
  // Ограничиваем количество одновременных сессий (например, максимум 5 устройств)
  await refreshTokenModel.limitUserSessions(user.id, 5);
  
  return { accessToken, refreshToken };
};

/**
 * Логин для администратора/менеджера
 */
const adminLogin = async (credentials, deviceInfo = {}) => {
  const { error } = loginSchema.validate(credentials);
  if (error) throw new AppError(error.details[0].message, 400);
  
  const user = await userModel.getUserByEmail(credentials.email);
  if (!user) throw new AppError('Неверные учетные данные', 401);
  
  const isMatch = await bcrypt.compare(credentials.password, user.password_hash);
  if (!isMatch) throw new AppError('Неверные учетные данные', 401);
  
  if (!['admin', 'manager'].includes(user.role)) {
    throw new AppError(
      'Доступ запрещен: Требуется роль администратора или менеджера',
      403
    );
  }
  
  const tokens = await createTokensForUser(user, deviceInfo);
  
  return {
    user: { 
      ...user, 
      password_hash: undefined, 
      isVerified: user.is_verified 
    },
    ...tokens,
  };
};

/**
 * Логин для пользователя
 */
const loginUser = async (credentials, deviceInfo = {}) => {
  const { error } = loginSchema.validate(credentials);
  if (error) throw new AppError(error.details[0].message, 400);
  
  const user = await userModel.getUserByEmail(credentials.email);
  if (!user) throw new AppError('Неверные учетные данные', 401);
  
  const isMatch = await bcrypt.compare(credentials.password, user.password_hash);
  if (!isMatch) throw new AppError('Неверные учетные данные', 401);
  
  const tokens = await createTokensForUser(user, deviceInfo);
  
  return {
    user: { 
      ...user, 
      password_hash: undefined, 
      isVerified: user.is_verified 
    },
    ...tokens,
  };
};

/**
 * Обновить access token по refresh token
 */
const refreshToken = async (token) => {
  try {
    // Проверяем валидность токена
    const decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET);
    
    // Ищем токен в БД
    const tokenRecord = await refreshTokenModel.findRefreshToken(token);
    if (!tokenRecord) {
      throw new AppError('Refresh token не найден или был отозван', 401);
    }
    
    // Проверяем, что токен не истёк
    if (new Date(tokenRecord.expires_at) < new Date()) {
      await refreshTokenModel.deleteRefreshToken(token);
      throw new AppError('Refresh token истёк', 401);
    }
    
    // Проверяем, что токен принадлежит этому пользователю
    if (tokenRecord.user_id !== decoded.id) {
      throw new AppError('Токен не принадлежит этому пользователю', 401);
    }
    
    // Получаем пользователя
    const user = await userModel.getUserById(decoded.id);
    if (!user) {
      throw new AppError('Пользователь не найден', 404);
    }
    
    // Обновляем время последнего использования токена
    await refreshTokenModel.updateLastUsed(token);
    
    // Генерируем новый access token
    const newAccessToken = generateAccessToken(user);
    
    return { accessToken: newAccessToken };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err.message === 'Invalid or expired token') {
      throw new AppError('Refresh token недействителен', 401);
    }
    throw err;
  }
};

/**
 * Logout - удаление refresh token
 */
const logout = async (token) => {
  if (token) {
    await refreshTokenModel.deleteRefreshToken(token);
  }
};

/**
 * Logout со всех устройств
 */
const logoutAll = async (userId) => {
  await refreshTokenModel.deleteAllUserTokens(userId);
};

/**
 * Получить активные сессии пользователя
 */
const getActiveSessions = async (userId) => {
  return await refreshTokenModel.getUserActiveSessions(userId);
};

/**
 * Получить пользователя по ID
 */
const getUserById = async (id) => {
  const user = await userModel.getUserById(id);
  if (!user) throw new AppError('Пользователь не найден', 404);
  return { ...user, password_hash: undefined };
};

/**
 * Обновить данные пользователя
 */
const updateUser = async (id, data) => {
  const updateSchema = Joi.object({
    first_name: Joi.string().optional(),
    last_name: Joi.string().optional(),
    phone: Joi.string().optional(),
    address: Joi.string().optional(),
  });
  const { error } = updateSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  return userModel.updateUser(id, data);
};

/**
 * Запрос на верификацию
 */
const requestVerification = async (email) => {
  const user = await userModel.getUserByEmail(email);
  if (!user) throw new AppError('Пользователь не найден', 404);
  if (user.is_verified) throw new AppError('Email уже подтверждён', 400);
  const code = await userModel.generateVerificationCode(user.id);
  await emailService.sendVerificationEmail(email, code);
  return { message: 'Код отправлен на email' };
};

/**
 * Подтвердить email
 */
const verifyEmail = async (email, code) => {
  const success = await userModel.verifyEmail(email, code);
  if (!success) throw new AppError('Неверный или истёкший код', 400);
  return { message: 'Email подтверждён' };
};

/**
 * Запрос на сброс пароля
 */
const requestPasswordReset = async (email) => {
  const result = await userModel.generateResetCode(email);
  if (!result) throw new AppError('Пользователь не найден', 404);
  await emailService.sendResetEmail(email, result.code);
  return { message: 'Код для сброса отправлен на email' };
};

/**
 * Подтвердить сброс пароля
 */
const confirmPasswordReset = async (data) => {
  const { error } = resetSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  const success = await userModel.resetPassword(data.email, data.code, data.newPassword);
  if (!success) throw new AppError('Неверный или истёкший код', 400);
  return { message: 'Пароль успешно сброшен' };
};

/**
 * Логин через Google
 */
const loginWithGoogle = async (profile, deviceInfo = {}) => {
  let user = await userModel.getUserByGoogleId(profile.id);
  if (!user) {
    user = await userModel.createUserFromOAuth(profile, 'google');
  }
  
  const tokens = await createTokensForUser(user, deviceInfo);
  
  return {
    user: { ...user, password_hash: undefined },
    ...tokens,
  };
};

module.exports = {
  registerUser,
  loginUser,
  refreshToken,
  getUserById,
  updateUser,
  adminLogin,
  requestVerification,
  verifyEmail,
  requestPasswordReset,
  confirmPasswordReset,
  loginWithGoogle,
  logout,
  logoutAll,
  getActiveSessions,
};