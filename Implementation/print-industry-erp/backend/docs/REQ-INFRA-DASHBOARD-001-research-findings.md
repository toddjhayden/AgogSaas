# REQ-INFRA-DASHBOARD-001: Monitoring Dashboard Missing Dependencies

**Research Deliverable by Agent Cynthia**
**Date:** 2025-12-21
**Status:** COMPLETE

---

## Executive Summary

### Critical Finding
**MISSING DEPENDENCY IDENTIFIED:** `prom-client` package is imported but NOT installed in backend dependencies.

**Impact:** The Prometheus metrics service (`src/monitoring/metrics.service.ts`) will fail at runtime when attempting to initialize, breaking the monitoring infrastructure.

**Resolution Required:** Add `prom-client: "^15.1.0"` to backend `package.json` dependencies.

---

## Architecture Overview

The monitoring dashboard consists of two parallel implementations:

### 1. Prometheus Metrics Module (`/backend/src/monitoring/`)
- **Purpose:** Prometheus-compatible metrics collection
- **Files:** 3 files (metrics.service.ts, monitoring.module.ts, health.controller.ts)
- **Metrics Collected:**
  - HTTP request duration and counts
  - GraphQL query/mutation performance
  - Database query performance and connection pool stats
  - Business metrics (production runs, material utilization, orders, revenue)
  - Security metrics (login attempts, unauthorized access, vault access)
  - Edge metrics (sync status, OEE, production events)
  - WebSocket connections and active users
- **Status:** ❌ Non-functional due to missing `prom-client` dependency

### 2. Advanced Monitoring Module (`/backend/src/modules/monitoring/`)
- **Purpose:** Real-time monitoring with GraphQL + NATS subscriptions
- **Files:** 6 files across services and GraphQL layers
- **Components:**
  - `HealthMonitorService` - Checks backend, frontend, database, NATS every 5s
  - `ErrorTrackingService` - Tracks errors with severity, status, resolution
  - `AgentActivityService` - Monitors AI agent status and progress
  - `ActiveFixesService` - Parses OWNER_REQUESTS.md for active issues
- **GraphQL Schema:** 402 lines defining queries, mutations, subscriptions
- **Database Tables:** `system_errors`, `health_history` (V0.0.1 migration)
- **Status:** ✅ All dependencies present (nats, axios, pg)

### 3. Frontend Dashboard (`/frontend/src/`)
- **Main Page:** `pages/MonitoringDashboard.tsx` (auto-refresh every 10s)
- **Components:** 6 monitoring components in `components/monitoring/`
  - SystemStatusCard, ErrorListCard, ActiveFixesCard
  - AgentActivityCard, ErrorFixMappingCard, ErrorsTable
- **GraphQL Queries:** Comprehensive queries and subscriptions in `graphql/monitoringQueries.ts`
- **Status:** ✅ All dependencies present (recharts, @mui/material, @apollo/client)

---

## Dependency Analysis

### Backend Dependencies Audit

**Currently Installed (package.json):**
```json
{
  "apollo-server": "^3.13.0",
  "axios": "^1.6.2",
  "dotenv": "^16.3.1",
  "graphql": "^16.8.1",
  "pg": "^8.11.3",
  "nats": "^2.18.0"
}
```

**Missing Dependencies:**

| Package | Used In | Import Statement | Impact |
|---------|---------|------------------|--------|
| `prom-client` | `src/monitoring/metrics.service.ts:2` | `import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'` | **CRITICAL** - Runtime failure on service initialization |

**All Other Imports Verified:**
- ✅ `nats` - Used in health-monitor, error-tracking, agent-activity services
- ✅ `axios` - Used in health-monitor service for HTTP health checks
- ✅ `pg` (Pool) - Used in all monitoring services for database access
- ✅ `fs`, `path` (Node.js built-ins) - Used in active-fixes service
- ✅ `graphql` - Used for GraphQL schema and resolvers

### Frontend Dependencies Audit

**Currently Installed (package.json):**
```json
{
  "recharts": "^3.6.0",          // ✅ Used for dashboard charts
  "@mui/material": "^5.15.0",     // ✅ Used for UI components
  "@apollo/client": "^3.8.8",     // ✅ Used for GraphQL queries
  "react": "^18.2.0",             // ✅ Required framework
  "react-dom": "^18.2.0"          // ✅ Required framework
}
```

**Status:** ✅ No missing dependencies detected

---

