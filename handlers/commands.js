const { createReauthKeyboard } = require('../utils/keyboards');
const { checkUserAuthentication, handleInvalidToken } = require('../utils/auth');
const { getUserAccessToken, clearUserAuthData } = require('../mockDb');
const { createStatusMessage, createErrorMessage } = require('../utils/messages');
const { createWelcomeMessage, createHelpMessage } = require('../utils/messages');
const { createMainMenuKeyboard } = require('../utils/keyboards');
const { createLoginKeyboard } = require('../utils/keyboards');
const { createLogoutKeyboard } = require('../utils/keyboards');
const { generateLoginUrl } = require('../config/bot');
const { getUserAccount, generateAgent, createAgent, getUserAgents, getAgent } = require('../api/nation');
const { createAgentCreationKeyboard } = require('../utils/keyboards');
const { setUserState } = require('../utils/userState');

/**
 * Handles the /start command to display a welcome message and menu of available commands
 * This is the default command that users see when they first interact with the bot
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleStartCommand(bot, msg) {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  console.log(`Processing /start command for user ${userId}`);
  
  try {
    // Check if user is already authenticated
    const authCheck = checkUserAuthentication(userId);
    
    // Create welcome message
    const welcomeMessage = createWelcomeMessage(userName, authCheck);
    
    bot.sendMessage(
      msg.chat.id,
      welcomeMessage,
      {
        parse_mode: 'Markdown',
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
}

/**
 * Handles the /login command to authenticate users with Privy
 * This command:
 * 1. Creates a login URL with Privy authentication
 * 2. Sends an inline keyboard with login button
 * 3. Handles the authentication callback
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleLoginCommand(bot, msg) {
  const userId = msg.from.id;
  console.log(`Processing /login command for user ${userId}`);
  
  try {
    // Create the login URL for Privy authentication
    const loginUrl = generateLoginUrl(userId);
    
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
          inline_keyboard: createLoginKeyboard(userId)
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
}

/**
 * Handles the /logout command to clear user authentication data
 * This command:
 * 1. Clears the user's authentication status and access token
 * 2. Sends confirmation message to the user
 * 3. Provides option to re-authenticate
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleLogoutCommand(bot, msg) {
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
                    url: generateLoginUrl(userId),
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
          inline_keyboard: createLogoutKeyboard(userId)
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
}

/**
 * Handles the /status command to check user authentication status
 * This command:
 * 1. Retrieves the user's authentication status
 * 2. Calls getUserAccount API to get account information
 * 3. Displays wallet and authentication information
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleStatusCommand(bot, msg) {
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
    const statusMessage = createStatusMessage(authCheck, accountData);
    
    bot.sendMessage(
      msg.chat.id,
      statusMessage,
      { parse_mode: 'Markdown' }
    );
    
  } catch (error) {
    console.error(`Error fetching status for user ${userId}:`, error);
    
    const { message: errorMessage, shouldClearAuth } = createErrorMessage(error);
    
    // Clear user authentication data if token appears to be expired
    handleInvalidToken(userId, shouldClearAuth);
    
    bot.sendMessage(
      msg.chat.id,
      errorMessage + '\n\nIf this error persists, please contact support.',
      {
        reply_markup: {
          inline_keyboard: createReauthKeyboard(userId)
        }
      }
    );
  }
}

/**
 * Handles the /accessToken command to retrieve and display user's Privy access token
 * This command:
 * 1. Retrieves the user's encrypted access token from database
 * 2. Decrypts the access token
 * 3. Sends the decrypted token to the user
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleAccessTokenCommand(bot, msg) {
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
          inline_keyboard: createReauthKeyboard(userId)
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
}

/**
 * Handles the /create_agent command to create agents from natural language prompts
 * This command:
 * 1. Checks if user is authenticated
 * 2. Prompts user to enter an agent description
 * 3. Validates the prompt (minimum 10 characters)
 * 4. Calls the agent generation API
 * 5. Creates the agent and provides feedback
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleCreateAgentCommand(bot, msg) {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  console.log(`Processing /create_agent command for user ${userId}`);
  
  try {
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
        msg.chat.id,
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
      msg.chat.id,
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
    
    console.log(`Sent agent creation prompt to user ${userId} and set awaiting state`);
    
  } catch (error) {
    console.error(`Error processing /create_agent command for user ${userId}:`, error);
    bot.sendMessage(
      msg.chat.id,
      '❌ Sorry, there was an error processing your request. Please try again later.\n\n' +
      'If this error persists, please contact support.'
    );
  }
}

/**
 * Handles the /my_agents command to display user's agents
 * This command:
 * 1. Checks if user is authenticated
 * 2. Calls getUserAgents API to fetch user's agents
 * 3. Displays the agents in a formatted message
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleMyAgentsCommand(bot, msg) {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  console.log(`Processing /my_agents command for user ${userId}`);
  
  try {
    // Check if user is authenticated
    const authCheck = checkUserAuthentication(userId);
    
    if (!authCheck.isAuthenticated) {
      const keyboard = createReauthKeyboard(userId);
      bot.sendMessage(
        msg.chat.id,
        '🔐 **Authentication Required**\n\n' +
        'You need to authenticate first to view your agents.\n\n' +
        'Please use the login button below to authenticate with Privy.',
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: keyboard
          }
        }
      );
      return;
    }

    // Show loading message
    const loadingMessage = await bot.sendMessage(
      msg.chat.id,
      '🔄 Loading your agents...'
    );

    // Get access token directly
    const accessToken = getUserAccessToken(userId);
    
    // Get user's agents
    const agentsData = await getUserAgents({
      accessToken: accessToken,
      limit: 100 // Limit to 100 agents for better readability
    });

    // Format agents message
    let message = '🤖 **Your Agents**\n\n';
    
    if (!agentsData.data || agentsData.data.length === 0) {
      message += 'You don\'t have any agents yet.\n\n' +
                'Use /create_agent to create your first agent!';
    } else {
      message += `Found ${agentsData.data.length} agent(s):\n`;
      message += `You can use /get_agent <agent_id> to get the information of a specific agent.\n\n`;
      
      agentsData.data.forEach((agent, index) => {
        message += `**${index + 1}. ${agent.name || 'Unnamed Agent'}**\n`;
        message += `   • ID: \`${agent.id}\`\n`;
        if (agent.description) {
          message += `   • Description: ${agent.description}\n`;
        }
        if (agent.status) {
          message += `   • Status: ${agent.status}\n`;
        }
        if (agent.created_at) {
          const createdDate = new Date(agent.created_at).toLocaleDateString();
          message += `   • Created: ${createdDate}\n`;
        }
        message += '\n';
      });
      
      if (agentsData.has_more) {
        message += '... and more agents available.\n';
      }
    }

    // Update the loading message with the results
    bot.editMessageText(
      message,
      {
        chat_id: msg.chat.id,
        message_id: loadingMessage.message_id,
        parse_mode: 'Markdown'
      }
    );

  } catch (error) {
    console.error(`Error processing /my_agents command for user ${userId}:`, error);
    
    // Try to edit the loading message if it exists
    try {
      await bot.editMessageText(
        '❌ **Error loading your agents**\n\n' +
        'There was an error retrieving your agents. Please try again later.\n\n' +
        'If this error persists, please contact support.',
        {
          chat_id: msg.chat.id,
          message_id: loadingMessage.message_id,
          parse_mode: 'Markdown'
        }
      );
    } catch (editError) {
      // If editing fails, send a new message
      bot.sendMessage(
        msg.chat.id,
        '❌ **Error loading your agents**\n\n' +
        'There was an error retrieving your agents. Please try again later.\n\n' +
        'If this error persists, please contact support.',
        { parse_mode: 'Markdown' }
      );
    }
  }
}

/**
 * Validates if the provided agent ID matches the expected format
 * Based on the example ID: d0o1lqvd14ts73arku3g
 * @param {string} agentId - The agent ID to validate
 * @returns {boolean} True if the ID format is valid
 */
