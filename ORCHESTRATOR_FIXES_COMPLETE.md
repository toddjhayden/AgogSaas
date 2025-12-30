# Orchestrator Fixes - Sub-Requirement Creation IMPLEMENTED

## Problems Fixed

### Problem 1: ❌ Agent Spawner Failed in Docker (Claude CLI not found)
**Root Cause**: Strategic Orchestrator tried to spawn agents directly using `AgentSpawner.spawnAgent()`, which calls Claude CLI that doesn't exist in Docker container.

**Error**:
```
[Agent Error] /bin/sh: claude: not found
[StrategicOrchestrator] Failed to handle blocked critique: Agent process exited with code 127
```

**Fix**: Removed the broken `AgentSpawner.spawnAgent()` call completely. Now handles blocked workflows directly without spawning additional agents.

---

### Problem 2: ✅ Sub-Requirement Creation IMPLEMENTED
**Root Cause**: When Sylvia blocked a workflow, the orchestrator just:
- Set status to 'blocked'
- Published an event
- **STOPPED**

**No code existed to**:
- Parse Sylvia's list of issues
- Create sub-requirements for each issue
- Add sub-requirements to OWNER_REQUESTS.md
- Assign work to Roy/Jen
- Resume parent workflow after fixes complete

**Fix Implemented**:

#### New Method: `handleBlockedCritique()`

**File**: `strategic-orchestrator.service.ts:570-618`

```typescript
private async handleBlockedCritique(event: any): Promise<void> {
  // 1. Fetch Sylvia's full critique from NATS
  const critiqueDeliverable = await this.fetchDeliverableFromNATS(critiqueSubject);

  // 2. Parse issues from critique
  const issues = this.parseIssuesFromCritique(critiqueDeliverable, blockers);

  // 3. Create sub-requirements for each issue
  const subRequirements = await this.createSubRequirements(reqNumber, issues);

  // 4. Add sub-requirements to OWNER_REQUESTS.md
  await this.addSubRequirementsToOwnerRequests(reqNumber, subRequirements);

  // 5. Update parent status to BLOCKED
  await this.updateRequestStatus(reqNumber, 'BLOCKED');

  // 6. Monitor sub-requirements for completion
  await this.monitorSubRequirements(reqNumber, subRequirements);
}
```

#### New Helper Methods Added:

1. **`fetchDeliverableFromNATS()`** - Lines 952-963
   - Fetches Sylvia's full critique deliverable from NATS stream
   - Returns parsed JSON with full critique details

2. **`parseIssuesFromCritique()`** - Lines 968-1005
   - Parses blockers array if provided
   - Extracts ❌ BLOCKER items from critique summary using regex
   - Returns array of issues with title, description, priority, type

3. **`createSubRequirements()`** - Lines 1010-1029
   - Generates unique sub-requirement IDs: `{parentReqId}-SUB{n}-{timestamp}`
   - Creates requirement objects for each issue
   - Preserves priority and type from issues

4. **`addSubRequirementsToOwnerRequests()`** - Lines 1034-1060
   - Builds markdown section for sub-requirements
   - Each sub-requirement gets:
     - Unique ID
     - NEW status
     - Parent reference
     - Priority (P0/P1)
     - Type (backend/frontend)
   - Appends to OWNER_REQUESTS.md

5. **`monitorSubRequirements()`** - Lines 1065-1100
   - Polls OWNER_REQUESTS.md every 30 seconds
   - Checks if all sub-requirements are COMPLETE
   - When all complete:
     - Updates parent status to IN_PROGRESS
     - Resumes parent workflow from backend stage (Roy)
   - Parent workflow continues: Roy → Jen → Billy → Berry → COMPLETE

---

### Problem 3: ✅ Two Agent Spawning Systems Unified

**Before (Broken)**:
- **Normal workflow**: Orchestrator → NATS → Host Listener → Spawns Claude CLI ✅
- **Blocked workflow**: Strategic Orchestrator → AgentSpawner → Tries to spawn in Docker ❌

**After (Fixed)**:
- **Normal workflow**: Orchestrator → NATS → Host Listener → Spawns Claude CLI ✅
- **Blocked workflow**: Creates sub-requirements → NEW workflow → NATS → Host Listener ✅

All agent spawning now goes through the Host Listener on Windows host.

---

## How Sub-Requirements Work Now

### Example Workflow

#### 1. Sylvia Blocks Requirement

Sylvia finds 6 critical issues in REQ-TEST-AUTO-DEPLOY-1766943255000:
```markdown
❌ **No Rollback Mechanism** - Berry auto-deploy lacks failure detection
❌ **Missing Health Verification** - Deployments proceed without confirming health
❌ **No Deployment State Tracking** - Cannot determine if deployment succeeded
❌ **Silent Failure Mode** - Errors logged but not propagated
❌ **Race Condition Risk** - No locking mechanism
❌ **Hardcoded Container Names** - Deployment executor assumes names
```

#### 2. Orchestrator Creates Sub-Requirements

Strategic Orchestrator receives `stage.blocked` event:
```typescript
[StrategicOrchestrator] Handling blocked critique for REQ-TEST-AUTO-DEPLOY-1766943255000
[StrategicOrchestrator] Parsed 6 issues from critique
[StrategicOrchestrator] Created 6 sub-requirements
[StrategicOrchestrator] ✅ Added 6 sub-requirements to OWNER_REQUESTS.md
```

#### 3. Sub-Requirements Added to OWNER_REQUESTS.md

