// src/utils/errorUtils.js
class AppError extends Error {
    constructor(message, status = 500) {
        super(message);
        this.status = status;
        this.isOperational = true; // Для отличия от unexpected ошибок
    }
}

module.exports = AppError;
