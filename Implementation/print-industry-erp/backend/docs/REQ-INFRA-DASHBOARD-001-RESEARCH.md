# REQ-INFRA-DASHBOARD-001: Monitoring Dashboard Missing Dependencies - Research Report

**Assigned To:** Marcus (Warehouse/Infrastructure Product Owner)
**Research Completed By:** Cynthia (Research Agent)
**Date:** 2025-12-21
**Status:** COMPLETE

---

## Executive Summary

The monitoring dashboard infrastructure has been comprehensively architected with:
- 4-layer backend monitoring system
- Full GraphQL API with real-time subscriptions
- PostgreSQL schema with 3 monitoring tables
- React dashboard with 6 monitoring components
- NATS integration for event streaming
- Prometheus metrics collection

**CRITICAL FINDING:** There are **TWO MISSING DEPENDENCIES** in the backend `package.json` that will cause runtime failures when the monitoring services initialize.

---

## Missing Dependencies (CRITICAL)

### 1. prom-client (BLOCKING ISSUE)

**Location:** `backend/src/monitoring/metrics.service.ts:2`

**Current Code:**
```typescript
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
```

**Problem:** The `prom-client` package is imported but NOT listed in `backend/package.json` dependencies.

**Impact:**
- Runtime error on service startup
- Metrics service will fail to initialize
- `/metrics` endpoint will be unavailable
- Prometheus scraping will fail

**Solution:**
```json
"dependencies": {
  "prom-client": "^15.1.0"
}
```

**Recommended Version:** `15.1.0` (latest stable as of January 2025)

---

### 2. @nestjs/common (BLOCKING ISSUE)

**Locations:** Used in 11 files across the monitoring system:
- `backend/src/monitoring/metrics.service.ts:1` - `@Injectable()`
- `backend/src/monitoring/health.controller.ts:1` - `@Controller()`, `@Get()`
- `backend/src/monitoring/monitoring.module.ts:1` - `@Module()`
- All GraphQL resolvers - `@Resolver()`, `@Query()`, `@Mutation()`, `@Args()`, etc.

**Current Code Example:**
```typescript
import { Injectable } from '@nestjs/common';
import { Controller, Get } from '@nestjs/common';
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
```

**Problem:** The entire NestJS framework is missing from dependencies. The codebase uses NestJS decorators extensively but the framework is not installed.

**Impact:**
- All monitoring services will fail to initialize
- Health controller endpoints won't work
- GraphQL resolvers won't function
- Module system won't work

**Solution:**
```json
"dependencies": {
  "@nestjs/common": "^10.3.0",
  "@nestjs/core": "^10.3.0",
  "@nestjs/platform-express": "^10.3.0",
  "@nestjs/graphql": "^12.0.11"
}
```

**Note:** The codebase appears to be transitioning from raw Apollo Server to NestJS. All monitoring modules use NestJS decorators, but the main `index.ts` still uses raw Apollo Server setup. This architectural inconsistency needs to be resolved.

---

## Monitoring Dashboard Architecture (Current State)

### Layer 1: Database Schema

**Migration:** `V0.0.1__create_monitoring_tables.sql`

**Tables:**
1. **system_errors**
   - Columns: id, tenant_id, severity, status, message, stack_trace, component, user_id, assignment fields
   - Indexes: 5 indexes for performance (severity, status, component, last_occurred, tenant_id)
   - Purpose: Full error lifecycle tracking

2. **health_history**
   - Columns: id, component, status, response_time, error, metadata, checked_at
   - Index: component + checked_at (time-series queries)
   - Purpose: Historical health check data

3. **memories**
   - Columns: id, tenant_id, agent_id, content, embedding (vector[768]), relevance_score, metadata
   - Index: embedding vector (Ollama nomic-embed-text)
   - Purpose: AI agent memory system with semantic search

---

### Layer 2: Backend Services

**Directory:** `backend/src/modules/monitoring/services/`

#### Health Monitor Service
**File:** `health-monitor.service.ts`

