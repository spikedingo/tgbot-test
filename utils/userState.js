/**
 * Simple in-memory user state management for agent creation flow
 * This tracks when users are in the middle of creating an agent
 */

// Simple in-memory state management for agent creation
const userStates = new Map();

/**
 * Set user state for a specific user
 * @param {string} userId - Telegram user ID
 * @param {string} state - State value (e.g., 'awaiting_agent_prompt')
 */
function setUserState(userId, state) {
  userStates.set(userId, state);
  console.log(`Set user ${userId} state to: ${state}`);
}

/**
 * Get current user state
 * @param {string} userId - Telegram user ID
 * @returns {string|null} Current state or null if no state set
 */
function getUserState(userId) {
  return userStates.get(userId) || null;
}

/**
 * Clear user state
 * @param {string} userId - Telegram user ID
 */
function clearUserState(userId) {
  const hadState = userStates.has(userId);
  userStates.delete(userId);
  if (hadState) {
    console.log(`Cleared state for user ${userId}`);
  }
}

/**
 * Check if user is in a specific state
 * @param {string} userId - Telegram user ID
 * @param {string} state - State to check for
 * @returns {boolean} True if user is in the specified state
 */
function isUserInState(userId, state) {
  return getUserState(userId) === state;
}

module.exports = {
  setUserState,
  getUserState,
  clearUserState,
  isUserInState
};
