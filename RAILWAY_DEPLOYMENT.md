# Railway Deployment Guide

This guide explains how to deploy your Telegram bot to Railway with polling mode instead of webhooks.

## Prerequisites

1. [Railway Account](https://railway.app/)
2. [Railway CLI](https://docs.railway.app/develop/cli) installed
3. Your Telegram Bot Token from [@BotFather](https://t.me/botfather)

## Configuration Changes Made

### 1. Bot Configuration
- Modified `index.js` to support both polling and webhook modes
- Added `USE_POLLING` environment variable to control bot mode
- Implemented graceful shutdown for Railway deployment

### 2. Railway Configuration Files
- `railway.json`: Railway deployment configuration
- `nixpacks.toml`: Build configuration for Node.js
- `Procfile`: Process definition for Railway

### 3. Environment Variables
Updated `env.example` with Railway-specific configuration:
- `USE_POLLING=true`: Enables polling mode
- `PORT`: Automatically provided by Railway
- `NODE_ENV=production`: Production environment

## Deployment Steps

### Option 1: Deploy via Railway Dashboard

1. **Connect Repository**
   - Go to [Railway Dashboard](https://railway.app/dashboard)
   - Click "New Project"
   - Connect your GitHub repository
   - Select this repository

2. **Configure Environment Variables**
   Set the following variables in Railway dashboard:
   ```
   TELEGRAM_BOT_TOKEN=your_actual_bot_token
   USE_POLLING=true
   NODE_ENV=production
   WEB_APP_URL=https://your-web-app.vercel.app
   ```

3. **Deploy**
   - Railway will automatically deploy your bot
   - Monitor logs to ensure successful deployment

### Option 2: Deploy via CLI

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**
   ```bash
   railway login
   ```

3. **Initialize Project**
   ```bash
   railway init
   ```

4. **Set Environment Variables**
   ```bash
   railway variables set TELEGRAM_BOT_TOKEN=your_actual_bot_token
   railway variables set USE_POLLING=true
   railway variables set NODE_ENV=production
   railway variables set WEB_APP_URL=https://your-web-app.vercel.app
   ```

5. **Deploy**
   ```bash
   railway up
   ```

## Environment Variables Reference

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Your Telegram bot token from BotFather | ✅ Yes | - |
| `USE_POLLING` | Set to 'true' for polling, 'false' for webhook | ✅ Yes | true |
| `NODE_ENV` | Environment (production/development) | ✅ Yes | production |
| `PORT` | Server port (automatically set by Railway) | ❌ No | 3001 |
| `WEB_APP_URL` | Your web app URL for Privy authentication | ✅ Yes | - |
| `WEBHOOK_URL` | Only needed if USE_POLLING=false | ❌ No | - |

## Monitoring and Logs

### View Logs
```bash
# Via CLI
railway logs

# Or via dashboard
# Go to your project > Deployments > View Logs
```

### Health Check Endpoints
Your deployed bot will have these endpoints available:
- `GET /`: Basic status check
- `GET /health`: Detailed health information
- `GET /keep-alive`: Keep-alive endpoint

## Troubleshooting

### Bot Not Responding
1. Check logs for errors: `railway logs`
2. Verify environment variables are set correctly
3. Ensure `USE_POLLING=true` is set
4. Check if bot token is valid

### Deployment Fails
1. Check build logs in Railway dashboard
2. Verify `package.json` dependencies
3. Ensure Node.js version compatibility (>=18.x)

### Memory or CPU Issues
1. Monitor resource usage in Railway dashboard
2. Consider upgrading Railway plan if needed
3. Optimize bot code for better performance

## Production Considerations

### Security
- Never commit `.env` files with actual tokens
- Use Railway's environment variable system
- Regularly rotate bot tokens

### Monitoring
- Set up Railway's monitoring alerts
- Monitor bot uptime and response times
- Use `/health` endpoint for external monitoring

### Scaling
- Railway automatically handles scaling
- Monitor resource usage and upgrade plan as needed
- Consider implementing rate limiting for high-traffic bots

## Support

- [Railway Documentation](https://docs.railway.app/)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [Node.js Telegram Bot API](https://github.com/yagop/node-telegram-bot-api)

## Migration from Webhook to Polling

If you're migrating from a webhook-based deployment:

1. Set `USE_POLLING=true` in environment variables
2. The bot will automatically delete existing webhooks on startup
3. Monitor logs to confirm polling mode is active
4. Test bot functionality after deployment

Your bot is now ready for Railway deployment with polling mode! 🚀