**Features:**
- Monitors 4 components: Backend, Frontend, Database, NATS
- 5-second interval health checks
- Response time measurement for each component
- Publishes health data to:
  - NATS topic: `wms.monitoring.health`
  - PostgreSQL: `health_history` table

**Component Checks:**
- **Backend:** HTTP GET to `http://backend:4000/health`
- **Frontend:** HTTP GET to `http://frontend:3000`
- **Database:** PostgreSQL query `SELECT 1`
- **NATS:** Connection test to NATS server

**Dependencies:**
- `nats` - for publishing health data
- `axios` - for HTTP health checks
- `pg` (Pool) - for database queries

---

#### Error Tracking Service
**File:** `error-tracking.service.ts`

**Features:**
- Severity levels: CRITICAL, ERROR, WARNING, INFO
- Status tracking: OPEN, IN_PROGRESS, RESOLVED, IGNORED
- Full error lifecycle management
- Stack trace capture
- Component association
- User assignment tracking
- Resolution history

**Database Operations:**
- INSERT errors into `system_errors` table
- UPDATE error status and assignments
- SELECT with filtering by severity, status, component

**NATS Integration:**
- Publishes to `wms.errors.{severity}` topics
- Real-time error notifications

---

#### Agent Activity Service
**File:** `agent-activity.service.ts`

**Features:**
- Tracks 6 AI agents:
  1. Cynthia (Research)
  2. Sylvia (Critique)
  3. Roy (Backend)
  4. Jen (Frontend)
  5. Billy (QA)
  6. Priya (Statistics)

**Agent States:**
- IDLE - Agent waiting for work
- RUNNING - Agent actively processing
- BLOCKED - Agent waiting on dependencies
- COMPLETED - Agent finished task
- FAILED - Agent encountered error

**NATS Subscription:**
- Topic: `wms.agents.activity.*`
- Receives agent status updates in real-time
- Maintains in-memory state for each agent

**Data Tracked:**
- Current status
- Current task description
- Progress percentage (0-100)
- Last activity timestamp
- Error messages (if failed/blocked)

---

#### Active Fixes Service
**File:** `active-fixes.service.ts`

**Features:**
- Parses `OWNER_REQUESTS.md` file
- Re-parses every 30 seconds for real-time updates
- Extracts metadata from markdown sections

**Parsed Data:**
- Feature title
- Assigned owner
- Priority (High/Medium/Low)
- Status (Not Started/In Progress/Complete)
- Blockers (extracted from description)
- Description text

**File Location:**
`D:\GitHub\agogsaas\project-spirit\owner_requests\OWNER_REQUESTS.md`

**Use Case:** Real-time tracking of feature requests and bug fixes without database writes

---

### Layer 3: GraphQL API

**Directory:** `backend/src/modules/monitoring/graphql/`

**Files:**
- `schema.graphql` (403 lines) - Complete monitoring schema
- `resolvers.ts` - Query, Mutation, and Subscription resolvers
- `index.ts` - Module exports

---

#### GraphQL Types

**SystemHealth**
```graphql
type SystemHealth {
  overallStatus: String!
  backend: ComponentHealth!
  frontend: ComponentHealth!
  database: ComponentHealth!
  nats: ComponentHealth!
  lastChecked: String!
}

type ComponentHealth {
  status: String!
  responseTime: Int
  error: String
}
```

**SystemError**
```graphql
type SystemError {
  id: ID!
  tenantId: String
  severity: ErrorSeverity!
  status: ErrorStatus!
  message: String!
  stackTrace: String
  component: String
  userId: String
  assignedTo: String
  assignedAt: String
  resolvedAt: String
  resolutionNotes: String
  firstOccurred: String!
  lastOccurred: String!
  occurrenceCount: Int!
  metadata: JSON
}

enum ErrorSeverity {
  CRITICAL
  ERROR
  WARNING
  INFO
}

enum ErrorStatus {
  OPEN
  IN_PROGRESS
  RESOLVED
  IGNORED
}
```

