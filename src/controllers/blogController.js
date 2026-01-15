// controllers/blogController.js
const blogService = require('../services/blogService');
const { addFullImageUrls } = require('../utils/imageUtils');

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
const createBlogPost = async (req, res, next) => {
  try {
    const post = await blogService.createBlogPost(req.body);
    const processed = addFullImageUrls(post, req);
    res.status(201).json(processed);
  } catch (err) {
    next(err);
  }
};

// Обновление поста
const updateBlogPost = async (req, res, next) => {
  try {
    const post = await blogService.updateBlogPost(req.params.id, req.body);
    const processed = addFullImageUrls(post, req);
    res.json(processed);
  } catch (err) {
    next(err);
  }
};

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
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
};