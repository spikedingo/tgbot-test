const express = require('express');
const router = express.Router();

/**
 * Health check and monitoring route handlers
 */

/**
 * Basic route to verify server is running
 */
function createHomeHandler() {
  return (req, res) => {
    res.send('Telegram Bot Server is running!');
  };
}

/**
 * Health check endpoint
 */
function createHealthHandler(bot) {
  return async (req, res) => {
    try {
      // Check webhook status
      const webhookInfo = await bot.getWebHookInfo();
      
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        webhook: {
          url: webhookInfo.url || 'Not set',
          pending_updates: webhookInfo.pending_update_count || 0,
          last_error_date: webhookInfo.last_error_date ? new Date(webhookInfo.last_error_date * 1000).toISOString() : null,
          last_error_message: webhookInfo.last_error_message || null
        }
      };
      
      // If there are recent errors, mark as unhealthy
      if (webhookInfo.last_error_date && (Date.now() / 1000 - webhookInfo.last_error_date) < 300) {
        health.status = 'unhealthy';
      }
      
      res.json(health);
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  };
}

/**
 * Keep-alive endpoint to prevent cold starts
 */
function createKeepAliveHandler() {
  return (req, res) => {
    res.json({
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  };
}

module.exports = {
  createHomeHandler,
  createHealthHandler,
  createKeepAliveHandler
};
