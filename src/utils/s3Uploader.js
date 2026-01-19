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

// Функция загрузки изображения
async function uploadImage(fileBuffer, fileName, entityType, entityId, imageName = 'main') {
    const fileExtension = path.extname(fileName).toLowerCase();
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    
    if (!allowedExtensions.includes(fileExtension)) {
        throw new Error('Недопустимое расширение файла');
    }
    
    let contentType = 'image/jpeg';
    if (fileExtension === '.png') contentType = 'image/png';
    if (fileExtension === '.webp') contentType = 'image/webp';
    
    const s3Key = `uploads/${entityType}/${entityId}/${imageName}${fileExtension}`;

    await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        Body: fileBuffer,
        ContentType: contentType,
        ACL: 'public-read',
        CacheControl: 'public, max-age=31536000',
    }));

    return `${CDN_BASE_URL}/${s3Key}`;
}

// Удалить все изображения блога из S3
async function deleteImageByUrl(imageUrl) {
    if (!imageUrl || !imageUrl.includes(CDN_BASE_URL)) return;

    const s3Key = imageUrl.replace(`${CDN_BASE_URL}/`, '');

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
        }));
    } catch (error) {
        console.error('Ошибка удаления файла из S3:', error.message);
    }
}

// Удалить все изображения сущности из S3
async function deleteEntityImages(entityType, entityId) {
    try {
        const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
        
        for (const ext of extensions) {
            const s3Key = `uploads/${entityType}/${entityId}/main${ext}`;
            try {
                await s3Client.send(new DeleteObjectCommand({
                    Bucket: BUCKET_NAME,
                    Key: s3Key,
                }));
            } catch (error) {
                // Игнорируем ошибку, если файла нет
            }
        }
    } catch (error) {
        console.error(`Ошибка удаления изображений ${entityType} из S3:`, error.message);
    }
}

// Загрузить несколько изображений галереи продукта
async function uploadProductGalleryImages(files, productId) {
    const galleryUrls = [];
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExtension = path.extname(file.originalname).toLowerCase();
        const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
        
        if (!allowedExtensions.includes(fileExtension)) {
            throw new Error(`Недопустимое расширение файла: ${fileExtension}`);
        }
        
        let contentType = 'image/jpeg';
        if (fileExtension === '.png') contentType = 'image/png';
        if (fileExtension === '.webp') contentType = 'image/webp';
        
        const s3Key = `uploads/products/${productId}/gallery/${i + 1}${fileExtension}`;
        
        await s3Client.send(new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            Body: file.buffer,
            ContentType: contentType,
            ACL: 'public-read',
            CacheControl: 'public, max-age=31536000',
        }));
        
        galleryUrls.push(`${CDN_BASE_URL}/${s3Key}`);
    }
    
    return galleryUrls;
}

// Удалить галерею продукта
async function deleteProductGallery(productId) {
    try {
        const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
        
        for (let i = 1; i <= 10; i++) {
            for (const ext of extensions) {
                const s3Key = `uploads/products/${productId}/gallery/${i}${ext}`;
                try {
                    await s3Client.send(new DeleteObjectCommand({
                        Bucket: BUCKET_NAME,
                        Key: s3Key,
                    }));
                } catch (error) {
                    // Игнорируем ошибку, если файла нет
                }
            }
        }
    } catch (error) {
        console.error('Ошибка удаления галереи продукта из S3:', error.message);
    }
}

module.exports = {
    uploadImage,
    deleteEntityImages,
    deleteImageByUrl,
    uploadProductGalleryImages,
    deleteProductGallery
};