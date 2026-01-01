const bannersService = require('../services/bannersService');
const { addFullImageUrls } = require('../utils/imageUtils'); // Если нужно для image_url

const getAllBanners = async (req, res, next) => {
    try {
        const banners = await bannersService.getAllBanners();
        // Добавляем полный URL к image_url, если используете
        const processedBanners = banners.map((banner) => ({
            ...banner,
            image_url: addFullImageUrls(banner.image_url, req), // Адаптируйте под вашу утилиту
        }));
        res.json(processedBanners);
    } catch (err) {
        next(err);
    }
};

const getAllBannersAdmin = async (req, res, next) => {
    try {
        const result = await bannersService.getAllBannersAdmin(req.query);
        res.json(result);
    } catch (err) {
        next(err);
    }
};

const getBannerById = async (req, res, next) => {
    try {
        const banner = await bannersService.getBannerById(req.params.id);
        res.json(banner);
    } catch (err) {
        next(err);
    }
};

const createBanner = async (req, res, next) => {
    try {
        const banner = await bannersService.createBanner(req.body);
        res.status(201).json(banner);
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
        res.json(banner);
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
