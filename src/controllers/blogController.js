const blogService = require('../services/blogService');
const { addFullImageUrls } = require('../utils/imageUtils'); // Если есть, иначе удали

const getBlogPosts = async (req, res, next) => {
  try {
    const result = await blogService.getAllBlogPosts(req.query);
    // Если есть addFullImageUrls — применяем к постам
    const processed = addFullImageUrls ? addFullImageUrls(result, req) : result;
    res.json(processed);
  } catch (err) {
    next(err);
  }
};

const getBlogPostByIdentifier = async (req, res, next) => {
  try {
    const post = await blogService.getBlogPostByIdentifier(req.params.identifier);
    const processed = addFullImageUrls ? addFullImageUrls(post, req) : post;
    res.json(processed);
  } catch (err) {
    next(err);
  }
};

const createBlogPost = async (req, res, next) => {
  try {
    const post = await blogService.createBlogPost(req.body);
    const processed = addFullImageUrls ? addFullImageUrls(post, req) : post;
    res.status(201).json(processed);
  } catch (err) {
    next(err);
  }
};

const updateBlogPost = async (req, res, next) => {
  try {
    const post = await blogService.updateBlogPost(req.params.id, req.body);
    const processed = addFullImageUrls ? addFullImageUrls(post, req) : post;
    res.json(processed);
  } catch (err) {
    next(err);
  }
};

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
  getBlogPostByIdentifier, // Изменили имя
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
};