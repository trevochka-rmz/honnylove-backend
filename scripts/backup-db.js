#!/usr/bin/env node

const { exec } = require('child_process');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const os = require('os');

const execAsync = promisify(exec);

// Загружаем переменные окружения
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// ========== ПАРСИНГ DATABASE_URL ==========
function parseDatabaseUrl(dbUrl) {
  if (!dbUrl) return null;
  
  try {
    const url = new URL(dbUrl);
    
    return {
      user: url.username,
      password: url.password,
      host: url.hostname,
      port: url.port || 5432,
      database: url.pathname.replace('/', ''),
    };
  } catch (error) {
    console.error('❌ Ошибка парсинга DATABASE_URL:', error.message);
    return null;
  }
}

// Получаем конфигурацию БД
function getDbConfig() {
  if (process.env.DATABASE_URL) {
    const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
    if (parsed) {
      console.log('📊 Использую DATABASE_URL для подключения');
      return parsed;
    }
  }
}

// ========== КОНФИГУРАЦИЯ ==========
const config = {
  // Yandex Cloud S3
  s3: {
    client: new S3Client({
      endpoint: 'https://storage.yandexcloud.net',
      region: 'ru-central1',
      credentials: {
        accessKeyId: process.env.YC_ACCESS_KEY,
        secretAccessKey: process.env.YC_SECRET_KEY,
      },
    }),
    backupBucket: process.env.YC_BACKUP_BUCKET,
  },
  
  // Database 
  db: getDbConfig(),
  
  // Backup settings
  backup: {
    tempDir: process.env.DB_BACKUP_LOCAL_PATH || os.tmpdir(),
    keepLocalDays: 0,
  }
};

// ========== ФУНКЦИИ ==========

/**
 * Создание дампа PostgreSQL
 */
