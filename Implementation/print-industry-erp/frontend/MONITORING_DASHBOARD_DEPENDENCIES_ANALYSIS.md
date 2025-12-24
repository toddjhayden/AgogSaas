# Monitoring Dashboard Missing Dependencies - Research Analysis

**Request Number:** REQ-INFRA-DASHBOARD-001
**Assigned To:** Marcus (Warehouse PO)
**Research By:** Cynthia (Research Agent)
**Date:** 2025-12-21
**Status:** COMPLETE

---

## Executive Summary

The monitoring dashboard components are currently non-functional due to **missing module path aliases** in the build configuration. The components are attempting to import GraphQL queries from `@graphql/queries`, but this alias is not configured in Vite, causing import resolution failures.

---

## Problem Analysis

### Root Cause Identified

**Issue #1: Missing Path Alias for `@graphql/queries`**

The monitoring components are using the import path:
```typescript
import { GET_SYSTEM_HEALTH } from '@graphql/queries';
import { GET_AGENT_ACTIVITIES } from '@graphql/queries';
import { GET_SYSTEM_ERRORS } from '@graphql/queries';
import { GET_ACTIVE_FIXES } from '@graphql/queries';
```

**Current Configuration:**

**File:** `frontend/vite.config.ts`
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@components': path.resolve(__dirname, './src/components'),
  },
}
```

**File:** `frontend/tsconfig.json`
```json
"paths": {
  "@/*": ["./src/*"]
}
```

**Problem:** The `@graphql/queries` alias is **not defined** in either configuration file.

### Affected Components

All monitoring dashboard components are affected:

1. **SystemStatusCard.tsx** (line 6)
   - Imports: `GET_SYSTEM_HEALTH`

2. **AgentActivityCard.tsx** (line 3)
   - Imports: `GET_AGENT_ACTIVITIES`

3. **ErrorListCard.tsx** (line 3)
   - Imports: `GET_SYSTEM_ERRORS`

4. **ActiveFixesCard.tsx** (line 3)
   - Imports: `GET_ACTIVE_FIXES`

### Current File Structure

```
frontend/src/graphql/
├── monitoringQueries.ts  (contains ALL monitoring queries)
├── client.ts
└── queries/
    ├── kpis.ts
    ├── operations.ts
    ├── wms.ts
    ├── finance.ts
    ├── quality.ts
    └── marketplace.ts
```

**Note:** There is **no** `queries/index.ts` file to export the monitoring queries.

---

## Technical Analysis

### Dependencies Review

**Frontend Dependencies (from `package.json`):**
- ✅ `@apollo/client`: ^3.8.8 (installed)
- ✅ `@mui/material`: ^5.15.0 (installed)
- ✅ `@mui/icons-material`: ^5.15.0 (installed)
- ✅ `graphql`: ^16.8.1 (installed)
- ✅ `react`: ^18.2.0 (installed)
- ✅ All MUI and GraphQL dependencies are present

**Backend Dependencies (from `package.json`):**
- ✅ `apollo-server`: ^3.13.0 (installed)
- ✅ `graphql`: ^16.8.1 (installed)
- ✅ Backend monitoring resolvers are implemented correctly

### Infrastructure Health

**Docker Compose Services:**
- ✅ PostgreSQL (pgvector) - Port 5433
- ✅ NATS with JetStream - Port 4223
- ✅ Ollama - Port 11434
- ✅ Backend (GraphQL API) - Port 4001
- ✅ Frontend (Vite dev server) - Port 3000

**Backend Monitoring Implementation:**
- ✅ Monitoring resolvers exist (`backend/src/modules/monitoring/graphql/resolvers.ts`)
- ✅ Monitoring services implemented:
  - `HealthMonitorService`
  - `ErrorTrackingService`
  - `AgentActivityService`
  - `ActiveFixesService`
- ✅ GraphQL schema defined (`backend/src/modules/monitoring/graphql/schema.graphql`)
- ✅ All monitoring queries are defined in `frontend/src/graphql/monitoringQueries.ts`

---

## Solution Options

### Option 1: Add Path Alias (RECOMMENDED)

**Approach:** Create a module export file and add path alias configuration.

**Advantages:**
- ✅ No changes to component imports
- ✅ Maintains consistency with existing `@components` alias
- ✅ Scalable for future additions
- ✅ TypeScript and Vite both support the alias

**Implementation Steps:**

1. **Create Export File:** `frontend/src/graphql/queries/index.ts`
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
} from '../monitoringQueries';

// Re-export other module queries
export * from './kpis';
export * from './operations';
export * from './wms';
export * from './finance';
export * from './quality';
export * from './marketplace';
```

