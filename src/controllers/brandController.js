// src/controllers/brandController.js
const brandService = require('../services/brandService');
const { addFullImageUrls } = require('../utils/imageUtils');

// Получить список брендов
const getBrands = async (req, res, next) => {
  try {
    const { brands, total, page, pages, limit, hasMore } =
      await brandService.getAllBrands(req.query);
    const processedResult = addFullImageUrls(
      { brands, total, page, pages, limit, hasMore },
      req
    );
    res.json(processedResult);
  } catch (err) {
    next(err);
  }
};

// Получить краткий список брендов
const getBrandsBrief = async (req, res, next) => {
  try {
    const brands = await brandService.getAllBrandsBrief();
    const processedBrands = addFullImageUrls(brands, req);
    res.json({
      success: true,
      count: processedBrands.length,
      brands: processedBrands,
    });
  } catch (err) {
    next(err);
  }
};

// Получить бренд по идентификатору
const getBrandByIdentifier = async (req, res, next) => {
  try {
    const brand = await brandService.getBrandByIdentifier(req.params.identifier);
    const processedBrand = addFullImageUrls(brand, req);
    res.json(processedBrand);
  } catch (err) {
    next(err);
  }
};

// Создать новый бренд
const createBrand = async (req, res, next) => {
  try {
    const brand = await brandService.createBrand(req.body);
    const processedBrand = addFullImageUrls(brand, req);
    res.status(201).json(processedBrand);
  } catch (err) {
    next(err);
  }
};

// Обновить бренд
const updateBrand = async (req, res, next) => {
  try {
    const brand = await brandService.updateBrand(req.params.id, req.body);
    const processedBrand = addFullImageUrls(brand, req);
    res.json(processedBrand);
  } catch (err) {
    next(err);
  }
};

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