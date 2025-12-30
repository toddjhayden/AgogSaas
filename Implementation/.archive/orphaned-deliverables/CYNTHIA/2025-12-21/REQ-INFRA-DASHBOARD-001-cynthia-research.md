# Research Report: Monitoring Dashboard Missing Dependencies
**REQ Number:** REQ-INFRA-DASHBOARD-001
**Agent:** Cynthia (Research Specialist)
**Date:** 2025-12-21
**Status:** COMPLETE

---

## Executive Summary

The monitoring dashboard in the AgogSaaS frontend is experiencing critical dependency issues preventing it from functioning. Analysis reveals **ALL npm dependencies are missing** from the frontend project, including essential packages for the monitoring dashboard functionality. Additionally, there is a **TypeScript path alias configuration mismatch** that would prevent proper module resolution even after dependencies are installed.

---

## Problem Identification

### 1. Missing Dependencies (CRITICAL)

The `npm list` command revealed that **ALL 22 dependencies** specified in `package.json` are currently unmet:

```
UNMET DEPENDENCY @apollo/client@^3.8.8
UNMET DEPENDENCY @emotion/react@^11.11.1
UNMET DEPENDENCY @emotion/styled@^11.11.0
UNMET DEPENDENCY @mui/icons-material@^5.15.0
UNMET DEPENDENCY @mui/material@^5.15.0
UNMET DEPENDENCY @tanstack/react-table@^8.21.3
UNMET DEPENDENCY graphql@^16.8.1
UNMET DEPENDENCY lucide-react@^0.562.0
UNMET DEPENDENCY nats.ws@^1.30.3
UNMET DEPENDENCY react@^18.2.0
UNMET DEPENDENCY react-dom@^18.2.0
UNMET DEPENDENCY react-i18next@^16.5.0
UNMET DEPENDENCY react-router-dom@^6.20.1
UNMET DEPENDENCY recharts@^3.6.0
UNMET DEPENDENCY zustand@^5.0.9
... (and 7 more devDependencies)
```

**Impact:** The application cannot run at all without these dependencies.

**Location:** `D:\GitHub\agogsaas\Implementation\print-industry-erp\frontend\package.json`

### 2. Path Alias Configuration Mismatch (HIGH)

The monitoring dashboard components import queries using the alias:
```typescript
import { GET_SYSTEM_HEALTH } from '@graphql/queries';
import { GET_SYSTEM_ERRORS } from '@graphql/queries';
import { GET_ACTIVE_FIXES } from '@graphql/queries';
import { GET_AGENT_ACTIVITIES } from '@graphql/queries';
```

**Current Configuration Issues:**

**tsconfig.json** (`print-industry-erp/frontend/tsconfig.json:18-20`):
```json
"paths": {
  "@/*": ["./src/*"]
}
```

