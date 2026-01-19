// src/models/blogModel.js
const db = require('../config/db');
const { uploadImage, deleteEntityImages, deleteImageByUrl } = require('../utils/s3Uploader');

// Получить все посты блога с пагинацией и фильтрами
const getAllBlogPosts = async ({
  page = 1,
  limit = 10,
  search,
  category,
  tags,
  sort = 'latest',
}) => {
  let baseQuery = 'FROM blog_posts';
  const params = [];
  let where = '';
  if (search) {
    where += (where ? ' AND' : '') + ` (
      title ILIKE $${params.length + 1} OR
      excerpt ILIKE $${params.length + 1} OR
      content ILIKE $${params.length + 1}
    )`;
    params.push(`%${search}%`);
  }
  if (category) {
    where += (where ? ' AND' : '') + ` category = $${params.length + 1}`;
    params.push(category);
  }
  if (tags) {
    let tagsArray;
    if (Array.isArray(tags)) {
      tagsArray = tags;
    } else if (typeof tags === 'string') {
      tagsArray = tags.split(',').map(tag => tag.trim());
    }
    if (tagsArray && tagsArray.length > 0) {
      where += (where ? ' AND' : '') + ` tags && $${params.length + 1}`;
      params.push(tagsArray);
    }
  }
  if (where) baseQuery += ' WHERE' + where;
  let orderBy = ' ORDER BY date DESC';
  if (sort === 'oldest') {
    orderBy = ' ORDER BY date ASC';
  } else if (sort === 'readTime') {
    orderBy = ' ORDER BY read_time DESC';
  }
  const dataQuery = `
    SELECT
      id, title, excerpt, content, image, category, author,
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      read_time, tags, created_at, updated_at, slug
    ${baseQuery}
    ${orderBy}
    LIMIT $${params.length + 1} OFFSET $${params.length + 2}
  `;
  const dataParams = [...params, limit, (page - 1) * limit];
  const { rows: posts } = await db.query(dataQuery, dataParams);
  const countQuery = `SELECT COUNT(*) ${baseQuery}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].count, 10);
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  const hasMore = page < pages;
  return { posts, total, page, pages, limit, hasMore };
};

// Получить пост блога по идентификатору (id или slug)
const getBlogPostByIdentifier = async (identifier) => {
  let { rows } = await db.query(`
    SELECT
      id, title, excerpt, content, image, category, author,
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      read_time, tags, created_at, updated_at, slug
    FROM blog_posts WHERE slug = $1
  `, [identifier]);
  if (rows[0]) return rows[0];

  ({ rows } = await db.query(`
    SELECT
      id, title, excerpt, content, image, category, author,
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      read_time, tags, created_at, updated_at, slug
    FROM blog_posts WHERE id = $1
  `, [identifier]));
  return rows[0] || null;
};

// Создать новый пост блога
const createBlogPost = async (postData, imageFile) => {
  const { title, excerpt, content, category, author, read_time, tags = [] } = postData;
  const date = postData.date || new Date().toISOString().split('T')[0];
  const { rows } = await db.query(
    `INSERT INTO blog_posts (title, excerpt, content, category, author, date, read_time, tags, image)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING id`,
    [title, excerpt, content, category, author, date, read_time, tags]
  );
  const blogId = rows[0].id;
  let finalImageUrl = null;
  if (imageFile) {
    finalImageUrl = await uploadImage(imageFile.buffer, imageFile.originalname, 'blogs', blogId);
    await db.query(`UPDATE blog_posts SET image = $1 WHERE id = $2`, [finalImageUrl, blogId]);
  }
  return getBlogPostByIdentifier(blogId);
};

// Обновить пост блога
const updateBlogPost = async (id, updateData, newImageFile) => {
  const oldPost = await getBlogPostByIdentifier(id);
  if (!oldPost) return null;
  const fields = [];
  const values = [];
  let paramIndex = 1;
  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(updateData[key]);
      paramIndex++;
    }
  });
  let finalImageUrl = oldPost.image;
  if (newImageFile) {
    if (oldPost.image && oldPost.image !== 'pending') {
      await deleteImageByUrl(oldPost.image);
    }
    finalImageUrl = await uploadImage(newImageFile.buffer, newImageFile.originalname,'blogs', id);
    fields.push(`image = $${paramIndex}`);
    values.push(finalImageUrl);
    paramIndex++;
  }
  if (fields.length > 0) {
    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    const query = `UPDATE blog_posts SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    await db.query(query, [...values, id]);
  }
  return getBlogPostByIdentifier(id);
};

// Удалить пост блога
const deleteBlogPost = async (id) => {
  const post = await getBlogPostByIdentifier(id);
  if (post && post.image && post.image !== 'pending') {
      await deleteEntityImages('blogs', id);;
  }
  await db.query('DELETE FROM blog_posts WHERE id = $1', [id]);
};

// Получить краткий список всех постов блога
const getAllBlogPostsBrief = async () => {
  const { rows } = await db.query(
    `SELECT id, title, excerpt, image, category,
            TO_CHAR(date, 'YYYY-MM-DD') AS date,
            read_time, tags, slug
     FROM blog_posts
     ORDER BY date DESC`
  );
  return rows;
};

// Получить все уникальные теги из блогов
const getAllBlogTags = async () => {
  const { rows } = await db.query(`
    SELECT DISTINCT unnest(tags) as tag 
    FROM blog_posts 
    WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
    ORDER BY tag
  `);
  return rows.map(row => row.tag);
};

module.exports = {
  getAllBlogPosts,
  getBlogPostByIdentifier,
  createBlogPost,
  getAllBlogTags,
  updateBlogPost,
  deleteBlogPost,
  getAllBlogPostsBrief,
};