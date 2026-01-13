// src/utils/orderImageUtils.js
const { addFullImageUrls } = require('./imageUtils');

/**
 * Подготавливает данные заказа для обработки imageUtils
 */
const prepareOrderForImageProcessing = (order) => {
  if (!order) return null;
  
  // Создаем копию заказа
  const preparedOrder = { ...order };
  
  // Если есть items, преобразуем productImage в image для обработки
  if (preparedOrder.items && Array.isArray(preparedOrder.items)) {
    preparedOrder.items = preparedOrder.items.map(item => {
      const preparedItem = { ...item };
      
      // Переименовываем productImage → image для обработки
      if (preparedItem.productImage) {
        preparedItem.image = preparedItem.productImage;
      }
      
      return preparedItem;
    });
  }
  
  return preparedOrder;
};

/**
 * Восстанавливает структуру заказа после обработки imageUtils
 */
const restoreOrderAfterImageProcessing = (processedOrder) => {
  if (!processedOrder) return null;
  
  const restoredOrder = { ...processedOrder };
  
  // Если есть items, восстанавливаем productImage из image
  if (restoredOrder.items && Array.isArray(restoredOrder.items)) {
    restoredOrder.items = restoredOrder.items.map(item => {
      const restoredItem = { ...item };
      
      // Если image был обработан, копируем его в productImage
      if (restoredItem.image) {
        restoredItem.productImage = restoredItem.image;
        // Удаляем временное поле image если оно не нужно в ответе
        delete restoredItem.image;
      }
      
      return restoredItem;
    });
  }
  
  return restoredOrder;
};

/**
 * Обрабатывает изображения в заказе используя существующий imageUtils
 */
const processOrderImages = (order, req) => {
  if (!order) return order;
  
  // 1. Подготавливаем заказ для обработки
  const preparedOrder = prepareOrderForImageProcessing(order);
  
  // 2. Используем существующий addFullImageUrls
  const processedOrder = addFullImageUrls(preparedOrder, req);
  
  // 3. Восстанавливаем оригинальную структуру
  return restoreOrderAfterImageProcessing(processedOrder);
};

/**
 * Обрабатывает изображения в массиве заказов
 */
const processOrdersImages = (orders, req) => {
  if (!orders) return orders;
  
  // Если это простой массив заказов
  if (Array.isArray(orders)) {
    return orders.map(order => processOrderImages(order, req));
  }
  
  // Если это объект с полем orders (как в getUserOrders)
  if (orders.orders && Array.isArray(orders.orders)) {
    return {
      ...orders,
      orders: orders.orders.map(order => processOrderImages(order, req))
    };
  }
  
  // Если это объект с полем data (как в getAllOrders)
  if (orders.data && Array.isArray(orders.data)) {
    return {
      ...orders,
      data: orders.data.map(order => processOrderImages(order, req))
    };
  }
  
  return orders;
};

module.exports = {
  processOrderImages,
  processOrdersImages
};