**AgentActivity**
```graphql
type AgentActivity {
  agentId: String!
  agentName: String!
  status: AgentStatus!
  currentTask: String
  lastActive: String!
  progress: Int
  errorMessage: String
}

enum AgentStatus {
  IDLE
  RUNNING
  BLOCKED
  COMPLETED
  FAILED
}
```

**ActiveFix**
```graphql
type ActiveFix {
  id: String!
  title: String!
  owner: String!
  status: String!
  priority: String!
  description: String!
  blockers: [String!]
}
```

**FeatureWorkflow**
```graphql
type FeatureWorkflow {
  featureTitle: String!
  reqNumber: String!
  assignedTo: String!
  stages: [WorkflowStage!]!
  currentStage: Int!
  status: WorkflowStatus!
  createdAt: String!
  updatedAt: String!
  completionPercentage: Int!
}

type WorkflowStage {
  agentName: String!
  status: StageStatus!
  deliverable: String
  startedAt: String
  completedAt: String
  error: String
}

enum WorkflowStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
}

enum StageStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  FAILED
  SKIPPED
}
```

---

#### GraphQL Queries

```graphql
type Query {
  systemHealth: SystemHealth!
  systemErrors(
    severity: ErrorSeverity
    status: ErrorStatus
    component: String
    limit: Int
  ): [SystemError!]!
  agentActivities: [AgentActivity!]!
  activeFixes: [ActiveFix!]!
  activeWorkflows: [FeatureWorkflow!]!
  monitoringStats: MonitoringStats!
}

type MonitoringStats {
  totalErrors: Int!
  criticalErrors: Int!
  openErrors: Int!
  activeAgents: Int!
  idleAgents: Int!
  activeFixes: Int!
  systemUptime: Float!
}
```

---

#### GraphQL Mutations

```graphql
type Mutation {
  createError(input: CreateErrorInput!): SystemError!
  updateErrorStatus(
    errorId: ID!
    status: ErrorStatus!
    resolutionNotes: String
  ): SystemError!
  assignError(errorId: ID!, userId: String!): SystemError!

  startWorkflow(
    featureTitle: String!
    reqNumber: String!
    assignedTo: String!
    stages: [String!]!
  ): FeatureWorkflow!
}

input CreateErrorInput {
  severity: ErrorSeverity!
  message: String!
  stackTrace: String
  component: String
  metadata: JSON
}
```

---

#### GraphQL Subscriptions (Real-time)

```graphql
type Subscription {
  systemHealthUpdated: SystemHealth!
  errorCreated(
    severity: ErrorSeverity
    component: String
  ): SystemError!
  errorUpdated(errorId: ID): SystemError!
  agentActivityUpdated(agentId: String): AgentActivity!
  workflowUpdated(reqNumber: String): FeatureWorkflow!
}
```

**Implementation:**
- Uses Apollo Server subscriptions
- PubSub mechanism for event broadcasting
- Filters support for targeted subscriptions

---

### Layer 4: Prometheus Metrics

**File:** `backend/src/monitoring/metrics.service.ts`

**Categories:**

#### HTTP Metrics
- `http_request_duration_seconds` (Histogram)
  - Labels: method, route, status_code
  - Buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

- `http_requests_total` (Counter)
  - Labels: method, route, status_code

#### GraphQL Metrics
- `graphql_query_duration_seconds` (Histogram)
  - Labels: operation_name, operation_type
  - Buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]

- `graphql_query_total` (Counter)
  - Labels: operation_name, status

- `graphql_mutation_total` (Counter)
  - Labels: operation_name, status

#### Database Metrics
- `db_query_duration_seconds` (Histogram)
  - Labels: query_type
  - Buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5]

- `db_connection_pool_size` (Gauge)
- `db_connection_pool_max` (Gauge)

#### Business Metrics
- `active_production_runs` (Gauge)
  - Labels: facility_id, facility_name, tenant_id

