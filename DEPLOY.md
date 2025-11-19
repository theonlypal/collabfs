# Production Deployment Guide

## Overview

This guide covers deployment of the CollabFS server to production environments and configuration of MCP clients.

## Prerequisites

- Node.js 18 or higher
- Account on chosen deployment platform (Railway, Render, or Fly.io)
- GitHub repository (for automated deployments)

## Server Deployment

### Option 1: Railway

Railway provides automatic HTTPS and WebSocket support.

**Steps**:
1. Install Railway CLI: `npm install -g @railway/cli`
2. Navigate to project root: `cd collabfs`
3. Initialize: `railway init`
4. Deploy: `railway up`
5. Set environment: `railway variables set NODE_ENV=production`
6. Note the deployment URL from Railway dashboard

**Configuration**:
- Uses `railway.json` for build configuration
- Automatic SSL certificate provisioning
- WebSocket endpoint: `wss://your-app.railway.app`

### Option 2: Render

Render provides zero-configuration deployments with the included `render.yaml`.

**Steps**:
1. Fork/push repository to GitHub
2. Create account at render.com
3. New Web Service -> Connect repository
4. Render detects `render.yaml` automatically
5. Click "Create Web Service"
6. Note the deployment URL from Render dashboard

**Configuration**:
- Uses `render.yaml` for service definition
- Automatic SSL certificate
- WebSocket endpoint: `wss://your-app.onrender.com`

### Option 3: Fly.io

Fly.io provides global deployment with edge locations.

**Steps**:
```bash
# Install Fly CLI
curl -L https://fly.io/install.sh | sh

# Navigate to project
cd collabfs

# Launch (creates app and deploys)
fly launch

# Deploy updates
fly deploy
```

**Configuration**:
- Uses `fly.toml` for app configuration
- Automatic SSL certificate
- WebSocket endpoint: `wss://your-app.fly.dev`

### Option 4: Docker

For custom infrastructure or on-premise deployments.

**Build**:
```bash
cd packages/server
docker build -t collabfs-server .
```

**Run**:
```bash
docker run -d \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e PORT=8080 \
  --name collabfs \
  collabfs-server
```

**Docker Compose**:
```yaml
version: '3.8'
services:
  collabfs:
    build: ./packages/server
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=production
      - PORT=8080
    restart: unless-stopped
```

## Server Verification

After deployment, verify the server is operational:

```bash
# Check health endpoint
curl https://your-server.com/health

# Expected response:
# {
#   "status": "ok",
#   "uptime": <seconds>,
#   "sessions": 0,
#   "clients": 0,
#   "memory": {...},
#   "timestamp": "..."
# }
```

## Client Configuration

### Claude Code

Edit MCP configuration file:

**macOS/Linux**: `~/.config/claude-code/mcp.json`
**Windows**: `%APPDATA%\claude-code\mcp.json`

```json
{
  "mcpServers": {
    "collabfs": {
      "command": "npx",
      "args": ["collabfs-mcp@latest"],
      "env": {
        "COLLABFS_SERVER_URL": "wss://your-server.railway.app",
        "COLLABFS_SESSION_ID": "project-identifier",
        "COLLABFS_USER_ID": "unique-user-id"
      }
    }
  }
}
```

### Gemini Code Assist

Similar configuration in Gemini's MCP settings file:

```json
{
  "mcpServers": {
    "collabfs": {
      "command": "npx",
      "args": ["collabfs-mcp@latest"],
      "env": {
        "COLLABFS_SERVER_URL": "wss://your-server.railway.app",
        "COLLABFS_SESSION_ID": "project-identifier",
        "COLLABFS_USER_ID": "unique-user-id"
      }
    }
  }
}
```

### Environment Variables

**Required**:
- `COLLABFS_SERVER_URL`: WebSocket URL of deployed server (must start with `wss://`)

**Optional**:
- `COLLABFS_SESSION_ID`: Session identifier (default: `default`)
- `COLLABFS_USER_ID`: User identifier (default: auto-generated)

## Verification

Test the complete deployment:

**User 1**:
```
Connect to CollabFS session "test-deployment"
Create file /test.txt with content "verification test"
```

**User 2**:
```
Connect to CollabFS session "test-deployment"
Read file /test.txt
```

User 2 should receive the file content created by User 1.

## Monitoring

### Health Checks

Configure health check monitoring for `/health` endpoint:

