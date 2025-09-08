#!/usr/bin/env node

/**
 * Post-Deployment Script
 * 
 * This script runs after deployment to automatically set up the webhook.
 * It's designed to be called by Railway's post-deployment hooks or CI/CD pipelines.
 */

require('dotenv').config({ path: '.env.local' });

const { execSync } = require('child_process');

console.log('🚀 Post-deployment setup starting...');
console.log('─'.repeat(50));

// Wait a moment for the server to be fully ready
console.log('⏳ Waiting for server to be ready...');
setTimeout(async () => {
  try {
    // Run the webhook setup script
    console.log('🔧 Setting up webhook...');
    execSync('node setup-webhook.js', { stdio: 'inherit' });
    
    console.log('✅ Post-deployment setup completed successfully!');
  } catch (error) {
    console.error('❌ Post-deployment setup failed:', error.message);
    console.log('💡 You can manually set the webhook later using: yarn setup-webhook');
    // Don't exit with error code to avoid failing the deployment
  }
}, 5000); // Wait 5 seconds
