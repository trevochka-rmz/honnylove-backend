// models/blogModel.js
const db = require('../config/db');

const getAllBlogPosts = async ({
  page = 1,
  limit = 10,
  search,
  category,
  tags,
  sort = 'latest', // 'latest' | 'oldest' | 'readTime'
}) => {
  let baseQuery = 'FROM blog_posts';
  const params = [];
  let where = '';
  // Поиск
  if (search) {
    where += (where ? ' AND' : '') + ` (
      title ILIKE $${params.length + 1} OR
      excerpt ILIKE $${params.length + 1} OR
      content ILIKE $${params.length + 1}
    )`;
    params.push(`%${search}%`);
  }
  // Фильтр по категории
  if (category) {
    where += (where ? ' AND' : '') + ` category = $${params.length + 1}`;
    params.push(category);
  }
  // Фильтр по тегам
  if (tags) {
    let tagsArray;
    // Проверяем разные форматы приходящего параметра
    if (Array.isArray(tags)) {
      tagsArray = tags;
    } else if (typeof tags === 'string') {
      // Если строка, может быть "путешествия" или "путешествия,отдых"
      if (tags.includes(',')) {
        tagsArray = tags.split(',').map(tag => tag.trim());
      } else {
        tagsArray = [tags];
      }
    }
    // Применяем фильтр только если есть теги
    if (tagsArray && tagsArray.length > 0) {
      // Используем оператор && для поиска хотя бы одного совпадения
      where += (where ? ' AND' : '') + ` tags && $${params.length + 1}`;
      params.push(tagsArray);
    }
  }
  if (where) baseQuery += ' WHERE' + where;
  // Сортировка
  let orderBy = ' ORDER BY date DESC';
  if (sort === 'oldest') {
    orderBy = ' ORDER BY date ASC';
  } else if (sort === 'readTime') {
    orderBy = ' ORDER BY read_time DESC';
  }
  // Основной запрос с пагинацией
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
  // Подсчёт общего количества
  const countQuery = `SELECT COUNT(*) ${baseQuery}`;
  const { rows: countRows } = await db.query(countQuery, params);
  const total = parseInt(countRows[0].count, 10);
  const pages = limit > 0 ? Math.ceil(total / limit) : 0;
  const hasMore = page < pages;
  return { posts, total, page, pages, limit, hasMore };
};

// Универсальная функция для поиска по identifier (id или slug)
const getBlogPostByIdentifier = async (identifier) => {
  let query = `
    SELECT
      id, title, excerpt, content, image, category, author,
      TO_CHAR(date, 'YYYY-MM-DD') AS date,
      read_time, tags, created_at, updated_at, slug
    FROM blog_posts WHERE `;
  let param = identifier;

  // ИСПРАВЛЕНИЕ: Проверяем, состоит ли ВСЯ строка только из цифр
  if (/^\d+$/.test(identifier)) {
    query += 'id = $1';
    param = identifier; // Оставляем как строку, т.к. id varchar
  } else {
    query += 'slug = $1';
  }

  const { rows } = await db.query(query, [param]);
  return rows[0] || null;
};

const createBlogPost = async (data) => {
  const {
    id,
    title,
    excerpt,
    content,
    image,
    category,
    author,
    date,
    read_time,
    tags = [],
  } = data;
  const { rows } = await db.query(
    `INSERT INTO blog_posts
      (id, title, excerpt, content, image, category, author, date, read_time, tags)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::DATE, $9, $10)
    RETURNING *`,
    [id, title, excerpt, content, image, category, author, date, read_time, tags]
  );
  const created = rows[0];
  return getBlogPostByIdentifier(created.id); // Возвращаем полный объект
};

const updateBlogPost = async (id, data) => {
  const fields = Object.keys(data)
    .filter(key => key !== 'id') // id не обновляем
    .map((key, idx) => {
      if (key === 'date') return `${key} = $${idx + 2}::DATE`;
      if (key === 'tags') return `${key} = $${idx + 2}`;
      return `${key} = $${idx + 2}`;
    })
    .join(', ');
  const values = Object.keys(data)
    .filter(key => key !== 'id')
    .map(key => data[key]);
  if (fields.length === 0) return getBlogPostByIdentifier(id);
  const { rows } = await db.query(
    `UPDATE blog_posts
     SET ${fields}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [id, ...values]
  );
  return getBlogPostByIdentifier(id);
};

const deleteBlogPost = async (id) => {
  await db.query('DELETE FROM blog_posts WHERE id = $1', [id]);
};

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