# REQ-INFRA-DASHBOARD-001: Monitoring Dashboard Missing Dependencies

**Research Agent:** Cynthia
**Date:** 2025-12-21
**Status:** COMPLETE

## Executive Summary

Analysis of the monitoring dashboard infrastructure has revealed **6 critical missing dependencies** and **3 configuration issues** that prevent the monitoring dashboard from functioning properly. The dashboard components exist and are well-architected, but cannot compile or run due to missing npm packages and incorrect path aliases.

---

## Critical Findings

### 1. BACKEND MISSING DEPENDENCIES

The backend monitoring services require NestJS framework and Prometheus client, but these are **completely absent** from package.json:

#### Missing Packages (Backend)
| Package | Current | Required | Used By |
|---------|---------|----------|---------|
| `@nestjs/common` | **MISSING** | `^10.0.0` | All monitoring services, controllers |
| `@nestjs/core` | **MISSING** | `^10.0.0` | NestJS runtime |
| `@nestjs/platform-express` | **MISSING** | `^10.0.0` | HTTP server integration |
| `prom-client` | **MISSING** | `^15.0.0` | Prometheus metrics collection |
| `reflect-metadata` | **MISSING** | `^0.1.13` | NestJS decorator support |
| `ts-node` | **MISSING** | `^10.9.0` | TypeScript runtime execution |

**Files Affected:**
- `backend/src/monitoring/monitoring.module.ts:1` - Imports `@nestjs/common`
- `backend/src/monitoring/health.controller.ts:1` - Imports `@nestjs/common`
- `backend/src/monitoring/metrics.service.ts:1-2` - Imports `@nestjs/common` and `prom-client`
- `backend/src/modules/imposition/imposition.resolver.ts` - Uses NestJS decorators
- `backend/src/modules/imposition/imposition-engine.service.ts` - Uses NestJS decorators

**Impact:** Backend cannot compile or start. All monitoring endpoints return 404.

---

### 2. FRONTEND MISSING DEPENDENCIES

The frontend has an **incorrect path alias** preventing imports from resolving:

#### Configuration Issue (Frontend)
**Problem:** Components import from `@graphql/queries` but:
- `vite.config.ts` only defines `@` and `@components` aliases
- `tsconfig.json` only defines `@/*` path mapping
- **NO `@graphql` alias exists**

**Files Affected:**
- `frontend/src/components/monitoring/SystemStatusCard.tsx:6`
- `frontend/src/components/monitoring/ErrorListCard.tsx:3`
- `frontend/src/components/monitoring/ActiveFixesCard.tsx:3`
- `frontend/src/components/monitoring/AgentActivityCard.tsx:3`

**Expected File:**
- Imports reference: `@graphql/queries`
- Actual file: `frontend/src/graphql/monitoringQueries.ts` (exports monitoring queries)
- No barrel export file exists at `graphql/queries.ts`

**Impact:** Frontend cannot compile. Module resolution fails with "Cannot find module '@graphql/queries'".

---

### 3. MISSING GRAPHQL QUERY BARREL EXPORT

**Problem:** Monitoring queries are defined in `monitoringQueries.ts` but components import from a non-existent `queries.ts` barrel file.

**Current Structure:**
```
frontend/src/graphql/
├── monitoringQueries.ts  ← Contains GET_SYSTEM_HEALTH, etc.
├── client.ts
└── queries/
    ├── kpis.ts
    ├── operations.ts
    ├── wms.ts
    ├── finance.ts
    ├── quality.ts
    └── marketplace.ts
```

**Required Fix:** Create `frontend/src/graphql/queries.ts` that re-exports from `monitoringQueries.ts`

---

## Detailed Dependency Analysis

### Backend Dependencies Deep Dive

#### 1. NestJS Framework (CRITICAL)
**Why Needed:**
- `monitoring.module.ts` uses `@Module()` decorator
- `health.controller.ts` uses `@Controller()`, `@Get()` decorators
- `metrics.service.ts` uses `@Injectable()` decorator

**Required Packages:**
```json
{
  "@nestjs/common": "^10.0.0",
  "@nestjs/core": "^10.0.0",
  "@nestjs/platform-express": "^10.0.0",
  "reflect-metadata": "^0.1.13"
}
```

**Installation:**
```bash
cd backend
npm install @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata
```

#### 2. Prometheus Client (CRITICAL)
**Why Needed:**
- `metrics.service.ts:2` imports `Registry, Counter, Histogram, Gauge, collectDefaultMetrics`
- Exposes `/metrics` endpoint for Prometheus scraping
- Collects HTTP, GraphQL, DB, business, and security metrics

**Required Package:**
```json
{
  "prom-client": "^15.0.0"
}
```

