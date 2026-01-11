# Plan: Blocked Catastrophic Escalation Path

**Created:** 2026-01-11
**Status:** IN PROGRESS (Phases B, C, D, E Complete - Phase A requires SDLC GUI)
**Priority:** P0 (catastrophic items are stuck with no path forward)

## Problem Statement

Catastrophic (P0) items are getting stuck in BLOCKED status with no escalation path:
- 21 catastrophic items currently BLOCKED
- Most are "Audit timed out - manual review required"
- No automated retry, diagnostic, or escalation mechanism exists
- Items sit in BLOCKED forever

## Solution: Automated Escalation Pipeline (B → C → D → E → A)

Implement fixes in order, each step handles what the previous couldn't resolve.

---

## Phase B: Auto-Retry (Transient Failure Recovery)

**Goal:** Handle transient failures automatically without creating P0 REQs

### Implementation

File: `agent-backend/src/proactive/senior-auditor.daemon.ts`

```typescript
// Before creating P0 timeout REQ, retry up to 3 times
private readonly MAX_AUDIT_RETRIES = 3;
private auditRetryCount: Map<string, number> = new Map();

// In waitForAuditResponse timeout handler:
if (retryCount < MAX_AUDIT_RETRIES) {
  console.log(`[Sam] Retry ${retryCount + 1}/${MAX_AUDIT_RETRIES} for ${reqNumber}`);
  await this.retryAudit(reqNumber, auditType);
  return; // Don't create P0 yet
}
// Only create P0 after all retries exhausted
```

### Success Criteria
- [x] Transient failures auto-recover (exponential backoff: 30s, 60s, 120s)
- [x] P0 REQs only created after 3 failed attempts
- [x] Retry count logged for diagnostics

**Implementation:** `senior-auditor.daemon.ts` lines 36-38, 63, 366-467

---

## Phase C: Diagnostic Agent

**Goal:** When retries fail, automatically gather diagnostic data

### Implementation

File: `agent-backend/src/proactive/audit-diagnostics.daemon.ts` (NEW)

```typescript
// Spawn diagnostic agent when audit fails after retries
async function runDiagnostics(failedReqNumber: string): Promise<DiagnosticReport> {
  return {
    natsHealth: await checkNatsConnectivity(),
    databaseHealth: await checkDatabaseQueries(),
    hostListenerLogs: await getRecentLogs('host-listener'),
    agentSpawnStatus: await checkAgentSpawnHistory(failedReqNumber),
    systemResources: await getSystemMetrics(),
    recommendations: [] // Populated based on findings
  };
}
```

### Diagnostic Checks
1. NATS connectivity and message queue depth
2. Database query performance (slow query log)
3. Host Listener spawn success/failure rate
4. Agent process exit codes
5. System CPU/memory/disk usage

### Success Criteria
- [x] Diagnostic report generated automatically
- [x] Report attached to P0 REQ description
- [x] Recommendations populated based on findings

**Implementation:**
- `audit-diagnostics.service.ts` (NEW) - Full diagnostic service
- `senior-auditor.daemon.ts` lines 491-505 - Integration with P0 REQ creation

---

## Phase D: Adaptive Timeout

**Goal:** Adjust timeout based on diagnostic findings

### Implementation

File: `agent-backend/src/proactive/senior-auditor.daemon.ts`

```typescript
// Dynamic timeout based on historical audit duration
private async getAdaptiveTimeout(auditType: string): Promise<number> {
  const historicalAvg = await this.getAverageAuditDuration(auditType);
  const buffer = 1.5; // 50% buffer
  return Math.max(
    CONFIG.minAuditTimeout,  // 30 min floor
    Math.min(
      historicalAvg * buffer,
      CONFIG.maxAuditTimeout   // 4 hour ceiling
    )
  );
}
```

### Success Criteria
- [x] Timeout adapts to actual audit duration (historical average × 1.5 buffer)
- [x] Slow audits don't timeout prematurely (max 4 hours ceiling)
- [x] Fast audits don't wait unnecessarily (min 30 min floor)

