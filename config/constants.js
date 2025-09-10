/**
 * Application constants and configuration
 */

const COMMANDS = {
  START: '/start',
  LOGIN: '/login',
  STATUS: '/status',
  LOGOUT: '/logout',
  ACCESS_TOKEN: '/accessToken',
  CREATE_AGENT: '/create_agent',
  MY_AGENTS: '/my_agents',
  GET_AGENT: '/get_agent'
};

const CALLBACK_DATA = {
  LOGIN_COMPLETE: 'login_complete_',
  REAUTH_REQUEST: 'reauth_request',
  SHOW_HELP: 'show_help',
  BACK_TO_START: 'back_to_start',
  LOGOUT_USER: 'logout_user',
  CHECK_STATUS: 'check_status',
  GET_ACCESS_TOKEN: 'get_access_token',
  CREATE_AGENT: 'create_agent',
  CANCEL_AGENT_CREATION: 'cancel_agent_creation'
};

const MESSAGES = {
  WELCOME: '👋 **Welcome to IntentKit Bot, {userName}!**\n\n' +
           'This bot helps you manage your Solana trading activities with secure authentication.\n\n',
  AUTHENTICATED: '✅ **You are currently authenticated**\n\n',
  AUTH_REQUIRED: '🔐 **Authentication required** to access all features\n\n',
  COMMANDS_HEADER: '📋 **Available Commands:**\n\n',
  QUICK_START: '💡 **Quick Start:**\n' +
               '1. Use /login to authenticate with Privy\n' +
               '2. Use /status to check your account information\n' +
               '3. Access your trading features with secure authentication\n\n',
  SECURITY_NOTICE: '🔒 **Security:** Your authentication data is encrypted and securely stored.'
};

const KEYBOARD_BUTTONS = {
  LOGIN: '🔑 Login with Privy',
  CHECK_STATUS: '📊 Check Status',
  LOGOUT: '🚪 Logout',
  HELP: '❓ Help',
  GET_ACCESS_TOKEN: '🎫 Get Access Token',
  REAUTHENTICATE: '🔄 Re-authenticate',
  MAIN_MENU: '🏠 Main Menu',
  LOGIN_AGAIN: '🔑 Login Again',
  CREATE_AGENT: '🤖 Create Agent',
  CANCEL: '❌ Cancel'
};

module.exports = {
  COMMANDS,
  CALLBACK_DATA,
  MESSAGES,
  KEYBOARD_BUTTONS
};
