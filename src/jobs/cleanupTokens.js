// src/jobs/cleanupTokens.js
const refreshTokenModel = require('../models/refreshTokenModel');

/**
 * Задача для очистки истёкших токенов
 * Запускается по расписанию (например, раз в день)
 */
const cleanupExpiredTokens = async () => {
  try {
    const deleted = await refreshTokenModel.deleteExpiredTokens();
    console.log(`[Cleanup] Удалено истёкших токенов: ${deleted}`);
  } catch (error) {
    console.error('[Cleanup] Ошибка при очистке токенов:', error);
  }
};

module.exports = { cleanupExpiredTokens };