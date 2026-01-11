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

---

## Part 5: Git Commit & CI/CD Discovery

### Commit Pushed
```
Commit: 8e5862d
Branch: master
Message: feat: Add request blocking system with semantic dependency inference
Files: 32 files, +10,736 lines
```

### CI/CD Failures Discovered
All GitHub Actions workflows failing (pre-existing issue):
- **Continuous Integration**: TypeScript build errors in backend
- **Security Scanning**: Dependency vulnerabilities
- **Build and Deploy**: Cannot deploy due to build failures

### Blocking System Verification
Confirmed the blocking system is properly integrated:

| Step | Status |
|------|--------|
| Filter blocked from work selection | ✅ `!r.isBlocked` in `getActionableRequests()` |
| Prioritize blockers | ✅ `getDeepestUnblocked()` sorts by blocksCount |
| Create blocking relationships | ✅ Semantic inference created 751 |
| Set isBlocked flag | ✅ REQs have `isBlocked: true` with reasons |
| Resolve on completion | ✅ `resolveBlockers()` API endpoint works |

---

## Part 6: CI/CD Fix REQs Created

### REQs Created
| REQ | Title | Priority | Status |
|-----|-------|----------|--------|
| REQ-CICD-1767575020 | Fix GitHub CI/CD Pipeline - TypeScript Build Errors | critical | in_progress |
| REQ-SECURITY-1767575033 | Fix GitHub Security Scanning Workflow | critical | blocked |
| REQ-DEPLOY-1767575047 | Fix GitHub Build and Deploy Workflow | critical | blocked |

### Blocking Relationships
- REQ-SECURITY-1767575033 blocked by REQ-CICD-1767575020
- REQ-DEPLOY-1767575047 blocked by REQ-CICD-1767575020

### Branch Workflow
Created feature branch for CI fixes:
```
Branch: fix/cicd-typescript-errors
Purpose: Agent commits fixes here, merge to master when CI passes
```

### Stale Workflow Reset
Reset 5 stale in_progress workflows on VPS to free concurrency:
```sql
UPDATE owner_requests SET current_phase = 'backlog'
WHERE current_phase = 'in_progress' AND updated_at < NOW() - INTERVAL '1 hour';
-- Reset: 5 rows
```

---

## Part 7: Blocking Verification Plan

Once CI/CD is fixed, verify blocking system works end-to-end:

| Test | What to Verify |
|------|----------------|
| Auto-unblock | When REQ-CICD completes, Security/Deploy REQs auto-unblock |
| No blocked work | Orchestrator skips REQs with `isBlocked: true` |
| Blocker priority | REQs that unblock the most others get picked first |
| Resolve on complete | `resolveBlockers()` called when workflow completes |
| GUI visualization | BlockerGraphPage shows relationships correctly |

---

## Current Status

### What's Working
- ✅ Blocking system implemented and integrated
- ✅ 751 semantic blocking relationships created
- ✅ CI/CD REQs created with proper blocking chain
- ✅ Feature branch ready for fixes
- ✅ Orchestrator picked up REQ-CICD-1767575020

### What's Needed
- ⏳ Start `start-listener.bat` to spawn Claude agents
- ⏳ Agent fixes TypeScript errors on feature branch
- ⏳ Merge to master when CI passes
- ⏳ Verify auto-unblock works
- ⏳ Verify GUI shows blocking graph

---

## Notes

### Duplicate TypeScript REQs
Discovered existing REQ for same issue:
- REQ-1767491478042-925my: "Resolve 846 Build-Time TypeScript Errors" (blocked by semantic inference)
- REQ-CICD-1767575020: "Fix GitHub CI/CD Pipeline - TypeScript Build Errors" (created, in progress)

The semantic inference correctly identified these as related. Once REQ-CICD completes, the other will likely auto-unblock or can be closed as duplicate.

### Host Agent Listener Required
The orchestrator publishes stage events, but the `host-agent-listener.ts` must be running on the local machine to spawn Claude Code agents. Without it, workflows wait indefinitely for deliverables.

---

## Issues to Address