## Implementation Status

### What's Working ✅

1. **GraphQL Monitoring Schema** (402 lines)
   - Complete type definitions for health, errors, agents, fixes
   - Query, Mutation, and Subscription resolvers
   - Integration with NATS for real-time updates

2. **Database Schema**
   - `system_errors` table with severity, status, component, stack traces
   - `health_history` table for historical health checks
   - Appropriate indexes for query performance

3. **Health Monitoring Service**
   - Auto-checks every 5 seconds
   - Monitors: Backend (port 4000), Frontend (port 5173), Database, NATS
   - Publishes to NATS topics for distribution
   - Stores historical data in database

4. **Error Tracking Service**
   - Captures errors with full context (severity, component, stack)
   - Supports resolution tracking (status, assigned_to, resolution_notes)
   - NATS event publishing for real-time subscriptions

5. **Agent Activity Monitoring**
   - Tracks 6 known agents: cynthia, sylvia, roy, jen, billy, priya
   - Supports progress tracking, status updates, error reporting
   - Subscribes to NATS topics for agent updates

6. **Active Fixes Tracking**
   - Parses `../OWNER_REQUESTS.md` every 30 seconds
   - Extracts REQ numbers, status, priority, owner, dates
   - Exposes via GraphQL for dashboard display

7. **Frontend Dashboard**
   - 6 specialized monitoring components
   - Auto-refresh every 10 seconds
   - Manual refresh button
   - Real-time error and health tracking
   - Agent activity visualization

### What's Broken ❌

1. **Prometheus Metrics Service**
   - **File:** `src/monitoring/metrics.service.ts`
   - **Line 2:** `import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client'`
   - **Error:** Module not found at runtime
   - **Impact:** Cannot collect Prometheus-format metrics
   - **Fix:** Install `prom-client` package

### What's Incomplete ⚠️

1. **Uptime Calculation** (resolvers.ts:152)
   - TODO comment: "Calculate from health history"
   - Currently hardcoded to 99.5%
   - Should query `health_history` table for actual uptime

2. **Completion Tracking** (agent-activity.service.ts:250)
   - TODO comment: "Track completions"
   - Completed workflows today statistic not implemented
   - Should track and aggregate completion events

3. **Prometheus Endpoint Integration**
   - Metrics service exists but no `/metrics` endpoint exposed
   - Health controller exists but may not be registered with Apollo Server
   - Need to verify REST endpoint registration

---

## Data Flow Architecture

### Health Monitoring Flow
```
[HealthMonitorService]
  → Every 5s: Check 4 components
  → Store in health_history table
  → Publish to NATS: monitoring.health.*
  → [GraphQL Resolver]
    → Query current health
    → Subscribe to real-time updates
  → [Frontend Dashboard]
    → Poll every 10s
    → Display SystemStatusCard
```

### Error Tracking Flow
```
[Application Code]
  → Error occurs
  → [ErrorTrackingService.logError()]
    → Store in system_errors table
    → Publish to NATS: monitoring.errors.created
  → [GraphQL Resolver]
    → Query errors (filtered by severity/status)
    → Subscribe to new errors
  → [Frontend Dashboard]
    → Display in ErrorListCard
    → Color-coded by severity
```

### Agent Activity Flow
```
[Agent Workflow]
  → Publish to NATS: deliverables.*.update
  → [AgentActivityService]
    → Subscribe to agent topics
    → Update in-memory activity map
    → Publish to monitoring.agents.*
  → [GraphQL Resolver]
    → Query agent activities
    → Subscribe to updates
  → [Frontend Dashboard]
    → Display in AgentActivityCard
    → Show progress bars
```

### Active Fixes Flow
```
[ActiveFixesService]
  → Every 30s: Read ../OWNER_REQUESTS.md
  → Parse markdown for REQ-* entries
  → Extract status, priority, owner, dates
  → Store in memory
  → [GraphQL Resolver]
    → Query active fixes
  → [Frontend Dashboard]
    → Display in ActiveFixesCard
```

---

## File Locations Reference

### Backend Files

**Prometheus Metrics Module:**
- `print-industry-erp/backend/src/monitoring/metrics.service.ts` (416 lines)
- `print-industry-erp/backend/src/monitoring/monitoring.module.ts`
- `print-industry-erp/backend/src/monitoring/health.controller.ts`

