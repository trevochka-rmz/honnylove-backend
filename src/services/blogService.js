// services/blogService.js
const Joi = require('joi');
const blogModel = require('../models/blogModel');
const AppError = require('../utils/errorUtils');

const blogSchema = Joi.object({
  title: Joi.string().required().messages({ 'any.required': 'Поле "title" обязательно' }),
  excerpt: Joi.string().required().messages({ 'any.required': 'Поле "excerpt" обязательно' }),
  content: Joi.string().required().messages({ 'any.required': 'Поле "content" обязательно' }),
  image: Joi.string().uri().required().messages({ 'any.required': 'Поле "image" обязательно' }),
  category: Joi.string().required().messages({ 'any.required': 'Поле "category" обязательно' }),
  author: Joi.string().required().messages({ 'any.required': 'Поле "author" обязательно' }),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  read_time: Joi.number().integer().min(1).required().messages({ 'any.required': 'Поле "read_time" обязательно' }),
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
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(10),
  category: Joi.string().optional(),
  search: Joi.string().optional(),
  tags: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
});

// Получение всех постов
const getAllBlogPosts = async (query) => {
  const { error, value } = querySchema.validate(query);
  if (error) throw new AppError(error.details[0].message, 400);
  return blogModel.getAllBlogPosts(value);
};

// Получение поста по identifier
const getBlogPostByIdentifier = async (identifier) => {
  const post = await blogModel.getBlogPostByIdentifier(identifier);
  if (!post) throw new AppError('Пост не найден', 404);
  return post;
};

// Создание поста
const createBlogPost = async (data) => {
  const { error, value } = blogSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  const existing = await blogModel.getBlogPostByIdentifier(value.id);
  if (existing) throw new AppError('Пост с таким ID уже существует', 409);
  return blogModel.createBlogPost(value);
};

// Обновление поста
const updateBlogPost = async (id, data) => {
  const { error, value } = updateSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  const post = await blogModel.getBlogPostByIdentifier(id);
  if (!post) throw new AppError('Пост не найден', 404);
  return blogModel.updateBlogPost(id, value);
};

// Удаление поста
const deleteBlogPost = async (id) => {
  const post = await blogModel.getBlogPostByIdentifier(id);
  if (!post) throw new AppError('Пост не найден', 404);
  await blogModel.deleteBlogPost(id);
};

module.exports = {
  getAllBlogPosts,
  getBlogPostByIdentifier,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
};