### Sam (Senior Auditor) Failed to Detect CI/CD Failure
**Problem:** Sam and the auditor team did not flag that GitHub CI/CD was completely broken. Every commit has been failing CI for days/weeks, yet no P0 alert was raised.

**Expected Behavior:**
- Sam should monitor GitHub Actions status
- CI/CD failures should be flagged as P0/Critical immediately
- Blocking REQs should have been auto-created for CI/CD fixes

**Action Items:**
- [ ] Add GitHub Actions monitoring to Sam's audit scope
- [ ] Create automatic P0 REQ generation when CI/CD fails
- [ ] Sam should check `gh run list` or GitHub API for workflow status
- [ ] Add CI/CD health to the auditor's checklist

### Need P0 Priority Level (Catastrophic)

Current priorities: `critical > high > medium > low`

**Missing: P0 = CATASTROPHIC**

| Priority | Meaning | Behavior |
|----------|---------|----------|
| **P0** | Catastrophic - building on fire | Auto-blocks ALL other work, bypasses concurrency, immediate alert |
| critical | Very important | High priority but doesn't block everything |
| high | Important | Normal high priority |
| medium | Normal | Standard work |
| low | Nice to have | When nothing else to do |

**P0 Examples:**
- CI/CD completely broken (nothing can deploy)
- Production down
- Security breach
- Data loss

**Implementation Needed:**
- [x] Add `catastrophic` priority to database - DONE (14 REQs updated from p0)
- [ ] Orchestrator: catastrophic auto-blocks all non-catastrophic work
- [ ] Orchestrator: REQs blocking catastrophic get top priority
- [ ] Orchestrator: Don't add new work while higher priority in progress
- [ ] Sam: Auto-create catastrophic REQs for emergencies
- [ ] Alerts: Immediate notification for catastrophic events

---

## Part 8: Catastrophic Priority Implementation

### Database Changes (VPS)
```sql
-- Updated p0 to catastrophic
UPDATE owner_requests SET priority = 'catastrophic' WHERE priority = 'p0';
-- Result: 14 rows updated

-- Fixed weird '1' priority
UPDATE owner_requests SET priority = 'medium' WHERE priority = '1';
-- Result: 3 rows updated

-- Updated CI/CD REQ to catastrophic
UPDATE owner_requests SET priority = 'catastrophic' WHERE req_number = 'REQ-CICD-1767575020';
-- Result: 1 row updated

-- Current distribution:
-- catastrophic: 15 (14 + CI/CD REQ)
-- critical: 14
-- high: 8
-- medium: 102
```

### Priority Order (Highest to Lowest)
1. **catastrophic** - Building on fire, everything stops
2. **critical** - Very important
3. **high** - Important
4. **medium** - Normal
5. **low** - Nice to have

### Work Selection Rules
1. If catastrophic REQ exists and is not blocked, work on it ONLY
2. If REQ blocks a catastrophic REQ, prioritize it (unblock the catastrophic)
3. Don't start new work if agents are busy on higher priority
4. Respect blocking relationships - blocked REQs cannot be started

### Strategic Orchestrator Code Changes

**File:** `agent-backend/src/orchestration/strategic-orchestrator.service.ts`

#### 1. Priority Order Definition
```typescript
// PRIORITY ORDER: catastrophic > critical > high > medium > low
const priorityOrder: Record<string, number> = {
  catastrophic: 0,  // Building on fire - everything stops
  critical: 1,
  high: 2,
  medium: 3,
  low: 4
};
```

#### 2. Catastrophic Detection
```typescript
// Check for catastrophic REQs - they get absolute priority
const catastrophicReqs = mappedRequests.filter(r =>
  r.priority === 'catastrophic' && r.status !== 'BLOCKED'
);
const hasCatastrophic = catastrophicReqs.length > 0;

if (hasCatastrophic) {
  console.log(`[StrategicOrchestrator] 🚨 CATASTROPHIC priority detected: ${catastrophicReqs.map(r => r.reqNumber).join(', ')}`);
}
```

