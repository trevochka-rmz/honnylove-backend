const settingsService = require('../services/settingsService');
const { addFullImageUrls } = require('../utils/imageUtils'); // Если нужно для icon в social_links

const getSettings = async (req, res, next) => {
    try {
        let settings = await settingsService.getSettings();
        // Обрабатываем иконки в social_links (если icon — путь к изображению)
        if (settings.social_links) {
            settings.social_links = settings.social_links.map((link) => ({
                ...link,
                icon: addFullImageUrls(link.icon, req), // Если icon — строка, иначе пропустить
            }));
        }
        res.json(settings);
    } catch (err) {
        next(err);
    }
};

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
