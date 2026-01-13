const Joi = require('joi');
const blogModel = require('../models/blogModel');
const AppError = require('../utils/errorUtils'); // Предполагаю, что есть

const blogSchema = Joi.object({
  id: Joi.string().required(), // Пользователь задаёт id (как в твоих примерах "1", "2")
  title: Joi.string().required(),
  excerpt: Joi.string().required(),
  content: Joi.string().required(),
  image: Joi.string().uri().required(),
  category: Joi.string().required(),
  author: Joi.string().required(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(), // 'YYYY-MM-DD'
  read_time: Joi.number().integer().min(1).required(),
  tags: Joi.array().items(Joi.string()).default([]),
});

const updateSchema = Joi.object({
  title: Joi.string().optional(),
  excerpt: Joi.string().optional(),
  content: Joi.string().optional(),
  image: Joi.string().uri().optional(),
  category: Joi.string().optional(),
  author: Joi.string().optional(),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  read_time: Joi.number().integer().min(1).optional(),
  tags: Joi.array().items(Joi.string()).optional(),
}).unknown(false); // stripUnknown не нужен, но можно добавить

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  category: Joi.string().optional(),
  search: Joi.string().optional(),
  filter: Joi.string().valid('popular', 'new').optional(),
  tags: Joi.alternatives().try(
    Joi.string(), 
    Joi.array().items(Joi.string()) 
  ).optional(),
});

const getAllBlogPosts = async (query) => {
  const { error, value } = querySchema.validate(query);
  if (error) throw new AppError(error.details[0].message, 400);
  return blogModel.getAllBlogPosts(value);
};

const getBlogPostById = async (id) => {
  const post = await blogModel.getBlogPostById(id);
  if (!post) throw new AppError('Пост не найден', 404);
  return post;
};

const createBlogPost = async (data) => {
  const { error, value } = blogSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);

  // Проверка на уникальность id
  const existing = await blogModel.getBlogPostById(value.id);
  if (existing) throw new AppError('Пост с таким ID уже существует', 409);

  return blogModel.createBlogPost(value);
};

const updateBlogPost = async (id, data) => {
  const { error, value } = updateSchema.validate(data, { stripUnknown: true });
  if (error) throw new AppError(error.details[0].message, 400);

  const post = await blogModel.getBlogPostById(id);
  if (!post) throw new AppError('Пост не найден', 404);

  return blogModel.updateBlogPost(id, value);
};

const deleteBlogPost = async (id) => {
  const post = await blogModel.getBlogPostById(id);
  if (!post) throw new AppError('Пост не найден', 404);
  // Можно добавить проверку на связанные комментарии/лайки, если будут
  await blogModel.deleteBlogPost(id);
};

module.exports = {
  getAllBlogPosts,
  getBlogPostById,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
};