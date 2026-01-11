# Plan: WIP Limit Enforcement & Finish-First Policy

**Created:** 2026-01-11
**Completed:** 2026-01-11
**Status:** IMPLEMENTED
**Priority:** P1 (critical - system is currently overloaded)

## Problem Statement

The agentic workflow system has a severe WIP (Work in Progress) overload:

| Metric | Current | Should Be |
|--------|---------|-----------|
| IN_PROGRESS items | 36 | 3-5 |
| MAX_CONCURRENT_WORKFLOWS | 10 | 3-5 |
| Unassigned IN_PROGRESS | 18 | 0 |
| QA items | 4 | More (work should flow through) |
| Completion rate | Low | Work should finish before new starts |

### Root Causes

1. **Concurrency limit too high** - 10 is too many parallel workflows
2. **No finish-first policy** - New work starts before existing completes
3. **Orphaned work** - Items marked IN_PROGRESS but no agent working
4. **No stage enforcement** - Work can stall between stages indefinitely
5. **No WIP visibility** - Hard to see what's actually being worked on

---

## Solution: Four-Part Fix

### Part 1: Reduce Concurrency Limit
### Part 2: Implement Finish-First Policy
### Part 3: Clean Up Orphaned Work
### Part 4: Stage Completion Tracking

---

## Part 1: Reduce Concurrency Limit

**Goal:** Limit parallel workflows to 3-5 to ensure focus and completion

### Implementation

File: `agent-backend/src/orchestration/strategic-orchestrator.service.ts`

```typescript
// Change from:
private readonly MAX_CONCURRENT_WORKFLOWS = 10;

// To:
private readonly MAX_CONCURRENT_WORKFLOWS = 3;

// With priority-based slots:
private readonly WORKFLOW_SLOTS = {
  catastrophic: 2,  // Reserved for P0 - always available
  normal: 3,        // For P1-P4 work
  total: 5          // Absolute maximum
};
```

### Slot Allocation Logic

```
Total slots: 5
├── Catastrophic reserved: 2 (always available for P0)
└── Normal pool: 3 (for P1-P4)

If catastrophic work exists:
  - Catastrophic gets its reserved slots immediately
  - Normal work limited to remaining slots

If no catastrophic:
  - Normal work can use all 5 slots
```

### Success Criteria
- [x] MAX_CONCURRENT_WORKFLOWS reduced to 3 (more conservative than 5)
- [x] 2 slots reserved for catastrophic (CATASTROPHIC_RESERVED_SLOTS = 2)
- [x] Concurrency limit enforced via canStartNewWorkFinishFirst()

---

## Part 2: Finish-First Policy

**Goal:** Don't start new work until existing work completes a stage

### Current Behavior (Problem)

```
REQ-001: IN_PROGRESS (Research stage) - started 2 hours ago
REQ-002: IN_PROGRESS (Research stage) - started 1 hour ago
REQ-003: IN_PROGRESS (Research stage) - started 30 min ago
→ System keeps starting new research, nothing moves to Critique
```

### Desired Behavior

```
REQ-001: IN_PROGRESS (Research stage)
→ Wait for REQ-001 to complete Research
→ REQ-001 moves to Critique stage
→ THEN start REQ-002 Research
```

### Implementation

File: `agent-backend/src/orchestration/strategic-orchestrator.service.ts`

```typescript
// Before starting new workflow, check if existing workflows are progressing
private async canStartNewWorkflow(priority: string): Promise<boolean> {
  // Catastrophic bypasses all checks
  if (priority === 'catastrophic') return true;

  // Get current IN_PROGRESS workflows
  const inProgress = await this.getInProgressWorkflows();

  // Check 1: Under concurrency limit?
  if (inProgress.length >= this.MAX_CONCURRENT_WORKFLOWS) {
    return false;
  }

  // Check 2: Are existing workflows making progress?
  const stalled = inProgress.filter(w => this.isWorkflowStalled(w));
  if (stalled.length > 0) {
    console.log(`[Orchestrator] ${stalled.length} workflows stalled - fixing before starting new`);
    await this.recoverStalledWorkflows(stalled);
    return false; // Don't start new until stalled are fixed
  }

  // Check 3: Is there room in the current stage?
  const byStage = this.groupByStage(inProgress);
  const researchCount = byStage['research']?.length || 0;
  if (researchCount >= 2) {
    console.log(`[Orchestrator] Research stage full (${researchCount}) - waiting for progression`);
    return false;
  }

  return true;
}

private isWorkflowStalled(workflow: Workflow): boolean {
  const lastActivity = workflow.lastHeartbeat || workflow.startedAt;
  const stalledThreshold = 30 * 60 * 1000; // 30 minutes no activity
  return (Date.now() - lastActivity) > stalledThreshold;
}
```