2. **Update `vite.config.ts`:**
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@components': path.resolve(__dirname, './src/components'),
    '@graphql': path.resolve(__dirname, './src/graphql'),
  },
}
```

3. **Update `tsconfig.json`:**
```json
"paths": {
  "@/*": ["./src/*"],
  "@graphql/*": ["./src/graphql/*"]
}
```

**Estimated Implementation Time:** 15-30 minutes
**Risk Level:** Low
**Breaking Changes:** None

---

### Option 2: Update Component Imports

**Approach:** Change all component imports to use relative paths.

**Changes Required:**
```typescript
// BEFORE
import { GET_SYSTEM_HEALTH } from '@graphql/queries';

// AFTER
import { GET_SYSTEM_HEALTH } from '../../graphql/monitoringQueries';
```

**Advantages:**
- ✅ No build configuration changes needed
- ✅ Explicit import paths

**Disadvantages:**
- ❌ Requires changes to 4 component files
- ❌ Breaks consistency with `@components` pattern
- ❌ Less maintainable if files are moved
- ❌ Longer, harder-to-read import paths

**Estimated Implementation Time:** 30-45 minutes
**Risk Level:** Low
**Breaking Changes:** None

---

### Option 3: Consolidate Queries (ALTERNATIVE)

**Approach:** Move all monitoring queries into the `queries/` directory structure.

**Implementation Steps:**

1. Move monitoring queries to `frontend/src/graphql/queries/monitoring.ts`
2. Create `frontend/src/graphql/queries/index.ts` to export all queries
3. Add `@graphql` alias (same as Option 1, step 2-3)

**Advantages:**
- ✅ Better organization
- ✅ All queries in one directory
- ✅ Consistent structure

**Disadvantages:**
- ❌ Requires file restructuring
- ❌ More complex than Option 1
- ❌ Risk of breaking other imports if not careful

**Estimated Implementation Time:** 45-60 minutes
**Risk Level:** Medium
**Breaking Changes:** Potentially affects other components

---

## Recommendations

### Primary Recommendation: Option 1 - Add Path Alias

**Justification:**
1. **Minimal Changes:** Only requires creating one index file and updating two config files
2. **Maintains Consistency:** Aligns with existing `@components` alias pattern
3. **Future-Proof:** Easily extensible for additional GraphQL modules
4. **Low Risk:** No changes to component code, only configuration
5. **Best Developer Experience:** Clean imports, easy to understand

### Secondary Recommendation: Option 3 - Consolidate Queries

**Use Case:** If the team prefers better long-term organization and is willing to invest more time upfront.

### Not Recommended: Option 2

This should only be used if there are restrictions preventing build configuration changes (which is unlikely).

---

## Implementation Checklist for Option 1 (Recommended)

**Step 1: Create Query Export File**
- [ ] Create `frontend/src/graphql/queries/index.ts`
- [ ] Export all monitoring queries from `monitoringQueries.ts`
- [ ] Export all other module queries (kpis, operations, wms, finance, quality, marketplace)

**Step 2: Update Vite Configuration**
- [ ] Open `frontend/vite.config.ts`
- [ ] Add `'@graphql': path.resolve(__dirname, './src/graphql')` to `resolve.alias`
- [ ] Save file

**Step 3: Update TypeScript Configuration**
- [ ] Open `frontend/tsconfig.json`
- [ ] Add `"@graphql/*": ["./src/graphql/*"]` to `compilerOptions.paths`
- [ ] Save file

**Step 4: Rebuild and Test**
- [ ] Stop the frontend container if running
- [ ] Rebuild: `docker-compose build frontend`
- [ ] Start: `docker-compose up frontend`
- [ ] Access monitoring dashboard: `http://localhost:3000/monitoring`
- [ ] Verify all cards load without errors
- [ ] Check browser console for import errors
- [ ] Test GraphQL queries in network tab

**Step 5: Verification**
- [ ] SystemStatusCard displays system health
- [ ] ErrorListCard displays error list (or "No errors")
- [ ] ActiveFixesCard displays active fixes
- [ ] AgentActivityCard displays agent activities
- [ ] No console errors related to imports
- [ ] GraphQL queries successfully reach backend

---

## Additional Notes

### No Missing NPM Dependencies

All required npm packages are already installed:
- Apollo Client (GraphQL client)
- Material-UI (UI components)
- GraphQL (schema and types)
- React (framework)

### Backend Already Functional

The backend monitoring module is fully implemented with:
- GraphQL resolvers for all queries
- Service layer (HealthMonitor, ErrorTracking, AgentActivity, ActiveFixes)
- Database tables (via migrations)
- NATS integration for real-time updates

### Docker Configuration Correct

The docker-compose.yml and Dockerfiles are properly configured with:
- Volume mounts for hot-reload development
- Correct port mappings
- Health checks
- Dependencies between services

