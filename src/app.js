// src/app.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const brandRoutes = require('./routes/brandRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const reviewRoutes = require('./routes/reviewRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const userRoutes = require('./routes/userRoutes');

dotenv.config(); // Загружает .env

const app = express();

app.use(cors({ origin: '*' })); // Или specific: 'http://localhost:3000'
app.use(express.json()); // Парсит JSON body

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
app.get('/test-image/:id', (req, res) => {
    const productId = req.params.id;
    res.send(`
        <html>
            <body>
                <h1>Тест изображения для товара ${productId}</h1>
                <p>Путь в БД: /uploads/products/${productId}/main.jpg</p>
                <p>Прямая ссылка: <a href="/uploads/products/${productId}/main.jpg">/uploads/products/${productId}/main.jpg</a></p>
                <img src="/uploads/products/${productId}/main.jpg" alt="Тест" style="max-width: 300px;">
                <hr>
                <p>Если изображение не отображается, проверьте:</p>
                <ol>
                    <li>Файл существует: backend/uploads/products/${productId}/main.jpg</li>
                    <li>Правильный путь в статике: app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));</li>
                </ol>
            </body>
        </html>
    `);
});

// Routes под /api
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/users', userRoutes);

// Глобальный error handler
app.use(errorHandler);

// Запуск сервера
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(
        `Server running on port ${PORT} in ${process.env.NODE_ENV} mode`
    );
});
