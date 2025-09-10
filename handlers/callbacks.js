const { createReauthKeyboard, createAgentCreationKeyboard } = require('../utils/keyboards');
const { checkUserAuthentication } = require('../utils/auth');
const { getUserAccessToken, clearUserAuthData, updateUserAuthStatus } = require('../mockDb');
const { createHelpMessage } = require('../utils/messages');
const { createWelcomeMessage } = require('../utils/messages');
const { createMainMenuKeyboard } = require('../utils/keyboards');
const { generateLoginUrl } = require('../config/bot');
const { CALLBACK_DATA } = require('../config/constants');
const { generateAgent, createAgent } = require('../api/nation');
const { setUserState, clearUserState } = require('../utils/userState');

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
    } else if (data === CALLBACK_DATA.CREATE_AGENT) {
      await handleCreateAgent(bot, callbackQuery);
    } else if (data === CALLBACK_DATA.CANCEL_AGENT_CREATION) {
      await handleCancelAgentCreation(bot, callbackQuery);
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

/**
 * Handles create agent request callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleCreateAgent(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  const userName = callbackQuery.from.first_name || 'User';
  
  try {
    // Answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Starting agent creation...',
      show_alert: false
    });

    // Check user authentication status
    const authCheck = checkUserAuthentication(userId);

    if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
      let statusMessage = `🤖 **Create Agent**\n\n`;
      
      if (!authCheck.isAuthenticated) {
        statusMessage += `Authentication: ❌ Not authenticated\n\n`;
        statusMessage += `Use /login to authenticate with Privy first to create agents.`;
      } else if (!authCheck.hasValidToken) {
        statusMessage += `Authentication: ❌ Access token not found or expired\n\n`;
        statusMessage += `Please re-authenticate using /login to create agents.`;
        // Clear the invalid authentication data
        clearUserAuthData(userId);
      }
      
      bot.sendMessage(
        callbackQuery.message.chat.id,
        statusMessage,
        { 
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: createReauthKeyboard(userId)
          }
        }
      );
      return;
    }

    // Set user state to await prompt
    setUserState(userId, 'awaiting_agent_prompt');

    // Send prompt request message
    bot.sendMessage(
      callbackQuery.message.chat.id,
      `🤖 **Create Agent**\n\n` +
      `${userName}, please describe the agent you want to create.\n\n` +
      `📝 **Instructions:**\n` +
      `• Describe what you want your agent to do\n` +
      `• Include any specific capabilities or tasks\n` +
      `• Mention scheduling if you want autonomous tasks\n` +
      `• Minimum 10 characters required\n\n` +
      `💡 **Examples:**\n` +
      `• "Buy 0.1 ETH every hour when price drops below $2000"\n` +
      `• "Monitor my portfolio and send daily reports"\n` +
      `• "Tweet market updates every 30 minutes"\n\n` +
      `Please send your agent description as the next message:`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: createAgentCreationKeyboard()
        }
      }
    );
    
    console.log(`Sent agent creation prompt to user ${userId} via callback and set awaiting state`);
    
  } catch (error) {
    console.error(`Error handling create agent callback for user ${userId}:`, error);
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Error starting agent creation. Please try again.',
      show_alert: true
    });
  }
}

/**
 * Handles cancel agent creation callback
 * @param {Object} bot - Telegram bot instance
 * @param {Object} callbackQuery - Telegram callback query object
 */
async function handleCancelAgentCreation(bot, callbackQuery) {
  const userId = callbackQuery.from.id;
  
  try {
    // Answer the callback query
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: 'Agent creation cancelled.',
      show_alert: false
    });
    
    // Clear user state since they cancelled
    clearUserState(userId);
    
    // Check authentication status to show appropriate menu
    const authCheck = checkUserAuthentication(userId);
    const welcomeMessage = createWelcomeMessage('User', authCheck);
    const keyboard = createMainMenuKeyboard(authCheck, userId);
    
    bot.sendMessage(
      callbackQuery.message.chat.id,
      `❌ **Agent Creation Cancelled**\n\n` +
      `No worries! You can create an agent anytime using the button below.\n\n` +
      welcomeMessage,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: keyboard
        }
      }
    );
    
    console.log(`User ${userId} cancelled agent creation and cleared state`);
    
  } catch (error) {
    console.error(`Error handling cancel agent creation for user ${userId}:`, error);
    
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: '❌ Error cancelling. Please try again.',
      show_alert: true
    });
  }
}