function validateAgentId(agentId) {
  // Agent ID should be alphanumeric, 20 characters long
  // Based on the example: d0o1lqvd14ts73arku3g
  const agentIdPattern = /^[a-z0-9]{20}$/;
  return agentIdPattern.test(agentId);
}

/**
 * Handles the /get_agent command to retrieve a specific agent by ID
 * This command:
 * 1. Checks if user is authenticated
 * 2. Validates the agent ID format
 * 3. Calls getAgent API to fetch the specific agent
 * 4. Displays the agent information in JSON format
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleGetAgentCommand(bot, msg) {
  const userId = msg.from.id;
  const userName = msg.from.first_name || 'User';
  console.log(`Processing /get_agent command for user ${userId}`);
  
  try {
    // Check if user is authenticated
    const authCheck = checkUserAuthentication(userId);
    
    if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
      let statusMessage = `🤖 **Get Agent**\n\n`;
      
      if (!authCheck.isAuthenticated) {
        statusMessage += `Authentication: ❌ Not authenticated\n\n`;
        statusMessage += `Use /login to authenticate with Privy first to get agent information.`;
      } else if (!authCheck.hasValidToken) {
        statusMessage += `Authentication: ❌ Access token not found or expired\n\n`;
        statusMessage += `Please re-authenticate using /login to get agent information.`;
        clearUserAuthData(userId);
      }
      
      bot.sendMessage(
        msg.chat.id,
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

    // Extract agent ID from command text
    const commandText = msg.text.trim();
    const parts = commandText.split(' ');
    
    if (parts.length < 2) {
      bot.sendMessage(
        msg.chat.id,
        `🤖 **Get Agent**\n\n` +
        `Usage: \`/get_agent <agent_id>\`\n\n` +
        `**Examples:**\n` +
        `• \`/get_agent d0o1lqvd14ts73arku3g\`\n` +
        `• \`/get_agent abc123def456ghi789j\`\n\n` +
        `**Agent ID Format:**\n` +
        `• Must be exactly 20 characters long\n` +
        `• Must contain only lowercase letters and numbers\n` +
        `• Example: \`d0o1lqvd14ts73arku3g\`\n\n` +
        `Use /my_agents to see your available agents and their IDs.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    const agentId = parts[1];
    
    // Validate agent ID format
    if (!validateAgentId(agentId)) {
      bot.sendMessage(
        msg.chat.id,
        `❌ **Invalid Agent ID Format**\n\n` +
        `The agent ID \`${agentId}\` is not valid.\n\n` +
        `**Requirements:**\n` +
        `• Must be exactly 20 characters long\n` +
        `• Must contain only lowercase letters (a-z) and numbers (0-9)\n` +
        `• No spaces, special characters, or uppercase letters\n\n` +
        `**Valid Example:** \`d0o1lqvd14ts73arku3g\`\n\n` +
        `Please check the agent ID and try again.`,
        { parse_mode: 'Markdown' }
      );
      return;
    }
    
    // Show loading message
    const loadingMessage = await bot.sendMessage(
      msg.chat.id,
      '🔄 Loading agent information...'
    );

    // Get access token
    const accessToken = getUserAccessToken(userId);
    
    // Get the specific agent
    const agentData = await getAgent({
      accessToken: accessToken,
      agentId: agentId
    });

    // Format the response with JSON display
    let message = `🤖 **Agent Information**\n\n`;
    message += `**Agent ID:** \`${agentId}\`\n\n`;
    message += `**JSON Data:**\n`;
    message += `\`\`\`json\n${JSON.stringify(agentData, null, 2)}\n\`\`\``;

    // Update the loading message with the results
    bot.editMessageText(
      message,
      {
        chat_id: msg.chat.id,
        message_id: loadingMessage.message_id,
        parse_mode: 'Markdown'
      }
    );

    console.log(`Successfully retrieved agent ${agentId} for user ${userId}`);

  } catch (error) {
    console.error(`Error processing /get_agent command for user ${userId}:`, error);
    
    // Try to edit the loading message if it exists
    try {
      await bot.editMessageText(
        '❌ **Error loading agent**\n\n' +
        'There was an error retrieving the agent information. This could be because:\n\n' +
        '• The agent ID is invalid or doesn\'t exist\n' +
        '• You don\'t have permission to access this agent\n' +
        '• There was a network error\n' +
        '• The agent service is temporarily unavailable\n\n' +
        '**Error Details:**\n' +
        `\`${error.message || 'Unknown error'}\`\n\n` +
        'Please check the agent ID and try again, or use /my_agents to see your available agents.',
        {
          chat_id: msg.chat.id,
          message_id: loadingMessage.message_id,
          parse_mode: 'Markdown'
        }
      );
    } catch (editError) {
      // If editing fails, send a new message
      bot.sendMessage(
        msg.chat.id,
        '❌ **Error loading agent**\n\n' +
        'There was an error retrieving the agent information. Please check the agent ID and try again.\n\n' +
        `**Error:** ${error.message || 'Unknown error'}`,
        { parse_mode: 'Markdown' }
      );
    }
  }
}

/**
 * Handles the /help command to display all available commands and their descriptions
 * This command provides detailed information about all bot features
 * 
 * @param {Object} bot - Telegram bot instance
 * @param {Object} msg - Telegram message object
 */
async function handleHelpCommand(bot, msg) {
  const userId = msg.from.id;
  console.log(`Processing /help command for user ${userId}`);
  
  try {
    // Create help message
    const helpMessage = createHelpMessage();
    
    bot.sendMessage(
      msg.chat.id,
      helpMessage,
      {
        parse_mode: 'HTML',
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
    console.error(`Error processing /help command for user ${userId}:`, error);
    bot.sendMessage(
      msg.chat.id,
      '❌ Sorry, there was an error displaying the help menu. Please try again later.\n\n' +
      'If this error persists, please contact support.'
    );
  }
}

module.exports = {
  handleStartCommand,
  handleLoginCommand,
  handleLogoutCommand,
  handleStatusCommand,
  handleAccessTokenCommand,
  handleCreateAgentCommand,
  handleMyAgentsCommand,
  handleGetAgentCommand,
  handleHelpCommand
};
