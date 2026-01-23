// src/controllers/cartController.js
const cartService = require('../services/cartService');
const { addFullImageUrls } = require('../utils/imageUtils');

// Добавить товар в корзину
const addToCart = async (req, res, next) => {
  try {
    const item = await cartService.addToCart(req.user.id, req.body);
    // Получаем полные данные корзины для ответа
    const cart = await cartService.getCart(req.user.id);
    // Находим добавленный товар
    const addedItem = cart.items.find(
      (i) =>
        i.product_id === item.product_id && i.user_id === item.user_id
    );
    // Обрабатываем изображения
    if (addedItem && addedItem.product) {
      addedItem.product = addFullImageUrls(addedItem.product, req);
    }
    res.status(201).json({
      message: 'Товар добавлен в корзину',
      item: addedItem,
      cartSummary: cart.summary,
    });
  } catch (err) {
    next(err);
  }
};

// Получить корзину пользователя
const getCart = async (req, res, next) => {
  try {
    const cart = await cartService.getCart(req.user.id);
    cart.items = cart.items.map((item) => ({
      ...item,
      product: item.product ? addFullImageUrls(item.product, req) : null,
    }));
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

// Обновить количество товара в корзине
const updateCartItem = async (req, res, next) => {
  try {
    const { quantity } = req.body;
    if (quantity === undefined) {
      return res.status(400).json({ error: 'Не указано количество' });
    }
    const item = await cartService.updateCartItem(
      req.user.id,
      req.params.itemId,
      quantity
    );
    // Получаем обновленную корзину
    const cart = await cartService.getCart(req.user.id);
    // Находим обновленный товар
    const updatedItem = cart.items.find(
      (i) => i.id === parseInt(req.params.itemId)
    );
    // Обрабатываем изображения
    if (updatedItem && updatedItem.product) {
      updatedItem.product = addFullImageUrls(updatedItem.product, req);
    }
    res.json({
      message: 'Количество обновлено',
      item: updatedItem,
      cartSummary: cart.summary,
    });
  } catch (err) {
    next(err);
  }
};

// Удалить товар из корзины
const removeFromCart = async (req, res, next) => {
  try {
    await cartService.removeFromCart(req.user.id, req.params.itemId);
    // Получаем обновленную корзину
    const cart = await cartService.getCart(req.user.id);
    res.json({
      message: 'Товар удален из корзины',
      cartSummary: cart.summary,
    });
  } catch (err) {
    next(err);
  }
};

// Очистить корзину
const clearCart = async (req, res, next) => {
  try {
    await cartService.clearCart(req.user.id);
    res.json({ message: 'Корзина очищена' });
  } catch (err) {
    next(err);
  }
};

// Получить выбранные товары из корзины
const getSelectedCartItems = async (req, res, next) => {
  try {
    const { selected_items } = req.body; 
    
    if (!selected_items || !Array.isArray(selected_items)) {
      return res.status(400).json({ 
        error: 'Укажите массив ID товаров (selected_items)' 
      });
    }
    
    const cart = await cartService.getSelectedCartItems(
      req.user.id, 
      selected_items
    );
    
    cart.items = cart.items.map((item) => ({
      ...item,
      product: item.product ? addFullImageUrls(item.product, req) : null,
    }));
    
    res.json({
      success: true,
      data: cart,
      selected_count: selected_items.length
    });
    
  } catch (err) {
    next(err);
  }
};

module.exports = {
  addToCart,
  getCart,
  updateCartItem,
  removeFromCart,
  clearCart,
  getSelectedCartItems
};