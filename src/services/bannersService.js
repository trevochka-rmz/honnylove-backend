const Joi = require('joi');
const bannersModel = require('../models/bannersModel');
const AppError = require('../utils/errorUtils');

// Схема валидации для создания/обновления (добавили preheader)
const bannerSchema = Joi.object({
    preheader: Joi.string().max(255).optional(), // Новый: опциональный, макс 255 символов
    title: Joi.string().required(),
    subtitle: Joi.string().optional(),
    image_url: Joi.string().optional(),
    button_text: Joi.string().optional(),
    button_link: Joi.string().optional(),
    display_order: Joi.number().integer().default(0),
    is_active: Joi.boolean().default(true),
});

// Получить все баннеры (фронт)
const getAllBanners = async () => {
    return bannersModel.getAllBanners();
};

// Получить все баннеры (админ)
const getAllBannersAdmin = async (query) => {
    const { page = 1, limit = 10 } = query;
    return bannersModel.getAllBannersAdmin({ page, limit });
};

// Получить по ID
const getBannerById = async (id) => {
    const banner = await bannersModel.getBannerById(id);
    if (!banner) throw new AppError('Banner not found', 404);
    return banner;
};

// Создать
const createBanner = async (data) => {
    const { error } = bannerSchema.validate(data);
    if (error) throw new AppError(error.details[0].message, 400);
    return bannersModel.createBanner(data);
};

// Обновить
const updateBanner = async (id, data) => {
    const { error } = bannerSchema.validate(data, { stripUnknown: true });
    if (error) throw new AppError(error.details[0].message, 400);
    const banner = await bannersModel.getBannerById(id);
    if (!banner) throw new AppError('Banner not found', 404);
    return bannersModel.updateBanner(id, data);
};

// Удалить
const deleteBanner = async (id) => {
    const banner = await bannersModel.getBannerById(id);
    if (!banner) throw new AppError('Banner not found', 404);
    return bannersModel.deleteBanner(id);
};

module.exports = {
    getAllBanners,
    getAllBannersAdmin,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner,
};
