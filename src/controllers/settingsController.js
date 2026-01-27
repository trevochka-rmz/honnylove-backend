// src/controllers/settingsController.js
const settingsService = require('../services/settingsService');

// Получить настройки сайта
const getSettings = async (req, res, next) => {
  try {
    let settings = await settingsService.getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
};

// Обновить настройки сайта
const updateSettings = async (req, res, next) => {
  try {
    const settings = await settingsService.updateSettings(req.body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};