async function createPostgresDump() {
  const timestamp = new Date().toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19);
  
  const date = new Date().toISOString().split('T')[0];
  
  // Имя файла
  const fileName = `honnylove-db-${timestamp}.dump.gz`;
  const localFilePath = path.join(config.backup.tempDir, fileName);
  
  console.log(`📦 Создание бэкапа БД: ${fileName}`);
  console.log(`🔗 Подключение к: ${config.db.host}:${config.db.port}/${config.db.database}`);
  
  try {
    // 1. Проверяем подключение к БД
    console.log('🔍 Проверка подключения к БД...');
    const checkCmd = `PGPASSWORD="${config.db.password}" psql -h ${config.db.host} -p ${config.db.port} -U ${config.db.user} -d ${config.db.database} -c "SELECT 1;"`;
    await execAsync(checkCmd);
    console.log('✅ Подключение к БД успешно');
    
    // 2. Создаём дамп
    console.log('💾 Создание дампа...');
    const dumpCmd = `PGPASSWORD="${config.db.password}" pg_dump \
      -h ${config.db.host} \
      -p ${config.db.port} \
      -U ${config.db.user} \
      -d ${config.db.database} \
      -F c \
      -Z 9 \
      -f "${localFilePath}"`;
    
    await execAsync(dumpCmd);
    
    // Проверяем размер файла
    const stats = fs.statSync(localFilePath);
    console.log(`✅ Дамп создан: ${localFilePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    
    return {
      success: true,
      fileName,
      localFilePath,
      fileSize: stats.size,
      date,
      timestamp,
    };
    
  } catch (error) {
    console.error('❌ Ошибка создания дампа:', error.message);
    
    // Удаляем битый файл если есть
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
    
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Загрузка в Yandex Object Storage
 */
async function uploadToS3(filePath, fileName, date) {
  try {
    console.log(`☁️  Загрузка в Yandex Cloud S3...`);
    
    const fileContent = fs.readFileSync(filePath);
    
    // Путь в S3: postgres/daily/2025-01-14/filename.gz
    const s3Key = `postgres/daily/${date}/${fileName}`;
    
    await config.s3.client.send(new PutObjectCommand({
      Bucket: config.s3.backupBucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: 'application/gzip',
      StorageClass: 'COLD',
    }));
    
    console.log(`✅ Загружено в S3: ${s3Key}`);
    
    // Также создаём latest backup
    await config.s3.client.send(new PutObjectCommand({
      Bucket: config.s3.backupBucket,
      Key: 'postgres/latest.dump.gz',
      Body: fileContent,
      ContentType: 'application/gzip',
      StorageClass: 'COLD',
    }));
    
    console.log('🔗 Обновлён latest.dump.gz');
    
    return {
      success: true,
      s3Key,
    };
    
  } catch (error) {
    console.error('❌ Ошибка загрузки в S3:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Очистка старых локальных файлов
 */
function cleanupOldLocalBackups() {
  if (config.backup.keepLocalDays <= 0) return;
  
  try {
    const files = fs.readdirSync(config.backup.tempDir);
    const cutoffTime = Date.now() - (config.backup.keepLocalDays * 24 * 60 * 60 * 1000);
    
    files.forEach(file => {
      if (file.includes('honnylove-db-')) {
        const filePath = path.join(config.backup.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtimeMs < cutoffTime) {
          fs.unlinkSync(filePath);
          console.log(`🗑️  Удалён старый локальный файл: ${file}`);
        }
      }
    });
  } catch (error) {
    console.warn('⚠️  Не удалось очистить старые файлы:', error.message);
  }
}

/**
 * Проверка конфигурации
 */
function validateConfig() {
  const errors = [];
  
  if (!config.db.password) {
    errors.push('Не указан пароль БД');
  }
  
  if (!config.db.host || !config.db.database || !config.db.user) {
    errors.push('Неполная конфигурация БД');
  }
  
  if (!process.env.YC_ACCESS_KEY || !process.env.YC_SECRET_KEY) {
    errors.push('Не указаны ключи Yandex Cloud');
  }
  
  if (errors.length > 0) {
    console.error('❌ Ошибки конфигурации:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.log('\n💡 Проверьте .env файл. Нужны либо:');
    console.log('   1. DATABASE_URL=postgresql://user:pass@host:port/db');
    console.log('   2. Или DB_BACKUP_HOST, DB_BACKUP_PASSWORD и т.д.');
    console.log('   3. Или DB_HOST, DB_PASSWORD и т.д.');
    return false;
  }
  
  return true;
}

/**
 * Основная функция
 */
async function main() {
  console.log('='.repeat(50));
  console.log('🚀 ЗАПУСК БЭКАПА БАЗЫ ДАННЫХ');
  console.log('='.repeat(50));
  
  // Проверяем конфигурацию
  if (!validateConfig()) {
    process.exit(1);
  }
  
  // Создаём временную папку
  if (!fs.existsSync(config.backup.tempDir)) {
    fs.mkdirSync(config.backup.tempDir, { recursive: true });
  }
  
  // 1. Создаём дамп
  const dumpResult = await createPostgresDump();
  if (!dumpResult.success) {
    console.error('💥 Не удалось создать дамп БД');
    process.exit(1);
  }
  
  // 2. Загружаем в S3
  const uploadResult = await uploadToS3(
    dumpResult.localFilePath,
    dumpResult.fileName,
    dumpResult.date
  );
  
  if (!uploadResult.success) {
    console.error('💥 Не удалось загрузить в S3');
    
    // Оставляем локальную копию при ошибке
    console.log(`⚠️  Локальная копия сохранена: ${dumpResult.localFilePath}`);
    process.exit(1);
  }
  
  // 3. Удаляем локальный файл
  if (config.backup.keepLocalDays <= 0) {
    fs.unlinkSync(dumpResult.localFilePath);
    console.log('🗑️  Локальный файл удалён');
  }
  
  // 4. Очистка старых файлов
  cleanupOldLocalBackups();
  
  // 5. Итог
  console.log('='.repeat(50));
  console.log('🎉 БЭКАП УСПЕШНО ЗАВЕРШЁН!');
  console.log(`📊 Размер: ${(dumpResult.fileSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 S3 путь: ${uploadResult.s3Key}`);
  console.log(`🕐 Время: ${new Date().toLocaleString('ru-RU')}`);
  console.log('='.repeat(50));
  
  process.exit(0);
}

// Запуск
if (require.main === module) {
  main().catch(error => {
    console.error('💥 Непредвиденная ошибка:', error);
    process.exit(1);
  });
}

module.exports = { createBackup: main, parseDatabaseUrl };