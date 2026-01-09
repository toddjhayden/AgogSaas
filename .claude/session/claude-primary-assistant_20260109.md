# Claude Primary Assistant Session - January 9, 2026

## Session Summary
Continued REC/REQ unification architecture planning from January 8 session.

## Context from Previous Session
- Fixed GitHub Actions workflow failures (deprecated actions v3→v4)
- Fixed Cloudflare Pages auto-deploy for SDLC GUI
- Marked CI/CD REQs as done (REQ-CICD-1767575020, REQ-SECURITY-1767575033, REQ-DEPLOY-1767575047)
- Discussed System Alerts architecture for Sam daemon audit timeout alerts

## Key Finding: Blocking System Ready for Unification

Analyzed `request_blockers` table (V0.0.28 migration) and confirmed:

### Schema Design
```sql
-- Blockers use UUID foreign keys to owner_requests
CONSTRAINT fk_blocked_request FOREIGN KEY (blocked_request_id)
  REFERENCES owner_requests(id) ON DELETE CASCADE,
CONSTRAINT fk_blocking_request FOREIGN KEY (blocking_request_id)
  REFERENCES owner_requests(id) ON DELETE CASCADE,
```

### Implications for Unification
1. **No blocker updates needed** - `request_blockers` only references `owner_requests.id` (UUIDs)
2. **Old `recommendations` table never integrated** - RECs couldn't participate in blocking
3. **Functions resolve req_number → UUID** - `add_request_blocker()` accepts strings but looks up UUIDs
4. **After migration, cross-type blocking works** - REQ-REQ, REC-REC, REQ-REC all supported

## Unification Readiness Checklist

| Component | Status | Notes |
|-----------|--------|-------|
| V0.0.29 columns on VPS | ✅ Ready | `requires_approval`, `approval_status`, `source`, `tags` exist |
| `request_blockers` schema | ✅ Ready | Already references `owner_requests` only |
| Old RECs migration | ❌ Pending | Need to migrate from `recommendations` table |
| Tag filtering in API | ❌ Pending | Need endpoints to filter by tags |
| System Alerts GUI board | ❌ Pending | New board for Sam's alerts |

## Architecture Decision: Hybrid Tag-Based Routing

User approved hybrid approach:
- All items in unified `owner_requests` table
- Tags control which GUI board items appear on
- Sam continues creating REQs, but tagged for System Alerts board
- Less effort than separate tables, easier for agents

## REQ Created

**REQ-SDLC-1767972294**: Implement REC/REQ Unification with Tag-Based Board Routing
- Phase: `backlog`
- Priority: `high`
- Tags: `architecture`, `unification`, `sdlc-gui`, `internal-tooling`

### Requirements in REQ:
1. Migrate old RECs from recommendations table to owner_requests
2. Add tag filtering to SDLC API endpoints
3. Build System Alerts board in SDLC GUI
4. Update orchestrator to use unified queries

---

## SDLC System Status

```json
{
  "database": true,
  "nats": false,
  "entityCount": 32,
  "phaseCount": 14,
  "columnCount": 22
}
```

**Note**: NATS is currently disconnected. Embeddings for new REQ will be generated when NATS reconnects or via backfill script (`scripts/backfill-memory-embeddings.js`).

---

## Work Log

### Investigation: Blocking System Compatibility
- Read `V0.0.28__create_request_blockers.sql`
- Confirmed UUID-based foreign keys to `owner_requests`
- No migration of blocker records needed for unification

### REQ Creation
- Created REQ-SDLC-1767972294 via SDLC API
- REQ in backlog phase, ready for implementation
- NATS publish pending (NATS currently disconnected)

---

## AUDIT BLOCKER: Runtime Health Enforcement

**REQ-AUDIT-1767982074**: Enforce Runtime Dependency Health - Exit on Failure
- Priority: **CATASTROPHIC**
- Phase: `backlog`

### The Rule
**NO GRACEFUL ERROR HANDLING.** All workflow systems require all dependencies (NATS, SDLC, embeddings) working. If any go down, services MUST EXIT immediately.

### Current Violation
Services keep running when NATS down (`nats: false`) instead of exiting. This is audit-critical.

### Fix Required
All services must `process.exit(1)` when any critical dependency becomes unavailable. Process supervisor restarts service. Startup checks block until dependencies available.

### Affected Services
- strategic-orchestrator.service.ts
- sdlc-control.daemon.ts
- senior-auditor.daemon.ts (Sam)
- recommendation-publisher.service.ts
- value-chain.daemon.ts
- All agent spawners

---

## Rule Violation: Errors Downgraded to Warnings

**Commit `36576e3`** (January 8) violated the rule:
- Downgraded strict TypeScript rules from `error` to `warn`
- Disabled React Compiler rules