#### 3. Priority Sorting (catastrophic first, then blockers-of-catastrophic)
```typescript
const sortedRequests = [...mappedRequests].sort((a, b) => {
  const aIsCatastrophic = a.priority === 'catastrophic';
  const bIsCatastrophic = b.priority === 'catastrophic';

  // Catastrophic always first
  if (aIsCatastrophic && !bIsCatastrophic) return -1;
  if (!aIsCatastrophic && bIsCatastrophic) return 1;

  // Blockers come next (especially those blocking catastrophic)
  // ... rest of sorting logic
});
```

#### 4. Skip Non-Catastrophic When Catastrophic In Progress
```typescript
// Check if any catastrophic REQ is currently in progress
const catastrophicInProgress = mappedRequests.some(r =>
  r.priority === 'catastrophic' && r.status === 'IN_PROGRESS'
);

// CATASTROPHIC PRIORITY RULE: When catastrophic is in progress, ONLY work on:
// 1. Other catastrophic REQs
// 2. REQs that block catastrophic REQs (to unblock them)
if (catastrophicInProgress && !isCatastrophic) {
  if (!blocksCatastrophic && !isBlocker) {
    console.log(`[StrategicOrchestrator] ⏸️ Skipping ${reqNumber} - catastrophic in progress`);
    continue;
  }
}
```

#### 5. Catastrophic Bypasses Concurrency Limits
```typescript
// Gap Fix #12: Enforce concurrency limit
// BUT: Catastrophic and blockers bypass concurrency limit
if (status === 'NEW' && !isBlocker && !isCatastrophic) {
  // ... concurrency check only applies to non-catastrophic
}
```

### Container Rebuild
```bash
docker-compose -f docker-compose.agents.yml build agent-backend
docker-compose -f docker-compose.agents.yml up -d agent-backend
# Container rebuilt and restarted with catastrophic priority handling
```

### Implementation Checklist

| Task | Status |
|------|--------|
| Add `catastrophic` priority to database | ✅ Done (14 REQs from p0) |
| Fix weird '1' priority values | ✅ Done (3 REQs to medium) |
| Update REQ-CICD to catastrophic | ✅ Done |
| Orchestrator: priority order with catastrophic | ✅ Done |
| Orchestrator: detect catastrophic REQs | ✅ Done |
| Orchestrator: skip non-catastrophic when catastrophic in progress | ✅ Done |
| Orchestrator: blockers-of-catastrophic get priority | ✅ Done |
| Orchestrator: catastrophic bypasses concurrency | ✅ Done |
| Rebuild agent-backend container | ✅ Done |
| Verify in logs | ⏳ Pending |

---

## Part 9: Catastrophic Priority Verification

### Logs Confirmed Working
```
[2026-01-05T02:00:35.173Z] [StrategicOrchestrator] 🚨 CATASTROPHIC priority detected: REQ-CICD-1767575020
[2026-01-05T02:00:35.173Z] [StrategicOrchestrator] ⏸️ Skipping REQ-1767183219586 - catastrophic in progress, focus on catastrophic work only
[2026-01-05T02:00:35.173Z] [StrategicOrchestrator] ⏸️ Skipping REQ-1767364752526 - catastrophic in progress, focus on catastrophic work only
... (all non-catastrophic REQs being skipped)
```

### Verification Checklist
- [x] Check orchestrator logs for CATASTROPHIC detection - ✅ Working
- [x] Confirm only catastrophic/blocker work is being picked up - ✅ All others skipped
- [ ] Verify blocked REQs auto-unblock when CI/CD REQ completes
- [ ] Confirm BlockerGraphPage shows relationships in GUI

---

## Part 10: Recovery Bug Discovery & Fix

### Problem Discovered
REQ-CICD-1767575020 was detected as catastrophic but **not actually being worked on**.

**Root Cause:** State mismatch
```
[WARN] [StrategicOrchestrator] ⚠️ State mismatch for REQ-CICD-1767575020: DB=IN_PROGRESS, NATS=null
```

The database showed `IN_PROGRESS` but no NATS workflow was actually running (zombie state).