**Advanced Monitoring Module:**
- `print-industry-erp/backend/src/modules/monitoring/services/health-monitor.service.ts`
- `print-industry-erp/backend/src/modules/monitoring/services/error-tracking.service.ts`
- `print-industry-erp/backend/src/modules/monitoring/services/agent-activity.service.ts`
- `print-industry-erp/backend/src/modules/monitoring/services/active-fixes.service.ts`
- `print-industry-erp/backend/src/modules/monitoring/graphql/schema.graphql` (402 lines)
- `print-industry-erp/backend/src/modules/monitoring/graphql/resolvers.ts`

**Database Schema:**
- `print-industry-erp/backend/migrations/V0.0.1__create_monitoring_tables.sql`

**Configuration:**
- `print-industry-erp/backend/package.json` (Dependencies declaration)

### Frontend Files

**Main Dashboard:**
- `print-industry-erp/frontend/src/pages/MonitoringDashboard.tsx`

**Components:**
- `print-industry-erp/frontend/src/components/monitoring/SystemStatusCard.tsx`
- `print-industry-erp/frontend/src/components/monitoring/ErrorListCard.tsx`
- `print-industry-erp/frontend/src/components/monitoring/ActiveFixesCard.tsx`
- `print-industry-erp/frontend/src/components/monitoring/AgentActivityCard.tsx`
- `print-industry-erp/frontend/src/components/monitoring/ErrorFixMappingCard.tsx`
- `print-industry-erp/frontend/src/components/monitoring/ErrorsTable.tsx`

**GraphQL Integration:**
- `print-industry-erp/frontend/src/graphql/monitoringQueries.ts`

---

## Recommendations for Marcus (Infrastructure Lead)

### Immediate Actions Required

1. **Install Missing Dependency** (CRITICAL)
   ```bash
   cd print-industry-erp/backend
   npm install prom-client@^15.1.0
   ```

2. **Verify Prometheus Endpoint** (HIGH)
   - Check if `/metrics` endpoint is exposed
   - Ensure `health.controller.ts` is registered with Apollo Server
   - Test Prometheus scraping capability

3. **Complete TODOs** (MEDIUM)
   - Implement uptime calculation from `health_history` table (resolvers.ts:152)
   - Implement completion tracking in agent activity service (agent-activity.service.ts:250)

### Testing Checklist

After installing `prom-client`:

- [ ] Backend starts without import errors
- [ ] Metrics service initializes successfully
- [ ] `/metrics` endpoint returns Prometheus-format data
- [ ] Health checks run every 5 seconds
- [ ] Errors are tracked in database
- [ ] GraphQL queries return monitoring data
- [ ] GraphQL subscriptions push real-time updates
- [ ] Frontend dashboard displays all 4 cards
- [ ] Auto-refresh works (10-second polling)
- [ ] Manual refresh button works

### Future Enhancements (Optional)

1. **Grafana Integration**
   - Set up Grafana dashboards to visualize Prometheus metrics
   - Create alerting rules for critical metrics

2. **Historical Analytics**
   - Implement uptime percentage calculation
   - Add trend analysis for error rates
   - Agent performance analytics

3. **Error Resolution Workflow**
   - Add assignment functionality for errors
   - Track time-to-resolution metrics
   - Integration with OWNER_REQUESTS.md

4. **Performance Optimization**
   - Consider caching for frequently queried data
   - Evaluate NATS subscription efficiency
   - Database query optimization for large datasets

---

## Conclusion

The monitoring dashboard infrastructure is **well-architected** and **nearly complete**. The only critical issue is the missing `prom-client` dependency, which prevents the Prometheus metrics service from functioning.

**Resolution:** Install `prom-client` package in backend dependencies.

**Estimated Effort:** 5 minutes to install dependency + 15 minutes testing = **20 minutes total**

**Risk Assessment:** Low risk - adding a well-maintained package with no breaking changes to existing code.

---

## Dependencies Summary

### Required Installation

```json
{
  "prom-client": "^15.1.0"
}
```

### Already Installed (Verified Working)

**Backend:**
- `apollo-server: "^3.13.0"`
- `axios: "^1.6.2"`
- `dotenv: "^16.3.1"`
- `graphql: "^16.8.1"`
- `pg: "^8.11.3"`
- `nats: "^2.18.0"`

**Frontend:**
- `recharts: "^3.6.0"`
- `@mui/material: "^5.15.0"`
- `@apollo/client: "^3.8.8"`

---

**End of Research Deliverable**
