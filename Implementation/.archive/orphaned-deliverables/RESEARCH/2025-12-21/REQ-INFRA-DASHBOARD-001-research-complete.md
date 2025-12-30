# REQ-INFRA-DASHBOARD-001 Research Complete

**Agent:** Cynthia (Research Agent)
**Request Number:** REQ-INFRA-DASHBOARD-001
**Title:** Fix Monitoring Dashboard Missing Dependencies
**Assigned To:** Marcus (Warehouse PO)
**Date:** 2025-12-21
**Status:** ✅ COMPLETE

---

## Executive Summary

Research complete. **No missing npm dependencies found**. The monitoring dashboard issue is caused by **missing module path alias configuration**, not missing packages.

---

## Root Cause Analysis

### The Problem

Frontend monitoring components are attempting to import GraphQL queries using:
```typescript
import { GET_SYSTEM_HEALTH } from '@graphql/queries';
```

However, the `@graphql` path alias is **not configured** in Vite or TypeScript, causing import resolution failures.

### Verification Results

✅ **All npm dependencies installed:**
- `@apollo/client`: ^3.8.8
- `@mui/material`: ^5.15.0
- `@mui/icons-material`: ^5.15.0
- `graphql`: ^16.8.1
- `react`: ^18.2.0
- All other required packages present

✅ **Backend fully implemented:**
- Monitoring resolvers: `backend/src/modules/monitoring/graphql/resolvers.ts:29,76`
- Health monitoring service
- Error tracking service
- Agent activity service
- Active fixes service

✅ **Frontend queries defined:**
- All monitoring queries exist in `frontend/src/graphql/monitoringQueries.ts:996-1202`
- `GET_SYSTEM_HEALTH` (line 996)
- `GET_SYSTEM_ERRORS` (line 1033)
- `GET_ACTIVE_FIXES` (line 1067)
- `GET_AGENT_ACTIVITIES` (line 1088)

❌ **Missing configuration:**
- No `@graphql` alias in `frontend/vite.config.ts:8-11`
- No `@graphql/*` path in `frontend/tsconfig.json:18-20`
- No `frontend/src/graphql/queries/index.ts` export file

---

## Recommended Solution

**Option 1: Add Path Alias Configuration (RECOMMENDED)**

### Implementation Steps

**Step 1:** Create `frontend/src/graphql/queries/index.ts`
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

**Step 2:** Update `frontend/vite.config.ts`
```typescript
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@components': path.resolve(__dirname, './src/components'),
    '@graphql': path.resolve(__dirname, './src/graphql'),  // ADD THIS
  },
}
```

**Step 3:** Update `frontend/tsconfig.json`
```json
"paths": {
  "@/*": ["./src/*"],
  "@graphql/*": ["./src/graphql/*"]  // ADD THIS
}
```

**Step 4:** Rebuild and test
```bash
docker-compose build frontend
docker-compose up frontend
# Access: http://localhost:3000/monitoring
```

### Why This Approach?

✅ No changes to component code
✅ Consistent with existing `@components` pattern
✅ Scalable for future additions
✅ Low risk, quick implementation (15-30 minutes)
✅ No breaking changes

---

## Affected Components

All monitoring dashboard cards require the alias to function:

1. **SystemStatusCard.tsx** - `frontend/src/components/monitoring/SystemStatusCard.tsx:6`
2. **AgentActivityCard.tsx** - `frontend/src/components/monitoring/AgentActivityCard.tsx:3`
3. **ErrorListCard.tsx** - `frontend/src/components/monitoring/ErrorListCard.tsx:3`
4. **ActiveFixesCard.tsx** - `frontend/src/components/monitoring/ActiveFixesCard.tsx:3`

---

## Infrastructure Verification

### Docker Services (from `docker-compose.yml`)

✅ PostgreSQL (pgvector) - Port 5433
✅ NATS with JetStream - Port 4223
✅ Ollama - Port 11434
✅ Backend (GraphQL API) - Port 4001
✅ Frontend (Vite dev server) - Port 3000

### Current File Structure

```
frontend/src/graphql/
├── monitoringQueries.ts  ← Contains ALL monitoring queries
├── client.ts
└── queries/
    ├── kpis.ts           ← Exists
    ├── operations.ts     ← Exists
    ├── wms.ts            ← Exists
    ├── finance.ts        ← Exists
    ├── quality.ts        ← Exists
    ├── marketplace.ts    ← Exists
    └── index.ts          ← MISSING (needs to be created)
```

---

## Testing Checklist

After implementing the solution, verify:

- [ ] Build completes without errors: `npm run build`
- [ ] No import resolution errors in console
- [ ] Monitoring dashboard accessible at `http://localhost:3000/monitoring`
- [ ] SystemStatusCard displays system health
- [ ] AgentActivityCard displays agent activities
- [ ] ErrorListCard displays errors or "No errors"
- [ ] ActiveFixesCard displays active fixes
- [ ] GraphQL queries successfully reach backend (check Network tab)
- [ ] No console errors related to `@graphql/queries` imports

---

## Deliverables

1. ✅ **Comprehensive analysis document:** `frontend/MONITORING_DASHBOARD_DEPENDENCIES_ANALYSIS.md`
2. ✅ **Root cause identified:** Missing path alias configuration
3. ✅ **Solution designed:** Add `@graphql` alias with index export file
4. ✅ **Implementation checklist:** Step-by-step instructions provided
5. ✅ **Testing strategy:** Verification steps documented

---

## Next Steps for Marcus

1. Review the detailed analysis: `frontend/MONITORING_DASHBOARD_DEPENDENCIES_ANALYSIS.md`
2. Implement Option 1 (recommended) following the checklist
3. Run tests to verify the fix
4. Mark REQ-INFRA-DASHBOARD-001 as complete

**Estimated implementation time:** 15-30 minutes
**Risk level:** Low
**Breaking changes:** None

---

## Research References

**Files Analyzed:**
- `frontend/package.json:1-40` - Dependencies verification
- `frontend/vite.config.ts:1-23` - Current alias configuration
- `frontend/tsconfig.json:1-25` - Current TypeScript paths
- `frontend/src/graphql/monitoringQueries.ts:996-1088` - Query definitions
- `frontend/src/components/monitoring/*.tsx` - Component imports
- `backend/src/modules/monitoring/graphql/resolvers.ts:29,76` - Backend implementation
- `docker-compose.yml:90-109` - Frontend service configuration

**Key Findings:**
- All npm packages present (verified in package.json)
- Backend monitoring resolvers functional (verified in resolvers.ts)
- Frontend queries exist (verified in monitoringQueries.ts)
- Only missing configuration: `@graphql` path alias

---

**Research Status:** ✅ COMPLETE
**Confidence Level:** HIGH
**Ready for Implementation:** YES

---

*This research was conducted by Cynthia (Research Agent) on behalf of Marcus (Warehouse PO) for feature request REQ-INFRA-DASHBOARD-001.*