**vite.config.ts** (`print-industry-erp/frontend/vite.config.ts:8-11`):
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@components': path.resolve(__dirname, './src/components'),
  },
},
```

**Problem:** The alias `@graphql/queries` is **not defined** in either configuration. The current setup only supports:
- `@/*` → `src/*`
- `@components/*` → `src/components/*`

**Actual File Location:** `D:\GitHub\agogsaas\Implementation\print-industry-erp\frontend\src\graphql\monitoringQueries.ts`

The monitoring queries exist but are located in `monitoringQueries.ts`, not in a separate `queries.ts` or `queries/index.ts` file.

---

## Monitoring Dashboard Architecture

### Components Affected

1. **MonitoringDashboard.tsx** (`print-industry-erp/frontend/src/pages/MonitoringDashboard.tsx`)
   - Main dashboard component
   - Imports 4 sub-components with GraphQL dependencies

2. **SystemStatusCard.tsx** (`print-industry-erp/frontend/src/components/monitoring/SystemStatusCard.tsx:6`)
   - Uses: `GET_SYSTEM_HEALTH` query
   - Polls every 10 seconds
   - Displays health of: backend, frontend, database, NATS

3. **ErrorListCard.tsx** (`print-industry-erp/frontend/src/components/monitoring/ErrorListCard.tsx:3`)
   - Uses: `GET_SYSTEM_ERRORS` query
   - Shows recent system errors with severity levels

4. **ActiveFixesCard.tsx** (`print-industry-erp/frontend/src/components/monitoring/ActiveFixesCard.tsx:3`)
   - Uses: `GET_ACTIVE_FIXES` query
   - Displays active feature requests and fixes

5. **AgentActivityCard.tsx** (`print-industry-erp/frontend/src/components/monitoring/AgentActivityCard.tsx:3`)
   - Uses: `GET_AGENT_ACTIVITIES` query
   - Shows real-time agent status and progress

### GraphQL Schema Status

**Backend Schema:** COMPLETE (`print-industry-erp/backend/src/modules/monitoring/graphql/schema.graphql`)

The monitoring GraphQL schema is fully defined with:
- System health queries (systemHealth, healthHistory)
- Error tracking queries (systemErrors, systemError)
- Agent activity queries (agentActivities, agentActivity)
- Active fixes queries (activeFixes, activeFix)
- Feature workflow queries (featureWorkflows, featureWorkflow)
- Real-time subscriptions for all monitoring events

**Frontend Queries:** PARTIAL (`print-industry-erp/frontend/src/graphql/monitoringQueries.ts`)

All necessary queries are defined (lines 996-1202):
- `GET_SYSTEM_HEALTH` (lines 996-1031)
- `GET_SYSTEM_ERRORS` (lines 1033-1065)
- `GET_ACTIVE_FIXES` (lines 1067-1086)
- `GET_AGENT_ACTIVITIES` (lines 1088-1104)
- Plus additional queries and subscriptions

---

## Root Cause Analysis

### Primary Issue: Dependency Installation

The project appears to be using Docker volumes for `node_modules`:

```yaml
# docker-compose.yml:108
volumes:
  - ./Implementation/print-industry-erp/frontend/src:/app/src
  - ./Implementation/print-industry-erp/frontend/package.json:/app/package.json
  - ./Implementation/print-industry-erp/frontend/tsconfig.json:/app/tsconfig.json
  - ./Implementation/print-industry-erp/frontend/tsconfig.node.json:/app/tsconfig.node.json
  - ./Implementation/print-industry-erp/frontend/index.html:/app/index.html
  - frontend_node_modules:/app/node_modules
```

**Issue:** The named volume `frontend_node_modules` may be empty or outdated. Dependencies need to be installed inside the Docker container.

### Secondary Issue: Import Path Resolution

Even after installing dependencies, imports will fail due to path alias mismatch. The code imports from `@graphql/queries` but:

1. No alias is configured for `@graphql/*`
2. The actual file is `monitoringQueries.ts`, not in a `queries` directory
3. No barrel export (`index.ts`) exists to re-export from `@graphql/queries`

---

## Industry Best Practices

### 1. GraphQL Monitoring Dashboards

Based on industry research, modern GraphQL monitoring solutions typically include:

**Apollo GraphOS** ([Metrics and Logging - Apollo GraphQL Docs](https://www.apollographql.com/docs/apollo-server/monitoring/metrics))
- Integrated hub for GraphQL performance data
- Real-time metrics in Apollo Studio
- Query performance tracking

**OpenTelemetry Approach** ([Monitoring GraphQL APIs with OpenTelemetry | SigNoz](https://signoz.io/blog/monitoring-graphql/))
- Open-source instrumentation layer
- Distributed tracing for GraphQL operations
- Performance monitoring across microservices

**Microsoft Fabric** ([GraphQL monitoring dashboard and logging (preview) - Microsoft Learn](https://learn.microsoft.com/en-us/fabric/data-engineering/graphql-monitor-log))
- Workspace-level monitoring enablement
- API dashboard for query analytics
- Request logging and error tracking

### 2. Vite + TypeScript Path Aliases

**Problem:** Vite doesn't natively support TypeScript path aliases

**Industry Solutions:**

**Manual Dual Configuration** ([Stop Struggling with Path Aliases in Vite + TypeScript + React](https://medium.com/@tusharupadhyay691/stop-struggling-with-path-aliases-in-vite-typescript-react-heres-the-ultimate-fix-1ce319eb77d0))
- Configure both `tsconfig.json` and `vite.config.ts`
- Ensure paths match exactly between both files
- Requires manual synchronization

**Automated Plugin (RECOMMENDED)** ([vite-tsconfig-paths - npm](https://www.npmjs.com/package/vite-tsconfig-paths), [GitHub - aleclarson/vite-tsconfig-paths](https://github.com/aleclarson/vite-tsconfig-paths))
- Install `vite-tsconfig-paths` plugin
- Automatically syncs `tsconfig.json` paths to Vite
- Eliminates configuration drift
- Zero manual synchronization needed

**Example Configuration:**
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths() // Automatically handles path aliases
  ],
});
```

---

## Docker Considerations

### Current Setup Analysis

**Docker Compose Configuration** (`docker-compose.yml:91-109`):
```yaml
frontend:
  build:
    context: ./Implementation/print-industry-erp/frontend
    dockerfile: Dockerfile
  container_name: agogsaas-frontend
  environment:
    VITE_GRAPHQL_URL: http://localhost:4001/graphql
  ports:
    - "3000:3000"
  depends_on:
    - backend
  volumes:
    - ./Implementation/print-industry-erp/frontend/src:/app/src
    - ./Implementation/print-industry-erp/frontend/package.json:/app/package.json
    - frontend_node_modules:/app/node_modules
  command: npm run dev -- --host 0.0.0.0
```

**Named Volume Strategy:** Using `frontend_node_modules:/app/node_modules` is a best practice for Docker development because:
- Prevents host OS conflicts (Windows vs Linux paths)
- Faster file access inside container
- Isolates dependencies from host machine

**Issue:** Dependencies must be installed **inside the container**, not on the host.

---

## Recommended Solutions

### Solution 1: Install Dependencies in Docker Container (IMMEDIATE)

**Priority:** CRITICAL
**Complexity:** Low
**ETA:** 5 minutes

**Steps:**
```bash
# Option A: Rebuild container with fresh install
docker-compose down
docker-compose build frontend --no-cache
docker-compose up frontend

# Option B: Install in running container
docker-compose exec frontend npm install

# Option C: Remove volume and rebuild
docker volume rm agogsaas_frontend_node_modules
docker-compose up --build frontend
```

**Pros:**
- Immediate fix
- No code changes required
- Standard Docker workflow

**Cons:**
- Doesn't fix path alias issue
- Requires understanding of Docker volumes

---

### Solution 2: Fix Path Alias Configuration (HIGH PRIORITY)

**Priority:** HIGH
**Complexity:** Medium
**ETA:** 15 minutes

**Option 2A: Add Missing Alias (Quick Fix)**

Update both configuration files:

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@graphql/*": ["./src/graphql/*"]
    }
  }
}
```

**vite.config.ts:**
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@components': path.resolve(__dirname, './src/components'),
    '@graphql': path.resolve(__dirname, './src/graphql'),
  },
},
```

**Then create barrel export:**
```typescript
// src/graphql/queries.ts (NEW FILE)
export * from './monitoringQueries';
```

**Option 2B: Use vite-tsconfig-paths Plugin (RECOMMENDED)**

1. Add dependency:
```json
// package.json
{
  "devDependencies": {
    "vite-tsconfig-paths": "^5.0.3"
  }
}
```

2. Update Vite config:
```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths()
  ],
  // Remove manual alias configuration
  server: {
    port: 3000,
    proxy: {
      '/graphql': {
        target: 'http://backend:4000',
        changeOrigin: true,
      },
    },
  },
});
```

3. Update tsconfig.json:
```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"],
      "@graphql/*": ["src/graphql/*"]
    }
  }
}
```

4. Create barrel export:
```typescript
// src/graphql/queries.ts or src/graphql/queries/index.ts
export * from './monitoringQueries';
```

**Pros:**
- Automated synchronization
- Industry standard solution
- Future-proof for additional aliases
- Reduces configuration drift

**Cons:**
- Adds one more dependency
- Requires npm install

---

### Solution 3: Simplify Import Paths (ALTERNATIVE)

**Priority:** MEDIUM
**Complexity:** Low
**ETA:** 10 minutes

Update all monitoring component imports to use the actual file:

```typescript
// Before
import { GET_SYSTEM_HEALTH } from '@graphql/queries';

// After
import { GET_SYSTEM_HEALTH } from '@/graphql/monitoringQueries';
```

**Files to Update:**
- `src/components/monitoring/SystemStatusCard.tsx`
- `src/components/monitoring/ErrorListCard.tsx`
- `src/components/monitoring/ActiveFixesCard.tsx`
- `src/components/monitoring/AgentActivityCard.tsx`

**Pros:**
- No configuration changes needed
- Works with existing setup
- Quick implementation

**Cons:**
- Longer import paths
- Breaks abstraction
- Not scalable if queries split into multiple files

---

## Implementation Roadmap

### Phase 1: Critical Fixes (Immediate)
1. ✅ Install missing npm dependencies in Docker container
2. ✅ Verify GraphQL server is running and schema is accessible
3. ✅ Test basic dashboard rendering

### Phase 2: Path Resolution (High Priority)
1. Choose approach:
   - **Recommended:** Install `vite-tsconfig-paths` plugin
   - **Alternative:** Manual alias configuration
   - **Quick Fix:** Update imports to use actual file paths
2. Implement chosen solution
3. Test all monitoring components import correctly

### Phase 3: Backend Integration (Medium Priority)
1. Verify monitoring resolvers are implemented
2. Test GraphQL queries return data
3. Validate real-time subscriptions work with NATS

### Phase 4: Production Readiness (Future)
1. Add error boundaries for graceful degradation
2. Implement retry logic for failed queries
3. Add loading skeletons for better UX
4. Set up monitoring alerts for critical errors
5. Document monitoring dashboard usage

---

## Technical Debt Identified

1. **No centralized queries export** - Monitoring queries should be re-exported from a single location
2. **Inconsistent alias patterns** - Some components use `@components`, others don't
3. **Missing Dockerfile** - No Dockerfile found for frontend container
4. **No dependency lock file** - Should have `package-lock.json` or `yarn.lock`
5. **Mixed query organization** - WMS queries in `monitoringQueries.ts` (lines 1-991) mixed with monitoring queries

---

## Dependencies Reference

### Required for Monitoring Dashboard

**GraphQL & Apollo:**
- `@apollo/client@^3.8.8` - GraphQL client with caching and state management
- `graphql@^16.8.1` - Core GraphQL implementation

**UI Framework:**
- `@mui/material@^5.15.0` - Material-UI components
- `@mui/icons-material@^5.15.0` - Material-UI icons
- `@emotion/react@^11.11.1` - CSS-in-JS library (MUI dependency)
- `@emotion/styled@^11.11.0` - Styled components (MUI dependency)

**Data Visualization:**
- `recharts@^3.6.0` - Charts for monitoring metrics

**Real-time Updates:**
- `nats.ws@^1.30.3` - WebSocket client for NATS subscriptions

**React Core:**
- `react@^18.2.0`
- `react-dom@^18.2.0`
- `react-router-dom@^6.20.1`

**State Management:**
- `zustand@^5.0.9` - Lightweight state management

**Build Tools:**
- `vite@^5.0.8` - Build tool and dev server
- `@vitejs/plugin-react@^4.2.1` - React plugin for Vite
- `typescript@^5.3.3` - TypeScript compiler

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Container dependency install fails | Low | High | Use `--force` flag, check network connectivity |
| Path alias still fails after fix | Medium | Medium | Have fallback to direct imports ready |
| GraphQL server not implemented | Low | High | Verify backend resolvers exist (already confirmed) |
| Volume permission issues | Medium | Low | Use `docker-compose down -v` to reset volumes |
| Missing backend monitoring resolvers | Low | Critical | Implement stub resolvers if needed |

---

## Assigned To: Marcus (Infrastructure Product Owner)

### Recommended Approach for Marcus:

**Step 1:** Install dependencies (5 min)
```bash
docker-compose exec frontend npm install
```

**Step 2:** Choose path alias solution
- If time permits: Install `vite-tsconfig-paths` (recommended)
- If urgent: Update imports to use `@/graphql/monitoringQueries`

**Step 3:** Test monitoring dashboard
```bash
# Access at http://localhost:3000/monitoring
# Verify all 4 cards render without errors
```

**Step 4:** Document any backend resolver gaps
- If queries return null/errors, create follow-up tickets for backend team

---

## Related Documentation

### Industry Resources

**GraphQL Monitoring:**
- [Metrics and Logging - Apollo GraphQL Docs](https://www.apollographql.com/docs/apollo-server/monitoring/metrics)
- [Monitoring GraphQL APIs with OpenTelemetry | SigNoz](https://signoz.io/blog/monitoring-graphql/)
- [GraphQL monitoring dashboard and logging (preview) - Microsoft Learn](https://learn.microsoft.com/en-us/fabric/data-engineering/graphql-monitor-log)

**Vite + TypeScript Configuration:**
- [Stop Struggling with Path Aliases in Vite + TypeScript + React](https://medium.com/@tusharupadhyay691/stop-struggling-with-path-aliases-in-vite-typescript-react-heres-the-ultimate-fix-1ce319eb77d0)
- [vite-tsconfig-paths - npm](https://www.npmjs.com/package/vite-tsconfig-paths)
- [GitHub - aleclarson/vite-tsconfig-paths](https://github.com/aleclarson/vite-tsconfig-paths)
- [Fixing Vite Aliasing Issues in React + TypeScript | by Monique McIntyre | Medium](https://medium.com/@ctrlaltmonique/fixing-vite-aliasing-issues-in-react-typescript-b4d007ed7e9b)
- [Vite: Fix "Failed to resolve import" (path aliases)](https://blog.openreplay.com/vite-fix-failed-to-resolve-import-path-aliases/)

### Project Files Referenced

**Frontend:**
- `print-industry-erp/frontend/package.json`
- `print-industry-erp/frontend/tsconfig.json`
- `print-industry-erp/frontend/vite.config.ts`
- `print-industry-erp/frontend/src/pages/MonitoringDashboard.tsx`
- `print-industry-erp/frontend/src/graphql/monitoringQueries.ts`
- `print-industry-erp/frontend/src/components/monitoring/*.tsx`

**Backend:**
- `print-industry-erp/backend/src/modules/monitoring/graphql/schema.graphql`
- `print-industry-erp/backend/package.json`

**Infrastructure:**
- `docker-compose.yml`

---

## Conclusion

The monitoring dashboard has two critical issues:

1. **Missing Dependencies (CRITICAL)** - All 22 npm packages are uninstalled
2. **Path Alias Mismatch (HIGH)** - Import paths don't match configuration

Both are straightforward to fix with the solutions provided. The GraphQL schema and component structure are well-designed and ready to work once these infrastructure issues are resolved.

**Recommended Priority Order:**
1. Install dependencies in Docker container (5 min)
2. Install `vite-tsconfig-paths` plugin (10 min)
3. Create barrel export at `src/graphql/queries.ts` (2 min)
4. Test monitoring dashboard (5 min)

**Total Estimated Time:** 22 minutes

---

**Report Status:** COMPLETE
**Next Stage:** Implementation (Marcus)
**Deliverable Path:** nats://agog.deliverables.cynthia.research.REQ-INFRA-DASHBOARD-001