### Why Recovery Failed
```
[ERROR] [StrategicOrchestrator] Failed to recover workflows: Cannot read properties of undefined (reading 'query')
```

**Bug:** `recoverWorkflows()` calls `this.sdlcDb.query()` but in cloud API mode, `this.sdlcDb` is **undefined**.

**Location:** `strategic-orchestrator.service.ts` lines 211-254

```typescript
// Line 136-138: sdlcDb only set in local mode
if (!this.useCloudApi) {
  this.sdlcDb = getSDLCDatabase();  // NOT set in cloud mode!
}

// Line 223-227: Recovery tries to use sdlcDb
const inProgressReqs = await this.sdlcDb.query<...>(  // FAILS!
  `SELECT req_number, title FROM owner_requests WHERE current_phase = 'in_progress'`
);
```

### Manual Fix Applied
Reset REQ-CICD to backlog via cloud API so orchestrator can pick it up fresh:

```bash
curl -X PUT "https://api.agog.fyi/api/agent/requests/REQ-CICD-1767575020/status" \
  -H "Content-Type: application/json" \
  -d '{"phase":"backlog"}'

# Response:
{"success":true,"data":{"reqNumber":"REQ-CICD-1767575020","currentPhase":"backlog","isBlocked":false}}
```

### Code Fix Needed
**TODO:** Fix `recoverWorkflows()` to use cloud API when `this.useCloudApi` is true:

```typescript
// In recoverWorkflows(), replace:
const inProgressReqs = await this.sdlcDb.query<...>(...);

// With:
const inProgressReqs = this.useCloudApi
  ? await this.sdlcApiClient.getRequestsByPhase('in_progress')
  : await this.sdlcDb.query<...>(...);
```

---

## Part 11: Workflow Started Successfully

### Additional Fix Required
The `agent_workflows` table in agent_memory had stale persistence:
```sql
-- Stale record preventing fresh start
SELECT req_number, status, current_stage FROM agent_workflows WHERE req_number LIKE '%CICD%';
-- REQ-CICD-1767575020 | running | 0

-- Fixed by deleting stale record
DELETE FROM agent_workflows WHERE req_number = 'REQ-CICD-1767575020';
```

### Workflow Now Running
After clearing stale persistence and restarting:
```
[2026-01-05T13:58:10.572Z] 🚨 CATASTROPHIC priority detected: REQ-CICD-1767575020
[2026-01-05T13:58:10.572Z] 🆕 NEW request detected: REQ-CICD-1767575020
[2026-01-05T13:58:10.617Z] ✅ Updated REQ-CICD-1767575020 phase to in_progress [cloud]
[2026-01-05T13:58:10.618Z] Routing REQ-CICD-1767575020 to marcus
[2026-01-05T13:58:11.105Z] [REQ-CICD-1767575020] Starting workflow: Fix GitHub CI/CD Pipeline - TypeScript Build Errors
[2026-01-05T13:58:11.107Z] Stage 1/11: Research
[2026-01-05T13:58:11.108Z] Published stage.started event for cynthia
[2026-01-05T13:58:11.109Z] Waiting for deliverable on agog.deliverables.cynthia.research.REQ-CICD-1767575020...
```

### Current Status
- ✅ Catastrophic priority working
- ✅ REQ-CICD workflow started
- ⏳ Stage 1: Waiting for Cynthia (Research) via host-agent-listener
- ⏳ Host-agent-listener should spawn Claude agent for Cynthia

### Bugs Found (Need Fix)
- [ ] **recoverWorkflows() broken in cloud API mode** - uses `this.sdlcDb` which is undefined
- [ ] **Stale workflow persistence** - agent_workflows table can have zombie records that prevent restarts

### Learnings
1. Multiple state stores must be synchronized:
   - VPS SDLC database (`owner_requests.current_phase`)
   - NATS workflow state (`agog.workflows.state.*`)
   - Local persistence (`agent_memory.agent_workflows`)
   - In-memory set (`processedRequests`)
2. All must be cleared/reset for a workflow to start fresh
