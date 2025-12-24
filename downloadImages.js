const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// Используем плагины для обхода защиты
puppeteer.use(StealthPlugin());

// Конфигурация
const TARGET_URL =
    'https://moonglow.md/ru/products/toner-pedy-anua-pdrn-hyaluronic-glow-pad-60pcs/';
const PRODUCT_ID = 13;
const OUTPUT_DIR = path.join('uploads', 'products', PRODUCT_ID.toString());
const DEBUG_DIR = path.join('debug');

// Функция для скачивания изображения
function downloadImage(url, filepath) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https
            .get(url, (response) => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Ошибка ${response.statusCode}: ${url}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            })
            .on('error', (err) => {
                fs.unlink(filepath, () => {}); // Удаляем частично скачанный файл
                reject(err);
            });
    });
}

async function waitForCloudflare(page) {
    console.log('⏳ Ожидаю загрузки страницы (возможно, с Cloudflare)...');

    // Ждём либо исчезновение Cloudflare, либо появление товара
    try {
        await page.waitForFunction(
            () => {
                // Если Cloudflare виден - ждём дальше
                const cloudflareText =
                    document.querySelector('h1.zone-name-title');
                const productImage = document.querySelector('.wp-post-image');

                // Страница загружена, если есть изображение товара ИЛИ нет Cloudflare
                return (
                    productImage ||
                    !cloudflareText?.textContent?.includes('moonglow.md')
                );
            },
            {
                timeout: 45000, // 45 секунд максимум
                polling: 1000,
            }
        );

        console.log('✅ Cloudflare пройден или не обнаружен');
        return true;
    } catch (error) {
        console.log('⚠️ Не удалось автоматически пройти Cloudflare');
        return false;
    }
}

async function manualBypass(page) {
    console.log('\n🔄 Попытка ручного обхода...');

    // Делаем браузер видимым для ручного взаимодействия
    await page.setViewport({ width: 1200, height: 800 });

    console.log(
        '👉 Если видите капчу Cloudflare, решите её вручную в открывшемся браузере.'
    );
    console.log(
        '👉 После успешного прохождения нажмите Enter в этом терминале...'
    );

    // Ждём, пока пользователь решит капчу
    await new Promise((resolve) => {
        process.stdin.once('data', resolve);
    });

    return true;
}

async function extractImageUrls(page) {
    console.log('🔍 Ищу изображения товара...');

    return await page.evaluate(() => {
        const images = [];

        // Ищем изображения по классам из HTML, который вы предоставили
        const selectors = [
            '.wp-post-image',
            'img[src*="anua-pdrn"]',
            '.product-gallery img',
            '.woocommerce-product-gallery img',
            'img[data-large_image]',
        ];

        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach((img) => {
                const src =
                    img.src ||
                    img.getAttribute('data-src') ||
                    img.getAttribute('data-large_image');
                if (src && !src.startsWith('data:') && !images.includes(src)) {
                    images.push(src);
                }
            });
        });

        // Также ищем в структуре WooCommerce (часто используется)
        const woocommerceGallery = document.querySelector(
            '.woocommerce-product-gallery__wrapper'
        );
        if (woocommerceGallery) {
            woocommerceGallery.querySelectorAll('img').forEach((img) => {
                const src = img.src || img.getAttribute('data-src');
                if (src && !images.includes(src)) {
                    images.push(src);
                }
            });
        }

        return images;
    });
}

