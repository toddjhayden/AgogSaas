# Real-Time Quote Collaboration - Deployment Guide
**REQ-STRATEGIC-AUTO-1767108044308**

## Overview
This deployment guide covers the real-time collaboration and live editing feature for quotes, implementing:
- Optimistic locking with version control
- WebSocket-based GraphQL subscriptions
- NATS event publishing for real-time updates
- Field-level audit trail
- Presence tracking
- Multi-tenant security isolation

## Prerequisites

### Required Services
1. **PostgreSQL 14+** with extensions:
   - `uuid-ossp` or `pgcrypto` (for uuid_generate_v7)
   - Row-Level Security (RLS) enabled

2. **NATS Server 2.9+**
   - Running and accessible from backend
   - JetStream enabled (optional but recommended)

3. **Node.js 18+** with NestJS framework

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:password@host:5432/database

# NATS Configuration
NATS_URL=nats://nats:4222
NATS_USER=your_nats_user        # Optional, if auth enabled
NATS_PASSWORD=your_nats_password # Optional, if auth enabled

# JWT Configuration (for WebSocket auth)
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRATION=24h
```

## Deployment Steps

### Step 1: Database Migration

Run the collaboration infrastructure migration:

```bash
cd print-industry-erp/backend
npm run migration:run
```

This will apply migration `V0.0.66__add_quote_collaboration_infrastructure.sql`, which creates:
- Version control columns on `quotes` and `quote_lines`
- `quote_changes` table for audit trail
- `active_quote_sessions` table for presence tracking
- RLS policies for tenant isolation
- Helper functions and triggers
- Indexes for performance

**Verification:**
```sql
-- Verify tables exist
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('quote_changes', 'active_quote_sessions');

-- Verify RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE tablename IN ('quote_changes', 'active_quote_sessions');

-- Verify version columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'quotes' AND column_name = 'version';
```

### Step 2: NATS Server Setup

**Option A: Docker Compose (Recommended)**
```yaml
# docker-compose.yml
services:
  nats:
    image: nats:2.10-alpine
    ports:
      - "4222:4222"
      - "8222:8222"  # HTTP monitoring
    command: ["-js", "-m", "8222"]  # Enable JetStream and monitoring
    volumes:
      - nats-data:/data
    restart: unless-stopped

volumes:
  nats-data:
```

**Option B: Standalone Installation**
```bash
# Install NATS server
wget https://github.com/nats-io/nats-server/releases/download/v2.10.7/nats-server-v2.10.7-linux-amd64.tar.gz
tar -xzf nats-server-v2.10.7-linux-amd64.tar.gz
cd nats-server-v2.10.7-linux-amd64

# Start with JetStream
./nats-server -js
```

**Verification:**
```bash
# Check NATS is running
curl http://localhost:8222/varz

# Test connection
npm install -g nats-top
nats-top -s nats://localhost:4222
```

### Step 3: Backend Service Deployment

**Install Dependencies:**
```bash
cd print-industry-erp/backend
npm install
```

**Build Backend:**
```bash
npm run build
```

**Start Backend:**
```bash
# Development
npm run start:dev

# Production
npm run start:prod
```

**Verification:**
```bash
# Check GraphQL playground
curl http://localhost:3000/graphql

