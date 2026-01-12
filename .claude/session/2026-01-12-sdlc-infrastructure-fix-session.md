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

## Outstanding Issue

### WorkflowPersistenceService Still Needs Database

The `sdlc/core/src/orchestration/workflow-persistence.service.ts` is hardcoded to connect to local postgres:

```typescript
const dbUrl = process.env.DATABASE_URL ||
  'postgresql://agent_user:agent_dev_password_2024@localhost:5434/agent_memory';
```

**Options to resolve:**
1. Add VPS database direct connection (need DATABASE_URL for VPS)
2. Route workflow persistence through SDLC API (add endpoints)
3. Make it gracefully degrade (workflows lost on restart)

**Current state:** sdlc-core crashes on startup because WorkflowPersistenceService can't connect.

---

## Commits Made

1. `feat(sdlc): Complete SDLC platform separation and infrastructure setup`
2. `fix(sdlc): Remove hardcoded credentials from docker-compose.yml`

---

## Files Changed (This Session)

| File | Change |
|------|--------|
| `sdlc/docker-compose.yml` | Removed postgres, updated to use VPS API |
| `sdlc/.env` | Points to VPS API |
| `sdlc/.env.example` | Template for VPS config |
| `sdlc/core/scripts/*.ts` | Restored 7 missing scripts |
| `sdlc/migrations/sdlc-control/V0.0.35-37` | New migrations (applied to local, need VPS) |

---

## Running Containers

| Container | Status | Purpose |
|-----------|--------|---------|
| sdlc-nats | Running | Agent messaging |
| sdlc-ollama | Running | Embeddings (future) |
| sdlc-core | Crashing | Needs DATABASE_URL fix |

---

## Next Steps

1. **Fix WorkflowPersistenceService** - Either:
   - Provide VPS DATABASE_URL, or
   - Add API endpoints for workflow persistence
2. **Apply migrations to VPS** - V0.0.35-37 need to run on VPS database
3. **Test full system** - Verify sdlc-core connects to VPS properly

---

## Session End
**Status:** Paused - awaiting DATABASE_URL decision
**Branch:** `feature/sdlc-separation`
