// src/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error(err.stack);
    const status = err.status || 500; // Теперь берёт из AppError
    const message =
      process.env.NODE_ENV === 'production' && status >= 500
        ? 'Internal Server Error' // В prod скрываем детали только для 5xx
        : err.message;
    res.status(status).json({
      success: false,
      message,
      data: err.data || null  
    });
  };
  module.exports = errorHandler;