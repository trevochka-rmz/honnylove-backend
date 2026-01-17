// src/services/bannersService.js
const Joi = require('joi');
const bannersModel = require('../models/bannersModel');
const AppError = require('../utils/errorUtils');

// Схема валидации для создания баннера
const bannerSchema = Joi.object({
  preheader: Joi.string().optional(),
  title: Joi.string().required(),
  subtitle: Joi.string().optional(),
  image_url: Joi.string().optional(),
  button_text: Joi.string().optional(),
  button_link: Joi.string().optional(),
  display_order: Joi.number().integer().default(0),
  is_active: Joi.boolean().default(true),
});

// Схема валидации для обновления баннера (все поля опциональные)
const updateSchema = Joi.object({
  preheader: Joi.string().optional(),
  title: Joi.string().optional(),
  subtitle: Joi.string().optional(),
  image_url: Joi.string().optional(),
  button_text: Joi.string().optional(),
  button_link: Joi.string().optional(),
  display_order: Joi.number().integer().optional(),
  is_active: Joi.boolean().optional(),
});

// Схема валидации для запросов списка баннеров (админ)
const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
});

// Получить все активные баннеры
const getAllBanners = async () => {
  return bannersModel.getAllBanners();
};

// Получить все баннеры с пагинацией для админки
const getAllBannersAdmin = async (query) => {
  const { error, value } = querySchema.validate(query);
  if (error) throw new AppError(error.details[0].message, 400);
  return bannersModel.getAllBannersAdmin(value);
};

// Получить баннер по ID
const getBannerById = async (id) => {
  const banner = await bannersModel.getBannerById(id);
  if (!banner) throw new AppError('Баннер не найден', 404);
  return banner;
};

// Создать новый баннер с валидацией
const createBanner = async (data) => {
  const { error, value } = bannerSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  return bannersModel.createBanner(value);
};

// Обновить баннер с валидацией
const updateBanner = async (id, data) => {
  const { error } = updateSchema.validate(data, { stripUnknown: true });
  if (error) throw new AppError(error.details[0].message, 400);
  const banner = await bannersModel.getBannerById(id);
  if (!banner) throw new AppError('Баннер не найден', 404);
  return bannersModel.updateBanner(id, data);
};

// Удалить баннер
const deleteBanner = async (id) => {
  const banner = await bannersModel.getBannerById(id);
  if (!banner) throw new AppError('Баннер не найден', 404);
  return bannersModel.deleteBanner(id);
};

module.exports = {
  getAllBanners,
  getAllBannersAdmin,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};