### Stage Limits

| Stage | Max Concurrent | Rationale |
|-------|----------------|-----------|
| Research (Cynthia) | 2 | Research is fast, can parallelize |
| Critique (Sylvia) | 2 | Review is fast |
| Backend (Roy) | 2 | Can work on independent features |
| Frontend (Jen) | 2 | Can work on independent UIs |
| QA (Billy) | 3 | QA can test multiple features |
| Statistics (Priya) | 2 | Fast, can parallelize |

### Success Criteria
- [x] New work only starts if existing work is progressing (canStartNewWorkFinishFirst)
- [x] Stalled workflows detected via heartbeat monitoring (STALLED_THRESHOLD_MS = 30 min)
- [x] Stage limits enforced via STAGE_LIMITS configuration
- [x] Work flows through pipeline (stage tracking enforces progression)

---

## Part 3: Clean Up Orphaned Work

**Goal:** Fix the 18 items stuck IN_PROGRESS with no agent

### What Is Orphaned Work?

```
REQ-123: phase=in_progress, assignedTo=null, lastActivity=3 days ago
→ This item started but agent never picked it up or crashed
→ No agent is working on it
→ It blocks a concurrency slot forever
```

### Implementation

File: `agent-backend/src/orchestration/orphan-cleanup.service.ts` (NEW)

```typescript
export class OrphanCleanupService {
  private readonly ORPHAN_THRESHOLD = 60 * 60 * 1000; // 1 hour no activity

  async cleanupOrphanedWork(): Promise<void> {
    const inProgress = await this.getInProgressRequests();

    for (const req of inProgress) {
      const isOrphan = await this.isOrphaned(req);

      if (isOrphan) {
        console.log(`[OrphanCleanup] Found orphan: ${req.reqNumber}`);

        // Option A: Move back to backlog for retry
        await this.moveToBacklog(req, 'Orphaned - no agent activity');

        // Option B: Retry from current stage
        // await this.retryCurrentStage(req);
      }
    }
  }

  private async isOrphaned(req: Request): Promise<boolean> {
    // No agent assigned
    if (!req.assignedTo) return true;

    // No heartbeat in threshold period
    const lastActivity = await this.getLastActivity(req.reqNumber);
    if (!lastActivity) return true;
    if ((Date.now() - lastActivity) > this.ORPHAN_THRESHOLD) return true;

    // Agent process not running
    const agentRunning = await this.isAgentProcessRunning(req.reqNumber);
    if (!agentRunning) return true;

    return false;
  }
}
```

### Cleanup Strategy

| Condition | Action |
|-----------|--------|
| No agent assigned | Move to BACKLOG |
| No activity > 1 hour | Check if agent running |
| Agent not running | Move to BACKLOG or retry stage |
| Agent running but slow | Wait (might be legitimate) |

### One-Time Cleanup Script

For the current 18 orphaned items:

```typescript
// scripts/cleanup-orphaned-work.ts
async function cleanupCurrentOrphans() {
  const orphans = await sdlcApi.getRequests({ phase: 'in_progress' });

  for (const req of orphans) {
    if (!req.assignedTo || await isStale(req)) {
      console.log(`Moving ${req.reqNumber} back to backlog`);
      await sdlcApi.updateRequestStatus(req.reqNumber, { phase: 'backlog' });
    }
  }
}
```

### Success Criteria
- [x] 18 current orphans cleaned up (moved via API script)
- [x] Orphan detection runs periodically (every 15 min via OrphanCleanupService)
- [x] Orphaned items automatically moved to BACKLOG (recoverOrphan method)
- [x] Concurrency slots freed up (IN_PROGRESS went from 36 to 7)

---

## Part 4: Stage Completion Tracking

**Goal:** Ensure work flows through all stages to DONE

### Current Problem

```
Research → Critique → Backend → Frontend → QA → Done
    ↓          ↓         ↓         ↓       ↓
   OK       STUCK     STUCK     STUCK   STARVED
```

Work enters Research but doesn't flow through to Done.

### Implementation

File: `agent-backend/src/orchestration/stage-tracker.service.ts` (NEW)