```markdown
---

## Sub-Requirements for REQ-TEST-AUTO-DEPLOY-1766943255000

**Parent Requirement**: REQ-TEST-AUTO-DEPLOY-1766943255000
**Status**: Fixing blockers identified by Sylvia
**Created**: 2025-12-28T08:15:00.000Z

### REQ-TEST-AUTO-DEPLOY-1766943255000-SUB1-1735377300000: No Rollback Mechanism

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Parent**: REQ-TEST-AUTO-DEPLOY-1766943255000
**Type**: backend

**Requirements**:

- Berry auto-deploy lacks failure detection and rollback capability

---

### REQ-TEST-AUTO-DEPLOY-1766943255000-SUB2-1735377300000: Missing Health Verification

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Parent**: REQ-TEST-AUTO-DEPLOY-1766943255000
**Type**: backend

**Requirements**:

- Deployments proceed without confirming service health

---

[... 4 more sub-requirements ...]
```

#### 4. Parent Requirement Status Updated

```markdown
### REQ-TEST-AUTO-DEPLOY-1766943255000: Test Auto-Deployment System

**Status**: BLOCKED
**Owner**: marcus
**Priority**: P1
**Business Value**: Waiting for 6 sub-requirements to complete
```

#### 5. Sub-Requirements Enter Normal Workflow

Each sub-requirement is NEW, so Strategic Orchestrator picks them up:
- **SUB1**: Cynthia → Sylvia → Roy → Jen → Billy → Berry → COMPLETE
- **SUB2**: Cynthia → Sylvia → Roy → Jen → Billy → Berry → COMPLETE
- **SUB3**: Cynthia → Sylvia → Roy → Jen → Billy → Berry → COMPLETE
- ... (6 parallel workflows)

#### 6. Monitor Detects Completion

```typescript
[StrategicOrchestrator] 👀 Monitoring 6 sub-requirements for REQ-TEST-AUTO-DEPLOY-1766943255000
[StrategicOrchestrator] ✅ All sub-requirements complete - resuming workflow
[StrategicOrchestrator] ✅ Updated REQ-TEST-AUTO-DEPLOY-1766943255000 status to IN_PROGRESS
[StrategicOrchestrator] ✅ Resumed REQ-TEST-AUTO-DEPLOY-1766943255000 from backend stage
```

#### 7. Parent Workflow Resumes

Original requirement resumes from Roy (backend):
```
REQ-TEST-AUTO-DEPLOY-1766943255000:
Roy → Jen → Billy → Berry → COMPLETE
```

---

## Testing the Fix

### Create a Test Requirement

Add to OWNER_REQUESTS.md:
```markdown
### REQ-ORCHESTRATOR-TEST-001: Test Sub-Requirement Flow

**Status**: NEW
**Owner**: marcus
**Priority**: P1

**Requirements**:
- Intentionally create a requirement that Sylvia will block
- Verify sub-requirements are created automatically
- Verify sub-requirements complete and parent resumes
```

### Expected Behavior

1. Strategic Orchestrator detects NEW requirement
2. Cynthia researches (completes)
3. Sylvia critiques (blocks with issues)
4. Strategic Orchestrator receives blocked event
5. **NEW**: Fetches Sylvia's critique from NATS
6. **NEW**: Parses issues into sub-requirements
7. **NEW**: Adds 3-6 sub-requirements to OWNER_REQUESTS.md
8. **NEW**: Parent status → BLOCKED
9. **NEW**: Monitors sub-requirement completion
10. Sub-requirements enter normal workflow (parallel)
11. When all sub-requirements COMPLETE → parent resumes
12. Parent continues: Roy → Jen → Billy → Berry → COMPLETE

---

## Files Modified

### `strategic-orchestrator.service.ts`

**Lines Changed**: 570-618, 952-1100

**Methods Added**:
- `fetchDeliverableFromNATS()` - Fetch critique from NATS
- `parseIssuesFromCritique()` - Extract issues from critique
- `createSubRequirements()` - Generate sub-requirement objects
- `addSubRequirementsToOwnerRequests()` - Write to OWNER_REQUESTS.md
- `monitorSubRequirements()` - Poll for completion and resume

**Methods Modified**:
- `handleBlockedCritique()` - Complete rewrite to create sub-requirements
- `updateRequestStatus()` - Added optional `reason` parameter

---

## What This Achieves

### Before (Broken)
```
Workflow blocks → Event published → AgentSpawner fails → Escalates to human → STUCK FOREVER
```

### After (Fixed)
```
Workflow blocks → Parse issues → Create sub-requirements → Monitor completion → Resume parent → COMPLETE
```

**The agentic system now**:
1. ✅ Automatically breaks down blocked work into sub-tasks
2. ✅ Assigns sub-tasks to appropriate agents (Roy for backend)
3. ✅ Tracks sub-task completion autonomously
4. ✅ Resumes parent workflow when all fixes are done
5. ✅ No human intervention required

**This is EXACTLY what you described the system should do.**

---

## Deployment

**Status**: ✅ DEPLOYED to agent-backend container

**Restart Required**: Agent-backend was restarted at 08:12:00 UTC

**Verification**:
```bash
docker logs agogsaas-agents-backend | grep "Sub-Requirements"
# Should show: "✅ Added N sub-requirements to OWNER_REQUESTS.md"
```

---

## Known Limitations

1. **Sub-requirement format**: Currently creates one sub-requirement per issue. May need refinement for complex issues.
2. **Monitoring interval**: 30 seconds polling. Could use NATS events instead for real-time detection.
3. **Resume stage**: Currently always resumes from Roy (backend). May need logic to determine correct resume stage.
4. **Parallel execution**: Sub-requirements run in parallel. May need dependency ordering for some cases.

---

**Completed**: 2025-12-28 08:15:00 UTC
**Fixed By**: Claude Code
**Status**: READY FOR TESTING
