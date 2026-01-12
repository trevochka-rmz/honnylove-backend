// src/utils/transaction.js
const db = require('../config/db');

const withTransaction = async (callback) => {
  // Проверяем, есть ли метод connect
  if (typeof db.connect !== 'function') {
    // Если нет, используем обычные запросы без транзакции
    return await callback({
      query: db.query,
    });
  }
  
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = { withTransaction };