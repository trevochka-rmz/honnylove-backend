// src/services/telegramService.js
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID;
const ADMIN_URL = process.env.ADMIN_URL || 'https://admin.honnylove.ru';

const PAYMENT_LABELS = {
    cash:          'Наличные',
    card:          'Банковская карта',
    online:        'Онлайн оплата',
    sbp:           'СБП',
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

// ─────────────────────────────────────────────────────────────────
// Базовая отправка
// ─────────────────────────────────────────────────────────────────
const sendMessage = async (text, orderId = null) => {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.warn('[Telegram] BOT_TOKEN или CHAT_ID не заданы в .env');
        return null;
    }

    const payload = {
        chat_id:                  CHAT_ID,
        text,
        parse_mode:               'HTML',
        disable_web_page_preview: true,
    };

    if (orderId) {
        payload.reply_markup = {
            inline_keyboard: [[{
                text: 'Открыть заказ в админке',
                url:  `${ADMIN_URL}/orders/${orderId}`,
            }]],
        };
    }

    const body = JSON.stringify(payload);

    return new Promise((resolve) => {
        const req = https.request(
            {
                hostname: 'api.telegram.org',
                path:     `/bot${BOT_TOKEN}/sendMessage`,
                method:   'POST',
                headers:  {
                    'Content-Type':   'application/json',
                    'Content-Length': Buffer.byteLength(body),
                },
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => (data += chunk));
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);
                        if (!parsed.ok) console.error('[Telegram] Ошибка API:', parsed.description);
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

// ─────────────────────────────────────────────────────────────────
// Получить метку варианта из позиции заказа
//
// ИСПРАВЛЕНО: variant_options из JSON-агрегации postgres приходит
// уже как объект (не строка), но variant_snapshot может быть строкой.
// Добавлена безопасная десериализация для обоих случаев.
// ─────────────────────────────────────────────────────────────────
const safeParseJson = (val) => {
    if (!val) return null;
    if (typeof val === 'object') return val;
    try { return JSON.parse(val); } catch { return null; }
};

const formatVariantLabel = (item) => {
    // 1. variant_name — прямое поле из JOIN product_variants
    if (item.variant_name) return item.variant_name;

    // 2. variant_options — объект {"Объём":"50 мл"} из JOIN product_variants
    const options = safeParseJson(item.variant_options);
    if (options && typeof options === 'object') {
        const entries = Object.entries(options);
        if (entries.length > 0) {
            return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
        }
    }

    // 3. variant_snapshot — JSON снимок, сохранённый при создании заказа
    const snap = safeParseJson(item.variant_snapshot);
    if (snap) {
        if (snap.name) return snap.name;
        const snapOptions = safeParseJson(snap.options);
        if (snapOptions && typeof snapOptions === 'object') {
            const entries = Object.entries(snapOptions);
            if (entries.length > 0) {
                return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
            }
        }
    }

    return null;
};

// ─────────────────────────────────────────────────────────────────
// Уведомление о новом заказе
// ─────────────────────────────────────────────────────────────────
const sendNewOrderNotification = async (order, orderNumber) => {
    const clientName = [order.customer_first_name, order.customer_last_name]
        .filter(Boolean).join(' ')
        || [order.user_first_name, order.user_last_name].filter(Boolean).join(' ')
        || order.user_email
        || `ID: ${order.user_id}`;

    const clientPhone = order.customer_phone || order.user_phone || '—';

    const itemsList = (order.items || [])
        .map((item, index) => {
            const price     = Number(item.actual_price ?? item.discount_price ?? item.price);
            const lineTotal = price * item.quantity;

            const variantLabel = formatVariantLabel(item);
            const variantLine  = variantLabel ? `   Вариант: ${variantLabel}\n` : '';

            return (
                `${index + 1}. ${item.product_name}\n` +
                variantLine +
                `   Арт: ${item.product_sku || '—'}  |  ` +
                `${item.quantity} шт. × ${price.toLocaleString('ru-RU')} руб. = ` +
                `<b>${lineTotal.toLocaleString('ru-RU')} руб.</b>`
            );
        })
        .join('\n\n');

    const subtotal = (order.items || []).reduce((sum, item) => {
        const price = Number(item.actual_price ?? item.discount_price ?? item.price);
        return sum + price * item.quantity;
    }, 0);

    const text =
        `🛍 <b>НОВЫЙ ЗАКАЗ ${orderNumber}</b>\n` +
        `\n` +
        `👤 <b>ПОКУПАТЕЛЬ</b>\n` +
        `Имя:      ${clientName}\n` +
        `Email:    ${order.user_email || '—'}\n` +
        `Телефон:  ${clientPhone}\n` +
        `\n` +
        `📦 <b>СОСТАВ ЗАКАЗА</b>\n` +
        `${itemsList || '—'}\n` +
        `\n` +
        `💰 <b>ИТОГО</b>\n` +
        `Товары:   ${subtotal.toLocaleString('ru-RU')} руб.\n` +
        `Доставка: ${Number(order.shipping_cost || 0).toLocaleString('ru-RU')} руб.\n` +
        (Number(order.discount_amount) > 0
            ? `Скидка:   -${Number(order.discount_amount).toLocaleString('ru-RU')} руб.\n`
            : '') +
        `<b>К оплате:  ${Number(order.total_amount).toLocaleString('ru-RU')} руб.</b>\n` +
        `Оплата:   ${PAYMENT_LABELS[order.payment_method] || order.payment_method}\n` +
        `\n` +
        `🚚 <b>ДОСТАВКА</b>\n` +
        `${order.shipping_address}\n` +
        (order.notes ? `\n💬 <b>КОММЕНТАРИЙ</b>\n${order.notes}` : '');

    return sendMessage(text, order.id);
};

const sendStatusChangeNotification = async (order, orderNumber, oldStatus, newStatus) => {
    const clientName = [order.user_first_name, order.user_last_name]
        .filter(Boolean).join(' ') || order.user_email || `ID: ${order.user_id}`;

    const text =
        `🔄 <b>ИЗМЕНЕНИЕ СТАТУСА ЗАКАЗА</b>\n` +
        `\n` +
        `Заказ:  ${orderNumber}\n` +
        `Клиент: ${clientName}\n` +
        `Сумма:  ${Number(order.total_amount).toLocaleString('ru-RU')} руб.\n` +
        `\n` +
        `Было:   ${STATUS_LABELS[oldStatus] || oldStatus}\n` +
        `<b>Стало:  ${STATUS_LABELS[newStatus] || newStatus}</b>`;

    return sendMessage(text, order.id);
};

const sendPaymentCancelledNotification = async (order, orderNumber) => {
    const clientName = [order.customer_first_name, order.customer_last_name]
        .filter(Boolean).join(' ') || order.user_email || '—';

    const text =
        `❌ <b>ПОКУПАТЕЛЬ ОТМЕНИЛ ОПЛАТУ</b>\n` +
        `\n` +
        `Заказ:   ${orderNumber}\n` +
        `Клиент:  ${clientName}\n` +
        `Телефон: ${order.customer_phone || '—'}\n` +
        `Сумма:   ${Number(order.total_amount).toLocaleString('ru-RU')} руб.\n` +
        `\n` +
        `Товары возвращены в корзину покупателя.`;

    return sendMessage(text, order.id);
};

module.exports = {
    sendNewOrderNotification,
    sendStatusChangeNotification,
    sendPaymentCancelledNotification,
};