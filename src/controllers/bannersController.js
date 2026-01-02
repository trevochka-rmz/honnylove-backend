const bannersService = require('../services/bannersService');
const { addFullImageUrls } = require('../utils/imageUtils'); // Утилита для изображений

const getAllBanners = async (req, res, next) => {
    try {
        const banners = await bannersService.getAllBanners();
        // Обрабатываем весь массив баннеров (addFullImageUrls обновит image_url в каждом)
        const processedBanners = addFullImageUrls(banners, req);
        res.json(processedBanners);
    } catch (err) {
        next(err);
    }
};

const getAllBannersAdmin = async (req, res, next) => {
    try {
        const result = await bannersService.getAllBannersAdmin(req.query);
        // Обрабатываем весь результат (если result = { banners: [...], ... })
        const processedResult = addFullImageUrls(result, req);
        res.json(processedResult);
    } catch (err) {
        next(err);
    }
};

const getBannerById = async (req, res, next) => {
    try {
        const banner = await bannersService.getBannerById(req.params.id);
        // Обрабатываем одиночный объект
        const processedBanner = addFullImageUrls(banner, req);
        res.json(processedBanner);
    } catch (err) {
        next(err);
    }
};

const createBanner = async (req, res, next) => {
    try {
        const banner = await bannersService.createBanner(req.body);
        // Обрабатываем созданный объект
        const processedBanner = addFullImageUrls(banner, req);
        res.status(201).json(processedBanner);
    } catch (err) {
        next(err);
    }
};

const updateBanner = async (req, res, next) => {
    try {
        const banner = await bannersService.updateBanner(
            req.params.id,
            req.body
        );
        // Обрабатываем обновлённый объект
        const processedBanner = addFullImageUrls(banner, req);
        res.json(processedBanner);
    } catch (err) {
        next(err);
    }
};

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
