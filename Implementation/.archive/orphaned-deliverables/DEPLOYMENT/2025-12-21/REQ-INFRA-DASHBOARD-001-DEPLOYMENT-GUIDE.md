# Monitoring Dashboard Deployment & Testing Guide

**Request Number:** REQ-INFRA-DASHBOARD-001
**For:** Marcus (Warehouse PO) / Jen (Frontend PO)
**Prepared By:** Roy (Backend PO)
**Date:** 2025-12-21

---

## Quick Start

### Prerequisites
- Docker Desktop installed and running
- Git repository cloned
- Port 3000, 4001, 5433, 4223 available

### Step 1: Start Infrastructure
```bash
# Navigate to project root
cd /path/to/agogsaas

# Stop any existing containers
docker-compose down

# Rebuild and start all services
docker-compose up --build -d

# Wait for services to become healthy (30-60 seconds)
docker-compose ps
```

Expected output:
```
NAME                  STATUS         PORTS
agogsaas-postgres     healthy        0.0.0.0:5433->5432/tcp
agogsaas-nats         healthy        0.0.0.0:4223->4222/tcp
agogsaas-ollama       healthy        0.0.0.0:11434->11434/tcp
agogsaas-backend      running        0.0.0.0:4001->4000/tcp
agogsaas-frontend     running        0.0.0.0:3000->3000/tcp
```

### Step 2: Verify Backend
```bash
# Check backend logs
docker-compose logs backend | tail -20
```

Expected output should include:
```
✅ Database connected
✅ Health monitoring started (5s interval)
✅ NATS Jetstream connected
🚀 Apollo Server ready at http://localhost:4000/graphql
```

### Step 3: Verify Frontend
```bash
# Check frontend logs
docker-compose logs frontend | tail -20
```

Expected output should include:
```
VITE v5.x.x ready in xxx ms
➜  Local:   http://localhost:3000/
➜  Network: http://0.0.0.0:3000/
```

### Step 4: Access Monitoring Dashboard
```bash
# Open monitoring dashboard
open http://localhost:3000/monitoring
```

**Expected Result:**
- ✅ Page loads without errors
- ✅ SystemStatusCard displays system health
- ✅ AgentActivityCard displays agent activities
- ✅ ErrorListCard displays error list
- ✅ ActiveFixesCard displays active fixes

---

## Detailed Verification Steps

### 1. Verify GraphQL API

**Test GraphQL Endpoint:**
```bash
# Test with curl
curl -X POST http://localhost:4001/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ systemHealth { status } }"}'
```

Expected response:
```json
{
  "data": {
    "systemHealth": {
      "status": "healthy"
    }
  }
}
```

**Access GraphQL Playground:**
```bash
open http://localhost:4001/graphql
```

Run this query in the playground:
```graphql
query TestMonitoring {
  systemHealth {
    status
    uptime
    timestamp
    components {
      name
      status
      responseTime
      lastCheck
      message
    }
  }

  systemErrors(limit: 5) {
    id
    errorCode
    message
    severity
    component
    status
    occurredAt
  }

  agentActivities {
    id
    agentName
    agentType
    activityType
    taskDescription
    status
    startedAt
  }

  activeFixes {
    id
    fixDescription
    status
    startedAt
  }
}
```

**Expected:** All queries return data without errors.

---

### 2. Verify Frontend Build

**Check for Import Errors:**
```bash
# View browser console (no import errors should appear)
open http://localhost:3000/monitoring
# Press F12 → Console tab
```

**Expected Console Output:**
```
[vite] connected
[Apollo Client] Query executed: systemHealth
[Apollo Client] Query executed: systemErrors
[Apollo Client] Query executed: agentActivities
[Apollo Client] Query executed: activeFixes
```

**NOT Expected (errors):**
```
❌ Failed to resolve import '@graphql/queries'
❌ Cannot find module '@graphql/queries'
❌ 404 Not Found: /@graphql/queries
```

---

### 3. Verify Component Rendering

