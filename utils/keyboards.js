const { generateLoginUrl } = require('../config/bot');
const { KEYBOARD_BUTTONS, CALLBACK_DATA } = require('../config/constants');

/**
 * Utility functions for creating inline keyboards
 */

/**
 * Creates main menu keyboard based on authentication status
 * @param {Object} authCheck - Authentication check result
 * @param {string} userId - Telegram user ID
 * @returns {Array} Inline keyboard array
 */
function createMainMenuKeyboard(authCheck, userId) {
  const keyboard = [];
  
  if (!authCheck.isAuthenticated || !authCheck.hasValidToken) {
    const loginUrl = generateLoginUrl(userId);
    keyboard.push([
      {
        text: KEYBOARD_BUTTONS.LOGIN,
        login_url: {
          url: loginUrl,
          forward_text: 'Login to IntentKit'
        }
      }
    ]);
  } else {
    keyboard.push([
      {
        text: KEYBOARD_BUTTONS.CHECK_STATUS,
        callback_data: CALLBACK_DATA.CHECK_STATUS
      }
    ]);
    keyboard.push([
      {
        text: KEYBOARD_BUTTONS.LOGOUT,
        callback_data: CALLBACK_DATA.LOGOUT_USER
      }
    ]);
  }
  
  keyboard.push([
    {
      text: KEYBOARD_BUTTONS.HELP,
      callback_data: CALLBACK_DATA.SHOW_HELP
    }
  ]);
  
  return keyboard;
}

/**
 * Creates authenticated user keyboard
 * @param {string} userId - Telegram user ID
 * @returns {Array} Inline keyboard array
 */
function createAuthenticatedKeyboard(userId) {
  return [
    [
      {
        text: KEYBOARD_BUTTONS.CHECK_STATUS,
        callback_data: CALLBACK_DATA.CHECK_STATUS
      }
    ],
    [
      {
        text: KEYBOARD_BUTTONS.GET_ACCESS_TOKEN,
        callback_data: CALLBACK_DATA.GET_ACCESS_TOKEN
      }
    ],
    [
      {
        text: KEYBOARD_BUTTONS.LOGOUT,
        callback_data: CALLBACK_DATA.LOGOUT_USER
      }
    ],
    [
      {
        text: KEYBOARD_BUTTONS.HELP,
        callback_data: CALLBACK_DATA.SHOW_HELP
      }
    ]
  ];
}

/**
 * Creates login keyboard
 * @param {string} userId - Telegram user ID
 * @returns {Array} Inline keyboard array
 */
function createLoginKeyboard(userId) {
  const loginUrl = generateLoginUrl(userId);
  
  return [
    [
      {
        text: KEYBOARD_BUTTONS.LOGIN,
        login_url: {
          url: loginUrl,
          forward_text: 'Login to IntentKit'
        }
      }
    ]
  ];
}

/**
 * Creates re-authentication keyboard
 * @param {string} userId - Telegram user ID
 * @returns {Array} Inline keyboard array
 */
function createReauthKeyboard(userId) {
  return [
    [
      {
        text: KEYBOARD_BUTTONS.REAUTHENTICATE,
        callback_data: CALLBACK_DATA.REAUTH_REQUEST
      }
    ]
  ];
}

/**
 * Creates logout confirmation keyboard
 * @param {string} userId - Telegram user ID
 * @returns {Array} Inline keyboard array
 */
function createLogoutKeyboard(userId) {
  const loginUrl = generateLoginUrl(userId);
  
  return [
    [
      {
        text: KEYBOARD_BUTTONS.LOGIN_AGAIN,
        login_url: {
          url: loginUrl,
          forward_text: 'Login to IntentKit'
        }
      }
    ],
    [
      {
        text: KEYBOARD_BUTTONS.MAIN_MENU,
        callback_data: CALLBACK_DATA.BACK_TO_START
      }
    ]
  ];
}

module.exports = {
  createMainMenuKeyboard,
  createAuthenticatedKeyboard,
  createLoginKeyboard,
  createReauthKeyboard,
  createLogoutKeyboard
};
