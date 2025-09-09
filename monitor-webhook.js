#!/usr/bin/env node

/**
 * Webhook Monitor Script
 * 
 * This script monitors the webhook status and automatically resets it if needed.
 * You can run this script periodically using cron or a monitoring service.
 * 
 * Usage:
 * node monitor-webhook.js
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;
const WEBHOOK_URL = WEBHOOK_BASE_URL ? `${WEBHOOK_BASE_URL}/webhook` : null;
const SERVER_URL = WEBHOOK_BASE_URL;

if (!BOT_TOKEN || !WEBHOOK_BASE_URL) {
  console.error('❌ Missing required environment variables');
  console.log('Required: TELEGRAM_BOT_TOKEN, WEBHOOK_BASE_URL');
  process.exit(1);
}

/**
 * Check webhook health via server endpoint
 */
function checkServerHealth() {
  return new Promise((resolve, reject) => {
    const healthUrl = `${SERVER_URL}/health`;
    
    https.get(healthUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const health = JSON.parse(data);
          resolve(health);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Trigger auto-reset webhook
 */
function triggerAutoReset() {
  return new Promise((resolve, reject) => {
    const resetUrl = `${SERVER_URL}/auto-reset-webhook`;
    
    const req = https.request(resetUrl, { method: 'POST' }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.end();
  });
}

/**
 * Main monitoring function
 */
async function monitorWebhook() {
  console.log('🔍 Monitoring webhook status...');
  console.log(`Server: ${SERVER_URL}`);
  console.log(`Webhook: ${WEBHOOK_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('─'.repeat(50));
  
  try {
    // Check server health
    const health = await checkServerHealth();
    console.log(`📊 Server Status: ${health.status}`);
    console.log(`⏱️  Uptime: ${Math.floor(health.uptime)} seconds`);
    
    if (health.webhook) {
      console.log(`🔗 Webhook URL: ${health.webhook.url}`);
      console.log(`📬 Pending Updates: ${health.webhook.pending_updates}`);
      
      if (health.webhook.last_error_date) {
        console.log(`⚠️  Last Error: ${health.webhook.last_error_date}`);
        console.log(`💬 Error Message: ${health.webhook.last_error_message}`);
      }
    }
    
    // If server is unhealthy, try to reset webhook
    if (health.status === 'unhealthy') {
      console.log('\n🚨 Server is unhealthy, attempting auto-reset...');
      
      const resetResult = await triggerAutoReset();
      
      if (resetResult.reset) {
        console.log(`✅ Webhook reset successfully: ${resetResult.reason}`);
      } else {
        console.log('ℹ️  No reset needed');
      }
    } else {
      console.log('\n✅ Webhook is healthy');
    }
    
  } catch (error) {
    console.error('❌ Error monitoring webhook:', error.message);
    
    // If server is not responding, try direct webhook reset
    console.log('\n🔄 Server not responding, attempting direct webhook reset...');
    
    try {
      const resetResult = await triggerAutoReset();
      console.log('✅ Direct reset successful:', resetResult.message);
    } catch (resetError) {
      console.error('❌ Direct reset failed:', resetError.message);
      console.log('\n💡 Manual intervention may be required');
      console.log('Try running: yarn setup-webhook');
    }
  }
  
  console.log('─'.repeat(50));
  console.log('✅ Monitoring complete');
}

// Run the monitor
monitorWebhook().catch(console.error);
