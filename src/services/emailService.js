// src/services/emailService.js
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Отправить verification code
const sendVerificationEmail = async (email, code) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Подтверждение email для HonnyLove',
    text: `Ваш код подтверждения: ${code}. Он действителен 15 минут.`,
    html: `<p>Ваш код подтверждения: <strong>${code}</strong>. Он действителен 15 минут.</p>`,
  });
};

// Отправить reset code
const sendResetEmail = async (email, code) => {
  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'Сброс пароля для HonnyLove',
    text: `Ваш код для сброса пароля: ${code}. Он действителен 15 минут.`,
    html: `<p>Ваш код для сброса пароля: <strong>${code}</strong>. Он действителен 15 минут.</p>`,
  });
};

module.exports = { sendVerificationEmail, sendResetEmail };