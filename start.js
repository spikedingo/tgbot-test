#!/usr/bin/env node

/**
 * Railway Startup Script
 * 
 * This script starts the server and sets up webhooks after ensuring
 * the server is fully ready and accessible.
 */

const { spawn } = require('child_process');
const https = require('https');

console.log('🚀 Starting Railway deployment...');
console.log('─'.repeat(50));

// Start the main application
const serverProcess = spawn('node', ['index.js'], {
  stdio: 'inherit',
  env: process.env
});

// Wait for server to be ready, then set webhook
setTimeout(async () => {
  if (process.env.NODE_ENV === 'production' && process.env.WEBHOOK_BASE_URL) {
    console.log('⏳ Waiting for server to be fully ready...');
    
    // Test if server is responding
    const isServerReady = await waitForServer();
    
    if (isServerReady) {
      console.log('🔧 Setting up webhook...');
      try {
        await setupWebhook();
      } catch (error) {
        console.error('❌ Webhook setup failed:', error.message);
        console.log('💡 You can manually set the webhook using: yarn setup-webhook');
      }
    } else {
      console.log('⚠️  Server not ready, skipping automatic webhook setup');
      console.log('💡 You can manually set the webhook using: yarn setup-webhook');
    }
  }
}, 10000); // Wait 10 seconds

/**
 * Wait for server to be ready
 */
async function waitForServer(maxAttempts = 10) {
  const port = process.env.PORT || 3001;
  const testUrl = `http://localhost:${port}/health`;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await new Promise((resolve, reject) => {
        const req = https.get(testUrl.replace('https:', 'http:'), { timeout: 5000 }, (res) => {
          if (res.statusCode === 200) {
            resolve();
          } else {
            reject(new Error(`Server responded with status ${res.statusCode}`));
          }
        });
        
        req.on('error', reject);
        req.on('timeout', () => {
          req.destroy();
          reject(new Error('Request timeout'));
        });
      });
      
      console.log('✅ Server is ready!');
      return true;
    } catch (error) {
      console.log(`⏳ Attempt ${attempt}/${maxAttempts}: Server not ready yet...`);
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }
  
  return false;
}

/**
 * Setup webhook using external endpoint
 */
async function setupWebhook() {
  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/webhook`;
  const setupUrl = `${process.env.WEBHOOK_BASE_URL}/set-webhook`;
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ webhook_url: webhookUrl });
    
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(setupUrl, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Webhook set successfully!');
          resolve();
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Handle process termination
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  serverProcess.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  serverProcess.kill('SIGINT');
});

serverProcess.on('exit', (code) => {
  console.log(`📊 Server process exited with code ${code}`);
  process.exit(code);
});