- `material_utilization_percentage` (Gauge)
  - Labels: facility_id, facility_name

- `orders_created_total` (Counter)
  - Labels: tenant_id, tenant_name

- `orders_fulfilled_total` (Counter)
  - Labels: tenant_id, tenant_name

- `marketplace_jobs_posted_total` (Counter)
- `marketplace_bids_submitted_total` (Counter)
- `marketplace_jobs_completed_total` (Counter)

- `revenue_total` (Counter)
  - Labels: tenant_id, tenant_name

#### Security Metrics
- `auth_failed_login_attempts_total` (Counter)
  - Labels: username, ip_address

- `auth_login_success_total` (Counter)
  - Labels: username, auth_method

- `auth_unauthorized_access_total` (Counter)
  - Labels: username, resource, security_zone

- `vault_access_total` (Counter)
  - Labels: username, vault_type

- `chain_of_custody_events_total` (Counter)
  - Labels: event_type

#### Edge Metrics
- `edge_last_sync_timestamp` (Gauge)
  - Labels: facility_id, facility_name, tenant_id

- `production_events_captured_total` (Counter)
  - Labels: facility_id, facility_name, event_type

- `overall_equipment_effectiveness` (Gauge)
  - Labels: facility_id, facility_name
  - Range: 0-100 (percentage)

- `production_items_completed_total` (Counter)
  - Labels: facility_id, facility_name

#### WebSocket Metrics
- `websocket_connections_active` (Gauge)
- `active_users_gauge` (Gauge)

**Default Metrics:**
- CPU usage
- Memory usage
- Heap statistics
- Event loop lag
- Process uptime

**Endpoint:** `GET /metrics` (Prometheus scrape target)

---

### Layer 5: Health Check Endpoints

**File:** `backend/src/monitoring/health.controller.ts`

#### Available Endpoints

