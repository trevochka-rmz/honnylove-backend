// src/config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const VkontakteStrategy = require('passport-vkontakte').Strategy;
const authService = require('../services/authService');

// Google Strategy
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.CALLBACK_URL}/api/auth/google/callback`,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const user = await authService.loginWithGoogle(profile);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// VK Strategy
passport.use(new VkontakteStrategy({
  clientID: process.env.VK_CLIENT_ID,
  clientSecret: process.env.VK_CLIENT_SECRET,
  callbackURL: `${process.env.CALLBACK_URL}/api/auth/vk/callback`,
}, async (accessToken, refreshToken, params, profile, done) => {
  try {
    const user = await authService.loginWithVk(profile);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

// Serialize/Deserialize (для сессий, но поскольку JWT, можно minimal)
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

module.exports = passport;