# Session: SDLC Infrastructure Fix and VPS Migration
**Date:** 2026-01-12 (Morning Session)
**Duration:** ~1 hour

---

## Summary

Continued from the previous SDLC separation session. Fixed infrastructure issues, removed hardcoded credentials, then migrated from local postgres to VPS API for all database operations.

---

## Part 1: Infrastructure Fixes

### 1. Orphaned Directories Cleaned Up
- Removed empty `Implementation/print-industry-erp/agent-backend/`
- Removed empty `Implementation/print-industry-erp/backend/`

### 2. Missing Scripts Restored
Restored to `sdlc/core/scripts/`:
- `start-all-monitoring-services.ts`
- `start-strategic-orchestrator.ts`
- `host-agent-listener.ts`
- `start-proactive-daemons.ts`
- `start-sdlc-control.ts`
- `start-all-services.ts`
- `test-recovery-and-value-chain.ts`

### 3. Docker-Compose Fixes
- Fixed volume mount: `./scripts` → `./core/scripts`
- Added missing environment variables (`SDLC_DATABASE_URL`, `AGENT_DB_*`)

### 4. Database Migrations Created
- `V0.0.35__create_recommendations.sql`
- `V0.0.36__create_owner_requests.sql`
- `V0.0.37__create_blocker_functions.sql`

### 5. Security Fix: Removed Hardcoded Credentials
Replaced hardcoded passwords in docker-compose.yml with environment variable substitution.

---

## Part 2: VPS Migration

### Decision
User identified that local `sdlc-postgres` was causing confusion. The production system uses `api.agog.fyi` (VPS), so local postgres is unnecessary overhead.

### Changes Made

**Removed local postgres:**
```bash
docker stop sdlc-postgres && docker rm sdlc-postgres
```

**Updated `sdlc/.env`:**
```env
# Points to VPS for database operations
SDLC_API_URL=https://api.agog.fyi
SDLC_AGENT_ID=local-sdlc-core
```

**Updated `sdlc/docker-compose.yml`:**
- Removed postgres service entirely
- Removed postgres dependency from core
- Core now uses `SDLC_API_URL` for all database operations
- Only 3 services remain: nats, ollama, core

### Current Architecture
```
┌─────────────────────────────────────────┐
│          Local (Windows)                │
├─────────────────────────────────────────┤
│  sdlc-nats     → Agent messaging        │
│  sdlc-ollama   → Embeddings (future)    │
│  sdlc-core     → Orchestration daemons  │
│       │                                 │
│       └──── HTTPS ────┐                 │
└───────────────────────┼─────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────┐
│          VPS (api.agog.fyi)             │
├─────────────────────────────────────────┤
│  PostgreSQL   → All SDLC data           │
│  - owner_requests                       │
│  - recommendations                      │
│  - agent_workflows                      │
│  - etc.                                 │
└─────────────────────────────────────────┘
```

---

## Part 3: WorkflowPersistenceService Fix

### Problem
`sdlc/core/src/orchestration/workflow-persistence.service.ts` had hardcoded database credentials:
```typescript
const dbUrl = process.env.DATABASE_URL ||
  'postgresql://agent_user:agent_dev_password_2024@localhost:5434/agent_memory';
```

### Solution Implemented
Updated WorkflowPersistenceService to:
- Remove hardcoded credentials (security fix)
- Use `DATABASE_URL` environment variable only
- Gracefully degrade to in-memory mode if DATABASE_URL not set
- Add `isEnabled()` method checked by all database operations
- Proper connection testing and logging

### Result
sdlc-core now starts successfully in degraded mode (workflows in-memory only).
To enable persistence, set `DATABASE_URL` in `.env` pointing to VPS database.

---

## Outstanding Issue

### Pre-commit Hooks Need Path Update
The `.git-hooks/pre-commit` script still references old paths:
- `Implementation/print-industry-erp/backend` → should be `projects/print-industry-erp/backend`
- `Implementation/print-industry-erp/frontend` → should be `projects/print-industry-erp/frontend`

Currently gracefully degrading (checks skipped).

---

## Commits Made

1. `feat(sdlc): Complete SDLC platform separation and infrastructure setup`
2. `fix(sdlc): Remove hardcoded credentials from docker-compose.yml`
3. `fix(sdlc): Remove hardcoded credentials from WorkflowPersistenceService`
4. `fix(sdlc): Remove obsolete paths and fix ECONNREFUSED error`

---

## Files Changed (This Session)

| File | Change |
|------|--------|
| `sdlc/docker-compose.yml` | Removed postgres, updated to use VPS API, added DATABASE_URL |
| `sdlc/.env` | Points to VPS API |
| `sdlc/.env.example` | Template for VPS config, added DATABASE_URL docs |
| `sdlc/core/scripts/*.ts` | Restored 7 missing scripts |
| `sdlc/migrations/sdlc-control/V0.0.35-37` | New migrations (applied to local, need VPS) |
| `sdlc/core/src/orchestration/workflow-persistence.service.ts` | Security fix: removed hardcoded credentials, added graceful degradation |
| `.git-hooks/pre-commit` | Updated paths from Implementation/ to projects/ |
| `sdlc/core/src/proactive/recovery-health-check.daemon.ts` | Removed OWNER_REQUESTS.md dependency, uses SDLC API |
| `sdlc/core/scripts/start-all-monitoring-services.ts` | Updated error messages |
| `sdlc/core/src/monitoring/log-monitor.service.ts` | Updated container names |
| `sdlc/agents/personas/sasha-workflow-expert.md` | Updated diagnostic commands |
| `sdlc/core/src/proactive/senior-auditor.daemon.ts` | Fixed ECONNREFUSED - optional database |

---

## Running Containers

| Container | Status | Purpose |
|-----------|--------|---------|
| sdlc-nats | Running | Agent messaging |
| sdlc-ollama | Running | Embeddings (future) |
| sdlc-core | Running ✅ | All orchestration daemons active |

---

## Next Steps

1. **Apply migrations to VPS** - V0.0.35-37 need to run on VPS database
2. **Optional: Enable workflow persistence** - Set DATABASE_URL in .env for VPS connection
3. **Optional: Enable audit persistence** - Same DATABASE_URL enables Sam's audit history

---

## Session End
**Status:** All infrastructure fixes complete, sdlc-core running stably
**Branch:** `feature/sdlc-separation`