**1. Basic Health Check**
```
GET /health
```
**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-12-21T10:30:00.000Z",
  "service": "agogsaas-backend",
  "version": "1.0.0",
  "environment": "blue",
  "region": "US-EAST"
}
```
**Use:** Load balancers, basic monitoring

---

**2. Liveness Probe**
```
GET /health/live
```
**Response:**
```json
{
  "status": "alive",
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```
**Use:** Kubernetes liveness probe (restart pod if fails)

---

**3. Readiness Probe**
```
GET /health/ready
```
**Response (Ready):**
```json
{
  "status": "ready",
  "checks": {
    "database": true,
    "nats": true,
    "ollama": true
  },
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```

**Response (Not Ready):**
```json
{
  "status": "not_ready",
  "checks": {
    "database": true,
    "nats": false,
    "ollama": false
  },
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```
**Use:** Kubernetes readiness probe, load balancers (remove from pool if not ready)

**Dependency Checks:**
- PostgreSQL: `SELECT 1` query with 3-second timeout
- NATS: Connection test with 3-second timeout
- Ollama: API tags endpoint check (optional, won't fail readiness)

---

**4. Prometheus Metrics**
```
GET /metrics
```
**Response:** Prometheus text format
```
# HELP http_request_duration_seconds Duration of HTTP requests in seconds
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{method="GET",route="/health",status_code="200",le="0.005"} 150
...

# HELP active_production_runs Number of currently active production runs
# TYPE active_production_runs gauge
active_production_runs{facility_id="FAC001",facility_name="Denver Plant",tenant_id="T1"} 12
```
**Use:** Prometheus server scraping (every 15 seconds)

---

**5. Metrics Summary**
```
GET /metrics/summary
```
**Response:**
```json
{
  "http": {
    "requests_per_second": 125.5,
    "error_rate_percent": 0.2,
    "p95_latency_ms": 45
  },
  "database": {
    "connection_pool_size": 15,
    "connection_pool_max": 200,
    "query_p95_ms": 12
  },
  "business": {
    "active_production_runs": 8,
    "material_utilization_percent": 87.5,
    "orders_today": 42
  },
  "edge": {
    "facilities_online": 3,
    "facilities_offline": 0
  },
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```
**Use:** Debugging, human-readable metrics

---

**6. System Info**
```
GET /health/info
```
**Response:**
```json
{
  "node_version": "v20.10.0",
  "platform": "linux",
  "arch": "x64",
  "uptime": 3600.5,
  "memory": {
    "total": 1073741824,
    "used": 536870912,
    "external": 12345678,
    "rss": 645922816
  },
  "environment": {
    "node_env": "production",
    "environment": "blue",
    "region": "US-EAST",
    "database_url": "***",
    "nats_url": "nats://nats:4222",
    "ollama_url": "http://ollama:11434"
  },
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```
**Use:** Debugging, troubleshooting

---

### Layer 6: Frontend Dashboard

**Directory:** `frontend/src/`

#### Main Dashboard Page
**File:** `pages/MonitoringDashboard.tsx`

**Features:**
- Auto-refresh toggle (10-second interval)
- Manual refresh button
- Last update timestamp display
- Responsive grid layout
- Material-UI styling

**Components Rendered:**
1. SystemStatusCard
2. ErrorListCard
3. ActiveFixesCard
4. AgentActivityCard
5. ErrorFixMappingCard
6. ErrorsTable

---

#### Dashboard Components

**1. SystemStatusCard**
**File:** `components/monitoring/SystemStatusCard.tsx`

**Query:** `GET_SYSTEM_HEALTH`

**Display:**
- 4 component health statuses (backend, frontend, database, nats)
- Color-coded indicators:
  - Green: HEALTHY
  - Orange: DEGRADED
  - Red: UNHEALTHY
- Response time for each component
- Last checked timestamp

**Polling:** 10-second interval

---

**2. ErrorListCard**
**File:** `components/monitoring/ErrorListCard.tsx`

**Query:** `GET_SYSTEM_ERRORS` (limit: 10)

**Display:**
- Top 10 recent errors
- Severity chips (color-coded)
- Error message
- Component association
- Timestamp
- Expandable for stack trace

**Polling:** 10-second interval

---

**3. ActiveFixesCard**
**File:** `components/monitoring/ActiveFixesCard.tsx`

**Query:** `GET_ACTIVE_FIXES`

**Display:**
- List of active fixes from OWNER_REQUESTS.md
- Owner assignment
- Status (Not Started / In Progress / Complete)
- Priority (High / Medium / Low)
- Clickable for details

**Polling:** 10-second interval

---

**4. AgentActivityCard**
**File:** `components/monitoring/AgentActivityCard.tsx`

**Query:** `GET_AGENT_ACTIVITIES`

**Display:**
- Grid layout showing all 6 agents
- Agent name and current status
- Progress bars for RUNNING agents
- Status color-coding:
  - Gray: IDLE
  - Blue: RUNNING
  - Yellow: BLOCKED
  - Green: COMPLETED
  - Red: FAILED
- Current task description
- Last activity timestamp

**Polling:** 10-second interval

---

**5. ErrorFixMappingCard**
**File:** `components/monitoring/ErrorFixMappingCard.tsx`

**Purpose:** Maps errors from ROADMAP.md to fixes from OWNER_REQUESTS.md

**Display:**
- Error ID and description
- Mapped fix (if exists)
- Coverage statistics:
  - Errors with fixes
  - Errors without fixes
- Color coding:
  - Green: Fixed
  - Yellow: Being fixed
  - Red: No fix assigned

**Data Source:** Static mapping (currently hardcoded, needs integration with actual data)

---

**6. ErrorsTable**
**File:** `components/monitoring/ErrorsTable.tsx`

**Data:** 9 pre-defined errors (ERROR-001 through ERROR-009)

**Display:**
- Expandable table rows
- Error ID and description
- Frequency count
- Error rate percentage
- Severity
- Fix status
- Stack trace (in expansion panel)
- Sortable by all columns

**Data Source:** Static data (needs integration with GET_SYSTEM_ERRORS query)

---

#### GraphQL Queries (Frontend)
**File:** `frontend/src/graphql/monitoringQueries.ts`

**Exports:**
- `GET_SYSTEM_HEALTH` - Current system status
- `GET_SYSTEM_ERRORS` - List errors with filters
- `GET_ACTIVE_FIXES` - List active fixes
- `GET_AGENT_ACTIVITIES` - All agent statuses
- `GET_MONITORING_STATS` - Aggregated stats
- `SUBSCRIBE_SYSTEM_HEALTH` - Real-time health updates
- `SUBSCRIBE_ERROR_CREATED` - Real-time error notifications
- `SUBSCRIBE_AGENT_ACTIVITY` - Real-time agent updates

---

## Frontend Dependencies (Current State)

**File:** `frontend/package.json`

**Dependencies:**
```json
{
  "@apollo/client": "^3.8.8",
  "@emotion/react": "^11.11.1",
  "@emotion/styled": "^11.11.0",
  "@mui/icons-material": "^5.15.0",
  "@mui/material": "^5.15.0",
  "@tanstack/react-table": "^8.21.3",
  "graphql": "^16.8.1",
  "lucide-react": "^0.562.0",
  "nats.ws": "^1.30.3",
  "react": "^18.2.0",
  "react-dom": "^18.2.0",
  "react-i18next": "^16.5.0",
  "react-router-dom": "^6.20.1",
  "recharts": "^3.6.0",
  "zustand": "^5.0.9"
}
```

**Status:** ✅ All frontend dependencies are present

---

## Backend Dependencies (Current State)

**File:** `backend/package.json`

**Current Dependencies:**
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

**Status:** ❌ MISSING CRITICAL DEPENDENCIES

---

## NATS Integration

### Monitoring Topics

**Published by Health Monitor:**
- `wms.monitoring.health` - System health updates every 5 seconds

**Published by Error Tracking:**
- `wms.errors.CRITICAL` - Critical errors
- `wms.errors.ERROR` - Standard errors
- `wms.errors.WARNING` - Warnings
- `wms.errors.INFO` - Info messages

**Subscribed by Agent Activity:**
- `wms.agents.activity.*` - Agent status updates

**Message Format (Health):**
```json
{
  "overallStatus": "HEALTHY",
  "components": {
    "backend": { "status": "HEALTHY", "responseTime": 5 },
    "frontend": { "status": "HEALTHY", "responseTime": 12 },
    "database": { "status": "HEALTHY", "responseTime": 2 },
    "nats": { "status": "HEALTHY", "responseTime": 1 }
  },
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```

**Message Format (Error):**
```json
{
  "id": "e123",
  "severity": "ERROR",
  "message": "Database connection timeout",
  "component": "backend",
  "timestamp": "2025-12-21T10:30:00.000Z",
  "stackTrace": "Error: timeout\n  at Connection.query (...)"
}
```

**Message Format (Agent Activity):**
```json
{
  "agentId": "cynthia",
  "agentName": "Cynthia (Research)",
  "status": "RUNNING",
  "currentTask": "Research monitoring dashboard dependencies",
  "progress": 75,
  "timestamp": "2025-12-21T10:30:00.000Z"
}
```

---

## Initialization Flow

**File:** `backend/src/index.ts`

**Startup Sequence:**
1. Load environment variables from `.env`
2. Initialize PostgreSQL connection pool
3. Test database connectivity with `SELECT 1`
4. Initialize NATS connection
5. Create monitoring service instances:
   - HealthMonitorService
   - ErrorTrackingService
   - AgentActivityService
   - ActiveFixesService
6. Create orchestration services:
   - OrchestratorService
   - StrategicOrchestratorService
   - AgentSpawnerService
7. Load GraphQL schemas:
   - Core schemas (tenant, operations, wms, finance, sales, quality, etc.)
   - Monitoring schema
8. Create Apollo Server with merged schemas and resolvers
9. Start health monitoring loop (5-second interval)
10. Start Apollo Server on port 4000
11. Log initialization messages for each layer

**Current Architecture Issue:**
The codebase uses a **hybrid approach**:
- Main server: Raw Apollo Server setup
- Monitoring modules: NestJS decorators (@Injectable, @Controller, @Module)

This creates a mismatch. Either:
1. Migrate fully to NestJS (recommended for large-scale apps)
2. Remove NestJS decorators and use plain TypeScript classes

---

## Recommended Actions for Marcus

### Immediate (Blocking)

1. **Install Missing Dependencies**
   ```bash
   cd print-industry-erp/backend
   npm install prom-client@15.1.0
   npm install @nestjs/common@10.3.0 @nestjs/core@10.3.0 @nestjs/platform-express@10.3.0 @nestjs/graphql@12.0.11 @nestjs/apollo@12.0.11
   ```

2. **Update package.json**
   Add to dependencies section:
   ```json
   "prom-client": "^15.1.0",
   "@nestjs/common": "^10.3.0",
   "@nestjs/core": "^10.3.0",
   "@nestjs/platform-express": "^10.3.0",
   "@nestjs/graphql": "^12.0.11",
   "@nestjs/apollo": "^12.0.11",
   "reflect-metadata": "^0.1.13"
   ```

3. **Test Service Startup**
   ```bash
   npm run dev
   ```
   Expected: Services start without import errors

---

### Short-term (Next Sprint)

4. **Resolve Architecture Inconsistency**
   - Decision needed: Full NestJS migration or remove NestJS decorators?
   - If keeping NestJS:
     - Refactor `index.ts` to use NestJS bootstrap
     - Create proper NestJS modules for all services
     - Use dependency injection throughout
   - If removing NestJS:
     - Replace decorators with plain TypeScript classes
     - Use factory functions for service instantiation

5. **Enable Prometheus Scraping**
   - Configure Prometheus to scrape `http://backend:4000/metrics`
   - Set scrape interval to 15 seconds
   - Verify metrics are being collected

6. **Configure Kubernetes Probes**
   - Liveness probe: `GET /health/live`
   - Readiness probe: `GET /health/ready`
   - Initial delay: 30 seconds
   - Period: 10 seconds
   - Timeout: 5 seconds

---

### Medium-term (Next Month)

7. **Integrate Frontend with Live Data**
   - ErrorFixMappingCard: Connect to actual error/fix data
   - ErrorsTable: Replace static data with GET_SYSTEM_ERRORS query
   - Add subscription support for real-time updates

8. **Add Alerting Rules**
   - Prometheus alert for critical errors
   - Prometheus alert for component health degradation
   - PagerDuty integration for on-call alerts

9. **Create Grafana Dashboards**
   - System health overview
   - Error trends and rates
   - Agent activity timeline
   - Business metrics (production runs, orders, revenue)
   - Edge facility health

10. **Performance Testing**
    - Load test health endpoints
    - Verify metrics collection overhead is < 1% CPU
    - Test with 1000+ concurrent WebSocket connections

---

## File Structure Summary

```
Backend Monitoring:
├── src/monitoring/
│   ├── health.controller.ts (195 lines)
│   ├── metrics.service.ts (416 lines)
│   └── monitoring.module.ts
└── src/modules/monitoring/
    ├── graphql/
    │   ├── schema.graphql (403 lines)
    │   ├── resolvers.ts
    │   └── index.ts
    └── services/
        ├── health-monitor.service.ts
        ├── error-tracking.service.ts
        ├── agent-activity.service.ts
        └── active-fixes.service.ts

Frontend Monitoring:
├── src/pages/
│   └── MonitoringDashboard.tsx
├── src/components/monitoring/
│   ├── SystemStatusCard.tsx
│   ├── ErrorListCard.tsx
│   ├── ActiveFixesCard.tsx
│   ├── AgentActivityCard.tsx
│   ├── ErrorFixMappingCard.tsx
│   └── ErrorsTable.tsx
└── src/graphql/
    └── monitoringQueries.ts

Database:
└── migrations/
    └── V0.0.1__create_monitoring_tables.sql
```

---

## Related Documentation

- **NATS Implementation:** See `NATS_IMPLEMENTATION_COMPLETE.md`
- **Strategic Agent Layer:** See `STRATEGIC_AGENT_LAYER_COMPLETE.md`
- **Phase 4 Completion:** See `PHASE4_COMPLETE.md`
- **Migration Summary:** See `MIGRATION_V1.0.11_SUMMARY.md`

---

## Testing Checklist for Marcus

After installing dependencies:

- [ ] Backend starts without import errors
- [ ] `GET /health` returns 200 OK
- [ ] `GET /health/ready` checks all dependencies
- [ ] `GET /metrics` returns Prometheus format
- [ ] GraphQL query `systemHealth` works
- [ ] GraphQL query `systemErrors` works
- [ ] GraphQL query `agentActivities` works
- [ ] GraphQL query `activeFixes` works
- [ ] Frontend dashboard loads without errors
- [ ] System status card shows component health
- [ ] Error list card displays recent errors
- [ ] Agent activity card shows agent statuses
- [ ] Active fixes card shows OWNER_REQUESTS.md data
- [ ] Auto-refresh works (10-second interval)
- [ ] NATS health monitoring publishes to `wms.monitoring.health`

---

## Contact for Questions

**Research Completed By:** Cynthia (Research Agent)
**Next Stage Owner:** Marcus (Warehouse/Infrastructure PO)
**Code Review:** Chuck (Senior Review Agent)
**Deployment:** Miki (DevOps PO)

---

## Appendix A: Complete Dependency List (Recommended)

**Backend package.json (Complete):**
```json
{
  "name": "agogsaas-backend",
  "version": "1.0.0",
  "description": "AgogSaaS Backend - GraphQL API with 4-layer AI system",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "migrate": "echo 'Migrations applied via docker-entrypoint-initdb.d'"
  },
  "dependencies": {
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/graphql": "^12.0.11",
    "@nestjs/apollo": "^12.0.11",
    "apollo-server": "^3.13.0",
    "axios": "^1.6.2",
    "dotenv": "^16.3.1",
    "graphql": "^16.8.1",
    "pg": "^8.11.3",
    "nats": "^2.18.0",
    "prom-client": "^15.1.0",
    "reflect-metadata": "^0.1.13"
  },
  "devDependencies": {
    "@types/node": "^20.10.4",
    "@types/pg": "^8.10.9",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.2",
    "@typescript-eslint/parser": "^6.13.2",
    "jest": "^29.7.0"
  }
}
```

---

## Appendix B: Environment Variables Required

**Backend .env file:**
```bash
# Database
DATABASE_URL=postgresql://agoguser:agogpass@postgres:5432/agogdb

# NATS
NATS_URL=nats://nats:4222

# Ollama (AI)
OLLAMA_URL=http://ollama:11434

# Server
PORT=4000
NODE_ENV=production

# Deployment
ENVIRONMENT=blue
REGION=US-EAST

# Health Check URLs (for monitoring)
BACKEND_URL=http://backend:4000
FRONTEND_URL=http://frontend:3000

# File Paths
OWNER_REQUESTS_PATH=/app/../project-spirit/owner_requests/OWNER_REQUESTS.md
```

---

## Appendix C: Prometheus Scrape Configuration

**prometheus.yml:**
```yaml
scrape_configs:
  - job_name: 'agogsaas-backend'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: /metrics
    static_configs:
      - targets: ['backend:4000']
        labels:
          environment: 'production'
          region: 'us-east'
          service: 'agogsaas-backend'
```

---

## Appendix D: Kubernetes Health Probes

**deployment.yaml:**
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agogsaas-backend
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: backend
        image: agogsaas-backend:latest
        ports:
        - containerPort: 4000
        livenessProbe:
          httpGet:
            path: /health/live
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 4000
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
```

---

**END OF RESEARCH REPORT**
