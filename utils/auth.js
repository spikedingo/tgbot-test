const { getUserAuthStatus, getUserAccessToken, clearUserAuthData } = require('../mockDb');

/**
 * Authentication utility functions
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
 * Clears user authentication data if token is invalid
 * @param {string} userId - Telegram user ID
 * @param {boolean} shouldClear - Whether to clear the data
 */
function handleInvalidToken(userId, shouldClear = false) {
  if (shouldClear) {
    clearUserAuthData(userId);
    console.log(`Cleared authentication data for user ${userId} due to invalid token`);
  }
}

module.exports = {
  checkUserAuthentication,
  handleInvalidToken
};