**SystemStatusCard:**
- ✅ Displays "System Status" title
- ✅ Shows status badge (Healthy/Degraded/Down)
- ✅ Lists components (Database, NATS, Ollama, Backend)
- ✅ Shows response times
- ✅ Displays last check timestamp
- ✅ Auto-refreshes every 10 seconds

**AgentActivityCard:**
- ✅ Displays "Agent Activity" title
- ✅ Lists recent agent activities
- ✅ Shows agent names and types
- ✅ Displays task descriptions
- ✅ Shows status badges (Running/Completed/Failed)
- ✅ Auto-refreshes every 10 seconds

**ErrorListCard:**
- ✅ Displays "Recent Errors" title
- ✅ Lists recent errors (or "No errors" message)
- ✅ Shows error codes and messages
- ✅ Displays severity badges (Critical/Error/Warning)
- ✅ Shows component names
- ✅ Auto-refreshes every 10 seconds

**ActiveFixesCard:**
- ✅ Displays "Active Fixes" title
- ✅ Lists active fixes (or "No active fixes" message)
- ✅ Shows fix descriptions
- ✅ Displays status badges (In Progress/Completed)
- ✅ Shows start times
- ✅ Auto-refreshes every 10 seconds

---

### 4. Network Tab Verification

**Open Browser DevTools:**
```bash
open http://localhost:3000/monitoring
# Press F12 → Network tab
# Filter: XHR/Fetch
# Refresh page
```

**Expected Network Requests:**
```
POST http://localhost:4001/graphql (systemHealth)      200 OK
POST http://localhost:4001/graphql (systemErrors)      200 OK
POST http://localhost:4001/graphql (agentActivities)   200 OK
POST http://localhost:4001/graphql (activeFixes)       200 OK
```

**Request Payload Example:**
```json
{
  "operationName": "GetSystemHealth",
  "query": "query GetSystemHealth { systemHealth { status components { name status responseTime } } }"
}
```

**Response Example:**
```json
{
  "data": {
    "systemHealth": {
      "status": "healthy",
      "components": [
        { "name": "database", "status": "healthy", "responseTime": 12 },
        { "name": "nats", "status": "healthy", "responseTime": 5 },
        { "name": "ollama", "status": "healthy", "responseTime": 150 }
      ]
    }
  }
}
```

---

### 5. Manual Refresh Test

**Test Manual Refresh Button:**
1. Click "Refresh" button in monitoring dashboard header
2. Observe all cards re-fetch data
3. Check Network tab for new GraphQL requests

**Expected:**
- ✅ Loading spinners appear briefly
- ✅ Data updates with fresh timestamps
- ✅ No errors in console

---

### 6. Auto-Refresh Test

**Test Auto-Refresh (10-second interval):**
1. Keep monitoring dashboard open
2. Wait 10 seconds
3. Observe network requests in DevTools

**Expected:**
- ✅ New GraphQL requests every 10 seconds
- ✅ Timestamps update automatically
- ✅ No polling errors in console

---

## Troubleshooting

### Issue: Frontend shows import errors

**Symptom:**
```
Failed to resolve import '@graphql/queries'
```

**Solution:**
```bash
# 1. Verify vite.config.ts is mounted
docker-compose down
docker-compose up --build -d frontend

# 2. Check if vite.config.ts has @graphql alias
cat print-industry-erp/frontend/vite.config.ts | grep '@graphql'
# Expected: '@graphql': path.resolve(__dirname, './src/graphql'),

# 3. Restart frontend container
docker-compose restart frontend
```

---

### Issue: Backend not responding

**Symptom:**
```
Network error: Failed to fetch
```

**Solution:**
```bash
# 1. Check backend logs
docker-compose logs backend

# 2. Verify backend is running
docker-compose ps backend
# Expected: running

# 3. Test database connection
docker-compose exec backend npm run test:db

# 4. Restart backend
docker-compose restart backend
```

---

### Issue: GraphQL queries return errors

