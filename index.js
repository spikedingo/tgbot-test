require('dotenv').config({ path: '.env.local' });
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const {updateUserAuthStatus, getUserAuthStatus, getUserAccessToken } = require('./mockDb');
const { encryptPrivyAccessToken, decryptPrivyAccessToken, isValidEncryptedToken } = require('./cryptoUtils');


const app = express();
const port = process.env.PORT || 3001;

// Initialize Telegram bot with polling for Railway deployment
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: {
    interval: 300, // Check for new messages every 300ms
    autoStart: true, // Start polling automatically
    params: {
      timeout: 10, // Long polling timeout in seconds
    }
  },
  webHook: false // Disable webhook
});

// Middleware to parse JSON
app.use(express.json());

// CORS middleware to allow cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Webhook endpoint for Telegram
app.post('/webhook', (req, res) => {
  try {
    console.log('Received webhook update:', JSON.stringify(req.body, null, 2));
    
    // Validate webhook data
    if (!req.body || typeof req.body !== 'object') {
      console.error('Invalid webhook data received');
      return res.status(400).json({ error: 'Invalid webhook data' });
    }
    
    // Process the update
    bot.processUpdate(req.body);
    
    // Log successful processing
    console.log('Webhook processed successfully at:', new Date().toISOString());
    res.status(200).json({ status: 'ok', timestamp: Date.now() });
    
  } catch (error) {
    console.error('Error processing webhook:', error);
    console.error('Request body:', req.body);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Basic route to verify server is running
app.get('/', (req, res) => {
  res.send('Telegram Bot Server is running!');
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check webhook status
    const webhookInfo = await bot.getWebHookInfo();
    
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      webhook: {
        url: webhookInfo.url || 'Not set',
        pending_updates: webhookInfo.pending_update_count || 0,
        last_error_date: webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toISOString() : null,
        last_error_message: webhookInfo.last_error_message || null
      }
    };
    
    // If there are recent errors, mark as unhealthy
    if (webhookInfo.last_error_date && (Date.now() / 1000 - webhookInfo.last_error_date) < 300) {
      health.status = 'unhealthy';
    }
    
    res.json(health);
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Webhook status endpoint
app.get('/webhook-status', async (req, res) => {
  try {
    const webhookInfo = await bot.getWebHookInfo();
    res.json({
      success: true,
      webhook_info: webhookInfo
    });
  } catch (error) {
    console.error('Error getting webhook status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Set webhook endpoint
app.post('/set-webhook', async (req, res) => {
  try {
    const webhookUrl = process.env.WEBHOOK_URL || `https://${req.get('host')}/webhook`;
    await bot.setWebHook(webhookUrl, {
      allowed_updates: ['message', 'callback_query', 'inline_query'],
      drop_pending_updates: false
    });
    console.log(`Webhook set to ${webhookUrl} at ${new Date().toISOString()}`);
    res.json({ success: true, message: `Webhook set to ${webhookUrl}` });
  } catch (error) {
    console.error('Error setting webhook:', error);
    res.status(500).json({ error: 'Failed to set webhook' });
  }
});

// Auto-reset webhook endpoint (for monitoring services)
app.post('/auto-reset-webhook', async (req, res) => {
  try {
    // Check if webhook needs to be reset
    const webhookInfo = await bot.getWebHookInfo();
    const expectedUrl = process.env.WEBHOOK_URL || `https://${req.get('host')}/webhook`;
    
    let needsReset = false;
    let reason = '';
    
    // Check if webhook URL is different
    if (webhookInfo.url !== expectedUrl) {
      needsReset = true;
      reason = 'URL mismatch';
    }
    
    // Check if there are recent errors (within last 5 minutes)
    if (webhookInfo.last_error_date && (Date.now() / 1000 - webhookInfo.last_error_date) < 300) {
      needsReset = true;
      reason = 'Recent errors detected';
    }
    
    // Check if there are too many pending updates
    if (webhookInfo.pending_update_count > 10) {
      needsReset = true;
      reason = 'Too many pending updates';
    }
    
    if (needsReset) {
      await bot.setWebHook(expectedUrl, {
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: true
      });
      console.log(`Webhook auto-reset: ${reason} at ${new Date().toISOString()}`);
      res.json({ 
        success: true, 
        reset: true, 
        reason: reason,
        message: `Webhook reset to ${expectedUrl}` 
      });
    } else {
      res.json({ 
        success: true, 
        reset: false, 
        message: 'Webhook is healthy, no reset needed' 
      });
    }
  } catch (error) {
    console.error('Error in auto-reset webhook:', error);
    res.status(500).json({ error: 'Failed to check/reset webhook' });
  }
});

// Keep-alive endpoint to prevent cold starts
app.get('/keep-alive', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Webhook endpoint to handle authentication callbacks from Privy
 * This endpoint is called by the web application when a user completes authentication
 * 
 * POST /auth/callback
 * Body: { telegramUserId: string, privyUserId: string, isAuthenticated: boolean, privyAccessToken: string }
 */
app.post('/auth/callback', async (req, res) => {
  try {
    const { telegramUserId, privyUserId, isAuthenticated, privyAccessToken } = req.body;
    
    console.log(`Received auth callback for user ${telegramUserId}: authenticated=${isAuthenticated}`);
    
    if (!telegramUserId) {
      return res.status(400).json({ error: 'telegramUserId is required' });
    }
    
    let encryptedAccessToken = null;
    
    // Handle privyAccessToken if provided
    if (privyAccessToken) {
      try {
        // Check if the token is already encrypted
        if (isValidEncryptedToken(privyAccessToken)) {
          console.log(`Access token for user ${telegramUserId} is already encrypted`);
          encryptedAccessToken = privyAccessToken;
        } else {
          // Encrypt the access token
          console.log(`Encrypting access token for user ${telegramUserId}`);
          encryptedAccessToken = encryptPrivyAccessToken(privyAccessToken);
        }
      } catch (encryptionError) {
        console.error(`Error handling access token for user ${telegramUserId}:`, encryptionError);
        return res.status(400).json({ error: 'Failed to process access token' });
      }
    }
    
    // Update user authentication status in our database with encrypted token
    updateUserAuthStatus(telegramUserId, isAuthenticated, privyUserId, encryptedAccessToken);
    
    if (isAuthenticated) {
      // Send confirmation message to the user
      bot.sendMessage(
        telegramUserId,
        '🎉 **Authentication Successful!**\n\n' +
        'You have successfully logged in with Privy. Your Telegram account is now linked and authenticated.\n\n' +
        'You can now use all bot features with enhanced security.',
        { parse_mode: 'Markdown' }
      );
    }
    
    res.json({ success: true, message: 'Authentication status updated' });
    
  } catch (error) {
    console.error('Error handling auth callback:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * MOCK DATABASE IMPLEMENTATION
 * 
 * This starter repo uses a simple JSON file to mock a database for simplicity.
 * In a production environment, you should replace this with a proper database.
 * 
 * Options for production:
 * - MongoDB
 * - PostgreSQL
 * - Redis
 * - etc.
 * 
 * The wallet mappings are stored in a JSON file that maps Telegram user IDs to Privy wallet IDs.
 * This is a simple implementation for demonstration purposes only.
 */

/**
 * Handles the /login command to authenticate users with Privy
 * This command:
 * 1. Creates a login URL with Privy authentication
 * 2. Sends an inline keyboard with login button
 * 3. Handles the authentication callback
 * 
 * @param {Object} msg - Telegram message object
 */
bot.onText(/\/login/, async (msg) => {
  const userId = msg.from.id;
  console.log(`Processing /login command for user ${userId}`);
  
  try {
    // Create the login URL for Privy authentication
    // The URL should point to your web application with Privy configured
    const loginUrl = `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`;
    
    // Send message with inline keyboard for login
    bot.sendMessage(
      msg.chat.id,
      '🔐 **Login with Privy**\n\n' +
      'Click the button below to authenticate with your Telegram account using Privy.\n\n' +
      'This will securely link your Telegram account and enable seamless authentication.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔑 Login with Privy',
                login_url: {
                  url: loginUrl,
                  forward_text: 'Login to Solana Trading Bot'
                }
              }
            ]
          ]
        }
      }
    );
    
  } catch (error) {
    console.error(`Error creating login URL for user ${userId}:`, error);
    bot.sendMessage(
      msg.chat.id,
      '❌ Sorry, there was an error setting up login. Please try again later.\n\n' +
      'If this error persists, please contact support.'
    );
  }
});

/**
 * Handles the /status command to check user authentication status
 * This command:
 * 1. Retrieves the user's authentication status
 * 2. Displays wallet and authentication information
 * 
 * @param {Object} msg - Telegram message object
 */
bot.onText(/\/status/, async (msg) => {
  const userId = msg.from.id;
  console.log(`Processing /status command for user ${userId}`);
  
  try {
    // Get user data from our database
    const userData = getUserAuthStatus(userId);
    console.log(userData, 'check user data')
    if (!userData || !userData.walletId) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ You don\'t have a wallet yet. Use /start to create one.'
      );
    }
    
    // Get wallet information
    const wallet = await privy.walletApi.getWallet({id: userData.walletId});
    const walletAddress = wallet.address;
    
    // Format status message
    const authStatus = userData.isAuthenticated ? '✅ Authenticated' : '❌ Not authenticated';
    const privyUserId = userData.privyUserId ? `\nPrivy User ID: ${userData.privyUserId}` : '';
    const lastLogin = userData.lastLogin ? `\nLast login: ${new Date(userData.lastLogin).toLocaleString()}` : '';
    
    bot.sendMessage(
      msg.chat.id,
      `📊 **Account Status**\n\n` +
      `Wallet Address: \`${walletAddress}\`\n` +
      `Authentication: ${authStatus}${privyUserId}${lastLogin}\n\n` +
      `Use /login to authenticate with Privy if you haven't already.`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error(`Error fetching status for user ${userId}:`, error);
    bot.sendMessage(
      msg.chat.id,
      '❌ Sorry, there was an error fetching your status. Please try again later.'
    );
  }
});

/**
 * Handles the /accessToken command to retrieve and display user's Privy access token
 * This command:
 * 1. Retrieves the user's encrypted access token from database
 * 2. Decrypts the access token
 * 3. Sends the decrypted token to the user
 * 
 * @param {Object} msg - Telegram message object
 */
bot.onText(/\/accessToken/, async (msg) => {
  const userId = msg.from.id;
  console.log(`Processing /accessToken command for user ${userId}`);
  
  try {
    // Check if user is authenticated
    const userData = getUserAuthStatus(userId);
    if (!userData || !userData.isAuthenticated) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ You are not authenticated. Please use /login to authenticate with Privy first.'
      );
    }
    
    // Get and decrypt the access token
    const accessToken = getUserAccessToken(userId);
    
    if (!accessToken) {
      return bot.sendMessage(
        msg.chat.id,
        '❌ No access token found. Please re-authenticate using /login.'
      );
    }
    
    // Send the access token to the user
    bot.sendMessage(
      msg.chat.id,
      `🔑 **Your Privy Access Token**\n\n` +
      `\`\`\`\n${accessToken}\n\`\`\`\n\n` +
      `⚠️ **Security Notice:**\n` +
      `• Keep this token secure and do not share it\n` +
      `• This token provides access to your Privy account\n` +
      `• If compromised, please re-authenticate immediately`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔄 Re-authenticate',
                callback_data: 'reauth_request'
              }
            ]
          ]
        }
      }
    );
    
    console.log(`Access token sent to user ${userId}`);
    
  } catch (error) {
    console.error(`Error retrieving access token for user ${userId}:`, error);
    bot.sendMessage(
      msg.chat.id,
      '❌ Sorry, there was an error retrieving your access token. Please try again later.\n\n' +
      'If this error persists, please contact support.'
    );
  }
});

