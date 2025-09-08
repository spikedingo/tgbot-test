require('dotenv').config({ path: '.env.local' });
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const {updateUserAuthStatus, getUserAuthStatus, getUserAccessToken, clearUserAuthData } = require('./mockDb');
const { encryptPrivyAccessToken, decryptPrivyAccessToken, isValidEncryptedToken } = require('./cryptoUtils');
const { getUserAccount } = require('./api/nation');


const app = express();
const port = process.env.PORT || 3001;

// Initialize Telegram bot with polling for Railway deployment
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { 
  polling: false,
  webHook: true // Enable webhook
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
 * Helper function to check if a user is properly authenticated
 * This checks both the authentication flag and the presence of a valid access token
 * @param {string} userId - Telegram user ID
 * @returns {Object} { isAuthenticated: boolean, userData: Object|null, hasValidToken: boolean }
 */
function checkUserAuthentication(userId) {
  try {
    const userData = getUserAuthStatus(userId);
    
    if (!userData || !userData.isAuthenticated) {
      return { isAuthenticated: false, userData: null, hasValidToken: false };
    }
    
    // Check if user has a valid access token
    const accessToken = getUserAccessToken(userId);
    const hasValidToken = !!accessToken;
    
    return { 
      isAuthenticated: userData.isAuthenticated, 
      userData: userData, 
      hasValidToken: hasValidToken 
    };
  } catch (error) {
    console.error(`Error checking authentication for user ${userId}:`, error);
    return { isAuthenticated: false, userData: null, hasValidToken: false };
  }
}

/**
 * Handles the /start command to display a welcome message and menu of available commands
 * This is the default command that users see when they first interact with the bot
 * 
 * @param {Object} msg - Telegram message object
 */
bot.onText(/\/start/, async (msg) => {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  console.log(`Processing /start command for user ${userId}`);
  
  try {
    // Check if user is already authenticated
    const authCheck = checkUserAuthentication(userId);
    
    let welcomeMessage = `👋 **Welcome to IntentKit Bot, ${userName}!**\n\n`;
    welcomeMessage += `This bot helps you manage your Solana trading activities with secure authentication.\n\n`;
    
    if (authCheck.isAuthenticated && authCheck.hasValidToken) {
      welcomeMessage += `✅ **You are currently authenticated**\n\n`;
    } else {
      welcomeMessage += `🔐 **Authentication required** to access all features\n\n`;
    }
    
    welcomeMessage += `📋 **Available Commands:**\n\n`;
    welcomeMessage += `❓ /start - Show this help menu\n`;
    welcomeMessage += `🔑 /login - Authenticate with Privy\n`;
    welcomeMessage += `📊 /status - Check your account status\n`;
    if (authCheck.isAuthenticated && authCheck.hasValidToken) {
      welcomeMessage += `🚪 /logout - Log out and clear credentials\n`;
    }
    welcomeMessage += `💡 **Quick Start:**\n`;
    welcomeMessage += `1. Use /login to authenticate with Privy\n`;
    welcomeMessage += `2. Use /status to check your account information\n`;
    welcomeMessage += `3. Access your trading features with secure authentication\n\n`;
    welcomeMessage += `🔒 **Security:** Your authentication data is encrypted and securely stored.`;
    
    // Create inline keyboard with main actions
    const keyboard = [];
    
    if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
      const loginUrl = `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`;
      keyboard.push([
        {
          text: '🔑 Login with Privy',
          login_url: {
            url: loginUrl,
            forward_text: 'Login to IntentKit'
          }
        }
      ]);
    } else {
      keyboard.push([
        {
          text: '📊 Check Status',
          callback_data: 'check_status'
        }
      ]);
      keyboard.push([
        {
          text: '🚪 Logout',
          callback_data: 'logout_user'
        }
      ]);
    }
    
    keyboard.push([
      {
        text: '❓ Help',
        callback_data: 'show_help'
      }
    ]);
    
    bot.sendMessage(
      msg.chat.id,
      welcomeMessage,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
    
  } catch (error) {
    console.error(`Error processing /start command for user ${userId}:`, error);
    bot.sendMessage(
      msg.chat.id,
      '👋 **Welcome to IntentKit Bot!**\n\n' +
      'Sorry, there was an error loading the full menu. Here are the basic commands:\n\n' +
      '🔑 /login - Authenticate with Privy\n' +
      '📊 /status - Check your account status\n' +
      '❓ /start - Show this help menu'
    );
  }
});

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
    
    // Check if user is already authenticated
    const authCheck = checkUserAuthentication(userId);
    if (authCheck.isAuthenticated && authCheck.hasValidToken) {
      console.log(`User ${userId} is already authenticated with valid token`);
      
      // Display existing user credentials information
      const lastLoginText = authCheck.userData.lastLogin ? 
        new Date(authCheck.userData.lastLogin).toLocaleString() : 'Unknown';
      
      bot.sendMessage(
        msg.chat.id,
        '✅ **Already Logged In**\n\n' +
        'You are already authenticated with Privy.\n\n' +
        `🔑 **Privy User ID:** \`${authCheck.userData.privyUserId || 'N/A'}\`\n` +
        `📅 **Last Login:** ${lastLoginText}\n\n` +
        'You can use all bot features. If you need to re-authenticate, use the button below.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔄 Re-authenticate',
                  login_url: {
                    url: loginUrl,
                    forward_text: 'Re-authenticate to IntentKit'
                  }
                }
              ],
              [
                {
                  text: '📊 Check Status',
                  callback_data: 'check_status'
                }
              ]
            ]
          }
        }
      );
      return;
    } else if (authCheck.isAuthenticated && !authCheck.hasValidToken) {
      console.log(`User ${userId} is marked as authenticated but has no valid token - clearing auth data`);
      // Clear authentication data if user is marked as authenticated but has no valid token
      clearUserAuthData(userId);
    }
    
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
                  forward_text: 'Login to IntentKit'
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
 * 2. Calls getUserAccount API to get account information
 * 3. Displays wallet and authentication information
 * 
 * @param {Object} msg - Telegram message object
 */
