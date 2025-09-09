const crypto = require('crypto');

/**
 * Encryption utility functions for sensitive data like privyAccessToken
 * Uses AES-256-GCM encryption for secure token storage
 */

// Get encryption key from environment variables
const ENCRYPTION_KEY = 'intentkit_secret_default_key_32_bytes';
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a string using AES-256-GCM
 * @param {string} text - The text to encrypt
 * @returns {string} - Base64 encoded encrypted data with IV and auth tag
 */
function encrypt(text) {
  try {
    // Generate a random initialization vector
    const iv = crypto.randomBytes(16);
    
    // Create a 32-byte key from the encryption key
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    
    // Create cipher with proper GCM mode
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    // Encrypt the text
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag
    const authTag = cipher.getAuthTag();
    
    // Combine IV, auth tag, and encrypted data
    const combined = iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    
    // Return base64 encoded result
    return Buffer.from(combined).toString('base64');
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypts a string using AES-256-GCM
 * @param {string} encryptedData - Base64 encoded encrypted data
 * @returns {string} - Decrypted text
 */
function decrypt(encryptedData) {
  try {
    // Decode base64
    const combined = Buffer.from(encryptedData, 'base64').toString();
    
    // Split the combined data
    const parts = combined.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    // Create a 32-byte key from the encryption key
    const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();
    
    // Create decipher with proper GCM mode
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    // Set authentication tag
    decipher.setAuthTag(authTag);
    
    // Decrypt the data
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Encrypts a privyAccessToken for secure storage
 * @param {string} accessToken - The Privy access token to encrypt
 * @returns {string} - Encrypted token
 */
function encryptPrivyAccessToken(accessToken) {
  if (!accessToken) {
    throw new Error('Access token is required for encryption');
  }
  return encrypt(accessToken);
}

/**
 * Decrypts a privyAccessToken from secure storage
 * @param {string} encryptedToken - The encrypted token
 * @returns {string} - Decrypted access token
 */
function decryptPrivyAccessToken(encryptedToken) {
  if (!encryptedToken) {
    throw new Error('Encrypted token is required for decryption');
  }
  return decrypt(encryptedToken);
}

/**
 * Validates if a string is a valid encrypted token format
 * @param {string} token - The token to validate
 * @returns {boolean} - True if valid encrypted format
 */
function isValidEncryptedToken(token) {
  try {
    if (!token || typeof token !== 'string') {
      return false;
    }
    
    // Try to decode and check format
    const combined = Buffer.from(token, 'base64').toString();
    const parts = combined.split(':');
    
    return parts.length === 3 && 
           parts[0].length === 32 && // IV should be 16 bytes = 32 hex chars
           parts[1].length === 32 && // Auth tag should be 16 bytes = 32 hex chars
           parts[2].length > 0;      // Encrypted data should exist
  } catch (error) {
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  encryptPrivyAccessToken,
  decryptPrivyAccessToken,
  isValidEncryptedToken
};