---

## Testing Strategy

### Unit Testing
```bash
# Test that imports resolve correctly
npm run build

# Should complete without import errors
```

### Integration Testing
1. Start all services: `docker-compose up`
2. Access monitoring dashboard: `http://localhost:3000/monitoring`
3. Verify data fetching from GraphQL backend
4. Test auto-refresh functionality (10-second interval)
5. Test manual refresh button
6. Verify WebSocket subscriptions (if enabled)

### Browser Console Verification
```javascript
// Should NOT see errors like:
// "Cannot find module '@graphql/queries'"
// "Failed to resolve import '@graphql/queries'"

// Should see successful GraphQL network requests:
// POST http://localhost:4001/graphql (systemHealth)
// POST http://localhost:4001/graphql (systemErrors)
// POST http://localhost:4001/graphql (activeFixes)
// POST http://localhost:4001/graphql (agentActivities)
```

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Import alias not resolved after config change | Low | Medium | Restart Vite dev server, clear cache |
| Breaking other imports | Very Low | Medium | Only affects new `@graphql` alias, existing `@` and `@components` unchanged |
| TypeScript compilation errors | Low | Low | TypeScript config aligned with Vite config |
| Docker build failures | Very Low | Medium | Config changes are non-breaking, tested pattern |

---

## References

### File Locations

**Frontend:**
- `frontend/src/graphql/monitoringQueries.ts` - All monitoring GraphQL queries (lines 996-1202)
- `frontend/src/components/monitoring/SystemStatusCard.tsx` - System health component
- `frontend/src/components/monitoring/AgentActivityCard.tsx` - Agent activity component
- `frontend/src/components/monitoring/ErrorListCard.tsx` - Error list component
- `frontend/src/components/monitoring/ActiveFixesCard.tsx` - Active fixes component
- `frontend/src/pages/MonitoringDashboard.tsx` - Main dashboard page
- `frontend/vite.config.ts` - Vite build configuration
- `frontend/tsconfig.json` - TypeScript configuration

**Backend:**
- `backend/src/modules/monitoring/graphql/resolvers.ts` - GraphQL resolvers
- `backend/src/modules/monitoring/services/health-monitor.service.ts` - Health monitoring
- `backend/src/modules/monitoring/services/error-tracking.service.ts` - Error tracking
- `backend/src/modules/monitoring/services/agent-activity.service.ts` - Agent activity
- `backend/src/modules/monitoring/services/active-fixes.service.ts` - Active fixes

**Infrastructure:**
- `docker-compose.yml` - Service orchestration (lines 90-109 for frontend)
- `frontend/Dockerfile` - Multi-stage build (development stage used in docker-compose)

---

## Conclusion

The monitoring dashboard is **not missing any npm dependencies**. The issue is purely a **module resolution configuration problem** that can be solved by adding the `@graphql` path alias to both Vite and TypeScript configurations.

**Recommended Solution:** Implement Option 1 (Add Path Alias)

**Deliverable for Marcus:**
1. This research document
2. Implementation checklist (included above)
3. Step-by-step configuration changes
4. Testing and verification procedures

**Next Steps:** Marcus can implement the recommended solution following the checklist, or escalate to Jen (Frontend PO) if frontend configuration changes require review.

---

## Appendix A: Sample Index File

**File:** `frontend/src/graphql/queries/index.ts`

```typescript
/**
 * GraphQL Queries - Central Export
 *
 * This file re-exports all GraphQL queries from various modules
 * to provide a single import point for components.
 */

// ============================================
// MONITORING QUERIES
// ============================================
export {
  // Queries
  GET_SYSTEM_HEALTH,
  GET_SYSTEM_ERRORS,
  GET_ACTIVE_FIXES,
  GET_AGENT_ACTIVITIES,
  GET_AGENT_ACTIVITY,
  GET_FEATURE_WORKFLOWS,
  GET_MONITORING_STATS,

  // Subscriptions
  SUBSCRIBE_SYSTEM_HEALTH,
  SUBSCRIBE_ERROR_CREATED,
  SUBSCRIBE_AGENT_ACTIVITY,
} from '../monitoringQueries';

// ============================================
// MODULE QUERIES
// ============================================
export * from './kpis';
export * from './operations';
export * from './wms';
export * from './finance';
export * from './quality';
export * from './marketplace';
```

---

## Appendix B: Updated Configuration Files

### Vite Configuration

**File:** `frontend/vite.config.ts`

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@graphql': path.resolve(__dirname, './src/graphql'),  // ADD THIS LINE
    },
  },
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

### TypeScript Configuration

**File:** `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "paths": {
      "@/*": ["./src/*"],
      "@graphql/*": ["./src/graphql/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

---

**End of Research Document**
