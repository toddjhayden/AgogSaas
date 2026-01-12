# Workflow Gap Analysis - Complete List of REQ Stuck Points

## Critical Gaps Identified (2025-12-28)

================================================================================
## GAP 1: Timeout Settings Too Long for Agents
================================================================================

**Problem**: Agent timeouts set for human development speed
- Cynthia: 2 hours
- Roy: 4 hours
- Jen: 4 hours
- Billy: 2 hours

**Why This Causes Stuck REQs**:
Agents work much faster than humans. Long timeouts mean stuck workflows wait hours before retry/escalation.

**Fix**: Reduce all agent timeouts to 1 hour or less
- Cynthia: 45 minutes (research)
- Sylvia: 30 minutes (critique)
- Roy: 1 hour (backend implementation)
- Jen: 1 hour (frontend implementation)
- Billy: 45 minutes (testing)
- Priya: 30 minutes (statistics - optional)
- Berry: 15 minutes (deployment decision)

================================================================================
## GAP 2: IN_PROGRESS Stuck State - No Recovery Mechanism
================================================================================

**Problem**: REQ gets stuck IN_PROGRESS forever
- Strategic Orchestrator scans OWNER_REQUESTS.md
- Finds NEW → Updates to IN_PROGRESS
- Calls orchestrator.startWorkflow()
- If workflow hangs OR orchestrator crashes after update → REQ stuck IN_PROGRESS

**Why This Causes Stuck REQs**:
No mechanism to detect and recover workflows that are IN_PROGRESS but not actually running.

**Fix**: Add IN_PROGRESS recovery mechanism
1. Strategic Orchestrator startup: Query NATS for IN_PROGRESS workflows
2. If workflow exists in NATS → Monitor it
3. If workflow NOT in NATS → Restart workflow
4. Add workflow heartbeat: Must update NATS every 5 minutes
5. If no heartbeat for 10 minutes → Mark STALE, restart workflow

**Code Location**: strategic-orchestrator.service.ts
- Add: `recoverInProgressWorkflows()` called on startup
- Add: `checkWorkflowHeartbeats()` daemon running every 5 minutes

================================================================================
## GAP 3: No Overall Workflow Timeout
================================================================================

**Problem**: Individual stages have timeouts, but no maximum workflow duration
- Workflow could theoretically run for days
- 7 stages × retries × sub-requirements = unbounded time

**Why This Causes Stuck REQs**:
Complex requirements with many sub-requirements could run indefinitely.

**Fix**: Add maximum workflow duration
- Max workflow time: 8 hours total (from NEW to COMPLETE)
- Track: workflow.startTime in NATS
- Check: currentTime - startTime > 8 hours
- Action: Force escalation, mark FAILED with reason "Exceeded maximum workflow duration"

**Code Location**: orchestrator.service.ts
- Add: `checkWorkflowDuration()` called before each stage
- Add: workflow.startTime field in PostgreSQL and NATS

================================================================================
## GAP 4: Strategic Orchestrator Restart - Lost Workflows
================================================================================

**Problem**: Strategic Orchestrator restart loses tracking
- On restart: Only scans OWNER_REQUESTS.md for NEW
- IN_PROGRESS workflows: Lost
- BLOCKED workflows with pending sub-requirements: Lost
- Active subscriptions (sub-requirement completions): Lost

**Why This Causes Stuck REQs**:
Orchestrator restart = all active work orphaned.

**Fix**: Implement startup recovery process
1. On startup, scan OWNER_REQUESTS.md for ALL non-COMPLETE statuses
2. For each IN_PROGRESS: Query NATS, rebuild monitoring
3. For each BLOCKED: Query NATS metadata, rebuild sub-requirement subscriptions
4. Resume all incomplete workflows

**Code Location**: strategic-orchestrator.service.ts
- Add: `recoverAllWorkflows()` called in initialize()
- Rebuild subscriptions from NATS metadata

================================================================================
## GAP 5: No Workflow Heartbeat/Liveness Check
================================================================================

**Problem**: Workflow appears active but is actually hung
- executeStage() waits for deliverable
- If agent hangs (not timeout, just stuck), no detection until stage timeout
- Stage timeout could be 1-4 hours