- **Uptime monitoring**: Services like UptimeRobot, Pingdom
- **Interval**: 60 seconds recommended
- **Timeout**: 5 seconds
- **Expected status**: 200 OK

### Statistics Endpoint

Query `/stats` for usage metrics:

```bash
curl https://your-server.com/stats
```

Returns:
```json
{
  "sessions": [...],
  "totalClients": <number>,
  "uptime": <seconds>,
  "memory": {...}
}
```

### Logging

Application logs are available through platform-specific tools:

- **Railway**: `railway logs`
- **Render**: Logs tab in dashboard
- **Fly.io**: `fly logs`
- **Docker**: `docker logs collabfs`

## Production Considerations

### Security

**Current implementation lacks**:
- Authentication
- Authorization
- Rate limiting
- Input validation beyond basic checks

**Recommendations for production**:
1. Implement JWT-based authentication
2. Add rate limiting (e.g., 100 requests/minute per user)
3. Validate all file paths and content
4. Implement session-level access control
5. Add audit logging

### Persistence

**Current behavior**: All sessions stored in memory, lost on restart.

**Production recommendations**:
1. Add database for session persistence (PostgreSQL or MongoDB)
2. Implement periodic snapshots of Yjs documents
3. Add session recovery mechanism on server restart
4. Consider Redis for distributed session state

### Scaling

**Single instance limitations**:
- All sessions on one server
- No horizontal scaling
- Single point of failure

**Scaling recommendations**:
1. Use Redis for session state synchronization
2. Deploy multiple instances behind load balancer
3. Implement sticky sessions or distributed state management
4. Consider message queue for operation broadcasting

### Error Handling

**Current implementation**:
- Basic error logging to console
- Graceful shutdown on SIGTERM/SIGINT
- Automatic client reconnection

**Production recommendations**:
1. Integrate error tracking (Sentry, Rollbar)
2. Implement structured logging (Winston, Pino)
3. Add error rate alerting
4. Implement circuit breakers for external dependencies

## Troubleshooting

### Connection Failures

**Symptom**: Client cannot connect to server

**Checks**:
1. Verify server is running: `curl https://your-server.com/health`
2. Confirm URL uses `wss://` protocol
3. Check firewall allows WebSocket connections
4. Verify no proxy interfering with WebSocket upgrade

### Synchronization Issues

**Symptom**: Changes not appearing for other users

**Checks**:
1. Confirm both users use identical `COLLABFS_SESSION_ID`
2. Check server logs for errors
3. Query `/stats` to verify both clients connected
4. Test with simple file operations first

### Performance Degradation

**Symptom**: Slow sync or high latency

**Checks**:
1. Monitor memory usage via `/health` endpoint
2. Check number of active sessions and clients
3. Review file sizes (recommend < 1MB per file)
4. Consider implementing file size limits
5. Add caching for frequently accessed files

### Server Crashes

**Symptom**: Server unexpectedly terminates

**Checks**:
1. Review logs for uncaught exceptions
2. Monitor memory usage (check for leaks)
3. Verify Node.js version >= 18
4. Check platform resource limits
5. Implement process manager (PM2) for automatic restart

## Updating

### Server Updates

**Railway/Render**: Automatic deployment on git push to main branch

**Fly.io**: Manual deployment required
```bash
fly deploy
```

**Docker**: Rebuild and restart container
```bash
docker build -t collabfs-server .
docker stop collabfs
docker rm collabfs
docker run -d -p 8080:8080 --name collabfs collabfs-server
```

### Client Updates

Clients using `npx collabfs-mcp@latest` automatically receive updates on next invocation.

Pin to specific version:
```json
{
  "command": "npx",
  "args": ["collabfs-mcp@1.0.0"]
}
```

## Cost Estimates

### Railway
- Free tier: $5 credit/month
- Hobby: $5/month + $0.000463/GB-hour
- Estimated: $5-15/month for moderate usage

### Render
- Free tier: 750 hours/month with sleep on inactivity
- Starter: $7/month
- Estimated: $7/month minimum

### Fly.io
- Free tier: 3 shared VMs
- Additional VMs: $1.94/month each
- Estimated: $0-10/month depending on usage

## Support

Report issues: https://github.com/theonlypal/collabfs/issues

Include in bug reports:
- Deployment platform
- Server logs (if accessible)
- Client configuration (sanitized)
- Steps to reproduce
