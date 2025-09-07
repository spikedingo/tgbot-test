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
 * Retrieves all user-wallet relationships from the mock database (backward compatibility)
 * @returns {Object} Map of Telegram user IDs to Privy wallet IDs
 */
function getAllUserWallets() {
  const userData = getAllUserData();
  const walletMappings = {};
  
  // Convert new format to old format for backward compatibility
  for (const [userId, data] of Object.entries(userData)) {
    if (data.walletId) {
      walletMappings[userId] = data.walletId;
    }
  }
  
  return walletMappings;
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
 * Saves all user-wallet relationships to the mock database (backward compatibility)
 * @param {Object} userWallets - Map of Telegram user IDs to Privy wallet IDs
 */
function saveAllUserWallets(userWallets) {
  try {
    const userData = getAllUserData();
    
    // Update wallet IDs while preserving other user data
    for (const [userId, walletId] of Object.entries(userWallets)) {
      if (!userData[userId]) {
        userData[userId] = {};
      }
      userData[userId].walletId = walletId;
    }
    
    saveAllUserData(userData);
  } catch (error) {
    console.error('Error saving user-wallet mappings:', error);
  }
}

/**
 * Saves a single user-wallet relationship to the mock database
 * This is more efficient than loading and saving the entire mapping when only updating one user
 * @param {string} userId - Telegram user ID
 * @param {string} walletId - Privy wallet ID
 */
function saveUserWallet(userId, walletId) {
  try {
    // Load existing user data
    const userData = getAllUserData();
    
    // Initialize user data if it doesn't exist
    if (!userData[userId]) {
      userData[userId] = {};
    }
    
    // Update the specific user's wallet
    userData[userId].walletId = walletId;
    
    // Save the updated data
    saveAllUserData(userData);
  } catch (error) {
    console.error(`Error saving wallet for user ${userId}:`, error);
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

module.exports = {
  getAllUserWallets,
  saveAllUserWallets,
  saveUserWallet,
  updateUserAuthStatus,
  getUserAuthStatus,
  getUserAccessToken,
  getAllUserData,
  saveAllUserData
}; 