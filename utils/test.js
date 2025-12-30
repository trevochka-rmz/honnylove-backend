//Создает папки в текущей директории с именами от 1 до n

const fs = require('fs');
const path = require('path');

async function createFolders() {
    try {
        const baseDir = process.cwd(); // Текущая директория
        const foldersToCreate = 20;

        console.log(
            `Создание ${foldersToCreate} папок в текущей директории...`
        );

        for (let i = 1; i <= foldersToCreate; i++) {
            const folderName = i.toString();
            const folderPath = path.join(baseDir, folderName);

            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
                console.log(`Создана папка: ${folderName}`);
            } else {
                console.log(
                    `Папка ${folderName} уже существует, пропускаем...`
                );
            }
        }

        console.log('\nГотово! Все папки успешно созданы.');
    } catch (error) {
        console.error('Произошла ошибка:', error.message);
    }
}

// Запуск функции
createFolders();
