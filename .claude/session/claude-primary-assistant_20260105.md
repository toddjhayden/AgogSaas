# Session Notes - Claude Primary Assistant
## Date: 2026-01-05

---

## Session Summary

This session focused on implementing the Request Blocking/Dependency system for the agentic workflow. Added both explicit dependency detection and semantic inference using embeddings.

---

## Part 1: Docker-Compose Cleanup (Local SDLC DB Removal)

### Changes Made

1. **Removed local sdlc-postgres from docker-compose.agents.yml**
   - Deleted the `sdlc-db` service definition
   - Agent-backend now uses cloud API only via `SDLC_API_URL=https://api.agog.fyi`

2. **Environment variable updates**
   - Added `SDLC_API_URL` and `SDLC_AGENT_ID` to agent-backend environment
   - Removed `SDLC_DATABASE_URL` and related local DB variables

3. **Reset stale data**
   - Reset 20 stale `in_progress` recommendations on VPS to `pending`
   - Reset 34 stale `running` agent_workflows locally to `pending`

### Files Modified

- `Implementation/print-industry-erp/docker-compose.agents.yml`

---

## Part 2: Request Blocking System Implementation

### Database Migration (Already on VPS)

Migration `V0.0.28__create_request_blockers.sql` provides:
- `request_blockers` table (many-to-many junction)
- `add_request_blocker()` function
- `resolve_request_blocker()` function
- `get_deepest_unblocked_requests()` function
- Auto-resolve trigger when requests complete

### Orchestrator Enhancements

1. **Fixed event structure mismatch** (`strategic-orchestrator.service.ts:1312-1324`)
   - Now handles both `blockedBy` (string) and `blockers` (array) from blocked events

2. **Explicit dependency detection** (`strategic-orchestrator.service.ts:1378-1408`)
   - Parses text for patterns like "depends on REQ-123", "requires REQ-456"
   - Patterns: depends on, requires, blocked by, after, prerequisite, waiting for

3. **Semantic dependency inference** (`strategic-orchestrator.service.ts:1537-1626`)
   - Uses embeddings to find semantically similar REQs
   - Applies heuristics to determine blocking direction:
     - Blocker keywords: design, architect, schema, authentication, infrastructure
     - Dependent keywords: implement, build, test, deploy, integrate
   - Calculates confidence score combining similarity and keyword analysis

4. **One-off analysis endpoint** (`strategic-orchestrator.service.ts:459-616`)
   - NATS trigger: `agog.orchestrator.analyze-dependencies`
   - Runs both explicit and semantic analysis
   - Only creates relationships with >60% confidence

5. **Auto-analyze new REQs** (`strategic-orchestrator.service.ts:963-970, 1477-1478`)
   - When new REQ detected, automatically analyzes for dependencies

### Files Modified

- `agent-backend/src/orchestration/strategic-orchestrator.service.ts`

---

## Part 3: SDLC GUI Blocker Graph Page

### New Components

1. **BlockerGraphPage.tsx** (`sdlc-gui/src/pages/BlockerGraphPage.tsx`)
   - Priority Work panel (deepest unblocked requests)
   - Blocking Relationships visualization
   - Selected Request Details panel
   - Stats summary (blockers, blocked, relationships)

2. **API Client Extensions** (`sdlc-gui/src/api/sdlc-client.ts`)
   - `getBlockers(reqNumber)` - Get blockers for a request
   - `getDeepestUnblocked(limit)` - Get prioritized work
   - `addBlocker()` - Create blocking relationship
   - `removeBlocker()` - Remove relationship
   - `getBlockerGraph()` - Get all requests with blocker info

3. **App.tsx Updates**
   - Added `/blockers` route
   - Added "Blocker Graph" nav item with Network icon

### Files Modified

- `sdlc-gui/src/pages/BlockerGraphPage.tsx` (NEW)
- `sdlc-gui/src/api/sdlc-client.ts`
- `sdlc-gui/src/App.tsx`

---

## Part 4: One-Off Analysis Results

### Final Results
```
Analyzed: 324 requests
Explicit dependencies found: 0
Embeddings generated: 136
Semantic dependencies inferred: 765
High-confidence (>60%): 751
Relationships created: 751
```

### Sample Relationships Created

| Blocked REQ | Blocked By REQ | Reason |
|-------------|----------------|--------|
| Test Suite REQ | Multi-Tenant RLS REQ | RLS must be implemented before comprehensive testing |
| Comprehensive Testing | Unit Test Coverage | Foundation tests block comprehensive suite |
| Automated Test Suite | WebSocket Security | Security hardening blocks test automation |

### How It Works
1. **Explicit detection**: Searches for "depends on REQ-xxx" patterns (found 0)
2. **Semantic inference**:
   - Generates embeddings for each REQ description using Ollama (nomic-embed-text)
   - Calculates cosine similarity between all REQ pairs
   - For similar REQs (>70% similarity), applies heuristics to determine blocking direction:
     - Blocker keywords: design, architect, schema, authentication, security, infrastructure
     - Dependent keywords: implement, build, test, deploy, integrate
   - Creates relationship if confidence >60%

---

## Current Blocking Architecture

| Component | Location | Purpose |
|-----------|----------|---------|
| `request_blockers` table | VPS SDLC DB | Store blocking relationships |
| `add_request_blocker()` | VPS SDLC DB | Create relationship |
| `resolve_request_blocker()` | VPS SDLC DB | Auto-resolve when REQ completes |
| `get_deepest_unblocked_requests()` | VPS SDLC DB | Priority work query |
| Strategic Orchestrator | agent-backend | Detect & manage blocking |
| BlockerGraphPage | sdlc-gui | Visualize relationships |

---

## TODO List

### Immediate
- [x] Rebuild and test semantic inference on existing REQs - **751 relationships created!**
- [ ] Deploy SDLC GUI with BlockerGraphPage to Cloudflare Pages
- [ ] Verify blocking relationships appear in GUI

### Future Enhancements
- [ ] Add manual blocking relationship creation in GUI
- [ ] Add blocking removal with audit trail
- [ ] Implement blocking validation (prevent cycles)
- [ ] Add blocking reason editing
- [ ] Tune similarity threshold (currently 70%) and confidence threshold (currently 60%)
- [ ] Add human review workflow for low-confidence inferences

---

## Container Status

| Container | Status | SDLC Connection |
|-----------|--------|-----------------|
| agogsaas-agents-backend | Running | Cloud API (api.agog.fyi) |
| agogsaas-agents-postgres | Running | Local (agent_memory only) |
| agogsaas-agents-nats | Running | - |
| agogsaas-agents-ollama | Running | - |
| agogsaas-sdlc-postgres | REMOVED | N/A (using cloud) |

---

## Key Learnings

1. **Blocking lives in SDLC only** - No blocker tables in local agent-memory DB
2. **Explicit detection requires REQ references** - Agents/users must write "depends on REQ-xxx"
3. **Semantic inference fills the gap** - Uses embeddings + heuristics to find implicit dependencies
4. **60% confidence threshold** - Only high-confidence semantic relationships are created