/**
 * Processes agent creation from prompt text
 * This function should be called when a user sends a text message after requesting agent creation
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 * @param {string} prompt - User's agent description prompt
 */
async function processAgentCreation(bot, msg, prompt) {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  
  try {
    // Validate prompt length
    if (!prompt || prompt.trim().length < 10) {
      bot.sendMessage(
        msg.chat.id,
        `❌ **Prompt Too Short**\n\n` +
        `Your agent description must be at least 10 characters long.\n\n` +
        `Current length: ${prompt ? prompt.trim().length : 0} characters\n\n` +
        `Please provide a more detailed description of what you want your agent to do:`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: createAgentCreationKeyboard()
          }
        }
      );
      return;
    }

    // Check authentication
    const authCheck = checkUserAuthentication(userId);
    if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
      bot.sendMessage(
        msg.chat.id,
        '❌ **Authentication Required**\n\n' +
        'Please authenticate first using /login to create agents.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: createReauthKeyboard(userId)
          }
        }
      );
      return;
    }

    // Send processing message
    const processingMsg = await bot.sendMessage(
      msg.chat.id,
      `🔄 **Creating Agent**\n\n` +
      `Processing your request...\n` +
      `📝 Prompt: "${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}"\n\n` +
      `⏳ This may take a few moments.`,
      { parse_mode: 'Markdown' }
    );

    const accessToken = getUserAccessToken(userId);

    // Generate agent using the Nation API
    console.log(`Generating agent for user ${userId} with prompt: ${prompt}`);
    const generateResponse = await generateAgent({
      accessToken: accessToken,
      prompt: prompt.trim(),
      userId: userId,
      existingAgent: null,
      projectId: null,
      deploy: false
    });

    console.log(`Agent generation successful for user ${userId}:`, {
      projectId: generateResponse.project_id,
      agentName: generateResponse.agent?.name,
      skillsCount: generateResponse.activated_skills?.length || 0,
      autonomousTasksCount: generateResponse.autonomous_tasks?.length || 0
    });

    // Create the agent using the generated configuration
    const createdAgent = await createAgent({
      accessToken: accessToken,
      agent: generateResponse.agent
    });

    console.log(`Agent created successfully for user ${userId}:`, {
      agentId: createdAgent.id,
      agentName: createdAgent.name
    });

    // Update the processing message with success
    bot.editMessageText(
      `✅ **Agent Created Successfully!**\n\n` +
      `🤖 **Agent Name:** ${createdAgent.name}\n` +
      `📋 **Description:** ${generateResponse.summary || 'Agent created from your prompt'}\n` +
      `🔧 **Skills Activated:** ${generateResponse.activated_skills?.length || 0}\n` +
      `⏰ **Autonomous Tasks:** ${generateResponse.autonomous_tasks?.length || 0}\n\n` +
      `🎉 Your agent is now ready to use!`,
      {
        chat_id: msg.chat.id,
        message_id: processingMsg.message_id,
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
    console.error(`Error creating agent for user ${userId}:`, error);
    
    let errorMessage = 'Failed to create agent';
    if (error.response?.status === 401) {
      errorMessage = 'Authentication expired. Please sign in again.';
      clearUserAuthData(userId);
    } else if (error.response?.status === 422) {
      errorMessage = 'Invalid agent configuration. Please try a different description.';
    } else if (error.response?.data?.message) {
      errorMessage = `Creation failed: ${error.response.data.message}`;
    } else if (error.message) {
      errorMessage = `Creation failed: ${error.message}`;
    }

    bot.sendMessage(
      msg.chat.id,
      `❌ **Agent Creation Failed**\n\n` +
      `${errorMessage}\n\n` +
      `Please try again with a different description or contact support if this error persists.`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔄 Try Again',
                callback_data: CALLBACK_DATA.CREATE_AGENT
              }
            ],
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
  handleLoginComplete,
  handleCreateAgent,
  handleCancelAgentCreation,
  processAgentCreation
};
