// src/controllers/brandController.js
const brandService = require('../services/brandService');
const upload = require('../middleware/uploadMiddleware');

// Получить список брендов
const getBrands = async (req, res, next) => {
  try {
    const { brands, total, page, pages, limit, hasMore } =
      await brandService.getAllBrands(req.query);
    res.json({ brands, total, page, pages, limit, hasMore });
  } catch (err) {
    next(err);
  }
};

// Получить краткий список брендов
const getBrandsBrief = async (req, res, next) => {
  try {
    const brands = await brandService.getAllBrandsBrief();
    res.json({
      success: true,
      count: brands.length,
      brands: brands,
    });
  } catch (err) {
    next(err);
  }
};

// Получить бренд по идентификатору
const getBrandByIdentifier = async (req, res, next) => {
  try {
    const brand = await brandService.getBrandByIdentifier(req.params.identifier);
    res.json(brand);
  } catch (err) {
    next(err);
  }
};

// Создать новый бренд
const createBrand = [
  upload.single('logo'),
  async (req, res, next) => {
      try {
          const brand = await brandService.createBrand(req.body, req.file);
          res.status(201).json(brand);
      } catch (err) {
          next(err);
      }
  }
];

// Обновить бренд
const updateBrand = [
  upload.single('logo'),
  async (req, res, next) => {
      try {
          const brand = await brandService.updateBrand(req.params.id, req.body, req.file);
          res.json(brand);
      } catch (err) {
          next(err);
      }
  }
];

// Удалить бренд
const deleteBrand = async (req, res, next) => {
  try {
    await brandService.deleteBrand(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBrands,
  getBrandsBrief,
  getBrandByIdentifier,
  createBrand,
  updateBrand,
  deleteBrand,
};