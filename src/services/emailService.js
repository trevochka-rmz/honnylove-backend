// src/services/emailService.js
const nodemailer = require('nodemailer');
const path = require('path');

// Конфигурация транспортера с отладкой
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER || '',
    pass: process.env.EMAIL_PASS || '',
  },
  tls: {
    rejectUnauthorized: false
  }
});

// Генерация HTML шаблона для писем
const generateEmailTemplate = (title, content, code = null, type = 'verification') => {
  const logoUrl = 'https://honnylove.ru/logo.png'; 
  const siteUrl = 'https://honnylove.ru';
  const supportEmail = 'honnyloveskin@outlook.com';
  
  return `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Helvetica Neue', Arial, sans-serif;
        }
        
        body {
            background-color: #f9f9f9;
            padding: 20px;
        }
        
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(255, 105, 180, 0.1);
            border: 1px solid #ffe6f2;
        }
        
        .header {
            background: linear-gradient(135deg, #ff69b4, #ff1493);
            padding: 40px 30px;
            text-align: center;
            color: white;
        }
        
        .logo {
            font-size: 32px;
            font-weight: bold;
            margin-bottom: 10px;
            letter-spacing: 1px;
        }
        
        .logo span {
            color: #fffacd;
        }
        
        .tagline {
            font-size: 16px;
            opacity: 0.9;
            font-style: italic;
        }
        
        .content {
            padding: 40px 30px;
        }
        
        .title {
            color: #ff1493;
            font-size: 24px;
            margin-bottom: 20px;
            text-align: center;
            font-weight: 600;
        }
        
        .message {
            color: #666;
            line-height: 1.6;
            margin-bottom: 30px;
            font-size: 16px;
            text-align: center;
        }
        
        .code-container {
            background: linear-gradient(135deg, #fff0f7, #ffe6f2);
            border-radius: 15px;
            padding: 25px;
            margin: 30px 0;
            text-align: center;
            border: 2px dashed #ff69b4;
        }
        
        .code-label {
            color: #ff1493;
            font-size: 14px;
            margin-bottom: 10px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        
        .code {
            font-size: 42px;
            font-weight: bold;
            color: #ff1493;
            letter-spacing: 10px;
            padding: 15px;
            background: white;
            border-radius: 10px;
            display: inline-block;
            margin: 10px 0;
            box-shadow: 0 5px 15px rgba(255, 105, 180, 0.2);
            font-family: 'Courier New', monospace;
        }
        
        .timer {
            color: #888;
            font-size: 14px;
            margin-top: 10px;
            font-style: italic;
        }
        
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #ff69b4, #ff1493);
            color: white;
            padding: 16px 40px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 600;
            font-size: 16px;
            margin: 20px 0;
            text-align: center;
            transition: all 0.3s ease;
            box-shadow: 0 5px 15px rgba(255, 105, 180, 0.3);
        }
        
        .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(255, 105, 180, 0.4);
        }
        
        .divider {
            height: 1px;
            background: linear-gradient(to right, transparent, #ffb6c1, transparent);
            margin: 30px 0;
        }
        
        .footer {
            padding: 25px 30px;
            background: #fff9fc;
            text-align: center;
            color: #888;
            font-size: 14px;
            border-top: 1px solid #ffe6f2;
        }
        
        .social-icons {
            margin: 20px 0;
        }
        
        .social-icon {
            display: inline-block;
            margin: 0 10px;
            color: #ff69b4;
            font-size: 20px;
            transition: color 0.3s ease;
        }
        
        .social-icon:hover {
            color: #ff1493;
        }
        
        .contact-info {
            margin-top: 15px;
            line-height: 1.6;
        }
        
        .contact-info a {
            color: #ff69b4;
            text-decoration: none;
        }
        
        .warning {
            background: #fff0f0;
            border-left: 4px solid #ff6b6b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 10px 10px 0;
            color: #666;
            font-size: 14px;
        }
        
        @media (max-width: 600px) {
            .content, .header, .footer {
                padding: 25px 20px;
            }
            
            .code {
                font-size: 32px;
                letter-spacing: 5px;
                padding: 12px;
            }
            
            .title {
                font-size: 20px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">Honny<span>Love</span></div>
            <div class="tagline">Ваша красота начинается здесь</div>
        </div>
        
        <div class="content">
            <h2 class="title">${title}</h2>
            
            <div class="message">
                ${content}
            </div>
            
            ${code ? `
            <div class="code-container">
                <div class="code-label">Ваш код подтверждения</div>
                <div class="code">${code}</div>
                <div class="timer">⏰ Код действителен в течение 15 минут</div>
            </div>
            ` : ''}
            
            ${type === 'reset' ? `
            <div class="warning">
                ⚠️ <strong>Внимание!</strong> Если вы не запрашивали сброс пароля, 
                просто проигнорируйте это письмо. Ваш аккаунт в безопасности.
            </div>
            ` : ''}
            
            <div class="divider"></div>
            
            <p class="message">
                Если у вас возникли вопросы, мы всегда готовы помочь!
            </p>
            
            <div style="text-align: center;">
                <a href="${siteUrl}/contacts" class="button">📞 Написать в поддержку</a>
            </div>
        </div>
        
        <div class="footer">
            <div class="social-icons">
                <a href="https://instagram.com/honnylove" class="social-icon">📷</a>
                <a href="https://t.me/honnylove" class="social-icon">📱</a>
                <a href="${siteUrl}" class="social-icon">🌐</a>
            </div>
            
            <div class="contact-info">
                <p>© ${new Date().getFullYear()} HonnyLove. Все права защищены.</p>
                <p><a href="${siteUrl}">${siteUrl}</a> | <a href="mailto:${supportEmail}">${supportEmail}</a></p>
                <p style="margin-top: 10px; font-size: 12px; color: #aaa;">
                    Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
  `;
};

