const express = require('express');
const router = express.Router();
const blogController = require('../controllers/blogController');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

// Публичные маршруты (для всех пользователей)
router.get('/', blogController.getBlogPosts);
// Можно добавить /brief если нужно короткий список
router.get('/:id', blogController.getBlogPostById);

// Защищённые маршруты (только админы)
router.post(
  '/',
  authenticate,
  requireRole(['admin']),
  blogController.createBlogPost
);

router.put(
  '/:id',
  authenticate,
  requireRole(['admin']),
  blogController.updateBlogPost
);

router.delete(
  '/:id',
  authenticate,
  requireRole(['admin']),
  blogController.deleteBlogPost
);

module.exports = router;