# Check health endpoint
curl http://localhost:3000/health
```

### Step 4: WebSocket Configuration

#### For Load Balancers (Nginx)

```nginx
upstream backend {
    server backend1:3000;
    server backend2:3000;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    # Regular HTTP requests
    location /graphql {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket upgrade for GraphQL subscriptions
    location /graphql {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;  # 24 hours
    }
}
```

#### For AWS Application Load Balancer

Enable WebSocket support on target group:
1. Go to EC2 > Target Groups
2. Select your backend target group
3. Edit attributes
4. Enable "Stickiness" (required for WebSocket)
5. Set stickiness duration to 86400 seconds (24 hours)

### Step 5: Frontend Integration

**Install GraphQL Subscriptions Client:**
```bash
cd print-industry-erp/frontend
npm install graphql-ws
```

**Example Client Setup:**
```typescript
import { createClient } from 'graphql-ws';

const wsClient = createClient({
  url: 'ws://localhost:3000/graphql',
  connectionParams: () => {
    const token = localStorage.getItem('authToken');
    return {
      authToken: `Bearer ${token}`,
    };
  },
});

// Subscribe to quote changes
const subscription = wsClient.subscribe(
  {
    query: `
      subscription OnQuoteChanged($quoteId: ID!) {
        quoteChanged(quoteId: $quoteId) {
          eventId
          timestamp
          eventType
          changes {
            field
            oldValue
            newValue
          }
          version
        }
      }
    `,
    variables: { quoteId: 'quote-uuid' },
  },
  {
    next: (data) => console.log('Quote updated:', data),
    error: (error) => console.error('Subscription error:', error),
    complete: () => console.log('Subscription complete'),
  }
);
```

## Security Considerations

### 1. WebSocket Authentication

**CRITICAL**: The current implementation has a placeholder JWT validation in `app.module.ts:162-165`. You MUST implement proper JWT validation before production deployment.

**Replace this code:**
```typescript
// TODO: Replace with actual JWT validation in production
const user = { id: '...', username: '...', tenantId: '...' };
```

**With proper JWT validation:**
```typescript
import { JwtService } from '@nestjs/jwt';

// In onConnect handler
const jwtService = new JwtService({ secret: process.env.JWT_SECRET });
try {
  const decoded = jwtService.verify(token);
  const user = {
    id: decoded.sub,
    username: decoded.username,
    tenantId: decoded.tenantId,
    email: decoded.email,
  };
  return { user, tenantId: user.tenantId, dbPool };
} catch (error) {
  throw new Error('Invalid authentication token');
}
```

### 2. Tenant Isolation Verification

Run this test to verify tenant isolation:

```sql
-- As tenant A user
SET app.current_tenant_id = 'tenant-a-uuid';
SELECT * FROM quote_changes;  -- Should only see tenant A changes

-- As tenant B user
SET app.current_tenant_id = 'tenant-b-uuid';
SELECT * FROM quote_changes;  -- Should only see tenant B changes
```

### 3. Rate Limiting

Implement rate limiting for subscriptions to prevent abuse:

```typescript
// Example using @nestjs/throttler
import { ThrottlerGuard } from '@nestjs/throttler';

@UseGuards(ThrottlerGuard)
@Subscription('quoteChanged')
quoteChanged(...) { ... }
```

## Monitoring and Maintenance

### 1. Monitor Stale Sessions

Set up a cron job to clean up stale sessions:

```sql
-- Run every 5 minutes
SELECT cleanup_stale_quote_sessions();
```

**Example cron job:**
```bash
# /etc/cron.d/quote-sessions-cleanup
*/5 * * * * postgres psql -d yourdb -c "SELECT cleanup_stale_quote_sessions();"
```

### 2. Monitor NATS Connection

Add health check for NATS connectivity:

```typescript
// health.controller.ts
@Get('/health/nats')
async checkNats() {
  const status = this.quoteEventPublisher.getStatus();
  if (!status.connected) {
    throw new ServiceUnavailableException('NATS not connected');
  }
  return { status: 'ok', nats: status };
}
```

### 3. Monitor Database Performance

Key indexes to monitor:
```sql
-- Check index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE tablename IN ('quote_changes', 'active_quote_sessions')
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('quote_changes', 'active_quote_sessions');
```

### 4. Archive Old Change Records

Set up monthly archival for old `quote_changes` records:

```sql
-- Archive changes older than 90 days
CREATE TABLE quote_changes_archive (LIKE quote_changes INCLUDING ALL);

INSERT INTO quote_changes_archive
SELECT * FROM quote_changes
WHERE changed_at < NOW() - INTERVAL '90 days';

DELETE FROM quote_changes
WHERE changed_at < NOW() - INTERVAL '90 days';
```

## Testing

### 1. Test Optimistic Locking

```typescript
// Simulate concurrent updates
const quote = await getQuote('quote-id');
const currentVersion = quote.version;

// User A updates
await updateQuoteWithVersionCheck({
  quoteId: 'quote-id',
  expectedVersion: currentVersion,
  changes: { notes: 'Updated by User A' },
});

// User B tries to update with stale version (should fail)
try {
  await updateQuoteWithVersionCheck({
    quoteId: 'quote-id',
    expectedVersion: currentVersion,  // Stale!
    changes: { notes: 'Updated by User B' },
  });
} catch (error) {
  console.log('Expected error:', error.message);
  console.log('Conflicting changes:', error.conflictingChanges);
}
```

### 2. Test Real-Time Updates

Open two browser windows and subscribe to the same quote:

```javascript
// Window 1: Subscribe
const sub = wsClient.subscribe({
  query: 'subscription { quoteChanged(quoteId: "quote-id") { changes { field newValue } } }'
});

// Window 2: Update quote
await updateQuoteLine({
  lineId: 'line-id',
  changes: { quantity: 100 }
});

// Window 1 should receive update immediately
```

### 3. Test Presence Tracking

```typescript
// Join session
const session = await joinQuoteSession({
  sessionId: 'session-1',
  quoteId: 'quote-id',
});

// Get active users
const activeSessions = await getActiveQuoteSessions('quote-id');
console.log('Active users:', activeSessions.length);

// Leave session
await leaveQuoteSession('session-1');
```

## Rollback Procedure

If issues arise, rollback in this order:

### 1. Disable Subscriptions
```typescript
// Comment out in app.module.ts
// subscriptions: { ... }
```

### 2. Revert Database Migration
```bash
# Create rollback migration
cat > migrations/V0.0.67__rollback_quote_collaboration.sql << 'EOF'
-- Drop tables
DROP TABLE IF EXISTS active_quote_sessions CASCADE;
DROP TABLE IF EXISTS quote_changes CASCADE;

-- Remove version columns
ALTER TABLE quote_lines DROP COLUMN IF EXISTS version;
ALTER TABLE quote_lines DROP COLUMN IF EXISTS updated_by;
ALTER TABLE quotes DROP COLUMN IF EXISTS version;

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_stale_quote_sessions();
DROP FUNCTION IF EXISTS check_quote_version(UUID, INTEGER);
DROP FUNCTION IF EXISTS check_quote_line_version(UUID, INTEGER);
DROP FUNCTION IF EXISTS increment_quote_version();
DROP FUNCTION IF EXISTS increment_quote_line_version();

-- Drop views
DROP VIEW IF EXISTS v_active_quote_collaborators;
DROP VIEW IF EXISTS v_recent_quote_changes;
EOF

# Run rollback
npm run migration:run
```

### 3. Restart Backend
```bash
npm run start:prod
```

## Performance Tuning

### 1. Database Connection Pool

Adjust pool size based on concurrent WebSocket connections:

```typescript
// database.module.ts
max: 50,  // Increase if many concurrent users
idleTimeoutMillis: 30000,
connectionTimeoutMillis: 5000,
```

### 2. NATS Message Limits

Configure NATS to handle high message volume:

```bash
# nats-server.conf
max_payload = 1MB
max_pending = 64MB
max_connections = 1000
```

### 3. WebSocket Keep-Alive

Configure keep-alive to detect stale connections:

```typescript
// app.module.ts subscriptions config
keepAlive: 10000,  // 10 seconds
```

## Troubleshooting

### Issue: WebSocket connection fails

**Symptoms:** Client cannot establish WebSocket connection

**Checks:**
1. Verify NATS is running: `curl http://localhost:8222/varz`
2. Check backend logs for WebSocket errors
3. Verify JWT token is being sent in `connectionParams`
4. Check load balancer WebSocket configuration

**Solution:**
```bash
# Check backend logs
docker logs backend | grep -i websocket

# Test WebSocket directly
wscat -c ws://localhost:3000/graphql -H "authToken: Bearer YOUR_TOKEN"
```

### Issue: Subscriptions not receiving updates

**Symptoms:** Client subscribed but not receiving events

**Checks:**
1. Verify NATS connection in backend
2. Check tenant ID filtering in subscription
3. Verify event is being published

**Solution:**
```typescript
// Check NATS status
const status = await fetch('http://localhost:3000/health/nats');
console.log(await status.json());

// Enable debug logging
console.log('Subscription filter:', { quoteId, tenantId, eventTenantId });
```

### Issue: Version conflict errors

**Symptoms:** Users frequently seeing version conflict errors

**Checks:**
1. Check if version increments properly
2. Verify trigger is firing on updates
3. Check for race conditions

**Solution:**
```sql
-- Verify trigger exists
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE '%version%';

-- Check recent version changes
SELECT quote_id, entity_version_before, entity_version_after
FROM quote_changes
WHERE changed_at > NOW() - INTERVAL '1 hour'
ORDER BY changed_at DESC;
```

## Support and Resources

- **NestJS Documentation:** https://docs.nestjs.com/graphql/subscriptions
- **NATS Documentation:** https://docs.nats.io/
- **GraphQL Subscriptions Spec:** https://github.com/enisdenjo/graphql-ws
- **PostgreSQL RLS:** https://www.postgresql.org/docs/current/ddl-rowsecurity.html

## Next Steps

### Phase 2: Operational Transforms (Future Enhancement)

After Phase 1 (Optimistic Locking) is stable, consider implementing:
- Operational Transforms (OT) for real-time merging
- Character-level diff tracking
- Automatic conflict resolution
- Collaborative cursor positioning

See Sylvia's critique deliverable for detailed Phase 2 recommendations.

---

**Deployment Checklist:**

- [ ] Database migration applied successfully
- [ ] NATS server running and accessible
- [ ] Environment variables configured
- [ ] JWT validation implemented (replace placeholder)
- [ ] WebSocket configuration tested
- [ ] Load balancer configured for WebSocket
- [ ] RLS policies verified for tenant isolation
- [ ] Stale session cleanup cron job configured
- [ ] Health checks monitoring NATS connectivity
- [ ] Frontend integration tested
- [ ] Rate limiting configured
- [ ] Rollback procedure documented and tested
