// src/controllers/bannersController.js
const bannersService = require('../services/bannersService');
const upload = require('../middleware/uploadMiddleware');

// Получить все активные баннеры
const getAllBanners = async (req, res, next) => {
  try {
    const banners = await bannersService.getAllBanners();
    res.json(banners);
  } catch (err) {
    next(err);
  }
};

// Получить все баннеры для админки
const getAllBannersAdmin = async (req, res, next) => {
  try {
    const result = await bannersService.getAllBannersAdmin(req.query);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

// Получить баннер по ID
const getBannerById = async (req, res, next) => {
  try {
    const banner = await bannersService.getBannerById(req.params.id);
    res.json(banner);
  } catch (err) {
    next(err);
  }
};

// Создать новый баннер
const createBanner = [
  upload.single('image'),
  async (req, res, next) => {
      try {
          const banner = await bannersService.createBanner(req.body, req.file);
          res.status(201).json(banner);
      } catch (err) {
          next(err);
      }
  }
];

// Обновить баннер
const updateBanner = [
  upload.single('image'),
  async (req, res, next) => {
      try {
          const banner = await bannersService.updateBanner(
              req.params.id,
              req.body,
              req.file
          );
          res.json(banner);
      } catch (err) {
          next(err);
      }
  }
];

// Удалить баннер
const deleteBanner = async (req, res, next) => {
  try {
    await bannersService.deleteBanner(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getAllBanners,
  getAllBannersAdmin,
  getBannerById,
  createBanner,
  updateBanner,
  deleteBanner,
};