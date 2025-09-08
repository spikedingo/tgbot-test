# Webhook Mode Deployment Guide

This guide explains how to deploy the Telegram bot using webhook mode instead of polling mode.

## Overview

The bot has been converted from polling mode to webhook mode for better performance and reliability in production environments.

## Key Changes Made

### 1. Bot Configuration
- Changed from `polling: true` to `webHook: true` in bot initialization
- Removed polling-specific configurations
- Added automatic webhook setup on server startup

### 2. Environment Variables
- `USE_POLLING=false` (webhook mode)
- `WEBHOOK_URL=https://tgbot-test-production.up.railway.app/webhook` (your webhook endpoint)
- `NODE_ENV=production` (enables auto-webhook setup)

### 3. New Scripts and Tools
- `setup-webhook.js` - Automated webhook setup script
- `post-deploy.js` - Post-deployment webhook configuration
- Enhanced monitoring with `monitor-webhook.js`

## Deployment Process

### Automatic Deployment (Recommended)

1. **Deploy to Railway:**
   ```bash
   yarn railway:deploy
   ```
   This will deploy the app and automatically set up the webhook.

2. **Verify Webhook:**
   ```bash
   yarn webhook-info
   ```

### Manual Deployment Steps

1. **Set Environment Variables in Railway:**
   - `TELEGRAM_BOT_TOKEN` - Your bot token
   - `NODE_ENV=production`
   - `USE_POLLING=false`
   - `WEBHOOK_URL=https://tgbot-test-production.up.railway.app/webhook`
   - Other required variables (PRIVY_APP_ID, ENCRYPTION_KEY, etc.)

2. **Deploy the Application:**
   ```bash
   railway up
   ```

3. **Set Up Webhook (if not automatic):**
   ```bash
   yarn setup-webhook
   ```

## Webhook Management Commands

### Setup Webhook
```bash
yarn setup-webhook
# or
node setup-webhook.js
```

### Check Webhook Status
```bash
yarn webhook-info
# or
node setup-webhook.js info
```

### Test Webhook Endpoint
```bash
yarn webhook-test
# or
node setup-webhook.js test
```

### Delete Webhook
```bash
yarn delete-webhook
# or
node setup-webhook.js delete
```

### Monitor Webhook Health
```bash
yarn monitor-webhook
# or
node monitor-webhook.js
```

## Webhook Endpoints

The bot exposes several webhook-related endpoints:

- `POST /webhook` - Main Telegram webhook endpoint
- `GET /health` - Health check with webhook status
- `GET /webhook-status` - Detailed webhook information
- `POST /set-webhook` - Manual webhook setup
- `POST /auto-reset-webhook` - Automatic webhook reset
- `GET /keep-alive` - Keep-alive endpoint

## Troubleshooting

### Webhook Not Working
1. Check webhook status:
   ```bash
   yarn webhook-info
   ```

2. Test the webhook endpoint:
   ```bash
   yarn webhook-test
   ```

3. Check server logs:
   ```bash
   yarn railway:logs
   ```

4. Reset webhook:
   ```bash
   yarn setup-webhook
   ```

### Common Issues

**Issue: Webhook URL not accessible**
- Ensure your Railway app is deployed and accessible
- Check that the URL matches your actual deployment URL
- Verify SSL certificate is valid

**Issue: Bot not responding to messages**
- Check webhook status with `yarn webhook-info`
- Look for error messages in Railway logs
- Verify bot token is correct

**Issue: Webhook setup fails during deployment**
- The server might not be ready immediately after deployment
- Wait a few minutes and run `yarn setup-webhook` manually
- Check environment variables are set correctly

## Environment Variables Reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from BotFather | `1234567890:ABC...` |
| `WEBHOOK_URL` | Yes | Full webhook URL | `https://your-app.railway.app/webhook` |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `USE_POLLING` | No | Force polling mode | `false` |
| `WEBHOOK_SECRET` | No | Webhook secret token | `random_secret` |
| `PRIVY_APP_ID` | Yes | Privy application ID | `your_privy_app_id` |
| `PRIVY_APP_SECRET` | Yes | Privy application secret | `your_secret` |
| `ENCRYPTION_KEY` | Yes | 32-byte encryption key | `32_byte_hex_key` |

## Monitoring

The bot includes built-in webhook monitoring:

1. **Health Check Endpoint:** `GET /health`
   - Returns webhook status and health information
   - Includes pending updates count and error information

2. **Automatic Reset:** `POST /auto-reset-webhook`
   - Automatically resets webhook if issues are detected
   - Called by monitoring scripts

3. **Manual Monitoring:** `yarn monitor-webhook`
   - Run this periodically to check webhook health
   - Can be set up as a cron job for continuous monitoring

## Security Considerations

1. **HTTPS Required:** Telegram requires HTTPS for webhooks
2. **Secret Token:** Consider setting `WEBHOOK_SECRET` for additional security
3. **IP Filtering:** Railway automatically provides HTTPS and proper SSL
4. **Error Handling:** The bot includes comprehensive error handling for webhook failures

## Benefits of Webhook Mode

1. **Better Performance:** No continuous polling, reduces server load
2. **Real-time Updates:** Immediate message processing
3. **Scalability:** Better suited for high-traffic bots
4. **Resource Efficiency:** Lower bandwidth and CPU usage
5. **Reliability:** Built-in retry mechanisms and error handling

## Rollback to Polling Mode

If you need to rollback to polling mode:

1. Set environment variable: `USE_POLLING=true`
2. Redeploy the application
3. The bot will automatically delete the webhook and start polling

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Railway logs for error messages
3. Use the webhook monitoring tools to diagnose issues
4. Ensure all environment variables are correctly set
