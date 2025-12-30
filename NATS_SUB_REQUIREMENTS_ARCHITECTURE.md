# NATS-Based Sub-Requirement Architecture - CORRECT IMPLEMENTATION

## Architecture Principles

### OWNER_REQUESTS.md = OWNER INPUT ONLY
- Contains ONLY requirements from the actual owner (human)
- NOT a work queue
- NOT for system-generated sub-requirements
- Strategic Orchestrator scans this file for NEW/PENDING/REJECTED owner requirements

### NATS = SYSTEM WORK QUEUE
- All work lives in NATS (owner requirements + sub-requirements)
- Sub-requirements published to NATS subjects
- Agents subscribe to NATS for work
- Priority, status, dependencies all managed in NATS
- Deliverables published to NATS

---

## Sub-Requirement Flow (CORRECT)

### 1. Sylvia Blocks Workflow

```
Sylvia finds 6 critical issues
  ↓
Publishes deliverable with status: BLOCKED
  ↓
Orchestrator publishes: agog.orchestration.events.stage.blocked
```

### 2. Strategic Orchestrator Receives Block Event

```typescript
[StrategicOrchestrator] Handling blocked critique for REQ-PARENT-001
[StrategicOrchestrator] Parsed 6 issues from critique
[StrategicOrchestrator] Created 6 sub-requirements
```

### 3. Sub-Requirements Published to NATS (NOT to OWNER_REQUESTS.md)

```typescript
// For each issue:
await this.nc.publish('agog.requirements.sub.new', JSON.stringify({
  reqId: 'REQ-PARENT-001-SUB1-1735377300000',
  title: 'No Rollback Mechanism',
  description: 'Berry auto-deploy lacks failure detection',
  priority: 'P0',
  parent: 'REQ-PARENT-001',
  type: 'backend',
  status: 'NEW',
  createdAt: '2025-12-28T08:15:00.000Z'
}));
```

**Log Output**:
```
[StrategicOrchestrator] Publishing 6 sub-requirements to NATS
[StrategicOrchestrator] ✅ Published REQ-PARENT-001-SUB1-1735377300000 to NATS (Priority: P0)
[StrategicOrchestrator] ✅ Published REQ-PARENT-001-SUB2-1735377300000 to NATS (Priority: P0)
...
[StrategicOrchestrator] ✅ Published 6 sub-requirements to NATS work queue
```

### 4. Strategic Orchestrator Subscribes to Sub-Requirements

```typescript
private async subscribeToSubRequirements(): Promise<void> {
  const sub = this.nc.subscribe('agog.requirements.sub.new');

  for await (const msg of sub) {
    const subReq = JSON.parse(msg.string());

    // Start workflow for each sub-requirement
    await this.orchestrator.startWorkflow(subReq.reqId, subReq.title, 'marcus');
  }
}
```

**Log Output**:
```
[StrategicOrchestrator] 📨 Received sub-requirement: REQ-PARENT-001-SUB1-1735377300000 (Priority: P0)
[StrategicOrchestrator] 🆕 Starting workflow for sub-requirement
[StrategicOrchestrator] Parent: REQ-PARENT-001, Priority: P0, Type: backend
[StrategicOrchestrator] ✅ Workflow started for sub-requirement REQ-PARENT-001-SUB1-1735377300000
```

### 5. Sub-Requirement Workflows Execute

Each sub-requirement enters the normal 7-stage workflow:

```
REQ-PARENT-001-SUB1-1735377300000:
  Cynthia (research) → Sylvia (critique) → Roy (backend) → Jen (frontend) → Billy (QA) → Priya (stats) → Berry (deploy)

REQ-PARENT-001-SUB2-1735377300000:
  Cynthia → Sylvia → Roy → Jen → Billy → Priya → Berry

... (all 6 in parallel)
```

### 6. Strategic Orchestrator Monitors Completions via NATS

