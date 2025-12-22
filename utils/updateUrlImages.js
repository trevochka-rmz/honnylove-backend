// updateImagePaths.js
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    user: 'admin',
    host: 'localhost',
    database: 'your_database',
    password: 'your_password',
    port: 5432,
});

async function updateImagePaths() {
    try {
        // Получаем все товары
        const { rows: products } = await pool.query(
            'SELECT id, name FROM product_products'
        );

        for (const product of products) {
            const productId = product.id;
            const productDir = `uploads/products/${productId}`;

            // Проверяем существование папки
            if (fs.existsSync(productDir)) {
                // Ищем главное фото
                const mainDir = `${productDir}/main`;
                let mainImage = null;

                if (fs.existsSync(mainDir)) {
                    const mainFiles = fs.readdirSync(mainDir);
                    if (mainFiles.length > 0) {
                        mainImage = `/uploads/products/${productId}/main/${mainFiles[0]}`;

                        // Обновляем в БД
                        await pool.query(
                            'UPDATE product_products SET main_image_url = $1 WHERE id = $2',
                            [mainImage, productId]
                        );
                    }
                }

                // Ищем галерею
                const galleryDir = `${productDir}/gallery`;
                let galleryImages = [];

                if (fs.existsSync(galleryDir)) {
                    const galleryFiles = fs.readdirSync(galleryDir);
                    galleryImages = galleryFiles.map(
                        (file) =>
                            `/uploads/products/${productId}/gallery/${file}`
                    );

                    // Обновляем в БД (jsonb поле)
                    await pool.query(
                        'UPDATE product_products SET image_urls = $1 WHERE id = $2',
                        [JSON.stringify(galleryImages), productId]
                    );
                }

                console.log(`Updated product ${productId}: ${product.name}`);
            }
        }

        console.log('All image paths updated successfully!');
    } catch (error) {
        console.error('Error updating image paths:', error);
    } finally {
        await pool.end();
    }
}

updateImagePaths();