// Отправить verification code
const sendVerificationEmail = async (email, code) => {
  try {
    console.log(`📧 [EMAIL] Отправка верификации на ${email}...`);
    console.log(`🔧 [EMAIL] Используем: ${process.env.EMAIL_USER}`);
    
    // Проверяем соединение
    await transporter.verify();
    console.log(`✅ [EMAIL] SMTP соединение установлено`);
    
    const subject = 'Подтверждение email для HonnyLove';
    const content = `Добро пожаловать в мир HonnyLove!<br><br>
    Для завершения регистрации и активации вашего аккаунта, 
    пожалуйста, введите следующий код подтверждения:`;
    
    const htmlContent = generateEmailTemplate(
      subject,
      content,
      code,
      'verification'
    );
    
    const info = await transporter.sendMail({
      from: `"HonnyLove" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      text: `Ваш код подтверждения для HonnyLove: ${code}\n\nКод действителен 15 минут.\n\nС уважением,\nКоманда HonnyLove`,
      html: htmlContent,
    });
    
    console.log(`✅ [EMAIL] Письмо верификации отправлено на ${email}`);
    console.log(`📫 [EMAIL] ID сообщения: ${info.messageId}`);
    
    return info;
    
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Ошибка отправки верификации:`);
    console.error(`   Сообщение: ${error.message}`);
    console.error(`   Код: ${error.code}`);
    console.error(`   Команда: ${error.command}`);
    
    if (error.response) {
      console.error(`   Ответ SMTP: ${error.response}`);
    }
    
    throw new Error(`Не удалось отправить письмо подтверждения: ${error.message}`);
  }
};

// Отправить reset email
const sendResetEmail = async (email, code) => {
  try {
    console.log(`📧 [EMAIL] Отправка сброса пароля на ${email}...`);
    console.log(`🔧 [EMAIL] Используем: ${process.env.EMAIL_USER}`);
    
    // Проверяем соединение
    await transporter.verify();
    console.log(`✅ [EMAIL] SMTP соединение установлено`);
    
    const subject = 'Сброс пароля для HonnyLove';
    const content = `Мы получили запрос на сброс пароля для вашего аккаунта HonnyLove.<br><br>
    Для установки нового пароля, пожалуйста, введите следующий код:`;
    
    const htmlContent = generateEmailTemplate(
      subject,
      content,
      code,
      'reset'
    );
    
    const info = await transporter.sendMail({
      from: `"HonnyLove" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      text: `Ваш код для сброса пароля HonnyLove: ${code}\n\nКод действителен 15 минут.\n\nЕсли вы не запрашивали сброс пароля, проигнорируйте это письмо.\n\nС уважением,\nКоманда HonnyLove`,
      html: htmlContent,
    });
    
    console.log(`✅ [EMAIL] Письмо сброса пароля отправлено на ${email}`);
    console.log(`📫 [EMAIL] ID сообщения: ${info.messageId}`);
    
    return info;
    
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Ошибка отправки сброса пароля:`);
    console.error(`   Сообщение: ${error.message}`);
    console.error(`   Код: ${error.code}`);
    console.error(`   Команда: ${error.command}`);
    
    if (error.response) {
      console.error(`   Ответ SMTP: ${error.response}`);
    }
    
    throw new Error(`Не удалось отправить письмо сброса пароля: ${error.message}`);
  }
};

// Дополнительная функция: отправка welcome email
const sendWelcomeEmail = async (email, username) => {
  try {
    console.log(`📧 [EMAIL] Отправка приветствия для ${email}...`);
    
    await transporter.verify();
    
    const subject = 'Добро пожаловать в HonnyLove!';
    const content = `Приветствуем, ${username}!<br><br>
    Спасибо за регистрацию в HonnyLove — вашем проводнике в мир красоты.<br><br>
    Теперь вы можете:
    <ul style="text-align: left; margin: 20px 0; padding-left: 20px;">
        <li>✨ Получать эксклюзивные предложения</li>
        <li>⭐ Добавлять товары в избранное</li>
        <li>🎁 Участвовать в акциях и розыгрышах</li>
        <li>🚀 Быстро оформлять заказы</li>
        <li>📦 Отслеживать статус доставки</li>
    </ul>
    Присоединяйтесь к нашему сообществу в соцсетях, чтобы быть в курсе новинок!`;
    
    const htmlContent = generateEmailTemplate(
      subject,
      content,
      null,
      'welcome'
    );
    
    const info = await transporter.sendMail({
      from: `"HonnyLove" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      text: `Добро пожаловать в HonnyLove, ${username}!\n\nСпасибо за регистрацию. Теперь вы можете пользоваться всеми возможностями нашего сайта.\n\nС уважением,\nКоманда HonnyLove`,
      html: htmlContent,
    });
    
    console.log(`✅ [EMAIL] Приветствие отправлено на ${email}`);
    return info;
    
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Ошибка отправки приветствия:`, error.message);
    // Не бросаем ошибку для welcome email, чтобы не ломать регистрацию
  }
};

// Дополнительная функция: отправка order confirmation
const sendOrderConfirmation = async (email, orderData) => {
  try {
    console.log(`📧 [EMAIL] Отправка подтверждения заказа на ${email}...`);

    await transporter.verify();

    const { orderNumber, order } = orderData;

    const PAYMENT_LABELS = {
      cash: 'Наличные при получении',
      card: 'Банковская карта',
      online: 'Онлайн оплата',
      sbp: 'СБП',
      bank_transfer: 'Банковский перевод',
    };

    // Список товаров в красивом виде
    const itemsHtml = (order.items || []).map(item => {
      const price = (i.discount_price && Number(i.discount_price) > 0)
        ? Number(i.discount_price)
        : Number(i.price);
      const lineTotal = price * item.quantity;
      return `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #ffe6f2; color: #444;">
            ${item.product_name}
            <div style="font-size: 12px; color: #aaa; margin-top: 3px;">
              Арт: ${item.product_sku || '—'}
            </div>
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #ffe6f2; 
                     text-align: center; color: #444;">
            ${item.quantity} шт.
          </td>
          <td style="padding: 12px; border-bottom: 1px solid #ffe6f2; 
                     text-align: right; color: #ff1493; font-weight: 600;">
            ${lineTotal.toLocaleString('ru-RU')} ₽
          </td>
        </tr>
      `;
    }).join('');

    const subtotal = (order.items || []).reduce((sum, item) => {
      return sum + Number(item.discount_price || item.price) * item.quantity;
    }, 0);

    const isPaid = order.payment_method !== 'cash';

    const subject = `Ваш заказ ${orderNumber} ${isPaid ? 'оплачен' : 'принят'}`;

    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; 
        font-family: 'Helvetica Neue', Arial, sans-serif; }
    body { background-color: #f9f9f9; padding: 20px; }
    .email-container { max-width: 600px; margin: 0 auto; background: white;
        border-radius: 20px; overflow: hidden;
        box-shadow: 0 10px 30px rgba(255,105,180,0.1); border: 1px solid #ffe6f2; }
    .header { background: linear-gradient(135deg, #ff69b4, #ff1493);
        padding: 40px 30px; text-align: center; color: white; }
    .logo { font-size: 32px; font-weight: bold; margin-bottom: 10px; }
    .logo span { color: #fffacd; }
    .tagline { font-size: 16px; opacity: 0.9; font-style: italic; }
    .content { padding: 40px 30px; }
    .title { color: #ff1493; font-size: 24px; margin-bottom: 20px;
        text-align: center; font-weight: 600; }
    .message { color: #666; line-height: 1.6; margin-bottom: 20px;
        font-size: 16px; text-align: center; }
    .status-badge { display: inline-block; padding: 8px 24px; border-radius: 50px;
        font-weight: 600; font-size: 14px; margin: 10px auto 25px; }
    .status-paid { background: #e8f5e9; color: #2e7d32; }
    .status-pending { background: #fff3e0; color: #e65100; }
    .section-title { color: #ff1493; font-size: 14px; font-weight: 600;
        text-transform: uppercase; letter-spacing: 1px; 
        margin: 25px 0 12px; }
    .info-block { background: #fff9fc; border-radius: 12px;
        padding: 20px; margin-bottom: 20px; border: 1px solid #ffe6f2; }
    .info-row { display: flex; justify-content: space-between;
        padding: 6px 0; color: #555; font-size: 15px; }
    .info-row:not(:last-child) { border-bottom: 1px solid #ffe6f2; }
    .info-label { color: #aaa; }
    .info-value { font-weight: 500; color: #333; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    .table-header th { background: linear-gradient(135deg, #fff0f7, #ffe6f2);
        padding: 12px; text-align: left; color: #ff1493;
        font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    .table-header th:last-child { text-align: right; }
    .table-header th:nth-child(2) { text-align: center; }
    .total-row td { padding: 15px 12px; font-weight: 600; font-size: 16px; }
    .divider { height: 1px;
        background: linear-gradient(to right, transparent, #ffb6c1, transparent);
        margin: 25px 0; }
    .footer { padding: 25px 30px; background: #fff9fc; text-align: center;
        color: #888; font-size: 14px; border-top: 1px solid #ffe6f2; }
    .footer a { color: #ff69b4; text-decoration: none; }
    .button { display: inline-block;
        background: linear-gradient(135deg, #ff69b4, #ff1493);
        color: white; padding: 14px 36px; text-decoration: none;
        border-radius: 50px; font-weight: 600; font-size: 15px;
        margin: 20px 0; }
  </style>
</head>
<body>
  <div class="email-container">
    
    <div class="header">
      <div class="logo">Honny<span>Love</span></div>
      <div class="tagline">Ваша красота начинается здесь</div>
    </div>

    <div class="content">
      <h2 class="title">
        ${isPaid ? 'Заказ оплачен!' : 'Заказ принят!'}
      </h2>

      <p class="message">
        ${isPaid
          ? `Оплата прошла успешно. Ваш заказ <strong>${orderNumber}</strong> передан в обработку.`
          : `Ваш заказ <strong>${orderNumber}</strong> принят. Оплата при получении.`
        }
      </p>

      <div style="text-align: center;">
        <span class="status-badge ${isPaid ? 'status-paid' : 'status-pending'}">
          ${isPaid ? '✓ Оплачен' : '⏳ Ожидает обработки'}
        </span>
      </div>

      <div class="section-title">Данные получателя</div>
      <div class="info-block">
        <div class="info-row">
          <span class="info-label">Имя</span>
          <span class="info-value">
            ${[order.customer_first_name, order.customer_last_name]
              .filter(Boolean).join(' ') || '—'}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">Телефон</span>
          <span class="info-value">${order.customer_phone || '—'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Адрес доставки</span>
          <span class="info-value">${order.shipping_address || '—'}</span>
        </div>
        ${order.notes ? `
        <div class="info-row">
          <span class="info-label">Комментарий</span>
          <span class="info-value">${order.notes}</span>
        </div>
        ` : ''}
      </div>

      <div class="section-title">Состав заказа</div>
      <table>
        <thead class="table-header">
          <tr>
            <th>Товар</th>
            <th>Кол-во</th>
            <th>Сумма</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          ${Number(order.shipping_cost) > 0 ? `
          <tr>
            <td colspan="2" style="padding: 10px 12px; color: #888; 
                font-size: 14px;" class="info-label">Доставка</td>
            <td style="padding: 10px 12px; text-align: right; color: #555;">
              ${Number(order.shipping_cost).toLocaleString('ru-RU')} ₽
            </td>
          </tr>
          ` : ''}
          ${Number(order.discount_amount) > 0 ? `
          <tr>
            <td colspan="2" style="padding: 10px 12px; color: #888; 
                font-size: 14px;">Скидка</td>
            <td style="padding: 10px 12px; text-align: right; color: #2e7d32;">
              −${Number(order.discount_amount).toLocaleString('ru-RU')} ₽
            </td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td colspan="2" style="color: #ff1493;">Итого к оплате</td>
            <td style="text-align: right; color: #ff1493; font-size: 18px;">
              ${Number(order.total_amount).toLocaleString('ru-RU')} ₽
            </td>
          </tr>
        </tfoot>
      </table>

      <div class="info-block" style="text-align: center;">
        <div style="color: #aaa; font-size: 14px; margin-bottom: 5px;">
          Способ оплаты
        </div>
        <div style="font-weight: 600; color: #333;">
          ${PAYMENT_LABELS[order.payment_method] || order.payment_method}
        </div>
      </div>

      <div class="divider"></div>

      <p class="message">
        Следить за статусом заказа можно в личном кабинете.
      </p>

      <div style="text-align: center;">
        <a href="https://honnylove.ru/orders/${order.id}" class="button">
          Мой заказ
        </a>
      </div>
    </div>

    <div class="footer">
      <p>© ${new Date().getFullYear()} HonnyLove. Все права защищены.</p>
      <p style="margin-top: 8px;">
        <a href="https://honnylove.ru">honnylove.ru</a> | 
        <a href="mailto:honnyloveskin@outlook.com">honnyloveskin@outlook.com</a>
      </p>
      <p style="margin-top: 10px; font-size: 12px; color: #aaa;">
        Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.
      </p>
    </div>

  </div>
</body>
</html>
    `;

    const info = await transporter.sendMail({
      from: `"HonnyLove" <${process.env.EMAIL_USER}>`,
      to: email,
      subject,
      html,
      text: `Заказ ${orderNumber} ${isPaid ? 'оплачен' : 'принят'}.\n\n` +
            `Сумма: ${Number(order.total_amount).toLocaleString('ru-RU')} ₽\n` +
            `Адрес: ${order.shipping_address}\n\n` +
            `Детали: https://honnylove.ru/orders/${order.id}`,
    });

    console.log(`✅ [EMAIL] Подтверждение заказа ${orderNumber} отправлено на ${email}`);
    return info;

  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Ошибка отправки подтверждения заказа:`, error.message);
    // Не бросаем ошибку — письмо не должно ломать создание заказа
  }
};

// Новая функция: отправка новостной рассылки
const sendNewsletterEmail = async (email, newsletterData) => {
  try {
    const subject = newsletterData.subject || 'Новости от HonnyLove';
    
    const content = newsletterData.content || `
      Узнавайте первыми о наших новинках, акциях и специальных предложениях!<br><br>
      Присоединяйтесь к нашему сообществу любителей красоты.
    `;
    
    const htmlContent = generateEmailTemplate(
      subject,
      content,
      null,
      'newsletter'
    );
    
    const info = await transporter.sendMail({
      from: `"HonnyLove" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: subject,
      html: htmlContent,
    });
    
    console.log(`✅ [EMAIL] Новостная рассылка отправлена на ${email}`);
    return info;
    
  } catch (error) {
    console.error(`❌ [EMAIL ERROR] Ошибка отправки рассылки:`, error.message);
  }
};



module.exports = { 
  sendVerificationEmail, 
  sendResetEmail,
  sendWelcomeEmail,
  sendOrderConfirmation,
  sendNewsletterEmail,
};