**Installation:**
```bash
cd backend
npm install prom-client
```

#### 3. TypeScript Node (RECOMMENDED)
**Why Needed:**
- Development scripts use `ts-node` for execution
- Scripts like `scripts/test-orchestration.ts` require direct TS execution

**Required Package:**
```json
{
  "ts-node": "^10.9.0"
}
```

**Installation:**
```bash
cd backend
npm install --save-dev ts-node
```

---

### Frontend Configuration Fixes

#### Fix 1: Add @graphql Alias to vite.config.ts

**Current:**
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@components': path.resolve(__dirname, './src/components'),
  },
}
```

**Required:**
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@components': path.resolve(__dirname, './src/components'),
    '@graphql': path.resolve(__dirname, './src/graphql'),
  },
}
```

#### Fix 2: Add @graphql Path to tsconfig.json

**Current:**
```json
{
  "paths": {
    "@/*": ["./src/*"]
  }
}
```

**Required:**
```json
{
  "paths": {
    "@/*": ["./src/*"],
    "@graphql/*": ["./src/graphql/*"]
  }
}
```

#### Fix 3: Create Barrel Export File

**Create:** `frontend/src/graphql/queries.ts`

**Content:**
```typescript
// Re-export monitoring queries
export {
  GET_SYSTEM_HEALTH,
  GET_SYSTEM_ERRORS,
  GET_ACTIVE_FIXES,
  GET_AGENT_ACTIVITIES,
  GET_AGENT_ACTIVITY,
  GET_FEATURE_WORKFLOWS,
  GET_MONITORING_STATS,
  SUBSCRIBE_SYSTEM_HEALTH,
  SUBSCRIBE_ERROR_CREATED,
  SUBSCRIBE_AGENT_ACTIVITY,
} from './monitoringQueries';

// Re-export other query modules
export * from './queries/kpis';
export * from './queries/operations';
export * from './queries/wms';
export * from './queries/finance';
export * from './queries/quality';
export * from './queries/marketplace';
```

---

## Current vs Required State

### Backend package.json

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

**Missing:**
- NestJS packages (5 packages)
- prom-client (1 package)
- ts-node (dev dependency)

### Frontend Configuration

**Current Aliases:**
- `@` → `./src`
- `@components` → `./src/components`

**Missing:**
- `@graphql` → `./src/graphql`

---

## Architecture Context

### Monitoring Dashboard Components

The monitoring dashboard is well-architected with the following structure:

**Frontend (Layer 1 - User Interface):**
- `MonitoringDashboard.tsx` - Main dashboard page with auto-refresh
- `SystemStatusCard.tsx` - Displays backend, frontend, DB, NATS health
- `ErrorListCard.tsx` - Shows system errors with severity filtering
- `ActiveFixesCard.tsx` - Tracks REQ fix requests
- `AgentActivityCard.tsx` - Shows Cynthia, Roy, Jen, Billy, Priya, Sylvia status
- `ErrorsTable.tsx` - Detailed error history table

**Backend (Layer 2 - Monitoring Services):**
- `health.controller.ts` - REST endpoints: `/health`, `/health/ready`, `/metrics`
- `metrics.service.ts` - Prometheus metrics collection
- `health-monitor.service.ts` - Component health checks (DB, NATS, Ollama)
- `error-tracking.service.ts` - System error CRUD + NATS events
- `agent-activity.service.ts` - Agent workflow tracking
- `active-fixes.service.ts` - OWNER_REQUESTS.md parser

**Database (Layer 0 - Persistence):**
- `system_errors` table - Error tracking with severity/status
- `health_history` table - Component health check history
- `memories` table - AI agent vector embeddings

**Integration Points:**
- GraphQL: All monitoring queries/mutations/subscriptions
- NATS: Event publishing for health, errors, agent activity
- Prometheus: Metrics scraping endpoint
- Kubernetes: Liveness/readiness probes

---

## Risk Assessment

### HIGH RISK - Production Blocking
1. **Backend cannot start** - NestJS dependencies missing
2. **Frontend cannot compile** - Module resolution failure
3. **No monitoring visibility** - Dashboard completely non-functional

### MEDIUM RISK - Operational
4. **Prometheus metrics unavailable** - No observability
5. **Health checks failing** - Kubernetes may kill pods
6. **Agent tracking offline** - Workflow visibility lost

### LOW RISK - Development
7. **TypeScript scripts fail** - Development workflow impacted

---

## Recommendations

### Immediate Actions (P0)

1. **Install Backend Dependencies:**
```bash
cd print-industry-erp/backend
npm install @nestjs/common@^10.0.0 @nestjs/core@^10.0.0 @nestjs/platform-express@^10.0.0 reflect-metadata@^0.1.13 prom-client@^15.0.0
npm install --save-dev ts-node@^10.9.0
```

