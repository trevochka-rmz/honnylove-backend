// src/controllers/bannersController.js
const bannersService = require('../services/bannersService');
const { addFullImageUrls } = require('../utils/imageUtils');
const upload = require('../middleware/uploadMiddleware');

// Получить все активные баннеры
const getAllBanners = async (req, res, next) => {
  try {
    const banners = await bannersService.getAllBanners();
    const processedBanners = addFullImageUrls(banners, req);
    res.json(processedBanners);
  } catch (err) {
    next(err);
  }
};

// Получить все баннеры для админки
const getAllBannersAdmin = async (req, res, next) => {
  try {
    const result = await bannersService.getAllBannersAdmin(req.query);
    const processedResult = addFullImageUrls(result, req);
    res.json(processedResult);
  } catch (err) {
    next(err);
  }
};

// Получить баннер по ID
const getBannerById = async (req, res, next) => {
  try {
    const banner = await bannersService.getBannerById(req.params.id);
    const processedBanner = addFullImageUrls(banner, req);
    res.json(processedBanner);
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
          const processedBanner = addFullImageUrls(banner, req);
          res.status(201).json(processedBanner);
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
          const processedBanner = addFullImageUrls(banner, req);
          res.json(processedBanner);
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