// controllers/blogController.js
const blogService = require('../services/blogService');
const { addFullImageUrls } = require('../utils/imageUtils');
const upload = require('../middleware/uploadMiddleware');


// Получение всех постов
const getBlogPosts = async (req, res, next) => {
  try {
    const result = await blogService.getAllBlogPosts(req.query);
    const processed = addFullImageUrls(result, req);
    res.json(processed);
  } catch (err) {
    next(err);
  }
};

// Получение поста по identifier
const getBlogPostByIdentifier = async (req, res, next) => {
  try {
    const post = await blogService.getBlogPostByIdentifier(req.params.identifier);
    const processed = addFullImageUrls(post, req);
    res.json(processed);
  } catch (err) {
    next(err);
  }
};

// Создание поста
const createBlogPost = [
  upload.single('image'),
  async (req, res, next) => {
      try {
          const postData = req.body;
          if (postData.tags && typeof postData.tags === 'string') {
              postData.tags = JSON.parse(postData.tags);
          }
          const newPost = await blogService.createBlogPost(postData, req.file);
          const processedPost = addFullImageUrls(newPost, req);
          res.status(201).json(processedPost);
      } catch (error) {
          next(error);
      }
  }
];

// Обновление поста
const updateBlogPost = [
  upload.single('image'),
  async (req, res, next) => {
      try {
          const { id } = req.params;
          const updateData = req.body;
          const updatedPost = await blogService.updateBlogPost(id, updateData, req.file);
          if (!updatedPost) return res.status(404).json({ error: 'Пост не найден' });
          const processedPost = addFullImageUrls(updatedPost, req);
          res.json(processedPost);
      } catch (error) {
          next(error);
      }
  }
];


// Удаление поста
const deleteBlogPost = async (req, res, next) => {
  try {
    await blogService.deleteBlogPost(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getBlogPosts,
  getBlogPostByIdentifier,
  deleteBlogPost,
  updateBlogPost,
  createBlogPost
};