```typescript
private async subscribeToSubRequirementCompletions(parentReqId, subRequirements) {
  const sub = this.nc.subscribe('agog.deliverables.berry.devops.>');

  for await (const msg of sub) {
    const deliverable = JSON.parse(msg.string());

    // Check if this is one of our sub-requirements
    if (subRequirements.includes(deliverable.reqId)) {
      completedSubReqs.add(deliverable.reqId);

      // All done?
      if (completedSubReqs.size === totalCount) {
        // Resume parent workflow
        await this.orchestrator.resumeWorkflowFromStage(parentReqId, title, assignedTo, 2);
      }
    }
  }
}
```

**Log Output**:
```
[StrategicOrchestrator] ✅ Sub-requirement REQ-PARENT-001-SUB1-1735377300000 completed (1/6)
[StrategicOrchestrator] ✅ Sub-requirement REQ-PARENT-001-SUB2-1735377300000 completed (2/6)
...
[StrategicOrchestrator] ✅ Sub-requirement REQ-PARENT-001-SUB6-1735377300000 completed (6/6)
[StrategicOrchestrator] ✅ All 6 sub-requirements complete for REQ-PARENT-001 - resuming workflow
```

### 7. Parent Workflow Resumes

```typescript
await this.updateRequestStatus(parentReqId, 'IN_PROGRESS', 'Sub-requirements complete');
await this.orchestrator.resumeWorkflowFromStage(parentReqId, title, assignedTo, 2); // Stage 2 = Roy
```

**Log Output**:
```
[StrategicOrchestrator] ✅ Updated REQ-PARENT-001 status to IN_PROGRESS (Sub-requirements complete)
[StrategicOrchestrator] ✅ Resumed REQ-PARENT-001 from backend stage
[REQ-PARENT-001] Stage 3/7: Backend Implementation
```

Parent workflow continues: Roy → Jen → Billy → Berry → COMPLETE

---

## NATS Subjects Used

### Requirements Queue
```
agog.requirements.sub.new              # New sub-requirements published here
agog.workflows.sub-requirements.{parent} # Metadata about parent's sub-requirements
```

### Workflow Events
```
agog.orchestration.events.stage.blocked  # When Sylvia blocks
agog.orchestration.events.stage.started  # When agent stage starts
agog.orchestration.events.workflow.completed # When workflow completes
```

### Deliverables
```
agog.deliverables.cynthia.research.{reqId}
agog.deliverables.sylvia.critique.{reqId}
agog.deliverables.roy.backend.{reqId}
agog.deliverables.jen.frontend.{reqId}
agog.deliverables.billy.qa.{reqId}
agog.deliverables.priya.statistics.{reqId}
agog.deliverables.berry.devops.{reqId}
```

---

## What NEVER Goes in OWNER_REQUESTS.md

❌ **Sub-requirements** - These are system-generated work items, not owner requests
❌ **Agent internal work** - Refactoring, optimization, cleanup tasks
❌ **Blocked workflow details** - Just update parent status to BLOCKED
❌ **Dependency trees** - Managed in NATS metadata

## What DOES Go in OWNER_REQUESTS.md

✅ **Owner requirements** - Features, fixes, enhancements requested by owner
✅ **Status updates** - NEW → IN_PROGRESS → BLOCKED → COMPLETE
✅ **Priority** - P0, P1, P2, P3
✅ **Business value** - Why the owner wants this

---

## Benefits of NATS-Based Architecture

### 1. Separation of Concerns
- Human input (OWNER_REQUESTS.md) vs system work queue (NATS)
- Clear boundary between what owner requested and what system generated

### 2. Priority Management in NATS
- Sub-requirements have priority (P0/P1/P2)
- Can implement priority-based work routing
- High-priority sub-requirements can jump the queue

### 3. Parallel Execution
- All sub-requirements start simultaneously
- No artificial serialization from file-based queue
- Faster overall completion

### 4. Real-Time Monitoring
- NATS subscriptions provide instant notification
- No polling OWNER_REQUESTS.md file
- More responsive system

