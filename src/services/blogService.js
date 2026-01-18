// src/services/blogService.js
const Joi = require('joi');
const blogModel = require('../models/blogModel');
const AppError = require('../utils/errorUtils');
const {validateImageFile} = require('../utils/imageUtils');

// Схема валидации для создания поста блога
const blogSchema = Joi.object({
  title: Joi.string().required().messages({ 'any.required': 'Поле "title" обязательно' }),
  excerpt: Joi.string().required().messages({ 'any.required': 'Поле "excerpt" обязательно' }),
  content: Joi.string().required().messages({ 'any.required': 'Поле "content" обязательно' }),
  image: Joi.string().uri().optional(),
  category: Joi.string().required().messages({ 'any.required': 'Поле "category" обязательно' }),
  author: Joi.string().required().messages({ 'any.required': 'Поле "author" обязательно' }),
  date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).optional(),
  read_time: Joi.number().integer().min(1).required().messages({ 'any.required': 'Поле "read_time" обязательно' }),
  tags: Joi.array().items(Joi.string()).default([]),
});

// Схема валидации для обновления поста блога (все поля опциональные)
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

// Схема валидации для запросов списка постов
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

// Получить все посты блога с валидацией запроса
const getAllBlogPosts = async (query) => {
  const { error, value } = querySchema.validate(query);
  if (error) throw new AppError(error.details[0].message, 400);
  return blogModel.getAllBlogPosts(value);
};

// Получить пост блога по идентификатору
const getBlogPostByIdentifier = async (identifier) => {
  const post = await blogModel.getBlogPostByIdentifier(identifier);
  if (!post) throw new AppError('Пост не найден', 404);
  return post;
};

// Создать новый пост блога с валидацией
const createBlogPost = async (data, imageFile) => {
  const { error, value } = blogSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  validateImageFile(imageFile);
  return blogModel.createBlogPost(value, imageFile);
};

// Обновить пост блога с валидацией
const updateBlogPost = async (id, data, imageFile) => {
  const { error, value } = updateSchema.validate(data);
  if (error) throw new AppError(error.details[0].message, 400);
  validateImageFile(imageFile);
  const post = await blogModel.getBlogPostByIdentifier(id);
  if (!post) throw new AppError('Пост не найден', 404);
  return blogModel.updateBlogPost(id, value, imageFile);
};

// Удалить пост блога
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