const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.honnylove.ru';

const PAYMENT_LABELS = {
  cash: 'Наличные',
  card: 'Банковская карта',
  online: 'Онлайн оплата',
  sbp: 'СБП',
  bank_transfer: 'Банковский перевод',
};

const STATUS_LABELS = {
  pending:    'Ожидает обработки',
  paid:       'Оплачен',
  processing: 'В обработке',
  shipped:    'Отправлен',
  delivered:  'Доставлен',
  cancelled:  'Отменён',
  returned:   'Возвращён',
  completed:  'Завершён',
};

const sendMessage = async (text, orderId = null) => {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.warn('[Telegram] BOT_TOKEN или CHAT_ID не заданы в .env');
    return null;
  }

  const payload = {
    chat_id: CHAT_ID,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  if (orderId) {
    payload.reply_markup = {
      inline_keyboard: [[
        {
          text: 'Открыть заказ в админке',
          url: `${ADMIN_URL}/orders/${orderId}`,
        },
      ]],
    };
  }

  const body = JSON.stringify(payload);

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.telegram.org',
        path: `/bot${BOT_TOKEN}/sendMessage`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            if (!parsed.ok) {
              console.error('[Telegram] Ошибка API:', parsed.description);
            }
            resolve(parsed);
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', (err) => {
      console.error('[Telegram] Сетевая ошибка:', err.message);
      resolve(null);
    });
    req.write(body);
    req.end();
  });
};

const sendNewOrderNotification = async (order, orderNumber) => {
  const clientName = [order.customer_first_name, order.customer_last_name]
    .filter(Boolean).join(' ') || '—';
  const clientPhone = order.customer_phone || '—';

  const itemsList = (order.items || [])
    .map((i, index) => {
      const price = Number(i.discount_price || i.price);
      const lineTotal = price * i.quantity;
      return (
        `${index + 1}. ${i.product_name}\n` +
        `   Арт: ${i.product_sku || '—'}  |  ` +
        `${i.quantity} шт. x ${price.toLocaleString('ru-RU')} руб. = ` +
        `<b>${lineTotal.toLocaleString('ru-RU')} руб.</b>`
      );
    })
    .join('\n\n');

  const subtotal = (order.items || []).reduce((sum, i) => {
    return sum + Number(i.discount_price || i.price) * i.quantity;
  }, 0);

  const text =
    `НОВЫЙ ЗАКАЗ ${orderNumber}\n` +
    `\n` +
    `ПОКУПАТЕЛЬ\n` +
    `Имя:      ${clientName}\n` +
    `Email:    ${order.user_email || '—'}\n` +
    `Телефон:  ${clientPhone || '—'}\n` +
    `\n` +
    `СОСТАВ ЗАКАЗА\n` +
    `${itemsList || '—'}\n` +
    `\n` +
    `ИТОГО\n` +
    `Товары:   ${subtotal.toLocaleString('ru-RU')} руб.\n` +
    `Доставка: ${Number(order.shipping_cost || 0).toLocaleString('ru-RU')} руб.\n` +
    (Number(order.discount_amount) > 0
      ? `Скидка:   -${Number(order.discount_amount).toLocaleString('ru-RU')} руб.\n`
      : '') +
    `<b>К оплате:  ${Number(order.total_amount).toLocaleString('ru-RU')} руб.</b>\n` +
    `Оплата:   ${PAYMENT_LABELS[order.payment_method] || order.payment_method}\n` +
    `\n` +
    `ДОСТАВКА\n` +
    `${order.shipping_address}\n` +
    (order.notes ? `\nКОММЕНТАРИЙ\n${order.notes}` : '');

  return sendMessage(text, order.id);
};

const sendStatusChangeNotification = async (order, orderNumber, oldStatus, newStatus) => {
  const clientName = [order.user_first_name, order.user_last_name]
    .filter(Boolean).join(' ') || order.user_email || `ID: ${order.user_id}`;

  const text =
    `ИЗМЕНЕНИЕ СТАТУСА ЗАКАЗА\n` +
    `\n` +
    `Заказ:    ${orderNumber}\n` +
    `Клиент:   ${clientName}\n` +
    `Сумма:    ${Number(order.total_amount).toLocaleString('ru-RU')} руб.\n` +
    `\n` +
    `Было:     ${STATUS_LABELS[oldStatus] || oldStatus}\n` +
    `<b>Стало:    ${STATUS_LABELS[newStatus] || newStatus}</b>`;

  return sendMessage(text, order.id);
};

module.exports = {
  sendNewOrderNotification,
  sendStatusChangeNotification,
};