### 5. Scalability
- NATS handles thousands of requirements
- File-based queue doesn't scale
- Multiple orchestrators can subscribe to same subjects

---

## Example: Complete Sub-Requirement Flow

### Owner Adds Requirement
```markdown
### REQ-AUTO-DEPLOY-001: Implement Auto-Deployment

**Status**: NEW
**Owner**: marcus
**Priority**: P1
```

### Workflow Starts
```
Cynthia researches → Sylvia critiques → BLOCKED (6 issues found)
```

### System Creates Sub-Requirements (in NATS, NOT in file)
```
Published to NATS:
  - REQ-AUTO-DEPLOY-001-SUB1-xxx: No Rollback Mechanism (P0, backend)
  - REQ-AUTO-DEPLOY-001-SUB2-xxx: Missing Health Verification (P0, backend)
  - REQ-AUTO-DEPLOY-001-SUB3-xxx: No Deployment State Tracking (P0, backend)
  - REQ-AUTO-DEPLOY-001-SUB4-xxx: Silent Failure Mode (P1, backend)
  - REQ-AUTO-DEPLOY-001-SUB5-xxx: Race Condition Risk (P1, backend)
  - REQ-AUTO-DEPLOY-001-SUB6-xxx: Hardcoded Container Names (P2, backend)
```

### OWNER_REQUESTS.md Status Updated
```markdown
### REQ-AUTO-DEPLOY-001: Implement Auto-Deployment

**Status**: BLOCKED
**Owner**: marcus
**Priority**: P1
```

**That's it.** No sub-requirements polluting the owner's file.

### Sub-Requirements Execute (in NATS)
```
All 6 start workflows in parallel:
  SUB1: Cynthia → Sylvia → Roy → Jen → Billy → Priya → Berry → COMPLETE
  SUB2: Cynthia → Sylvia → Roy → Jen → Billy → Priya → Berry → COMPLETE
  ...
  SUB6: Cynthia → Sylvia → Roy → Jen → Billy → Priya → Berry → COMPLETE
```

### Parent Resumes (status in file updated)
```markdown
### REQ-AUTO-DEPLOY-001: Implement Auto-Deployment

**Status**: IN_PROGRESS
**Owner**: marcus
**Priority**: P1
```

### Parent Completes
```markdown
### REQ-AUTO-DEPLOY-001: Implement Auto-Deployment

**Status**: COMPLETE
**Owner**: marcus
**Priority**: P1
```

---

## Code Changes Made

### File: `strategic-orchestrator.service.ts`

**Methods Added**:
1. `publishSubRequirementsToNATS()` - Lines 1037-1065
   - Publishes sub-requirements to `agog.requirements.sub.new`
   - Stores metadata at `agog.workflows.sub-requirements.{parent}`

2. `subscribeToSubRequirements()` - Lines 579-624
   - Subscribes to `agog.requirements.sub.new`
   - Starts workflows for sub-requirements automatically

3. `subscribeToSubRequirementCompletions()` - Lines 1070-1123
   - Monitors Berry completions for sub-requirements
   - Resumes parent workflow when all complete

**Methods Modified**:
1. `handleBlockedCritique()` - Lines 629-667
   - Changed from file-based to NATS-based
   - Calls `publishSubRequirementsToNATS()` instead of `addSubRequirementsToOwnerRequests()`
   - Calls `subscribeToSubRequirementCompletions()` instead of `monitorSubRequirements()`

---

## Deployment Status

✅ **DEPLOYED** to agent-backend container
✅ **TESTED** - Subscriptions confirmed running
✅ **READY** - Waiting for blocked workflow to test full flow

**Verification**:
```bash
docker logs agogsaas-agents-backend | grep "Subscribed to sub-requirements"
# Output: [StrategicOrchestrator] - Subscribed to sub-requirements from NATS work queue
```

---

**Completed**: 2025-12-28 08:45:00 UTC
**Architecture**: NATS-based work queue (correct)
**Status**: READY FOR TESTING