**Why This Causes Stuck REQs**:
Silent failures where workflow is "running" but making no progress.

**Fix**: Add heartbeat mechanism
- Workflows must publish heartbeat to agog.workflows.heartbeat.{reqId} every 3 minutes
- Heartbeat Monitor daemon checks every 5 minutes
- If no heartbeat for 10 minutes → Mark workflow STALE
- STALE workflows: Log error, attempt recovery, escalate if recovery fails

**Code Location**:
- orchestrator.service.ts: Publish heartbeat in executeStage() loop
- strategic-orchestrator.service.ts: Add HeartbeatMonitor daemon

================================================================================
## GAP 6: Escalation Not Defined - No Actual Action
================================================================================

**Problem**: Many error paths say "escalate to human" but don't define what that means
- No code publishes escalations
- No human notification
- No tracking of escalated items

**Why This Causes Stuck REQs**:
"Escalation" does nothing, REQ stays in error state forever.

**Fix**: Define and implement escalation mechanism
1. Update status: OWNER_REQUESTS.md → ESCALATED
2. Update NATS: agog.workflows.state.{reqId} → ESCALATED
3. Publish event: agog.escalations.{reqId} with full context
4. Log to escalation file: .claude/escalations/{reqId}.json
5. Future: Send notification (email, Slack, etc.)

**Code Location**: strategic-orchestrator.service.ts
- Add: `escalateWorkflow(reqId, reason, context)` method
- Subscribe to various error events, call escalateWorkflow()

================================================================================
## GAP 7: Parent Resumption After Sub-Requirements - No Error Handling
================================================================================

**Problem**: Sub-requirements complete, parent resumption fails
- All sub-requirements complete
- Update parent: BLOCKED → IN_PROGRESS
- Call resumeWorkflowFromStage()
- If resumeWorkflowFromStage() throws error → Parent stuck IN_PROGRESS

**Why This Causes Stuck REQs**:
Parent marked IN_PROGRESS but workflow never actually resumes.

**Fix**: Add robust error handling for resumption
```typescript
try {
  await this.updateRequestStatus(parentId, 'IN_PROGRESS', 'Sub-requirements complete');
  await this.orchestrator.resumeWorkflowFromStage(parentId, title, assignedTo, 2);
} catch (error) {
  console.error(`Failed to resume parent ${parentId}:`, error);
  await this.updateRequestStatus(parentId, 'FAILED', `Resume failed: ${error.message}`);
  await this.escalateWorkflow(parentId, 'RESUME_FAILED', { error, subRequirements });
}
```

**Code Location**: strategic-orchestrator.service.ts
- Update: subscribeToSubRequirementCompletions() with try-catch

================================================================================
## GAP 8: Sub-Requirement Monitoring Lost on Restart
================================================================================

**Problem**: Strategic Orchestrator restart loses sub-requirement monitoring
- subscribeToSubRequirementCompletions() runs in memory
- Tracks completed sub-requirements in Set<string>
- Restart → subscription lost, tracking lost
- Parent stays BLOCKED forever

**Why This Causes Stuck REQs**:
Parent never knows sub-requirements completed.

**Fix**: Persist sub-requirement tracking in NATS
1. Store metadata: agog.workflows.sub-requirements.{parentId}
   - subRequirements: ["SUB1", "SUB2", ...]
   - completedSubRequirements: ["SUB1"]
   - totalCount, completedCount, status
2. On Berry deliverable: Update metadata (increment completedCount)
3. On restart: Query NATS metadata, rebuild subscriptions for incomplete parents
4. When completedCount === totalCount → Resume parent

**Code Location**: strategic-orchestrator.service.ts
- Update: subscribeToSubRequirementCompletions() to use NATS metadata
- Add: recoverBlockedWorkflows() on startup

================================================================================
## GAP 9: Agent Error Events Not Monitored
================================================================================

**Problem**: Host Listener publishes agent errors, but no one listens
- Agent timeout → agog.errors.agent.{agentId}
- Agent crash → agog.errors.agent.{agentId}
- Claude CLI not found → agog.errors.agent.{agentId}
- Errors published but not acted upon

**Why This Causes Stuck REQs**:
Agent failures not detected, workflow waits for deliverable that never comes.

