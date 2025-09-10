const { Configuration, CreditApi, GeneratorApi, AgentApi, UserApi } = require('@crestal/nation-sdk');
const axios = require('axios');

/**
 * Parameters for credit expense history
 * @typedef {Object} CreditExpenseHistoryParams
 * @property {string} accessToken - The access token for authentication
 * @property {string} [cursor] - Optional cursor for pagination
 */

/**
 * Get credit expense history for a user
 * @param {CreditExpenseHistoryParams} params - The parameters for the API call
 * @returns {Promise<Object>} The credit expense history data
 */
const getCreditExpenseHistory = async (params) => {
  try {
    const configuration = new Configuration({
      basePath: process.env.NATION_SERVICE_URL,
      accessToken: params.accessToken
    });
    const creditApi = new CreditApi(configuration);
    const { data } = await creditApi.listUserEvents(undefined, 'expense', params.cursor);

    if (Object.keys(data).length > 0) {
      return data;
    }

    return {
      data: [],
      next_cursor: '',
      has_more: false
    };
  } catch (err) {
    throw err;
  }
};

/**
 * Get user account information
 * @param {string} accessToken - The access token for authentication
 * @returns {Promise<Object>} The user account data
 */
const getUserAccount = async (accessToken) => {
  try {
    const configuration = new Configuration({
      basePath: process.env.NATION_SERVICE_URL,
      accessToken: accessToken
    });
    const creditApi = new CreditApi(configuration);
    const { data } = await creditApi.getUserAccount();

    return data;
  } catch (err) {
    throw err;
  }
};

/**
 * Generate agent from natural language prompt
 * @param {Object} params - The parameters for agent generation
 * @param {string} params.accessToken - The access token for authentication
 * @param {string} params.prompt - Natural language description of the agent
 * @param {string} params.userId - User ID for logging and rate limiting
 * @param {Object|null} params.existingAgent - Optional existing agent to update
 * @param {string|null} params.projectId - Optional project ID for conversation history
 * @param {boolean} params.deploy - Whether to deploy the agent after generation
 * @returns {Promise<Object>} The agent generation response
 */
const generateAgent = async (params) => {
  try {
    const requestBody = {
      prompt: params.prompt,
      user_id: params.userId,
      existing_agent: params.existingAgent || null,
      project_id: params.projectId || null,
      deploy: params.deploy || false
    };
    const configuration = new Configuration({
      basePath: process.env.NATION_SERVICE_URL,
      accessToken: params.accessToken
    });

    const generatorApi = new GeneratorApi(configuration);

    const {data} = await generatorApi.generateAgent(requestBody);

    return data;
  } catch (err) {
    throw err;
  }
};

/**
 * Create agent using generated configuration
 * @param {Object} params - The parameters for agent creation
 * @param {string} params.accessToken - The access token for authentication
 * @param {Object} params.agent - Agent configuration object
 * @returns {Promise<Object>} The created agent data
 */
const createAgent = async (params) => {
  try {
    const configuration = new Configuration({
      basePath: process.env.NATION_SERVICE_URL,
      accessToken: params.accessToken
    });
    const agentApi = new AgentApi(configuration);
    const {data} = await agentApi.createAgent(params.agent);
    return data;
  } catch (err) {
    throw err;
  }
};

/**
 * Get user's agents
 * @param {Object} params - The parameters for the API call
 * @param {string} params.accessToken - The access token for authentication
 * @param {string} [params.cursor] - Optional cursor for pagination
 * @param {number} [params.limit] - Optional limit for number of results
 * @returns {Promise<Object>} The user's agents data
 */
const getUserAgents = async (params) => {
  try {
    const configuration = new Configuration({
      basePath: process.env.NATION_SERVICE_URL,
      accessToken: params.accessToken
    });
    const userApi = new UserApi(configuration);
    const {data} = await userApi.getUserAgents(params.cursor, params.limit);
    return data;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  getCreditExpenseHistory,
  getUserAccount,
  generateAgent,
  createAgent,
  getUserAgents
};
