require('dotenv').config({ path: '.env.local' });
const TelegramBot = require('node-telegram-bot-api');

/**
 * Bot configuration and initialization
 */

// Initialize Telegram bot with polling for Railway deployment
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: false,
  webHook: true // Enable webhook
});

/**
 * Helper function to generate login URL with user ID
 * @param {string} userId - Telegram user ID
 * @returns {string} Login URL
 */
function generateLoginUrl(userId) {
  const baseUrl = process.env.WEB_APP_URL;
  if (!baseUrl) {
    throw new Error('WEB_APP_URL environment variable is not set');
  }
  return `${baseUrl}/login?user_id=${userId}`;
}

module.exports = {
  bot,
  generateLoginUrl
};