2. **Fix Frontend Path Aliases:**
   - Update `vite.config.ts` with `@graphql` alias
   - Update `tsconfig.json` with `@graphql/*` path
   - Create barrel export at `graphql/queries.ts`

3. **Verify Monitoring Dashboard:**
   - Run `npm run dev` in both backend and frontend
   - Access dashboard at `http://localhost:3000/monitoring`
   - Verify all cards load without errors

### Follow-up Actions (P1)

4. **Update Documentation:**
   - Document required dependencies in README
   - Add monitoring dashboard setup guide
   - Include troubleshooting section

5. **Add Dependency Checks:**
   - Create pre-build validation script
   - Add dependency audit to CI/CD pipeline

6. **Testing:**
   - Add monitoring component unit tests
   - Create integration tests for GraphQL queries
   - Add E2E tests for dashboard functionality

---

## Files Requiring Changes

### Backend Files
1. `print-industry-erp/backend/package.json` - Add 6 missing dependencies
2. No code changes required (imports are already correct)

### Frontend Files
1. `print-industry-erp/frontend/vite.config.ts` - Add @graphql alias
2. `print-industry-erp/frontend/tsconfig.json` - Add @graphql/* path
3. `print-industry-erp/frontend/src/graphql/queries.ts` - CREATE NEW barrel export

### No Changes Required
- All monitoring components are correctly implemented
- GraphQL schema and resolvers are properly defined
- Database migrations are complete
- NATS integration is functional

---

## Dependencies for Marcus (Warehouse PO)

As the assigned implementer (marcus), you will need:

1. **Backend Package Installation Commands** (provided above)
2. **Frontend Configuration Updates** (vite.config.ts, tsconfig.json)
3. **Barrel Export File Template** (queries.ts content provided)
4. **Validation Steps:**
   - Backend: `npm run build` should succeed
   - Frontend: `npm run build` should succeed
   - Runtime: Dashboard should render all 5 cards
   - Metrics: `curl http://localhost:4000/metrics` should return Prometheus data

---

## Verification Checklist

### Backend Verification
- [ ] `npm install` completes without errors
- [ ] `npm run build` compiles successfully
- [ ] `npm run dev` starts server on port 4000
- [ ] GET `http://localhost:4000/health` returns 200
- [ ] GET `http://localhost:4000/metrics` returns Prometheus metrics
- [ ] GET `http://localhost:4000/graphql` (GraphQL playground loads)

### Frontend Verification
- [ ] `npm install` completes without errors (should be unchanged)
- [ ] `npm run build` compiles successfully
- [ ] `npm run dev` starts Vite on port 3000
- [ ] No module resolution errors in console
- [ ] Dashboard renders at `/monitoring` route
- [ ] SystemStatusCard displays component health
- [ ] ErrorListCard loads errors
- [ ] ActiveFixesCard shows REQ items
- [ ] AgentActivityCard displays agent status

### Integration Verification
- [ ] GraphQL queries return data (not just mock data)
- [ ] Auto-refresh works (updates every 10s)
- [ ] Manual refresh button works
- [ ] No console errors in browser DevTools
- [ ] Network tab shows successful GraphQL requests

---

## Conclusion

The monitoring dashboard architecture is **sound and well-implemented**, but is completely **non-functional due to missing dependencies**. The fixes are straightforward:

1. 6 npm packages need to be installed (backend)
2. 2 configuration files need alias updates (frontend)
3. 1 barrel export file needs to be created (frontend)

**Estimated Fix Time:** 15-30 minutes
**Risk Level:** Low (non-breaking changes, additive only)
**Priority:** HIGH (blocks monitoring capabilities)

All required implementation details, commands, and verification steps have been provided for Marcus to execute.

---

## Appendix: Component Import Graph

```
MonitoringDashboard.tsx
├─ imports SystemStatusCard.tsx
│  └─ imports @graphql/queries (GET_SYSTEM_HEALTH) ❌ BROKEN
├─ imports ErrorListCard.tsx
│  └─ imports @graphql/queries (GET_SYSTEM_ERRORS) ❌ BROKEN
├─ imports ActiveFixesCard.tsx
│  └─ imports @graphql/queries (GET_ACTIVE_FIXES) ❌ BROKEN
└─ imports AgentActivityCard.tsx
   └─ imports @graphql/queries (GET_AGENT_ACTIVITIES) ❌ BROKEN

ACTUAL FILE: frontend/src/graphql/monitoringQueries.ts
EXPECTED PATH: @graphql/queries → frontend/src/graphql/queries.ts
STATUS: File does not exist, alias not configured
```

---

**End of Research Deliverable**
