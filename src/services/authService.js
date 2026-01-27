// src/services/authService.js
const bcrypt = require('bcryptjs');
const Joi = require('joi');
const userModel = require('../models/userModel');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyToken,
} = require('../utils/jwtUtils');
const AppError = require('../utils/errorUtils');
const emailService = require('./emailService'); // Новый сервис

// Схема валидации для регистрации пользователя (с custom messages на русском)
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
});

// Схема для логина (добавил min для password)
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

// Схема для reset (new password min 6)
const resetSchema = Joi.object({
  email: Joi.string().email().required(),
  code: Joi.string().length(6).required(),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'Новый пароль должен быть не менее 6 символов',
  }),
});

// Зарегистрировать нового пользователя (с верификацией email, но опциональной)
const registerUser = async (data) => {
  const { error, value } = userSchema.validate(data, { abortEarly: false }); // Все ошибки сразу
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
  // Генерируем и отправляем verification code (опционально для подтверждения позже)
  const code = await userModel.generateVerificationCode(newUser.id);
  await emailService.sendVerificationEmail(newUser.email, code);
  return { message: 'Пользователь создан. Код для подтверждения отправлен на email (опционально).' };
};

// Логин для администратора/менеджера (убрал обязательную проверку is_verified)
const adminLogin = async (credentials) => {
  const { error } = loginSchema.validate(credentials);
  if (error) throw new AppError(error.details[0].message, 400);
  const user = await userModel.getUserByEmail(credentials.email);
  if (!user) throw new AppError('Неверные учетные данные', 401);
  const isMatch = await bcrypt.compare(
    credentials.password,
    user.password_hash
  );
  if (!isMatch) throw new AppError('Неверные учетные данные', 401);
  if (!['admin', 'manager'].includes(user.role)) {
    throw new AppError(
      'Доступ запрещен: Требуется роль администратора или менеджера',
      401
    );
  }
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await userModel.updateRefreshToken(user.id, refreshToken);
  return {
    user: { ...user, password_hash: undefined, isVerified: user.is_verified }, // Добавил isVerified для фронта
    accessToken,
    refreshToken,
  };
};

// Логин для пользователя (убрал обязательную проверку is_verified)
const loginUser = async (credentials) => {
  const { error } = loginSchema.validate(credentials);
  if (error) throw new AppError(error.details[0].message, 400);
  const user = await userModel.getUserByEmail(credentials.email);
  if (!user) throw new AppError('Неверные учетные данные', 401);
  const isMatch = await bcrypt.compare(
    credentials.password,
    user.password_hash
  );
  if (!isMatch) throw new AppError('Неверные учетные данные', 401);
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await userModel.updateRefreshToken(user.id, refreshToken);
  return {
    user: { ...user, password_hash: undefined, isVerified: user.is_verified }, // Добавил isVerified для фронта
    accessToken,
    refreshToken,
  };
};

// Обновить access token по refresh token
const refreshToken = async (token) => {
  try {
    const decoded = verifyToken(token, process.env.JWT_REFRESH_SECRET);
    const user = await userModel.getUserById(decoded.id);
    if (!user || user.refresh_token !== token) {
      throw new AppError('Неверный refresh token', 401);
    }
    const newAccessToken = generateAccessToken(user);
    return { accessToken: newAccessToken };
  } catch (err) {
    if (err.message === 'Invalid or expired token') {
      throw new AppError('Refresh token истек или неверный', 401);
    }
    throw err;
  }
};

// Получить пользователя по ID
const getUserById = async (id) => {
  const user = await userModel.getUserById(id);
  if (!user) throw new AppError('Пользователь не найден', 404);
  return { ...user, password_hash: undefined };
};

// Обновить данные пользователя
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

// Новые функции (оставляем как есть, для отдельного подтверждения)

// Запрос на верификацию (если нужно повторно отправить код)
const requestVerification = async (email) => {
  const user = await userModel.getUserByEmail(email);
  if (!user) throw new AppError('Пользователь не найден', 404);
  if (user.is_verified) throw new AppError('Email уже подтверждён', 400);
  const code = await userModel.generateVerificationCode(user.id);
  await emailService.sendVerificationEmail(email, code);
  return { message: 'Код отправлен на email' };
};

// Подтвердить email
const verifyEmail = async (email, code) => {
  const success = await userModel.verifyEmail(email, code);
  if (!success) throw new AppError('Неверный или истёкший код', 400);
  return { message: 'Email подтверждён' };
};

// Запрос на сброс пароля
const requestPasswordReset = async (email) => {
  const result = await userModel.generateResetCode(email);
  if (!result) throw new AppError('Пользователь не найден', 404);
  await emailService.sendResetEmail(email, result.code);
  return { message: 'Код для сброса отправлен на email' };
};

// Подтвердить сброс пароля
const confirmPasswordReset = async (data) => {
  const { error } = resetSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  const success = await userModel.resetPassword(data.email, data.code, data.newPassword);
  if (!success) throw new AppError('Неверный или истёкший код', 400);
  return { message: 'Пароль успешно сброшен' };
};

// Логин через Google (OAuth callback логика)
const loginWithGoogle = async (profile) => {
  let user = await userModel.getUserByGoogleId(profile.id);
  if (!user) {
    user = await userModel.createUserFromOAuth(profile, 'google');
  }
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await userModel.updateRefreshToken(user.id, refreshToken);
  return {
    user: { ...user, password_hash: undefined },
    accessToken,
    refreshToken,
  };
};

// Логин через VK (аналогично)
const loginWithVk = async (profile) => {
  let user = await userModel.getUserByVkId(profile.id);
  if (!user) {
    user = await userModel.createUserFromOAuth(profile, 'vk');
  }
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  await userModel.updateRefreshToken(user.id, refreshToken);
  return {
    user: { ...user, password_hash: undefined },
    accessToken,
    refreshToken,
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
  loginWithVk,
};