async function main() {
    console.log('🚀 Запуск улучшенного скрипта с обходом Cloudflare\n');

    // Создаём папки для отладки
    await fs.mkdir(DEBUG_DIR, { recursive: true });

    let browser;
    try {
        // 1. Запускаем браузер с более "стелс" настройками
        browser = await puppeteer.launch({
            headless: false, // ВАЖНО: false для ручного взаимодействия
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-blink-features=AutomationControlled',
                '--disable-web-security',
                '--disable-features=IsolateOrigins,site-per-process',
                '--window-size=1200,800',
            ],
            ignoreDefaultArgs: ['--enable-automation'],
            defaultViewport: null,
        });

        const page = await browser.newPage();

        // 2. Маскируем браузер под обычный
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        });

        // 3. Переходим на страницу
        console.log(`🌐 Открываю: ${TARGET_URL}`);
        await page.goto(TARGET_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000,
        });

        // 4. Пытаемся пройти Cloudflare автоматически
        const autoSuccess = await waitForCloudflare(page);

        if (!autoSuccess) {
            // 5. Если автоматически не получилось - ручной режим
            await manualBypass(page);

            // Даём время на загрузку контента после ручного ввода
            await page.waitForTimeout(5000);
        }

        // 6. Сохраняем финальный HTML для отладки
        const finalHtml = await page.content();
        await fs.writeFile(path.join(DEBUG_DIR, 'final_page.html'), finalHtml);
        console.log(
            `📄 Финальный HTML сохранён: ${path.join(
                DEBUG_DIR,
                'final_page.html'
            )}`
        );

        // 7. Делаем скриншот текущего состояния
        await page.screenshot({
            path: path.join(DEBUG_DIR, 'final_screenshot.png'),
            fullPage: true,
        });
        console.log(
            `📸 Финальный скриншот сохранён: ${path.join(
                DEBUG_DIR,
                'final_screenshot.png'
            )}`
        );

        // 8. Извлекаем URL изображений
        const imageUrls = await extractImageUrls(page);

        if (imageUrls.length === 0) {
            console.log('\n❌ Изображения не найдены. Возможные причины:');
            console.log('   - Страница всё ещё показывает Cloudflare');
            console.log('   - Структура страницы изменилась');
            console.log('   - Товар отсутствует на странице');

            // Сохраняем всё содержимое для анализа
            const pageText = await page.evaluate(() => document.body.innerText);
            await fs.writeFile(path.join(DEBUG_DIR, 'page_text.txt'), pageText);
            console.log(
                `📝 Текст страницы сохранён для анализа: ${path.join(
                    DEBUG_DIR,
                    'page_text.txt'
                )}`
            );

            // Показываем, что видит скрипт
            console.log('\n🔎 Что видит скрипт на странице:');
            const visibleImages = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('img')).map(
                    (img) => ({
                        src: img.src.substring(0, 100),
                        alt: img.alt,
                        className: img.className,
                    })
                );
            });

            await fs.writeFile(
                path.join(DEBUG_DIR, 'visible_images.json'),
                JSON.stringify(visibleImages, null, 2)
            );
            console.log(
                `👁️ Список всех изображений сохранён: ${path.join(
                    DEBUG_DIR,
                    'visible_images.json'
                )}`
            );
        } else {
            console.log(`\n✅ Найдено ${imageUrls.length} изображений:`);
            imageUrls.forEach((url, i) => {
                console.log(`   ${i + 1}. ${url.substring(0, 80)}...`);
            });

            // 9. Создаём папки для товара
            await fs.mkdir(path.join(OUTPUT_DIR, 'gallery'), {
                recursive: true,
            });

            // 10. Скачиваем изображения (первые 3)
            const maxImages = Math.min(imageUrls.length, 3);
            console.log(`\n📥 Скачиваю ${maxImages} изображений...`);

            for (let i = 0; i < maxImages; i++) {
                const imageUrl = imageUrls[i];
                const filename = i === 0 ? 'main.jpg' : `${i}.jpg`;
                const filepath =
                    i === 0
                        ? path.join(OUTPUT_DIR, filename)
                        : path.join(OUTPUT_DIR, 'gallery', filename);

                try {
                    console.log(`   ${i + 1}/${maxImages}: ${filename}`);
                    console.log(`     ← ${imageUrl.substring(0, 60)}...`);

                    await downloadImage(imageUrl, filepath);
                    console.log(`     ✅ Успешно: ${filepath}`);
                } catch (error) {
                    console.log(`     ❌ Ошибка: ${error.message}`);
                }

                // Пауза между загрузками
                if (i < maxImages - 1) {
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }

            console.log(
                `\n🎉 Готово! Для товара ID ${PRODUCT_ID} скачано ${maxImages} изображений`
            );
            console.log(
                `📁 Основное фото: ${path.join(OUTPUT_DIR, 'main.jpg')}`
            );
            console.log(`📁 Галерея: ${path.join(OUTPUT_DIR, 'gallery')}`);
        }
    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
        console.error('Стек вызовов:', error.stack);

        await fs.writeFile(
            path.join(DEBUG_DIR, 'error_log.txt'),
            `Время: ${new Date().toISOString()}\nОшибка: ${
                error.stack
            }\nURL: ${TARGET_URL}\n`
        );
    } finally {
        // 11. Закрываем браузер
        if (browser) {
            console.log('\n\n📋 ИНСТРУКЦИЯ ПО РАБОТЕ:');
            console.log('1. Скрипт откроет браузер Chrome');
            console.log(
                '2. Если появится Cloudflare капча - решите её вручную'
            );
            console.log(
                '3. После решения капчи нажмите Enter в этом терминале'
            );
            console.log('4. Скрипт продолжит работу и скачает изображения');
            console.log('\n⏳ Ожидаю 30 секунд перед закрытием браузера...');

            // Ждём 30 секунд, чтобы можно было увидеть результат
            await new Promise((r) => setTimeout(r, 30000));
            await browser.close();
            console.log('🛑 Браузер закрыт.');
        }
    }
}

// Обработка Ctrl+C
process.on('SIGINT', async () => {
    console.log('\n\n⚠️ Прервано пользователем');
    process.exit(0);
});

// Запуск скрипта
main().catch(console.error);