/**
 * Handles login callback from Telegram
 * This is called when a user completes the login process via the login_url
 * 
 * @param {Object} callbackQuery - Telegram callback query object
 */
bot.on('callback_query', async (callbackQuery) => {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  console.log(`Received callback query from user ${userId}: ${data}`);
  
  // Handle login completion
  if (data && data.startsWith('login_complete_')) {
    try {
      // Extract privy user ID from callback data
      const privyUserId = data.replace('login_complete_', '');
      
      // Update user authentication status
      updateUserAuthStatus(userId, true, privyUserId);
      
      // Answer the callback query
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '✅ Login successful! You are now authenticated.',
        show_alert: true
      });
      
      // Send confirmation message
      bot.sendMessage(
        callbackQuery.message.chat.id,
        '🎉 **Authentication Successful!**\n\n' +
        'You have successfully logged in with Privy. Your Telegram account is now linked and authenticated.\n\n' +
        'You can now use all bot features with enhanced security.',
        { parse_mode: 'Markdown' }
      );
      
    } catch (error) {
      console.error(`Error handling login callback for user ${userId}:`, error);
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Login failed. Please try again.',
        show_alert: true
      });
    }
  }
  
  // Handle re-authentication request
  if (data === 'reauth_request') {
    try {
      // Answer the callback query
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Redirecting to login...',
        show_alert: false
      });
      
      // Create the login URL for Privy authentication
      const loginUrl = `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`;
      
      // Send message with inline keyboard for re-authentication
      bot.sendMessage(
        callbackQuery.message.chat.id,
        '🔄 **Re-authentication Required**\n\n' +
        'Click the button below to re-authenticate with Privy and update your access token.\n\n' +
        'This will securely refresh your authentication and access token.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔑 Re-authenticate with Privy',
                  login_url: {
                    url: loginUrl,
                    forward_text: 'Re-authenticate to Solana Trading Bot'
                  }
                }
              ]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error(`Error handling re-auth request for user ${userId}:`, error);
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error redirecting to login. Please try /login command.',
        show_alert: true
      });
    }
  }
});