**Symptom:**
```json
{
  "errors": [
    { "message": "Cannot query field 'systemHealth' on type 'Query'" }
  ]
}
```

**Solution:**
```bash
# 1. Verify monitoring schema is loaded
docker-compose exec backend grep -r "systemHealth" /app/src/modules/monitoring

# 2. Check if resolvers are registered
docker-compose exec backend grep -r "monitoringResolvers" /app/src/index.ts

# 3. Rebuild backend
docker-compose up --build -d backend
```

---

### Issue: Database connection failed

**Symptom:**
```
❌ Database connection failed
```

**Solution:**
```bash
# 1. Check Postgres status
docker-compose ps postgres
# Expected: healthy

# 2. Test database connection
docker-compose exec postgres pg_isready -U agogsaas_user -d agogsaas

# 3. Check DATABASE_URL
docker-compose exec backend printenv DATABASE_URL
# Expected: postgresql://agogsaas_user:changeme@postgres:5432/agogsaas

# 4. Restart Postgres
docker-compose restart postgres
```

---

### Issue: NATS connection failed

**Symptom:**
```
⚠️  NATS connection failed (orchestration features disabled)
```

**Solution:**
```bash
# 1. Check NATS status
docker-compose ps nats
# Expected: healthy

# 2. Test NATS connection
docker-compose exec backend nc -zv nats 4222

# 3. Restart NATS
docker-compose restart nats
```

**Note:** NATS failure is non-critical for monitoring dashboard. System will continue working with degraded orchestration features.

---

## Performance Benchmarks

### Expected Response Times

**GraphQL Queries:**
- `systemHealth`: < 50ms
- `systemErrors`: < 100ms
- `agentActivities`: < 150ms
- `activeFixes`: < 100ms

**Page Load:**
- Initial load: < 2 seconds
- Component hydration: < 500ms
- Auto-refresh: < 200ms

**Database Queries:**
- Health check: < 10ms
- Error lookup: < 20ms
- Agent activity lookup: < 30ms
- Active fixes lookup: < 20ms

---

## Data Population (Optional)

If monitoring dashboard shows empty data, you can populate test data:

### Add Test Errors
```bash
docker-compose exec backend psql $DATABASE_URL -c "
INSERT INTO system_errors (id, error_code, message, severity, component, status, occurred_at)
VALUES
  (gen_random_uuid(), 'DB_CONN_001', 'Connection timeout', 'ERROR', 'database', 'ACTIVE', NOW()),
  (gen_random_uuid(), 'NATS_PUB_002', 'Publish failed', 'WARNING', 'nats', 'ACTIVE', NOW());
"
```

### Add Test Agent Activities
```bash
docker-compose exec backend psql $DATABASE_URL -c "
INSERT INTO agent_activities (id, agent_name, agent_type, activity_type, task_description, status, started_at)
VALUES
  (gen_random_uuid(), 'cynthia', 'research', 'RESEARCH', 'Analyzing monitoring dashboard issue', 'COMPLETED', NOW() - INTERVAL '1 hour'),
  (gen_random_uuid(), 'roy', 'backend', 'IMPLEMENTATION', 'Implementing monitoring infrastructure', 'IN_PROGRESS', NOW());
"
```

### Add Test Active Fixes
```bash
docker-compose exec backend psql $DATABASE_URL -c "
INSERT INTO active_fixes (id, fix_description, status, started_at)
VALUES
  (gen_random_uuid(), 'Fixing GraphQL import path alias', 'IN_PROGRESS', NOW());
"
```

After inserting test data, refresh the monitoring dashboard to see the populated data.

---

## Sign-Off Checklist

