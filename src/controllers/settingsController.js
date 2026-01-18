// src/controllers/settingsController.js
const settingsService = require('../services/settingsService');
const { addFullImageUrls } = require('../utils/imageUtils');

// Получить настройки сайта
const getSettings = async (req, res, next) => {
  try {
    let settings = await settingsService.getSettings();
    if (settings.social_links) {
      settings.social_links = settings.social_links.map((link) => ({
        ...link,
        icon: addFullImageUrls(link.icon, req), 
      }));
    }
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