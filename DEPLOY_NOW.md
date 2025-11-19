# Deploy Server RIGHT NOW

## Option 1: Railway (Fastest - 2 minutes)

1. Go to https://railway.app/new
2. Click "Deploy from GitHub repo"
3. Select `theonlypal/collabfs`
4. Set root directory: `/packages/server`
5. Railway will auto-detect Dockerfile
6. Click "Deploy"
7. Wait 2 minutes for deployment
8. Go to Settings → Networking → Generate Domain
9. Copy your URL: `https://collabfs-production.up.railway.app`
10. Your WebSocket URL is: `wss://collabfs-production.up.railway.app`

## Option 2: Render (3 minutes)

1. Go to https://dashboard.render.com/select-repo
2. Connect GitHub: `theonlypal/collabfs`
3. Click "New Web Service"
4. Name: `collabfs`
5. Root Directory: `packages/server`
6. Build Command: `npm install && npm run build`
7. Start Command: `node dist/index.js`
8. Click "Create Web Service"
9. Wait 3 minutes for deployment
10. Copy your URL: `https://collabfs.onrender.com`
11. Your WebSocket URL is: `wss://collabfs.onrender.com`

## Test Deployment

```bash
curl https://YOUR-DEPLOYED-URL/health
```

Should return:
```json
{"status":"ok","uptime":...}
```

## After Deployment

Update this in your notes:
- Server URL: `wss://YOUR-DEPLOYED-URL`
- Share this URL with your friends for their MCP config

## Publish NPM Package

Once server is deployed:

```bash
cd /Users/johncox/collabfs/packages/mcp-client

# Build
npm run build

# Login to npm (if not already)
npm login

# Publish
npm publish
```

Then your friends can install with:
```bash
npx collabfs-mcp@latest
```

With config:
```json
{
  "COLLABFS_SERVER_URL": "wss://YOUR-DEPLOYED-URL"
}
```
