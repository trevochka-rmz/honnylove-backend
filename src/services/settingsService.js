// src/services/settingsService.js
const Joi = require('joi');
const settingsModel = require('../models/settingsModel');
const AppError = require('../utils/errorUtils');

// Схема валидации для обновления настроек
const settingsSchema = Joi.object({
  phone: Joi.string().optional(),
  email: Joi.string().email().optional(),
  description: Joi.string().optional(),
  social_links: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        url: Joi.string().uri().required(),
        icon: Joi.string().optional(),
      })
    )
    .optional(),
  footer_links: Joi.array()
    .items(
      Joi.object({
        title: Joi.string().required(),
        url: Joi.string().required(),
      })
    )
    .optional(),
});

// Получить настройки сайта
const getSettings = async () => {
  return settingsModel.getSettings();
};

// Обновить настройки сайта с валидацией
const updateSettings = async (data) => {
  const { error } = settingsSchema.validate(data, { stripUnknown: true });
  if (error) throw new AppError(error.details[0].message, 400);
  return settingsModel.updateSettings(data);
};

module.exports = {
  getSettings,
  updateSettings,
};