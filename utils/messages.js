const { MESSAGES, COMMANDS } = require('../config/constants');

/**
 * Utility functions for formatting messages
 */

/**
 * Creates welcome message with user name
 * @param {string} userName - User's first name
 * @param {Object} authCheck - Authentication check result
 * @returns {string} Formatted welcome message
 */
function createWelcomeMessage(userName, authCheck) {
  let message = MESSAGES.WELCOME.replace('{userName}', userName);
  
  if (authCheck.isAuthenticated && authCheck.hasValidToken) {
    message += MESSAGES.AUTHENTICATED;
  } else {
    message += MESSAGES.AUTH_REQUIRED;
  }
  
  message += MESSAGES.COMMANDS_HEADER;
  message += `❓ ${COMMANDS.START} - Show this help menu\n`;
  message += `🔑 ${COMMANDS.LOGIN} - Authenticate with Privy\n`;
  message += `📊 ${COMMANDS.STATUS} - Check your account status\n`;
  
  if (authCheck.isAuthenticated && authCheck.hasValidToken) {
    message += `🚪 ${COMMANDS.LOGOUT} - Log out and clear credentials\n`;
  }
  
  message += MESSAGES.QUICK_START;
  message += MESSAGES.SECURITY_NOTICE;
  
  return message;
}

/**
 * Creates help message
 * @returns {string} Formatted help message
 */
function createHelpMessage() {
  return `📋 **IntentKit Bot Commands**\n\n` +
         `🔑 **${COMMANDS.LOGIN}** - Authenticate with Privy\n` +
         `   • Links your Telegram account with Privy\n` +
         `   • Required for accessing all bot features\n\n` +
         `📊 **${COMMANDS.STATUS}** - Check your account status\n` +
         `   • Shows authentication status\n` +
         `   • Displays account information from API\n` +
         `   • Shows wallet and user details\n\n` +
         `🚪 **${COMMANDS.LOGOUT}** - Log out and clear credentials\n` +
         `   • Clears your authentication data\n` +
         `   • Removes access tokens\n` +
         `   • Available only when authenticated\n\n` +
         `❓ **${COMMANDS.START}** - Show this help menu\n` +
         `   • Displays welcome message and command list\n` +
         `   • Shows quick action buttons\n\n` +
         `💡 **Quick Tips:**\n` +
         `• Always authenticate first with ${COMMANDS.LOGIN}\n` +
         `• Use ${COMMANDS.STATUS} to verify your authentication\n` +
         `• Use ${COMMANDS.LOGOUT} to securely clear your data\n` +
         `• Your data is encrypted and securely stored\n` +
         `• Contact support if you encounter issues`;
}

/**
 * Creates status message for authenticated user
 * @param {Object} authCheck - Authentication check result
 * @param {Object} accountData - Account data from API
 * @returns {string} Formatted status message
 */
function createStatusMessage(authCheck, accountData) {
  const authStatus = '✅ Authenticated';
  const privyUserId = authCheck.userData.privyUserId ? `\nPrivy User ID: ${authCheck.userData.privyUserId}` : '';
  const lastLogin = authCheck.userData.lastLogin ? `\nLast login: ${new Date(authCheck.userData.lastLogin).toLocaleString()}` : '';
  
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
  
  return `📊 **Account Status**\n\n` +
         `Authentication: ${authStatus}${privyUserId}${lastLogin}${accountInfo}`;
}

/**
 * Creates error message based on error type
 * @param {Error} error - The error object
 * @returns {Object} { message: string, shouldClearAuth: boolean }
 */
function createErrorMessage(error) {
  let message = '❌ Sorry, there was an error fetching your account information.';
  let shouldClearAuth = false;
  
  if (error.response) {
    if (error.response.status === 401) {
      message = '❌ Authentication failed. Your token may have expired. Please re-authenticate using /login.';
      shouldClearAuth = true;
    } else if (error.response.status === 403) {
      message = '❌ Access forbidden. Please check your permissions.';
    } else {
      message = `❌ API Error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`;
    }
  } else if (error.message) {
    message = `❌ Error: ${error.message}`;
  }
  
  return { message, shouldClearAuth };
}

module.exports = {
  createWelcomeMessage,
  createHelpMessage,
  createStatusMessage,
  createErrorMessage
};
