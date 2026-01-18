// src/utils/imageUtils.js

// Добавляет полный URL к изображениям продукта, категории или бренда
const addFullImageUrls = (data, req) => {
  if (!data) return data;

  const imageBaseUrl = 'https://honnylove-images.website.yandexcloud.net';
  let apiBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3050';

  if (process.env.NODE_ENV !== 'production' && req) {
      apiBaseUrl = `${req.protocol}://${req.get('host')}`;
  }

  const addBaseUrl = (imagePath) => {
      if (!imagePath || typeof imagePath !== 'string') {
          return null;
      }

      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
          return imagePath;
      }

      if (imagePath.startsWith('/')) {
          return `${imageBaseUrl}${imagePath}`;
      }

      return `${imageBaseUrl}/${imagePath}`;
  };

  const processItem = (item) => {
      if (!item || typeof item !== 'object') {
          return item;
      }

      const processed = { ...item };

      if (item.image) {
          processed.image = addBaseUrl(item.image);
      }
      if (item.main_image_url) {
          processed.main_image_url = addBaseUrl(item.main_image_url);
      }
      if (item.image_url) {
          processed.image_url = addBaseUrl(item.image_url);
      }
      if (item.logo) {
          processed.logo = addBaseUrl(item.logo);
      }
      if (item.logo_url) {
          processed.logo_url = addBaseUrl(item.logo_url);
      }

      if (item.images && Array.isArray(item.images)) {
          processed.images = item.images.map(addBaseUrl);
      }
      if (item.image_urls && Array.isArray(item.image_urls)) {
          processed.image_urls = item.image_urls.map(addBaseUrl);
      }

      if (item.children && Array.isArray(item.children)) {
          processed.children = item.children.map(processItem);
      }
      if (item.products && Array.isArray(item.products)) {
          processed.products = item.products.map(processItem);
      }

      return processed;
  };

  if (data.products && Array.isArray(data.products)) {
      return {
          ...data,
          products: data.products.map(processItem),
      };
  } else if (data.brands && Array.isArray(data.brands)) {
      return {
          ...data,
          brands: data.brands.map(processItem),
      };
  } else if (data.categories && Array.isArray(data.categories)) {
      return {
          ...data,
          categories: data.categories.map(processItem),
      };
  } else if (data.banners && Array.isArray(data.banners)) {
      return {
          ...data,
          banners: data.banners.map(processItem),
      };
  } else if (data.posts && Array.isArray(data.posts)) {
      return {
          ...data,
          posts: data.posts.map(processItem),
      };
  } else if (data.data && Array.isArray(data.data)) {
      return {
          ...data,
          data: data.data.map(processItem),
      };
  } else if (Array.isArray(data)) {
      return data.map(processItem);
  } else {
      return processItem(data);
  }
};

// Валидация типа файла изображения
const validateImageFile = (file) => {
  if (!file) return;
  
  const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedMimeTypes.includes(file.mimetype)) {
      throw new Error('Недопустимый тип файла. Разрешены: jpg, jpeg, png, webp');
  }
};

module.exports = {
  addFullImageUrls,
  validateImageFile
};