### For Marcus (Warehouse PO)
- [ ] Infrastructure started successfully (`docker-compose up`)
- [ ] Backend health check passed (✅ Database connected)
- [ ] Frontend loaded without errors (http://localhost:3000/monitoring)
- [ ] All monitoring cards render correctly
- [ ] GraphQL queries return data (Network tab verification)
- [ ] Auto-refresh working (10-second interval)
- [ ] Manual refresh button working
- [ ] No console errors in browser DevTools

### For Jen (Frontend PO)
- [ ] `vite.config.ts` has `@graphql` alias
- [ ] `tsconfig.json` has `@graphql/*` path mapping
- [ ] `src/graphql/queries/index.ts` exports all queries
- [ ] All monitoring components import from `@graphql/queries`
- [ ] Frontend builds successfully (`npm run build`)
- [ ] No TypeScript errors in components

### For Roy (Backend PO)
- [ ] Backend infrastructure verified (see BACKEND-VERIFICATION.md)
- [ ] All GraphQL resolvers tested
- [ ] Database migrations applied
- [ ] NATS integration working
- [ ] Docker volume mounting correct (vite.config.ts added)
- [ ] Deployment guide created

---

## Next Steps

### If All Tests Pass
1. Marcus submits completion deliverable to NATS
2. Chuck (Senior Review) performs final review
3. Ticket REQ-INFRA-DASHBOARD-001 marked as COMPLETE

### If Issues Found
1. Document specific errors and logs
2. Escalate to appropriate PO (Roy for backend, Jen for frontend)
3. Create follow-up tasks if needed

---

## Support Contacts

**Backend Issues:**
- Agent: Roy (Backend PO)
- Scope: GraphQL API, Database, Services, Docker backend config

**Frontend Issues:**
- Agent: Jen (Frontend PO)
- Scope: React components, Vite config, TypeScript, Apollo Client

**Infrastructure Issues:**
- Agent: Miki (DevOps PO)
- Scope: Docker, Networking, NATS, PostgreSQL

**Process Issues:**
- Agent: Chuck (Senior Review)
- Scope: Agent workflow, NATS deliverables, AGOG standards

---

## Appendix: Full System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     User Browser                             │
│                 http://localhost:3000/monitoring             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP Requests
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Frontend Container                          │
│                  (React + Vite)                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Monitoring Dashboard Components                       │  │
│  │  • SystemStatusCard.tsx                              │  │
│  │  • AgentActivityCard.tsx                             │  │
│  │  • ErrorListCard.tsx                                 │  │
│  │  • ActiveFixesCard.tsx                               │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │ import from '@graphql/queries'            │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │ src/graphql/queries/index.ts                         │  │
│  │  • Exports all monitoring queries                     │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │ Apollo Client                                         │  │
│  │  • Polling: 10s interval                             │  │
│  │  • GraphQL endpoint: http://localhost:4001/graphql   │  │
│  └──────────────┬───────────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────────┘
                  │ GraphQL Queries
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backend Container                           │
│               (Node.js + Apollo Server)                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Apollo Server (index.ts)                             │  │
│  │  • Endpoint: http://localhost:4001/graphql           │  │
│  │  • Introspection: enabled                            │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │ Monitoring GraphQL Resolvers                         │  │
│  │  • systemHealth()                                    │  │
│  │  • systemErrors()                                    │  │
│  │  • agentActivities()                                 │  │
│  │  • activeFixes()                                     │  │
│  └──────────────┬───────────────────────────────────────┘  │
│                 │                                            │
│  ┌──────────────▼───────────────────────────────────────┐  │
│  │ Service Layer                                         │  │
│  │  • HealthMonitorService                              │  │
│  │  • ErrorTrackingService                              │  │
│  │  • AgentActivityService                              │  │
│  │  • ActiveFixesService                                │  │
│  └──────────────┬───────────────────────────────────────┘  │
└─────────────────┼────────────────────────────────────────┘
                  │ SQL Queries
                  ▼
┌─────────────────────────────────────────────────────────────┐
│                PostgreSQL Container                          │
│                  (pgvector/pgvector:pg16)                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Monitoring Tables                                     │  │
│  │  • system_health_checks                              │  │
│  │  • system_errors                                     │  │
│  │  • agent_activities                                  │  │
│  │  • active_fixes                                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

**End of Deployment Guide**
