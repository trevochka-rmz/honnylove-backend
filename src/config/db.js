// src/config/db.js - ГИБРИДНАЯ СОВМЕСТИМАЯ ВЕРСИЯ
const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

/**
 * Создаем пул подключений с вашим старым подключением
 */
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,  // ← ваш старый формат
    ssl: process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : false, // SSL для prod
    
    // Добавляем настройки пула из новой версии
    max: 20,                    // Максимальное количество клиентов в пуле
    idleTimeoutMillis: 30000,   // Время простоя до закрытия соединения
    connectionTimeoutMillis: 2000, // Время ожидания подключения
});

/**
 * Обработка ошибок пула (объединенная версия)
 */
pool.on('error', (err, client) => {
    console.error('Неожиданная ошибка клиента БД:', err);
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

/**
 * Простой query БЕЗ изменений - полная совместимость со старым кодом
 */
const query = (text, params) => {
    if (process.env.NODE_ENV === 'development') {
        const start = Date.now();
        return pool.query(text, params)
            .then(res => {
                const duration = Date.now() - start;
                console.log('Executed query', {
                    text: text.length > 100 ? text.substring(0, 100) + '...' : text,
                    duration: `${duration}ms`,
                    rows: res.rowCount
                });
                return res;
            })
            .catch(err => {
                console.error('Ошибка выполнения query:', err.message);
                throw err;
            });
    }
    return pool.query(text, params);
};

/**
 * Получить клиента из пула (для транзакций)
 * Не забудьте вызвать client.release() после использования!
 */
const getClient = async () => {
    const client = await pool.connect();
    
    // Сохраняем оригинальные методы
    const originalQuery = client.query;
    const originalRelease = client.release;
    
    // Переопределяем release для логирования
    client.release = () => {
        // Возвращаем оригинальные методы
        client.query = originalQuery;
        client.release = originalRelease;
        
        if (process.env.NODE_ENV === 'development') {
            console.log('Клиент БД освобожден');
        }
        
        return originalRelease.apply(client);
    };
    
    return client;
};

/**
 * Выполнить функцию внутри транзакции
 * Автоматически делает COMMIT при успехе и ROLLBACK при ошибке
 * 
 * Пример использования:
 * await transaction(async (client) => {
 *   await client.query('INSERT INTO orders ...');
 *   await client.query('INSERT INTO order_items ...');
 * });
 */
const transaction = async (callback) => {
    const client = await getClient();
    
    try {
        await client.query('BEGIN');
        
        const result = await callback(client);
        
        await client.query('COMMIT');
        
        if (process.env.NODE_ENV === 'development') {
            console.log('Транзакция успешно завершена (COMMIT)');
        }
        
        return result;
    } catch (err) {
        await client.query('ROLLBACK');
        
        if (process.env.NODE_ENV === 'development') {
            console.error('Транзакция откачена (ROLLBACK):', err.message);
        }
        
        throw err;
    } finally {
        client.release();
    }
};

/**
 * Проверка подключения к БД
 */
const testConnection = async () => {
    try {
        const res = await query('SELECT NOW() as current_time');
        console.log('✅ Подключение к PostgreSQL успешно:', res.rows[0].current_time);
        return true;
    } catch (err) {
        console.error('❌ Ошибка подключения к PostgreSQL:', err.message);
        return false;
    }
};

/**
 * Graceful shutdown - корректное закрытие пула
 */
const closePool = async () => {
    try {
        await pool.end();
        console.log('🔌 Пул подключений PostgreSQL закрыт');
    } catch (err) {
        console.error('Ошибка при закрытии пула:', err);
    }
};

/**
 * Автоматический тест подключения при старте (как в вашем старом коде)
 */
pool.connect((err, client, release) => {
    if (err) {
        console.error('Error acquiring client', err.stack);
    } else {
        console.log('Connected to PostgreSQL');
        release();
    }
});

// Обработка завершения процесса (из новой версии)
process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    await closePool();
    process.exit(0);
});

/**
 * Экспортируем ВСЕ функции:
 */
module.exports = {
    // Старые функции (для совместимости)
    query,          // Простой query - работает ТОЧНО как раньше
    
    // Новые функции из предложенной версии
    pool,           // Сам пул (для прямого доступа если нужно)
    getClient,      // Получить клиента для транзакции
    transaction,    // Автоматическая транзакция
    testConnection, // Проверка подключения
    closePool       // Закрыть пул
    
    // Примечание: не экспортируем dotenv, это внутренняя зависимость
};
