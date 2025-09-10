const express = require('express');
const { updateUserAuthStatus } = require('../mockDb');
const { encryptPrivyAccessToken, isValidEncryptedToken } = require('../cryptoUtils');
const router = express.Router();

/**
 * Authentication route handlers
 */

/**
 * Webhook endpoint to handle authentication callbacks from Privy
 * This endpoint is called by the web application when a user completes authentication
 * 
 * POST /auth/callback
 * Body: { telegramUserId: string, privyUserId: string, isAuthenticated: boolean, privyAccessToken: string }
 */
function createAuthCallbackHandler(bot) {
  return async (req, res) => {
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
  };
}

module.exports = {
  createAuthCallbackHandler
};