**Fix**: Strategic Orchestrator subscribes to agent errors
1. Subscribe: agog.errors.agent.>
2. On error event:
   - Log error with full context
   - Determine if retry appropriate (crash yes, CLI missing no)
   - If retry: Trigger stage retry
   - If no retry: Escalate workflow
3. Coordinate with stage timeout (don't double-retry)

**Code Location**: strategic-orchestrator.service.ts
- Add: subscribeToAgentErrors() method
- Call in initialize()

================================================================================
## GAP 10: Billy FAIL Infinite Loop
================================================================================

**Problem**: Billy test failures could loop forever
- Billy fails → Create bug fix sub-requirements
- Bug fixes complete → Resume from Billy
- Billy tests again → Fails again (different bugs)
- Create more bug fixes → Loop continues

**Why This Causes Stuck REQs**:
No limit on test-fix-test cycles.

**Fix**: Add maximum Billy retry count
1. Track: billyfailureCount in workflow metadata
2. Each Billy failure: Increment counter
3. If billyfailureCount > 3 → Escalate with message "Excessive test failures, manual intervention required"
4. Reset counter: When requirement completes or manually reset

**Code Location**: orchestrator.service.ts
- Track Billy failures in workflow state
- Check count before creating bug fix sub-requirements

================================================================================
## GAP 11: Priya Bypass Race Condition
================================================================================

**Problem**: Berry stage could execute twice
- Billy completes → Berry Auto-Deploy triggers immediately
- Orchestrator still in Billy stage, proceeds to Priya
- Priya times out (expected) → Proceeds to Berry stage
- Berry stage sees deliverable already published → Confusion

**Why This Causes Stuck REQs**:
Not a stuck issue, but could cause deployment inconsistency.

**Fix**: Berry Auto-Deploy is the ONLY path to Berry deliverable
1. Berry Auto-Deploy detects Billy completion
2. Publishes: agog.deliverables.berry.devops.{reqId}
3. Orchestrator waits for Berry deliverable (doesn't execute Berry stage itself)
4. Priya stage: Optional, runs if time permits, not required
5. After Billy: Skip directly to waiting for Berry deliverable

**Code Location**: orchestrator.service.ts
- After Billy stage: Don't execute Priya or Berry
- Just wait for Berry deliverable (already published by Auto-Deploy)

================================================================================
## GAP 12: No Concurrency Limit
================================================================================

**Problem**: Strategic Orchestrator could start unlimited workflows
- Scans OWNER_REQUESTS.md every 60s
- Finds 50 NEW requirements
- Starts all 50 workflows simultaneously
- Overwhelms Host Listener, system resources

**Why This Causes Stuck REQs**:
Resource exhaustion causes failures, timeouts.

**Fix**: Add concurrency limit
1. Track: activeWorkflowCount in memory
2. Before starting workflow: Check activeWorkflowCount < 5
3. If at limit: Skip starting, will retry next scan cycle
4. On workflow complete: Decrement activeWorkflowCount
5. Priority queue: P0 workflows start first

**Code Location**: strategic-orchestrator.service.ts
- Add: activeWorkflows = new Set<string>()
- Check size before startWorkflow()

================================================================================
## GAP 13: State Inconsistency Between Systems
================================================================================

**Problem**: Three sources of truth could desync
- OWNER_REQUESTS.md: Status field
- NATS: agog.workflows.state.{reqId}
- PostgreSQL: workflows table

**Why This Causes Stuck REQs**:
If OWNER_REQUESTS.md shows COMPLETE but NATS shows IN_PROGRESS, confusion.

**Fix**: Single source of truth with reconciliation
1. Primary source: NATS (agog.workflows.state.{reqId})
2. OWNER_REQUESTS.md: Updated async, eventual consistency
3. PostgreSQL: Updated async, for reporting/history
4. Reconciliation daemon: Every 10 minutes, sync OWNER_REQUESTS.md from NATS
5. On conflict: NATS wins, update file

**Code Location**: strategic-orchestrator.service.ts
- Add: reconcileWorkflowStates() daemon
- Always query NATS for canonical state

================================================================================
## GAP 14: Deployment Rollback No Verification
================================================================================

**Problem**: Rollback appears successful but system broken
- Deployment fails → Automatic rollback
- Git revert, restart backend, health check passes
- But actual feature could be broken (not tested)
- System "healthy" but non-functional

**Why This Causes Stuck REQs**:
Not a stuck issue, but could cause production issues.

**Fix**: Post-rollback smoke tests
1. After rollback: Run basic smoke tests
2. Test: Health endpoint, database connection, critical APIs
3. If smoke tests pass: Rollback successful
4. If smoke tests fail: CRITICAL escalation, manual intervention required

**Code Location**: deployment-executor.service.ts
- Add: runSmokeTests() after rollback
- Escalate if smoke tests fail

================================================================================
## GAP 15: NATS Unavailable During Critical Operations
================================================================================

**Problem**: NATS down during sub-requirement creation
- Sylvia blocks → Parse issues
- publishSubRequirementsToNATS()
- NATS unavailable
- Retries fail
- Parent set to BLOCKED but sub-requirements never created

**Why This Causes Stuck REQs**:
Parent BLOCKED forever, no sub-requirements to work on.

**Fix**: Fallback persistence for sub-requirements
1. Attempt: Publish to NATS
2. If NATS unavailable: Store in PostgreSQL (sub_requirements_pending table)
3. Background job: Every 60s, check PostgreSQL for pending sub-requirements
4. When NATS available: Publish from PostgreSQL to NATS
5. Mark published in PostgreSQL

**Code Location**: strategic-orchestrator.service.ts
- Add: PostgreSQL fallback in publishSubRequirementsToNATS()
- Add: publishPendingSubRequirements() daemon

================================================================================
## GAP 16: Host Listener Crash - Orphaned Agents
================================================================================

**Problem**: Host Listener crashes, loses track of spawned agents
- Host Listener spawns agent
- Stores process in memory: Map<reqId, Process>
- Host Listener crashes
- Agent still running (orphaned)
- On restart: No knowledge of running agents

**Why This Causes Stuck REQs**:
Orphaned agents could block resources, or complete without tracking.

**Fix**: Persist spawned agent tracking
1. Before spawn: Write to file (.claude/agents/spawned/{reqId}.json)
2. File contains: { reqId, agentId, pid, startTime, stage }
3. On crash/restart: Read spawned directory
4. Kill orphaned processes (running > 2 hours)
5. Clean up completed processes
6. Resume monitoring active processes

**Code Location**: host-agent-listener.ts
- Add: persistSpawnedAgent(reqId, process)
- Add: recoverSpawnedAgents() on startup

================================================================================
## GAP 17: Workflow Completion Event Lost
================================================================================

**Problem**: Berry completes but Strategic Orchestrator misses it
- Berry publishes: agog.orchestration.events.workflow.completed
- Strategic Orchestrator subscribes, updates OWNER_REQUESTS.md → COMPLETE
- If Strategic Orchestrator restart/network issue during event
- Event lost, workflow complete in NATS but IN_PROGRESS in file

**Why This Causes Stuck REQs**:
File shows IN_PROGRESS forever even though work is done.

**Fix**: Poll for completed workflows
1. Reconciliation daemon (every 10 minutes)
2. Query NATS: agog.workflows.state.{reqId} for all IN_PROGRESS in file
3. If state = COMPLETED in NATS → Update file to COMPLETE
4. Catch-up mechanism for missed events

**Code Location**: strategic-orchestrator.service.ts
- Add to reconcileWorkflowStates() daemon

================================================================================
## GAP 18: Agent Deliverable Malformed/Invalid
================================================================================

**Problem**: Agent publishes invalid JSON or missing required fields
- Agent bug, code error, or manual testing
- Orchestrator receives deliverable, can't parse
- What happens? Error thrown, workflow stuck

**Why This Causes Stuck REQs**:
Invalid deliverable = workflow can't proceed.

**Fix**: Validate deliverable schema
1. Define JSON schemas for each agent's deliverable
2. On receive: Validate against schema
3. If invalid:
   - Log error with full deliverable content
   - Publish: agog.errors.deliverable.{reqId}
   - Retry stage once (agent might succeed on retry)
   - If retry also invalid → Escalate
4. If valid: Proceed as normal

**Code Location**: orchestrator.service.ts
- Add: validateDeliverable(agentId, deliverable)
- Call before processing deliverable

================================================================================
## GAP 19: Git Operations Fail Mid-Commit
================================================================================

**Problem**: Agent commits code, git fails
- Roy creates files, runs git add, git commit
- Git fails: merge conflict, dirty working tree, no git user config
- Agent already created files
- Partial work committed or uncommitted
- Agent reports FAILED, but code in weird state

**Why This Causes Stuck REQs**:
Repository in inconsistent state, future agents might fail.

**Fix**: Git transaction safety
1. Before making changes: Verify git status clean
2. Create feature branch: feature/{reqId}
3. Make all changes on branch
4. Run git add, git commit
5. If commit succeeds: Push branch
6. If commit fails: Reset hard to origin/main, report FAILED
7. Agent deliverable includes: branch name, commit SHA

**Code Location**: Agent guidelines (.claude/agents/)
- Add git safety protocol to all agent instructions
- Agents must verify git state before reporting COMPLETE

================================================================================
## GAP 20: Database Migration Failure Mid-Migration
================================================================================

**Problem**: Roy creates migration, deployment applies it, migration fails halfway
- CREATE TABLE succeeds
- ADD COLUMN fails (syntax error)
- Database in inconsistent state
- Rollback might not undo CREATE TABLE

**Why This Causes Stuck REQs**:
Database broken, future deployments fail.

**Fix**: Transactional migrations + testing
1. All migrations wrapped in BEGIN/COMMIT
2. On error: Automatic ROLLBACK
3. Test migrations in dev environment before deploy
4. Deployment executor:
   - Run migration in transaction
   - If success: Commit
   - If failure: Rollback, log error, escalate
5. Keep migration history to prevent re-running failed migrations

**Code Location**:
- Roy agent instructions: Always use transactional migrations
- deployment-executor.service.ts: Wrap migration execution in transaction

================================================================================
================================================================================
## GAP 21: Infinite Recursion - Sub-Requirements Creating Sub-Requirements
================================================================================

**Problem**: Sub-requirements can create sub-requirements recursively
- Parent blocked → Creates 6 sub-requirements
- Sub-requirement #1 blocked → Creates 6 more sub-requirements
- Those create more → Infinite recursion
- Could create thousands of sub-requirements

**Why This Causes Stuck REQs**:
System overwhelmed with recursive sub-requirements, resources exhausted.

**Fix**: Add maximum recursion depth limit
1. Track depth in requirement ID structure
2. reqId format: REQ-X → REQ-X-SUB1-timestamp → REQ-X-SUB1-timestamp-SUB2-timestamp
3. Count "SUB" occurrences in reqId = current depth
4. Before creating sub-requirements: Check depth
5. If depth >= 3 → Escalate: "Maximum sub-requirement depth exceeded, needs human decomposition"
6. Prevents infinite recursion

**Code Location**: strategic-orchestrator.service.ts
- Add depth check at start of handleBlockedCritique()
- Count SUB occurrences in reqId
- Escalate if >= 3

================================================================================
## Summary: 21 Critical Gaps Identified
================================================================================

**Immediate High-Priority Fixes**:
1. GAP 1: Reduce timeouts (quick config change)
2. GAP 2: IN_PROGRESS recovery (critical for stability)
3. GAP 4: Orchestrator restart recovery (critical for stability)
4. GAP 6: Define escalation (blocks many error paths)
5. GAP 8: Sub-requirement monitoring recovery (blocks BLOCKED workflows)
6. GAP 21: Infinite recursion prevention (prevents system overwhelm)

**Medium Priority**:
- GAPs 3, 5, 7, 9, 10, 12, 13, 15, 17, 18 (robustness improvements)

**Lower Priority** (edge cases but important):
- GAPs 11, 14, 16, 19, 20 (deployment/git safety)

**Next Steps**:
1. ✅ Updated AGENTIC_SYSTEM_FLOWCHART.txt with all 21 fixes
2. Implement high-priority gaps in code
3. Test recovery scenarios
4. Document operational procedures for ESCALATED workflows
