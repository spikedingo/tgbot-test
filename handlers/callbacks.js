const { createReauthKeyboard } = require('../utils/keyboards');
const { checkUserAuthentication } = require('../utils/auth');
const { getUserAccessToken, clearUserAuthData, updateUserAuthStatus } = require('../mockDb');
const { createHelpMessage } = require('../utils/messages');
const { createWelcomeMessage } = require('../utils/messages');
const { createMainMenuKeyboard } = require('../utils/keyboards');
const { generateLoginUrl } = require('../config/bot');
const { CALLBACK_DATA } = require('../config/constants');

/**
 * Main callback query handler that routes to specific handlers
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleCallbackQuery(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  console.log(`Received callback query from user ${userId}: ${data}`);
  
  try {
    // Route to appropriate handler based on callback data
    if (data === CALLBACK_DATA.REAUTH_REQUEST) {
      await handleReauthRequest(bot, callbackQuery);
    } else if (data === CALLBACK_DATA.SHOW_HELP) {
      await handleShowHelp(bot, callbackQuery);
    } else if (data === CALLBACK_DATA.BACK_TO_START) {
      await handleBackToStart(bot, callbackQuery);
    } else if (data === CALLBACK_DATA.LOGOUT_USER) {
      await handleLogoutUser(bot, callbackQuery);
    } else if (data === CALLBACK_DATA.CHECK_STATUS) {
      await handleCheckStatus(bot, callbackQuery);
    } else if (data === CALLBACK_DATA.GET_ACCESS_TOKEN) {
      await handleGetAccessToken(bot, callbackQuery);
    } else if (data && data.startsWith(CALLBACK_DATA.LOGIN_COMPLETE)) {
      // Handle legacy login completion (if still needed)
      await handleLoginComplete(bot, callbackQuery);
    }
  } catch (error) {
    console.error(`Error handling callback query for user ${userId}:`, error);
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Error processing request. Please try again.',
      show_alert: true
    });
  }
}

/**
 * Handles get access token request callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleGetAccessToken(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  
  try {
    // Answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Retrieving access token...',
      show_alert: false
    });
    
    // Check if user is authenticated
    const authCheck = checkUserAuthentication(userId);
    if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
      if (!authCheck.isAuthenticated) {
        return bot.sendMessage(
          callbackQuery.message.chat.id,
          '❌ You are not authenticated. Please use /login to authenticate with Privy first.'
        );
      } else {
        // Clear invalid auth data and ask for re-authentication
        clearUserAuthData(userId);
        return bot.sendMessage(
          callbackQuery.message.chat.id,
          '❌ No valid access token found. Please re-authenticate using /login.'
        );
      }
    }
    
    // Get and decrypt the access token
    const accessToken = getUserAccessToken(userId);
    
    // Send the access token to the user
    bot.sendMessage(
      callbackQuery.message.chat.id,
      `🔑 **Your Privy Access Token**\n\n` +
      `\`\`\`\n${accessToken}\n\`\`\`\n\n` +
      `⚠️ **Security Notice:**\n` +
      `• Keep this token secure and do not share it\n` +
      `• This token provides access to your Privy account\n` +
      `• If compromised, please re-authenticate immediately`,
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: createReauthKeyboard(userId)
        }
      }
    );
    
    console.log(`Access token sent to user ${userId}`);
    
  } catch (error) {
    console.error(`Error retrieving access token for user ${userId}:`, error);
    bot.sendMessage(
      callbackQuery.message.chat.id,
      '❌ Sorry, there was an error retrieving your access token. Please try again later.\n\n' +
      'If this error persists, please contact support.'
    );
  }
}

/**
 * Handles show help request callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleShowHelp(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  
  try {
    // Answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Showing help...',
      show_alert: false
    });
    
    const helpMessage = createHelpMessage();
    
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
                callback_data: CALLBACK_DATA.BACK_TO_START
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

/**
 * Handles back to start menu callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleBackToStart(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  
  try {
    // Answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Returning to main menu...',
      show_alert: false
    });
    
    // Check if user is already authenticated
    const authCheck = checkUserAuthentication(userId);
    
    // Create welcome message
    const welcomeMessage = createWelcomeMessage('User', authCheck);
    
    // Create inline keyboard with main actions
    const keyboard = createMainMenuKeyboard(authCheck, userId);
    
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

/**
 * Handles logout request callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleLogoutUser(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  
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
                    url: generateLoginUrl(userId),
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
                text: '🔑 Login with Privy',
                login_url: {
                  url: generateLoginUrl(userId),
                  forward_text: 'Login to IntentKit'
                }
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

/**
 * Handles re-authentication request callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleReauthRequest(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  
  try {
    // Answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Redirecting to login...',
      show_alert: false
    });
    
    // Create the login URL for Privy authentication
    const loginUrl = generateLoginUrl(userId);
    
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
                  forward_text: 'Re-authenticate to IntentKit'
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

/**
 * Handles check status request callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleCheckStatus(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  
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

/**
 * Handles login completion callback (legacy support)
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleLoginComplete(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  
  try {
    // Extract privy user ID from callback data
    const privyUserId = data.replace(CALLBACK_DATA.LOGIN_COMPLETE, '');
    
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

module.exports = {
  handleCallbackQuery,
  handleGetAccessToken,
  handleShowHelp,
  handleBackToStart,
  handleLogoutUser,
  handleReauthRequest,
  handleCheckStatus,
  handleLoginComplete
};