bot.onText(/\/status/, async (msg) => {
  const userId = msg.from.id;
  console.log(`Processing /status command for user ${userId}`);
  
  try {
    // Check user authentication status
    const authCheck = checkUserAuthentication(userId);

    if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
      let statusMessage = `📊 **Account Status**\n\n`;
      
      if (!authCheck.isAuthenticated) {
        statusMessage += `Authentication: ❌ Not authenticated\n\n`;
        statusMessage += `Use /login to authenticate with Privy first to access account information.`;
      } else if (!authCheck.hasValidToken) {
        statusMessage += `Authentication: ❌ Access token not found or expired\n\n`;
        statusMessage += `Please re-authenticate using /login to get your account information.`;
        // Clear the invalid authentication data
        clearUserAuthData(userId);
      }
      
      bot.sendMessage(
        msg.chat.id,
        statusMessage,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    // Get access token and call getUserAccount API
    const accessToken = getUserAccessToken(userId);

    // Call getUserAccount API
    const accountData = await getUserAccount(accessToken);
    
    // Format status message with API data
    const authStatus = '✅ Authenticated';
    const privyUserId = authCheck.userData.privyUserId ? `\nPrivy User ID: ${authCheck.userData.privyUserId}` : '';
    const lastLogin = authCheck.userData.lastLogin ? `\nLast login: ${new Date(authCheck.userData.lastLogin).toLocaleString()}` : '';
    
    // Format account information from API
    let accountInfo = '\n\n🏦 **Account Information:**\n';
    if (accountData) {
      if (accountData.id) accountInfo += `Account ID: \`${accountData.id}\`\n`;
      if (accountData.credits !== undefined) accountInfo += `Credits: ${accountData.credits}\n`;
      if (accountData.email) accountInfo += `Email: ${accountData.email}\n`;
      if (accountData.username) accountInfo += `Username: ${accountData.username}\n`;
      if (accountData.created_at) accountInfo += `Created: ${new Date(accountData.created_at).toLocaleString()}\n`;
      
      // Add any other relevant fields from the API response
      if (Object.keys(accountData).length > 0) {
        accountInfo += `\n📋 **Full API Response:**\n\`\`\`json\n${JSON.stringify(accountData, null, 2)}\n\`\`\``;
      }
    } else {
      accountInfo += 'No account data available';
    }
    
    bot.sendMessage(
      msg.chat.id,
      `📊 **Account Status**\n\n` +
      `Authentication: ${authStatus}${privyUserId}${lastLogin}${accountInfo}`,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error(`Error fetching status for user ${userId}:`, error);
    
    let errorMessage = '❌ Sorry, there was an error fetching your account information.';
    let shouldClearAuth = false;
    
    // Provide more specific error messages based on the error type
    if (error.response) {
      if (error.response.status === 401) {
        errorMessage = '❌ Authentication failed. Your token may have expired. Please re-authenticate using /login.';
        shouldClearAuth = true; // Clear auth data for 401 errors (expired tokens)
      } else if (error.response.status === 403) {
        errorMessage = '❌ Access forbidden. Please check your permissions.';
      } else {
        errorMessage = `❌ API Error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`;
      }
    } else if (error.message) {
      errorMessage = `❌ Error: ${error.message}`;
    }
    
    // Clear user authentication data if token appears to be expired
    if (shouldClearAuth) {
      clearUserAuthData(userId);
      console.log(`Cleared authentication data for user ${userId} due to API failure`);
    }
    
    bot.sendMessage(
      msg.chat.id,
      errorMessage + '\n\nIf this error persists, please contact support.',
      {
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
  }
});

/**
 * Handles the /logout command to clear user authentication data
 * This command:
 * 1. Clears the user's authentication status and access token
 * 2. Sends confirmation message to the user
 * 3. Provides option to re-authenticate
 * 
 * @param {Object} msg - Telegram message object
 */
bot.onText(/\/logout/, async (msg) => {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  console.log(`Processing /logout command for user ${userId}`);
  
  try {
    // Check if user is currently authenticated
    const authCheck = checkUserAuthentication(userId);
    
    if (!authCheck.isAuthenticated) {
      return bot.sendMessage(
        msg.chat.id,
        'ℹ️ **Already Logged Out**\n\n' +
        'You are not currently authenticated. No logout action needed.\n\n' +
        'Use /login to authenticate with Privy if you want to access bot features.',
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔑 Login with Privy',
                  login_url: {
                    url: `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`,
                    forward_text: 'Login to IntentKit'
                  }
                }
              ]
            ]
          }
        }
      );
    }
    
    // Clear user authentication data
    clearUserAuthData(userId);
    
    // Send logout confirmation message
    bot.sendMessage(
      msg.chat.id,
      `👋 **Logout Successful, ${userName}!**\n\n` +
      'Your authentication data has been cleared:\n' +
      '• ✅ Authentication status reset\n' +
      '• 🔑 Access token removed\n' +
      '• 🔒 All credentials deleted\n\n' +
      'You are now logged out and will need to re-authenticate to access bot features.',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔑 Login Again',
                login_url: {
                  url: `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`,
                  forward_text: 'Login to IntentKit'
                }
              }
            ],
            [
              {
                text: '🏠 Main Menu',
                callback_data: 'back_to_start'
              }
            ]
          ]
        }
      }
    );
    
    console.log(`User ${userId} successfully logged out`);
    
  } catch (error) {
    console.error(`Error processing /logout command for user ${userId}:`, error);
    bot.sendMessage(
      msg.chat.id,
      '❌ Sorry, there was an error during logout. Please try again later.\n\n' +
      'If this error persists, please contact support.'
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
    const authCheck = checkUserAuthentication(userId);
    if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
      if (!authCheck.isAuthenticated) {
        return bot.sendMessage(
          msg.chat.id,
          '❌ You are not authenticated. Please use /login to authenticate with Privy first.'
        );
      } else {
        // Clear invalid auth data and ask for re-authentication
        clearUserAuthData(userId);
        return bot.sendMessage(
          msg.chat.id,
          '❌ No valid access token found. Please re-authenticate using /login.'
        );
      }
    }
    
    // Get and decrypt the access token
    const accessToken = getUserAccessToken(userId);
    
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
  

  // Handle show help request
  if (data === 'show_help') {
    try {
      // Answer the callback query
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Showing help...',
        show_alert: false
      });
      
      const helpMessage = `📋 **IntentKit Bot Commands**\n\n` +
        `🔑 **/login** - Authenticate with Privy\n` +
        `   • Links your Telegram account with Privy\n` +
        `   • Required for accessing all bot features\n\n` +
        `📊 **/status** - Check your account status\n` +
        `   • Shows authentication status\n` +
        `   • Displays account information from API\n` +
        `   • Shows wallet and user details\n\n` +
        `🚪 **/logout** - Log out and clear credentials\n` +
        `   • Clears your authentication data\n` +
        `   • Removes access tokens\n` +
        `   • Available only when authenticated\n\n` +
        `❓ **/start** - Show this help menu\n` +
        `   • Displays welcome message and command list\n` +
        `   • Shows quick action buttons\n\n` +
        `💡 **Quick Tips:**\n` +
        `• Always authenticate first with /login\n` +
        `• Use /status to verify your authentication\n` +
        `• Use /logout to securely clear your data\n` +
        `• Your data is encrypted and securely stored\n` +
        `• Contact support if you encounter issues`;
      
      bot.sendMessage(
        callbackQuery.message.chat.id,
        helpMessage,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🏠 Back to Main Menu',
                  callback_data: 'back_to_start'
                }
              ]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error(`Error showing help for user ${userId}:`, error);
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error showing help. Please try again.',
        show_alert: true
      });
    }
  }
  
  // Handle back to start menu
  if (data === 'back_to_start') {
    try {
      // Answer the callback query
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Returning to main menu...',
        show_alert: false
      });
      
      // Check if user is already authenticated
      const authCheck = checkUserAuthentication(userId);
      
      let welcomeMessage = `👋 **Welcome to IntentKit Bot!**\n\n`;
      welcomeMessage += `This bot helps you manage your Solana trading activities with secure authentication.\n\n`;
      
      if (authCheck.isAuthenticated && authCheck.hasValidToken) {
        welcomeMessage += `✅ **You are currently authenticated**\n\n`;
      } else {
        welcomeMessage += `🔐 **Authentication required** to access all features\n\n`;
      }
      
      welcomeMessage += `📋 **Available Commands:**\n\n`;
      welcomeMessage += `🔑 /login - Authenticate with Privy\n`;
      welcomeMessage += `📊 /status - Check your account status\n`;
      welcomeMessage += `🎫 /accessToken - Get your access token\n`;
      if (authCheck.isAuthenticated && authCheck.hasValidToken) {
        welcomeMessage += `🚪 /logout - Log out and clear credentials\n`;
      }
      welcomeMessage += `❓ /start - Show this help menu\n\n`;
      welcomeMessage += `💡 **Quick Start:**\n`;
      welcomeMessage += `1. Use /login to authenticate with Privy\n`;
      welcomeMessage += `2. Use /status to check your account information\n`;
      welcomeMessage += `3. Access your trading features with secure authentication\n\n`;
      welcomeMessage += `🔒 **Security:** Your authentication data is encrypted and securely stored.`;
      
      // Create inline keyboard with main actions
      const keyboard = [];
      
      if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
        const loginUrl = `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`;
        keyboard.push([
          {
            text: '🔑 Login with Privy',
            login_url: {
              url: loginUrl,
              forward_text: 'Login to IntentKit'
            }
          }
        ]);
      } else {
        keyboard.push([
          {
            text: '📊 Check Status',
            callback_data: 'check_status'
          }
        ]);
        keyboard.push([
          {
            text: '🎫 Get Access Token',
            callback_data: 'get_access_token'
          }
        ]);
        keyboard.push([
          {
            text: '🚪 Logout',
            callback_data: 'logout_user'
          }
        ]);
      }
      
      keyboard.push([
        {
          text: '❓ Help',
          callback_data: 'show_help'
        }
      ]);
      
      bot.sendMessage(
        callbackQuery.message.chat.id,
        welcomeMessage,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      
    } catch (error) {
      console.error(`Error returning to start menu for user ${userId}:`, error);
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error returning to menu. Please try /start command.',
        show_alert: true
      });
    }
  }
  
  // Handle logout request
  if (data === 'logout_user') {
    try {
      // Answer the callback query
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Logging out...',
        show_alert: false
      });
      
      // Check if user is currently authenticated
      const authCheck = checkUserAuthentication(userId);
      
      if (!authCheck.isAuthenticated) {
        bot.sendMessage(
          callbackQuery.message.chat.id,
          'ℹ️ **Already Logged Out**\n\n' +
          'You are not currently authenticated. No logout action needed.\n\n' +
          'Use /login to authenticate with Privy if you want to access bot features.',
          { 
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: '🔑 Login with Privy',
                    login_url: {
                      url: `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`,
                      forward_text: 'Login to IntentKit'
                    }
                  }
                ]
              ]
            }
          }
        );
        return;
      }
      
      // Clear user authentication data
      clearUserAuthData(userId);
      
      // Send logout confirmation message
      bot.sendMessage(
        callbackQuery.message.chat.id,
        `👋 **Logout Successful!**\n\n` +
        'Your authentication data has been cleared:\n' +
        '• ✅ Authentication status reset\n' +
        '• 🔑 Access token removed\n' +
        '• 🔒 All credentials deleted\n\n' +
        'You are now logged out and will need to re-authenticate to access bot features.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔑 Login Again',
                  login_url: {
                    url: `https://intentkit-tg-bot-git-featuseexpress-crestal.vercel.app/login?user_id=${userId}`,
                    forward_text: 'Login to IntentKit'
                  }
                }
              ],
              [
                {
                  text: '🏠 Main Menu',
                  callback_data: 'back_to_start'
                }
              ]
            ]
          }
        }
      );
      
      console.log(`User ${userId} successfully logged out via callback`);
      
    } catch (error) {
      console.error(`Error handling logout callback for user ${userId}:`, error);
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error during logout. Please try again.',
        show_alert: true
      });
    }
  }
  
  // Handle check status request
  if (data === 'check_status') {
    try {
      // Answer the callback query
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Checking your status...',
        show_alert: false
      });
      
      // Get user authentication status
      const authCheck = checkUserAuthentication(userId);
      
      if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
        let message = '❌ **Not Authenticated**\n\n';
        
        if (!authCheck.isAuthenticated) {
          message += 'You are not currently authenticated with Privy.\n\n';
        } else {
          message += 'Your authentication token is invalid or expired.\n\n';
          // Clear invalid auth data
          clearUserAuthData(userId);
        }
        
        message += 'Use /login to authenticate and access all bot features.';
        
        bot.sendMessage(
          callbackQuery.message.chat.id,
          message,
          { parse_mode: 'Markdown' }
        );
        return;
      }
      
      // Format user status information
      const lastLoginText = authCheck.userData.lastLogin ? 
        new Date(authCheck.userData.lastLogin).toLocaleString() : 'Unknown';
      const walletIdText = authCheck.userData.walletId ? authCheck.userData.walletId : 'Not linked';
      
      bot.sendMessage(
        callbackQuery.message.chat.id,
        '📊 **Your Status**\n\n' +
        `✅ **Authentication:** Active\n` +
        `🔑 **Privy User ID:** \`${authCheck.userData.privyUserId || 'N/A'}\`\n` +
        `👛 **Wallet ID:** \`${walletIdText}\`\n` +
        `📅 **Last Login:** ${lastLoginText}\n\n` +
        'All bot features are available to you.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: '🔑 Get Access Token',
                  callback_data: 'get_access_token'
                }
              ]
            ]
          }
        }
      );
      
    } catch (error) {
      console.error(`Error checking status for user ${userId}:`, error);
      
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: '❌ Error checking status. Please try again.',
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
  
  // Auto-setup webhook for production deployment
  if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_URL) {
    try {
      console.log('🔧 Setting up webhook automatically...');
      const webhookUrl = process.env.WEBHOOK_URL;
      await bot.setWebHook(webhookUrl, {
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: false,
        max_connections: 40
      });
      console.log(`✅ Webhook set successfully to: ${webhookUrl}`);
      
      // Verify webhook setup
      const webhookInfo = await bot.getWebHookInfo();
      console.log('📊 Webhook info:', {
        url: webhookInfo.url,
        pending_updates: webhookInfo.pending_update_count,
        max_connections: webhookInfo.max_connections
      });
    } catch (error) {
      console.error('❌ Error setting up webhook:', error);
      console.log('💡 You can manually set the webhook using: yarn setup-webhook');
    }
  } else if (process.env.USE_POLLING === 'true') {
    // Fallback to polling mode if explicitly requested
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
  // No need to stop polling in webhook mode
  server.close(() => {
    console.log('Process terminated');
  });
}); 