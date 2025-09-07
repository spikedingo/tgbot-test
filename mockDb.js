const fs = require('fs');
const path = require('path');

/**
 * MOCK DATABASE IMPLEMENTATION
 * 
 * This starter repo uses a simple JSON file to mock a database for simplicity.
 * In a production environment, you should replace this with a proper database or other user management system.
 * 
 * This mock database stores user data including wallet mappings and authentication status.
 * The data structure is: 
 * { 
 *   telegramUserId: {
 *     walletId: string,
 *     isAuthenticated: boolean,
 *     privyUserId: string,
 *     privyAccessToken: string (encrypted),
 *     lastLogin: timestamp
 *   }
 * }
 * This is a simple implementation for demonstration purposes only.
 */

// Define the path for the user data file
const userDataPath = path.join(__dirname, 'wallet-mappings.json');

/**
 * Retrieves all user data from the mock database
 * @returns {Object} Map of Telegram user IDs to user data objects
 */
function getAllUserData() {
  try {
    if (fs.existsSync(userDataPath)) {
      const data = fs.readFileSync(userDataPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error reading user data:', error);
  }
  return {};
}

/**
 * Saves all user data to the mock database
 * @param {Object} userData - Map of Telegram user IDs to user data objects
 */
function saveAllUserData(userData) {
  try {
    fs.writeFileSync(userDataPath, JSON.stringify(userData, null, 2));
  } catch (error) {
    console.error('Error saving user data:', error);
  }
}

/**
 * Updates user authentication status in the mock database
 * @param {string} userId - Telegram user ID
 * @param {boolean} isAuthenticated - Authentication status
 * @param {string} privyUserId - Privy user ID (optional)
 * @param {string} encryptedAccessToken - Encrypted Privy access token (optional)
 */
function updateUserAuthStatus(userId, isAuthenticated, privyUserId = null, encryptedAccessToken = null) {
  try {
    // Load existing user data
    const userData = getAllUserData();
    
    // Initialize user data if it doesn't exist
    if (!userData[userId]) {
      userData[userId] = {};
    }
    
    // Update authentication status
    userData[userId].isAuthenticated = isAuthenticated;
    userData[userId].lastLogin = new Date().toISOString();
    
    if (privyUserId) {
      userData[userId].privyUserId = privyUserId;
    }
    
    if (encryptedAccessToken) {
      userData[userId].privyAccessToken = encryptedAccessToken;
    }
    
    // Save the updated data
    saveAllUserData(userData);
    
    console.log(`Updated auth status for user ${userId}: authenticated=${isAuthenticated}, hasAccessToken=${!!encryptedAccessToken}`);
  } catch (error) {
    console.error(`Error updating auth status for user ${userId}:`, error);
  }
}

/**
 * Retrieves user authentication status from the mock database
 * @param {string} userId - Telegram user ID
 * @returns {Object|null} User data object or null if not found
 */
function getUserAuthStatus(userId) {
  try {
    const userData = getAllUserData();
    return userData[userId] || null;
  } catch (error) {
    console.error(`Error getting auth status for user ${userId}:`, error);
    return null;
  }
}

/**
 * Retrieves and decrypts the Privy access token for a user
 * @param {string} userId - Telegram user ID
 * @returns {string|null} Decrypted access token or null if not found/error
 */
function getUserAccessToken(userId) {
  try {
    const userData = getUserAuthStatus(userId);
    if (!userData || !userData.privyAccessToken) {
      return null;
    }
    
    // Import decryption function
    const { decryptPrivyAccessToken } = require('./cryptoUtils');
    
    // Decrypt the access token
    return decryptPrivyAccessToken(userData.privyAccessToken);
  } catch (error) {
    console.error(`Error getting access token for user ${userId}:`, error);
    return null;
  }
}

/**
 * Clears user authentication data (token and authentication status)
 * This is used when tokens expire or authentication fails
 * @param {string} userId - Telegram user ID
 */
function clearUserAuthData(userId) {
  try {
    // Load existing user data
    const userData = getAllUserData();
    
    if (userData[userId]) {
      // Clear authentication-related data but keep other user data
      userData[userId].isAuthenticated = false;
      userData[userId].privyAccessToken = null;
      // Keep privyUserId and lastLogin for reference
      
      // Save the updated data
      saveAllUserData(userData);
      
      console.log(`Cleared authentication data for user ${userId} due to token expiration or API failure`);
    }
  } catch (error) {
    console.error(`Error clearing auth data for user ${userId}:`, error);
  }
}

module.exports = {
  updateUserAuthStatus,
  getUserAuthStatus,
  getUserAccessToken,
  clearUserAuthData,
  getAllUserData,
  saveAllUserData
}; 