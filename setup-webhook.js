#!/usr/bin/env node

/**
 * Webhook Setup Script
 * 
 * This script sets up the Telegram Bot webhook for production deployment.
 * It can be run manually or automatically after deployment.
 * 
 * Usage:
 * node setup-webhook.js           - Set webhook
 * node setup-webhook.js info      - Get webhook info
 * node setup-webhook.js delete    - Delete webhook
 */

require('dotenv').config({ path: '.env.local' });
const https = require('https');
const { URL } = require('url');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;
const WEBHOOK_URL = `${WEBHOOK_BASE_URL}/webhook`;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Make HTTPS request to Telegram API
 */
function makeRequest(endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${TELEGRAM_API_BASE}${endpoint}`);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: data ? 'POST' : 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.ok) {
            resolve(parsed.result);
          } else {
            reject(new Error(parsed.description || 'API request failed'));
          }
        } catch (error) {
          reject(error);
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

/**
 * Set webhook
 */
async function setWebhook(webhookUrl) {
  console.log('🔧 Setting up webhook...');
  console.log(`📍 Webhook URL: ${webhookUrl}`);
  
  try {
    const result = await makeRequest('/setWebhook', {
      url: webhookUrl,
      allowed_updates: ['message', 'callback_query', 'inline_query'],
      drop_pending_updates: false,
      max_connections: 40,
    });
    
    console.log('✅ Webhook set successfully!');
    console.log('📋 Result:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to set webhook:', error.message);
    throw error;
  }
}

/**
 * Get webhook info
 */
async function getWebhookInfo() {
  console.log('📊 Getting webhook information...');
  
  try {
    const result = await makeRequest('/getWebhookInfo');
    
    console.log('📋 Webhook Information:');
    console.log(`  URL: ${result.url || 'Not set'}`);
    console.log(`  Has custom certificate: ${result.has_custom_certificate}`);
    console.log(`  Pending update count: ${result.pending_update_count}`);
    console.log(`  Max connections: ${result.max_connections || 'Default (40)'}`);
    
    if (result.ip_address) {
      console.log(`  IP address: ${result.ip_address}`);
    }
    
    if (result.last_error_date) {
      const errorDate = new Date(result.last_error_date * 1000);
      console.log(`  Last error date: ${errorDate.toISOString()}`);
      console.log(`  Last error message: ${result.last_error_message}`);
    }
    
    if (result.last_synchronization_error_date) {
      const syncErrorDate = new Date(result.last_synchronization_error_date * 1000);
      console.log(`  Last sync error date: ${syncErrorDate.toISOString()}`);
    }
    
    return result;
  } catch (error) {
    console.error('❌ Failed to get webhook info:', error.message);
    throw error;
  }
}

/**
 * Delete webhook
 */
async function deleteWebhook() {
  console.log('🗑️  Deleting webhook...');
  
  try {
    const result = await makeRequest('/deleteWebhook', {
      drop_pending_updates: false
    });
    
    console.log('✅ Webhook deleted successfully!');
    console.log('📋 Result:', result);
    return result;
  } catch (error) {
    console.error('❌ Failed to delete webhook:', error.message);
    throw error;
  }
}

/**
 * Test webhook endpoint
 */
async function testWebhookEndpoint(webhookUrl) {
  console.log('🧪 Testing webhook endpoint...');
  
  try {
    const url = new URL(webhookUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const testData = JSON.stringify({
      update_id: 1,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: 1, type: 'private' },
        from: { id: 1, is_bot: false, first_name: 'Test' },
        text: '/start'
      }
    });

    return new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            console.log('✅ Webhook endpoint is responding correctly');
            resolve(true);
          } else {
            console.log(`⚠️  Webhook endpoint responded with status: ${res.statusCode}`);
            console.log('Response:', data);
            resolve(false);
          }
        });
      });
      
      req.on('error', (error) => {
        console.log('❌ Webhook endpoint test failed:', error.message);
        resolve(false);
      });
      
      req.write(testData);
      req.end();
    });
  } catch (error) {
    console.log('❌ Invalid webhook URL:', error.message);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  const command = process.argv[2] || 'set';
  
  console.log('🤖 Telegram Bot Webhook Setup');
  console.log('─'.repeat(50));
  
  try {
    switch (command.toLowerCase()) {
      case 'set':
      case 'setup':
        // Test endpoint first
        const isEndpointReady = await testWebhookEndpoint(WEBHOOK_URL);
        if (!isEndpointReady) {
          console.log('⚠️  Warning: Webhook endpoint might not be ready');
          console.log('   The webhook will still be set, but may not work immediately');
        }
        
        await setWebhook(WEBHOOK_URL);
        
        // Verify the webhook was set
        console.log('\n🔍 Verifying webhook setup...');
        const info = await getWebhookInfo();
        
        if (info.url === WEBHOOK_URL) {
          console.log('✅ Webhook verification successful!');
        } else {
          console.log('⚠️  Warning: Webhook URL mismatch');
          console.log(`   Expected: ${WEBHOOK_URL}`);
          console.log(`   Actual: ${info.url}`);
        }
        break;
        
      case 'info':
      case 'status':
        await getWebhookInfo();
        break;
        
      case 'delete':
      case 'remove':
        await deleteWebhook();
        break;
        
      case 'test':
        const testResult = await testWebhookEndpoint(WEBHOOK_URL);
        if (testResult) {
          console.log('✅ Webhook endpoint test passed');
        } else {
          console.log('❌ Webhook endpoint test failed');
          process.exit(1);
        }
        break;
        
      default:
        console.log('❓ Unknown command. Available commands:');
        console.log('   set/setup - Set webhook');
        console.log('   info/status - Get webhook info');
        console.log('   delete/remove - Delete webhook');
        console.log('   test - Test webhook endpoint');
        process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Operation failed:', error.message);
    process.exit(1);
  }
  
  console.log('─'.repeat(50));
  console.log('✅ Operation completed');
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error.message);
  process.exit(1);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled rejection:', error.message);
  process.exit(1);
});

// Run the script
main().catch(console.error);
