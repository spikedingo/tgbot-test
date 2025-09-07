const { Configuration, CreditApi } = require('@crestal/nation-sdk');

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
      basePath: 'https://nation.service.crestal.dev',
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
      basePath: 'https://nation.service.crestal.dev',
      accessToken: accessToken
    });
    const creditApi = new CreditApi(configuration);
    const { data } = await creditApi.getUserAccount();

    return data;
  } catch (err) {
    throw err;
  }
};

module.exports = {
  getCreditExpenseHistory,
  getUserAccount
};
