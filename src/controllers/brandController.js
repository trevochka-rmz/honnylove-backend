// controllers/brandController.js
const brandService = require('../services/brandService');
const { addFullImageUrls } = require('../utils/imageUtils'); // Импортируем утилиту

const getBrands = async (req, res, next) => {
    try {
        const { brands, total, page, pages, limit, hasMore } =
            await brandService.getAllBrands(req.query);

        // Добавляем полные URL к логотипам
        const processedResult = addFullImageUrls(
            { brands, total, page, pages, limit, hasMore },
            req
        );

        res.json(processedResult);
    } catch (err) {
        next(err);
    }
};

const getBrandsBrief = async (req, res, next) => {
    try {
        const brands = await brandService.getAllBrandsBrief();

        // Добавляем полные URL к логотипам
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

const getBrandById = async (req, res, next) => {
    try {
        const brand = await brandService.getBrandById(req.params.id);

        // Добавляем полные URL к логотипу
        const processedBrand = addFullImageUrls(brand, req);

        res.json(processedBrand);
    } catch (err) {
        next(err);
    }
};

const createBrand = async (req, res, next) => {
    try {
        const brand = await brandService.createBrand(req.body);

        // Добавляем полные URL к логотипу
        const processedBrand = addFullImageUrls(brand, req);

        res.status(201).json(processedBrand);
    } catch (err) {
        next(err);
    }
};

const updateBrand = async (req, res, next) => {
    try {
        const brand = await brandService.updateBrand(req.params.id, req.body);

        // Добавляем полные URL к логотипу
        const processedBrand = addFullImageUrls(brand, req);

        res.json(processedBrand);
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
    getBrandsBrief,
    getBrandById,
    createBrand,
    updateBrand,
    deleteBrand,
};