```typescript
export class StageTrackerService {
  // Track time in each stage
  async recordStageEntry(reqNumber: string, stage: string): Promise<void> {
    await this.db.query(`
      INSERT INTO stage_tracking (req_number, stage, entered_at)
      VALUES ($1, $2, NOW())
    `, [reqNumber, stage]);
  }

  async recordStageExit(reqNumber: string, stage: string): Promise<void> {
    await this.db.query(`
      UPDATE stage_tracking
      SET exited_at = NOW(), duration_minutes = EXTRACT(EPOCH FROM (NOW() - entered_at))/60
      WHERE req_number = $1 AND stage = $2 AND exited_at IS NULL
    `, [reqNumber, stage]);
  }

  // Alert on stuck stages
  async checkForStuckWork(): Promise<StuckWork[]> {
    const stageTimeouts = {
      research: 120,   // 2 hours
      critique: 60,    // 1 hour
      backend: 240,    // 4 hours
      frontend: 240,   // 4 hours
      qa: 120,         // 2 hours
      statistics: 30   // 30 min
    };

    const stuck = [];
    for (const [stage, timeout] of Object.entries(stageTimeouts)) {
      const stuckInStage = await this.getStuckInStage(stage, timeout);
      stuck.push(...stuckInStage);
    }
    return stuck;
  }
}
```

### Stage Flow Enforcement

```typescript
// In orchestrator, after stage completes:
async onStageComplete(reqNumber: string, stage: string): Promise<void> {
  await this.stageTracker.recordStageExit(reqNumber, stage);

  const nextStage = this.getNextStage(stage);
  if (nextStage) {
    // IMMEDIATELY start next stage - don't wait
    await this.stageTracker.recordStageEntry(reqNumber, nextStage);
    await this.startStage(reqNumber, nextStage);
  } else {
    // Workflow complete
    await this.markComplete(reqNumber);
  }
}
```

### Metrics Dashboard Data

```sql
-- Stage flow metrics
SELECT
  stage,
  COUNT(*) as count,
  AVG(duration_minutes) as avg_duration,
  MAX(duration_minutes) as max_duration,
  COUNT(*) FILTER (WHERE exited_at IS NULL) as currently_in_stage
FROM stage_tracking
GROUP BY stage;
```

### Success Criteria
- [x] Stage entry/exit tracked (StageTrackerService recordStageEntry/recordStageExit)
- [x] Stuck work detected automatically (checkForStuckWork with configurable timeouts)
- [x] Work flows through to DONE (subscribeToStageCompletions triggers next stage)
- [x] Metrics available for monitoring (getStageMetrics, getStageCounts, logStatus)

---

## Implementation Order

```
Day 1: Part 1 - Reduce concurrency limit (quick win)
Day 1: Part 3 - Run one-time orphan cleanup script
Day 2: Part 2 - Implement finish-first policy
Day 3: Part 3 - Implement periodic orphan cleanup
Day 4: Part 4 - Stage completion tracking
Day 5: Testing and tuning
```

---

## Quick Wins (Can Do Immediately)

### 1. Reduce MAX_CONCURRENT_WORKFLOWS

```typescript
// strategic-orchestrator.service.ts line 78
// Change:
private readonly MAX_CONCURRENT_WORKFLOWS = 10;
// To:
private readonly MAX_CONCURRENT_WORKFLOWS = 3;
```

### 2. One-Time Orphan Cleanup

```bash
# Move 18 unassigned IN_PROGRESS items back to BACKLOG
curl -X PUT "https://api.agog.fyi/api/agent/requests/REQ-XXX/status" \
  -H "Content-Type: application/json" \
  -d '{"phase": "backlog"}'
```

### 3. Move Strategic Agent Work Back

Marcus/Sarah have dev work assigned - move back to BACKLOG:
```
marcus: 10 items → should be 0 (he's a Product Owner)
sarah: 1 item → should be 0 (she's a Product Owner)
```

---

## Related Files

| File | Changes Needed |
|------|----------------|
| `strategic-orchestrator.service.ts` | Concurrency limit, finish-first logic |
| `orchestrator.service.ts` | Stage completion tracking |
| `orphan-cleanup.service.ts` | NEW - orphan detection/cleanup |
| `stage-tracker.service.ts` | NEW - stage flow tracking |

---

## Success Metrics

| Metric | Before | After (Target) |
|--------|--------|----------------|
| IN_PROGRESS count | 36 | 3-5 |
| Unassigned IN_PROGRESS | 18 | 0 |
| QA count | 4 | 5+ (work flowing through) |
| DONE per day | ? | Higher |
| Avg time to DONE | ? | Tracked and decreasing |

---

## Relationship to blocked-catastrophic-escalation.md

These two plans work together:

```
WIP Limit Enforcement          Blocked Catastrophic Escalation
        ↓                                    ↓
Ensures work FINISHES          Ensures BLOCKED work gets UNBLOCKED
        ↓                                    ↓
        └──────────── Work flows to DONE ───────────┘
```

Both are needed for a healthy workflow system.
