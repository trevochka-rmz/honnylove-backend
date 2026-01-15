// utils/s3Uploader.js
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');

const s3Client = new S3Client({
    endpoint: 'https://storage.yandexcloud.net',
    region: 'ru-central1',
    credentials: {
        accessKeyId: process.env.YC_ACCESS_KEY,
        secretAccessKey: process.env.YC_SECRET_KEY,
    },
});

const BUCKET_NAME = process.env.YC_IMAGE_BUCKET;
const CDN_BASE_URL = process.env.YC_CDN_URL;

// Функция загрузки изображения для блога
async function uploadBlogImage(fileBuffer, fileName, blogId) {
    const fileExtension = path.extname(fileName);
    const uniqueFileName = `main-${Date.now()}${fileExtension}`;
    const s3Key = `uploads/blogs/${blogId}/${uniqueFileName}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
    }));

    return `${CDN_BASE_URL}/${s3Key}`;
}

// Функция удаления старого изображения
async function deleteOldBlogImage(imageUrl) {
    if (!imageUrl || !imageUrl.includes(CDN_BASE_URL)) return;

    const s3Key = imageUrl.replace(`${CDN_BASE_URL}/`, '');

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        }));
    } catch (error) {
        console.error('Ошибка удаления старого файла из S3:', error.message);
    }
}

module.exports = {
    uploadBlogImage,
    deleteOldBlogImage
};