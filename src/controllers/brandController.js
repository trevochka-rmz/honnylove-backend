// src/controllers/brandController.js
const brandService = require('../services/brandService');

const getBrands = async (req, res, next) => {
    try {
        const brands = await brandService.getAllBrands(req.query);
        res.json(brands);
    } catch (err) {
        next(err);
    }
};

const getBrandById = async (req, res, next) => {
    try {
        const brand = await brandService.getBrandById(req.params.id);
        res.json(brand);
    } catch (err) {
        next(err);
    }
};

const createBrand = async (req, res, next) => {
    try {
        const brand = await brandService.createBrand(req.body);
        res.status(201).json(brand);
    } catch (err) {
        next(err);
    }
};

const updateBrand = async (req, res, next) => {
    try {
        const brand = await brandService.updateBrand(req.params.id, req.body);
        res.json(brand);
    } catch (err) {
        next(err);
    }
};

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
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand,
};
