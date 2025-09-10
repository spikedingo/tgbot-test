require('dotenv').config({ path: '.env' });
const express = require('express');

// Import bot configuration
const { bot } = require('./config/bot');

// Import command handlers
const { 
  handleStartCommand,
  handleLoginCommand,
  handleStatusCommand,
  handleLogoutCommand,
  handleAccessTokenCommand,
  handleCreateAgentCommand
} = require('./handlers/commands');

// Import callback handlers
const { handleCallbackQuery, processAgentCreation } = require('./handlers/callbacks');

// Import route handlers
const { 
  createWebhookHandler, 
  createWebhookStatusHandler, 
  createSetWebhookHandler, 
  createAutoResetWebhookHandler 
} = require('./routes/webhook');
const { createAuthCallbackHandler } = require('./routes/auth');
const { 
  createHomeHandler, 
  createHealthHandler, 
  createKeepAliveHandler 
} = require('./routes/health');

// Import constants
const { COMMANDS } = require('./config/constants');
const { updateUserAuthStatus } = require('./mockDb');
const { getUserState, clearUserState } = require('./utils/userState');

const app = express();
const port = process.env.PORT || 3001;

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

// Setup Express routes
app.get('/', createHomeHandler());
app.get('/health', createHealthHandler(bot));
app.get('/keep-alive', createKeepAliveHandler());

// Webhook routes
app.post('/webhook', createWebhookHandler(bot));
app.get('/webhook-status', createWebhookStatusHandler(bot));
app.post('/set-webhook', createSetWebhookHandler(bot));
app.post('/auto-reset-webhook', createAutoResetWebhookHandler(bot));

// Auth routes
app.post('/auth/callback', createAuthCallbackHandler(bot));

// Setup Telegram bot command handlers
bot.onText(new RegExp(COMMANDS.START), (msg) => handleStartCommand(bot, msg));
bot.onText(new RegExp(COMMANDS.LOGIN), (msg) => handleLoginCommand(bot, msg));
bot.onText(new RegExp(COMMANDS.STATUS), (msg) => handleStatusCommand(bot, msg));
bot.onText(new RegExp(COMMANDS.LOGOUT), (msg) => handleLogoutCommand(bot, msg));
bot.onText(new RegExp(COMMANDS.ACCESS_TOKEN), (msg) => handleAccessTokenCommand(bot, msg));
bot.onText(new RegExp(COMMANDS.CREATE_AGENT), (msg) => handleCreateAgentCommand(bot, msg));

// Setup callback query handler
bot.on('callback_query', (callbackQuery) => handleCallbackQuery(bot, callbackQuery));

// Handle web app data and text messages for agent creation
bot.on('message', async (msg) => {
  const userId = msg.from.id;
  
  // Skip command messages (they're handled by onText handlers)
  if (msg.text && msg.text.startsWith('/')) {
    return;
  }
  
  console.log(msg, 'check message')
  
  // Check if this is web app data
  if (msg.web_app_data) {
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
    return;
  }
  
  // Handle text messages for agent creation
  if (msg.text && !msg.web_app_data) {
    const userState = getUserState(userId);
    
    // Check if user is in agent creation mode
    if (userState === 'awaiting_agent_prompt') {
      console.log(`Processing agent creation prompt from user ${userId}: ${msg.text}`);
      
      // Clear the user state since we're processing the prompt
      clearUserState(userId);
      
      // Process the agent creation with the provided prompt
      await processAgentCreation(bot, msg, msg.text);
    }
  }
});

/**
 * Setup webhook with retry logic for Railway deployment
 */
async function setupWebhookWithRetry(maxRetries = 3) {
  const webhookUrl = process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/webhook` : null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`🔧 Setting up webhook automatically... (attempt ${attempt}/${maxRetries})`);
      
      // First, delete any existing webhook to ensure clean setup
      try {
        await bot.deleteWebHook();
        console.log('🗑️  Cleared existing webhook');
      } catch (error) {
        // Ignore errors when deleting webhook (might not exist)
        console.log('ℹ️  No existing webhook to clear');
      }
      
      // Wait a moment before setting new webhook
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Set the new webhook
      await bot.setWebHook(webhookUrl, {
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: false,
        max_connections: 40,
        secret_token: process.env.WEBHOOK_SECRET || undefined
      });
      
      console.log(`✅ Webhook set successfully to: ${webhookUrl}`);
      
      // Verify webhook setup
      const webhookInfo = await bot.getWebHookInfo();
      console.log('📊 Webhook info:', {
        url: webhookInfo.url,
        pending_updates: webhookInfo.pending_update_count,
        max_connections: webhookInfo.max_connections,
        has_custom_certificate: webhookInfo.has_custom_certificate
      });
      
      // Success - break out of retry loop
      return;
      
    } catch (error) {
      console.error(`❌ Webhook setup attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('❌ All webhook setup attempts failed');
        console.log('💡 You can manually set the webhook using: yarn setup-webhook');
        console.log(`💡 Or call: curl -X POST ${process.env.WEBHOOK_BASE_URL}/set-webhook`);
      } else {
        console.log(`⏳ Retrying in ${attempt * 2} seconds...`);
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }
  }
}

// Export the Express app for Vercel
module.exports = app;

// Start server for Railway deployment
const server = app.listen(port, '0.0.0.0', async () => {
  console.log(`Server is running on port ${port} and accessible from network`);
  
  // Auto-setup webhook for production deployment with retry logic
  if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_BASE_URL) {
    // Delay webhook setup to ensure server is fully ready
    setTimeout(async () => {
      await setupWebhookWithRetry();
    }, 5000); // Wait 5 seconds after server start
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