/**
 * Handles web app data from Telegram Mini Apps
 * This is called when a user completes login via web app
 * 
 * @param {Object} msg - Telegram message object
 */
bot.on('message', async (msg) => {
  console.log(msg, 'check message')
  // Check if this is web app data
  if (msg.web_app_data) {
    const userId = msg.from.id;
    console.log(`Received web app data from user ${userId}`);
    
    try {
      // Parse the web app data (this would contain authentication info from Privy)
      const webAppData = JSON.parse(msg.web_app_data.data);
      
      if (webAppData.type === 'login_complete' && webAppData.privyUserId) {
        // Update user authentication status
        updateUserAuthStatus(userId, true, webAppData.privyUserId);
        
        // Send confirmation message
        bot.sendMessage(
          msg.chat.id,
          '🎉 **Authentication Successful!**\n\n' +
          'You have successfully logged in with Privy via Mini App. Your Telegram account is now linked and authenticated.\n\n' +
          'You can now use all bot features with enhanced security.',
          { parse_mode: 'Markdown' }
        );
      }
    } catch (error) {
      console.error(`Error handling web app data for user ${userId}:`, error);
      bot.sendMessage(
        msg.chat.id,
        '❌ There was an error processing your authentication. Please try again.'
      );
    }
  }
});

// Export the Express app for Vercel
module.exports = app;

// Start server for Railway deployment
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`Server is running on port ${port} and accessible from network`);
  
  // If using polling, delete any existing webhook
  if (process.env.USE_POLLING === 'true') {
    try {
      await bot.deleteWebHook();
      console.log('Webhook deleted, bot now running in polling mode');
    } catch (error) {
      console.error('Error deleting webhook:', error);
    }
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (process.env.USE_POLLING === 'true') {
    bot.stopPolling();
  }
  server.close(() => {
    console.log('Process terminated');
  });
}); 