const express = require('express');
const router = express.Router();

/**
 * Webhook route handlers
 */

/**
 * Webhook endpoint for Telegram
 */
function createWebhookHandler(bot) {
  return (req, res) => {
    try {
      console.log('Received webhook update:', JSON.stringify(req.body, null, 2));
      
      // Validate webhook data
      if (!req.body || typeof req.body !== 'object') {
        console.error('Invalid webhook data received');
        return res.status(400).json({ error: 'Invalid webhook data' });
      }
      
      // Process the update
      bot.processUpdate(req.body);
      
      // Log successful processing
      console.log('Webhook processed successfully at:', new Date().toISOString());
      res.status(200).json({ status: 'ok', timestamp: Date.now() });
      
    } catch (error) {
      console.error('Error processing webhook:', error);
      console.error('Request body:', req.body);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

/**
 * Webhook status endpoint
 */
function createWebhookStatusHandler(bot) {
  return async (req, res) => {
    try {
      const webhookInfo = await bot.getWebHookInfo();
      res.json({
        success: true,
        webhook_info: webhookInfo
      });
    } catch (error) {
      console.error('Error getting webhook status:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
}

/**
 * Set webhook endpoint
 */
function createSetWebhookHandler(bot) {
  return async (req, res) => {
    try {
      const webhookUrl = process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/webhook` : `https://${req.get('host')}/webhook`;
      await bot.setWebHook(webhookUrl, {
        allowed_updates: ['message', 'callback_query', 'inline_query'],
        drop_pending_updates: false
      });
      console.log(`Webhook set to ${webhookUrl} at ${new Date().toISOString()}`);
      res.json({ success: true, message: `Webhook set to ${webhookUrl}` });
    } catch (error) {
      console.error('Error setting webhook:', error);
      res.status(500).json({ error: 'Failed to set webhook' });
    }
  };
}

/**
 * Auto-reset webhook endpoint (for monitoring services)
 */
function createAutoResetWebhookHandler(bot) {
  return async (req, res) => {
    try {
      // Check if webhook needs to be reset
      const webhookInfo = await bot.getWebHookInfo();
      const expectedUrl = process.env.WEBHOOK_BASE_URL ? `${process.env.WEBHOOK_BASE_URL}/webhook` : `https://${req.get('host')}/webhook`;
      
      let needsReset = false;
      let reason = '';
      
      // Check if webhook URL is different
      if (webhookInfo.url !== expectedUrl) {
        needsReset = true;
        reason = 'URL mismatch';
      }
      
      // Check if there are recent errors (within last 5 minutes)
      if (webhookInfo.last_error_date && (Date.now() / 1000 - webhookInfo.last_error_date) < 300) {
        needsReset = true;
        reason = 'Recent errors detected';
      }
      
      // Check if there are too many pending updates
      if (webhookInfo.pending_update_count > 10) {
        needsReset = true;
        reason = 'Too many pending updates';
      }
      
      if (needsReset) {
        await bot.setWebHook(expectedUrl, {
          allowed_updates: ['message', 'callback_query', 'inline_query'],
          drop_pending_updates: true
        });
        console.log(`Webhook auto-reset: ${reason} at ${new Date().toISOString()}`);
        res.json({ 
          success: true, 
          reset: true, 
          reason: reason,
          message: `Webhook reset to ${expectedUrl}` 
        });
      } else {
        res.json({ 
          success: true, 
          reset: false, 
          message: 'Webhook is healthy, no reset needed' 
        });
      }
    } catch (error) {
      console.error('Error in auto-reset webhook:', error);
      res.status(500).json({ error: 'Failed to check/reset webhook' });
    }
  };
}

module.exports = {
  createWebhookHandler,
  createWebhookStatusHandler,
  createSetWebhookHandler,
  createAutoResetWebhookHandler
};