**The Rule**: Errors cause system breaks BY DESIGN. Never downgrade errors to warnings.

**Action Required**: Revert those ESLint changes. Fix the actual TypeScript errors instead.

---

## Bug: Catastrophic Priority Not Enforced

**Location**: `strategic-orchestrator.service.ts` lines 1043-1044

```typescript
const catastrophicReqs = mappedRequests.filter(r =>
  r.priority === 'catastrophic' && r.status !== 'BLOCKED'  // BUG: excludes blocked!
);
```

### Impact
- If all catastrophic items are BLOCKED, `hasCatastrophic = false`
- Catastrophic priority rule doesn't trigger
- Lower priority work proceeds while catastrophic sits blocked
- Blockers for catastrophic items don't get prioritized

---

## Sasha - Workflow Infrastructure Expert

### Created Files
1. **`.claude/WORKFLOW_RULES.md`** - Mandatory workflow rules (no graceful errors, no error→warning, etc.)
2. **`.claude/agents/sasha-workflow-expert.md`** - Sasha agent definition

### Sasha's Responsibilities
1. **Fix infrastructure issues** - NATS down, DB unreachable, embeddings down
2. **Answer rule questions** - Agents ask Sasha before doing risky things (e.g., "Can I downgrade this error?")
3. **Extend timeouts** - When agents need more time for legitimate work

### Agent Communication
- Agents request Sasha via NATS: `agog.agent.requests.sasha-rules`
- Sasha responds via: `agog.agent.responses.sasha-rules`
- Host listener spawns Sasha and relays responses

### Model Usage
- **Haiku** - Rule questions (fast, simple yes/no)
- **Sonnet** - Infrastructure recovery (complex debugging)

### Host Listener Integration (Pending)
The host-agent-listener.ts needs these additions:
1. Add `sasha` to agent files mapping
2. Add `checkWorkflowHealth()` method
3. Add `subscribeToSashaRuleQuestions()` subscription
4. Add `spawnSashaForRuleQuestion()` method (haiku)
5. Add `spawnSashaForInfraRecovery()` method (sonnet)
6. Call `subscribeToSashaRuleQuestions()` in start()

**Note**: File modification conflicts prevented automated edits. Manual integration required.

---

## REQs Created Today

| REQ Number | Title | Priority |
|------------|-------|----------|
| REQ-SDLC-1767972294 | REC/REQ Unification with Tag-Based Routing | high |
| REQ-AUDIT-1767982074 | Enforce Runtime Dependency Health | catastrophic |
| REQ-LINT-1767982183 | Revert ESLint Error→Warning Downgrade | catastrophic |

---

## Sasha Integration Complete (Session 2)

All workflow services now have Sasha awareness integrated:

### Files Modified

1. **host-agent-listener.ts** (Full Integration)
   - Added `workflowRules` property to class
   - Added workflow rules loading at startup from `.claude/WORKFLOW_RULES.md`
   - Added Sasha to agent files mapping
   - Modified `contextInput` to include workflow rules and Sasha info for ALL spawned agents
   - Added `subscribeToSashaRuleQuestions()` NATS subscription
   - Added `checkWorkflowHealth()` method
   - Added `spawnSashaForRuleQuestion()` method (haiku model)
   - Added `spawnSashaForInfraRecovery()` method (sonnet model)

2. **strategic-orchestrator.service.ts**
   - Added `SASHA_RULES_TOPIC` constant
   - Added `askSashaForGuidance()` method

3. **senior-auditor.daemon.ts** (Sam)
   - Added `sashaRulesTopic` to CONFIG
   - Added `askSashaForGuidance()` method

4. **value-chain-expert.daemon.ts**
   - Added `SASHA_RULES_TOPIC` constant
   - Added `askSashaForGuidance()` method

### Agent Context Updates

All spawned agents now receive in their context:
1. **MANDATORY WORKFLOW RULES** - Full content of `.claude/WORKFLOW_RULES.md`
2. **SASHA - YOUR WORKFLOW TECHNICAL SUPPORT** - Instructions on how to contact Sasha:
   - NATS topic: `agog.agent.requests.sasha-rules`
   - Request format: `{ requestingAgent, question, context }`
   - Response topic: `agog.agent.responses.sasha-rules`

### NATS Topics for Sasha

| Topic | Direction | Purpose |
|-------|-----------|---------|
| `agog.agent.requests.sasha-rules` | → Sasha | Agents ask rule questions |
| `agog.agent.responses.sasha-rules` | ← Sasha | Sasha answers rule questions |

---

## Session End

- Date: January 9, 2026
- Key Deliverables:
  - WORKFLOW_RULES.md created
  - Sasha agent created
  - Host listener fully integrated with Sasha
  - All workflow services (orchestrator, Sam, value-chain) have Sasha awareness

