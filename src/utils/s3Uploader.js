// utils/s3Uploader.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

// Инициализация S3 клиента для работы с Yandex Object Storage
const s3Client = new S3Client({
    endpoint: 'https://storage.yandexcloud.net',
    region: 'ru-central1',
    credentials: {
        accessKeyId: process.env.YC_ACCESS_KEY,
        secretAccessKey: process.env.YC_SECRET_KEY,
    },
});

// Название бакета и базовый URL CDN
const BUCKET_NAME  = process.env.YC_IMAGE_BUCKET;
const CDN_BASE_URL = process.env.YC_CDN_URL;

// Разрешенные расширения изображений
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

// Получить Content-Type по расширению файла
function getContentType(fileExtension) {
    const map = {
        '.png':  'image/png',
        '.webp': 'image/webp',
        '.jpg':  'image/jpeg',
        '.jpeg': 'image/jpeg',
    };
    return map[fileExtension] || 'image/jpeg';
}

// Проверка допустимого расширения файла
function validateExtension(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
        throw new Error(`Недопустимое расширение файла: ${ext}`);
    }
    return ext;
}

// Преобразовать URL изображения в S3 ключ
function urlToS3Key(imageUrl) {
    if (!imageUrl || !CDN_BASE_URL) return null;
    if (!imageUrl.startsWith(CDN_BASE_URL)) return null;
    return imageUrl.replace(`${CDN_BASE_URL}/`, '');
}

// Удалить объект из S3 по ключу
async function deleteByKey(s3Key) {
    if (!s3Key) return;
    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        }));
    } catch (error) {
        console.error('Ошибка удаления из S3:', s3Key, error.message);
    }
}

// Загрузить одно изображение (main) для сущности
async function uploadImage(fileBuffer, fileName, entityType, entityId, imageName = 'main') {
    const ext     = validateExtension(fileName);
    const s3Key   = `uploads/${entityType}/${entityId}/${imageName}${ext}`;

    await s3Client.send(new PutObjectCommand({
        Bucket:       BUCKET_NAME,
        Key:          s3Key,
        Body:         fileBuffer,
        ContentType:  getContentType(ext),
        ACL:          'public-read',
        CacheControl: 'public, max-age=31536000',
    }));

    return `${CDN_BASE_URL}/${s3Key}`;
}

// Удалить изображение по URL
async function deleteImageByUrl(imageUrl) {
    const key = urlToS3Key(imageUrl);
    await deleteByKey(key);
}

// Удалить основное изображение сущности (перебор всех расширений)
async function deleteEntityImages(entityType, entityId) {
    for (const ext of ALLOWED_EXTENSIONS) {
        await deleteByKey(`uploads/${entityType}/${entityId}/main${ext}`);
    }
}

// Загрузить галерею изображений для сущности
async function uploadGalleryImages(files, entityType, entityId) {
    const urls = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext  = validateExtension(file.originalname);
        const key  = `uploads/${entityType}/${entityId}/gallery/${i + 1}${ext}`;

        await s3Client.send(new PutObjectCommand({
            Bucket:       BUCKET_NAME,
            Key:          key,
            Body:         file.buffer,
            ContentType:  getContentType(ext),
            ACL:          'public-read',
            CacheControl: 'public, max-age=31536000',
        }));

        urls.push(`${CDN_BASE_URL}/${key}`);
    }
    return urls;
}

// Удалить галерею по массиву URL
async function deleteGalleryByUrls(imageUrls) {
    if (!imageUrls || imageUrls.length === 0) return;
    for (const url of imageUrls) {
        await deleteImageByUrl(url);
    }
}

// Удалить галерею по шаблону (если URL не сохранены)
async function deleteGalleryByPattern(entityType, entityId, maxCount = 10) {
    for (let i = 1; i <= maxCount; i++) {
        for (const ext of ALLOWED_EXTENSIONS) {
            await deleteByKey(`uploads/${entityType}/${entityId}/gallery/${i}${ext}`);
        }
    }
}

// Загрузить галерею изображений продукта
const uploadProductGalleryImages = (files, productId) =>
    uploadGalleryImages(files, 'products', productId);

// Загрузить галерею изображений варианта продукта
const uploadVariantGalleryImages = (files, variantId) =>
    uploadGalleryImages(files, 'variants', variantId);

// Удалить галерею продукта
async function deleteProductGallery(productId, existingUrls = null) {
    if (existingUrls && existingUrls.length > 0) {
        await deleteGalleryByUrls(existingUrls);
    } else {
        await deleteGalleryByPattern('products', productId, 10);
    }
}

// Удалить галерею варианта продукта
async function deleteVariantGallery(variantId, existingUrls = null) {
    if (existingUrls && existingUrls.length > 0) {
        await deleteGalleryByUrls(existingUrls);
    } else {
        await deleteGalleryByPattern('variants', variantId, 5);
    }
}

module.exports = {
    uploadImage,
    deleteImageByUrl,
    deleteEntityImages,
    uploadGalleryImages,
    deleteGalleryByUrls,
    uploadProductGalleryImages,
    uploadVariantGalleryImages,
    deleteProductGallery,
    deleteVariantGallery,
};