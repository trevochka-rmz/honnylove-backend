// models/blogModel.js
const db = require('../config/db');

// Получение всех постов с пагинацией и фильтрами
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

// Получение поста по id или slug
const getBlogPostByIdentifier = async (identifier) => {
  // Сначала по slug
  let { rows } = await db.query(`
    SELECT
      id, title, excerpt, content, image, category, author,
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      read_time, tags, created_at, updated_at, slug
    FROM blog_posts WHERE slug = $1
  `, [identifier]);
  if (rows[0]) return rows[0];
  // Если не найдено — по id
  ({ rows } = await db.query(`
    SELECT
      id, title, excerpt, content, image, category, author,
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      read_time, tags, created_at, updated_at, slug
    FROM blog_posts WHERE id = $1
  `, [identifier]));
  return rows[0] || null;
};

// Создание поста
const createBlogPost = async (data) => {
  if (!data.date) data.date = new Date().toISOString().split('T')[0];
  
  const query = `
    INSERT INTO blog_posts
      (title, excerpt, content, image, category, author, date, read_time, tags)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  
  const params = [
    data.title, data.excerpt, data.content, data.image, 
    data.category, data.author, data.date, data.read_time, data.tags || []
  ];
  
  const { rows } = await db.query(query, params);
  return getBlogPostByIdentifier(rows[0].id);
};

// Обновление поста
const updateBlogPost = async (id, data) => {
  const fields = Object.keys(data)
    .map((key, idx) => {
      if (key === 'date') return `${key} = $${idx + 2}::DATE`;
      return `${key} = $${idx + 2}`;
    })
    .join(', ');
  const values = Object.values(data);
  if (fields.length === 0) return getBlogPostByIdentifier(id);
  const { rows } = await db.query(
    `UPDATE blog_posts
     SET ${fields}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return getBlogPostByIdentifier(id);
};

// Удаление поста
const deleteBlogPost = async (id) => {
  await db.query('DELETE FROM blog_posts WHERE id = $1', [id]);
};

// Получение кратких постов
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

module.exports = {
  getAllBlogPosts,
  getBlogPostByIdentifier,
  createBlogPost,
  updateBlogPost,
  deleteBlogPost,
  getAllBlogPostsBrief,
};