**Implementation:** `senior-auditor.daemon.ts`
- CONFIG: `minAuditTimeout`, `maxAuditTimeout`, `adaptiveTimeoutBuffer` (lines 40-43)
- `getAverageAuditDuration()` - queries historical data (lines 481-518)
- `getAdaptiveTimeout()` - calculates bounded timeout (lines 520-545)
- `waitForAuditResponse()` - accepts timeout parameter (line 363)
- `runAudit()` - calculates adaptive timeout before wait (lines 316-320)

---

## Phase E: Root Cause Fixes

**Goal:** Fix actual causes identified by diagnostics

### Common Root Causes & Fixes

| Root Cause | Fix |
|------------|-----|
| Slow DB queries | Add query timeout, optimize indexes |
| Agent crash | Fix error handling, add crash recovery |
| NATS message loss | Add message acknowledgment, retry |
| Host Listener race | Already fixed with waitForConsumerReady |
| Memory exhaustion | Add memory limits, pagination |

### Implementation

Based on diagnostic findings, create targeted fix REQs:
- Each fix is a separate REQ with specific acceptance criteria
- Fixes are prioritized by frequency of occurrence

### Success Criteria
- [x] Most common timeout causes identified with auto-fix REQs
- [ ] Timeout rate drops by 80%+ (requires observation over time)

**Implementation:**
- `audit-diagnostics.service.ts` - `ROOT_CAUSE_PATTERNS` array (lines 95-152) with 6 common patterns
- `audit-diagnostics.service.ts` - `detectRootCausePatterns()` method (lines 167-196)
- `senior-auditor.daemon.ts` - Auto-fix REQ creation (lines 669-714)

**Detected Root Causes:**
1. Host Listener not running (no consumers)
2. Database performance degradation (slow queries)
3. Memory exhaustion (>90% memory)
4. CPU overload (>90% CPU)
5. Agent spawn failures
6. NATS messaging issues

---

## Phase A: Human Notification (SDLC GUI)

**Goal:** Escalate to human only after automation exhausted

### TODO: SDLC GUI Enhancement

**Status:** PENDING - Requires SDLC GUI development

### Required SDLC GUI Features

1. **Escalation Dashboard**
   - List of items requiring human intervention
   - Filter by priority, age, type
   - Show diagnostic report inline

2. **Action Buttons**
   - "Retry" - Re-run the workflow
   - "Reassign" - Assign to different agent
   - "Unblock" - Mark blocker as resolved
   - "Cancel" - Close as won't fix
   - "Escalate" - Notify additional humans

3. **Notification Integration**
   - Email notification when item escalates
   - Slack/Teams webhook (optional)
   - In-app notification badge

4. **Audit Trail**
   - Log all human actions
   - Track time-to-resolution
   - Report on escalation patterns

### API Endpoints Needed

```
POST /api/agent/requests/{reqNumber}/retry
POST /api/agent/requests/{reqNumber}/reassign
POST /api/agent/requests/{reqNumber}/unblock
POST /api/agent/requests/{reqNumber}/escalate
GET  /api/agent/escalations (items needing human attention)
```

### Success Criteria
- [ ] Humans notified only when automation fails
- [ ] Diagnostic data available in GUI
- [ ] Clear action buttons for common resolutions
- [ ] Escalation SLA tracking

---

## Implementation Order

```
Week 1: Phase B (Auto-Retry)
Week 2: Phase C (Diagnostic Agent)
Week 3: Phase D (Adaptive Timeout)
Week 4: Phase E (Root Cause Fixes based on diagnostics)
Week 5+: Phase A (SDLC GUI - longer term)
```

---

## Related Files

- `agent-backend/src/proactive/senior-auditor.daemon.ts` - Audit timeout handling
- `agent-backend/src/orchestration/strategic-orchestrator.service.ts` - Blocked handling
- `sdlc-gui/src/pages/` - SDLC GUI pages (for Phase A)
- `agent-backend/src/api/sdlc-api.server.ts` - API endpoints

---

## Open Questions

1. Should retry attempts use exponential backoff?
2. What's the maximum escalation wait time before human notification?
3. Should diagnostic agent be a Claude agent or pure TypeScript service?
4. Which communication channels for human notification (email, Slack, SMS)?
