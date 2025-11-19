# Execute Deployment - DO THIS NOW

This machine doesn't have Node.js or deployment tools installed. You need to execute these steps.

## Step 1: Deploy Server (Choose ONE)

### Option A: Railway (Easiest, No CLI needed)

1. Go to: https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Authorize GitHub if needed
4. Select repository: `theonlypal/collabfs`
5. Railway will ask for configuration:
   - **Root Directory**: `packages/server`
   - **Build Command**: Auto-detected from Dockerfile
6. Click "Deploy"
7. Wait 2-3 minutes
8. Go to: Settings → Networking → Generate Domain
9. Copy the URL (e.g., `collabfs-production.up.railway.app`)

Your WebSocket URL: `wss://collabfs-production.up.railway.app`

### Option B: Render (Also No CLI)

1. Go to: https://dashboard.render.com/
2. Click "New +" → "Web Service"
3. Connect GitHub repository: `theonlypal/collabfs`
4. Configuration:
   - **Name**: `collabfs`
   - **Root Directory**: `packages/server`
   - **Environment**: Docker
   - **Plan**: Free
5. Click "Create Web Service"
6. Wait 3-5 minutes
7. Copy the URL from dashboard

Your WebSocket URL: `wss://collabfs.onrender.com`

## Step 2: Verify Deployment

Open browser or terminal:
```bash
curl https://YOUR-DEPLOYED-URL/health
```

Should return:
```json
{
  "status": "ok",
  "uptime": 123,
  "sessions": 0,
  "clients": 0
}
```

## Step 3: Build and Publish npm Package

You need Node.js installed. If not:
```bash
# macOS
brew install node

# Or download from https://nodejs.org
```

Then:
```bash
cd /Users/johncox/collabfs/packages/mcp-client

# Install dependencies
npm install

# Build
npm run build

# Publish to npm (you'll need npm account)
npm login
npm publish
```

If you don't have npm account:
```bash
npm adduser
# Follow prompts to create account
```

## Step 4: Test With Your Friends

Share this config:

```json
{
  "mcpServers": {
    "collabfs": {
      "command": "npx",
      "args": ["collabfs-mcp@latest"],
      "env": {
        "COLLABFS_SERVER_URL": "wss://YOUR-ACTUAL-DEPLOYED-URL",
        "COLLABFS_SESSION_ID": "test-session",
        "COLLABFS_USER_ID": "user1"
      }
    }
  }
}
```

Replace `YOUR-ACTUAL-DEPLOYED-URL` with your Railway or Render URL.

## Step 5: Test It Works

Friend 1:
```
Connect to CollabFS session "test-session"
Create file /test.txt with "Hello from Friend 1"
```

Friend 2:
```
Connect to CollabFS session "test-session"
Read file /test.txt
```

Friend 2 should see Friend 1's file instantly.

## If You Get Stuck

The code is production-ready on GitHub: https://github.com/theonlypal/collabfs

Railway and Render both have web UIs - no CLI needed. Just click through the steps above.

## Timeline

- Server deployment: 5 minutes
- npm package: 5 minutes
- Testing: 5 minutes
- **Total: 15 minutes to fully operational**
