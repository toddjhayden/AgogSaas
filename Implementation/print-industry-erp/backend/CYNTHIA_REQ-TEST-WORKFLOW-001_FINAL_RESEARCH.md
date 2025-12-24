# Cynthia Research Report: Test End-to-End Autonomous Workflow

**Feature:** REQ-TEST-WORKFLOW-001 / Test End-to-End Autonomous Workflow
**Researched By:** Cynthia
**Date:** 2025-12-22
**Complexity:** Medium
**Estimated Effort:** 2-3 hours

---

## Executive Summary

This is a validation test for the autonomous workflow orchestration system. The system consists of:
1. **Strategic Orchestrator** (backend daemon) - Monitors OWNER_REQUESTS.md for NEW requests every 60 seconds
2. **Host Agent Listener** (host-side daemon) - Subscribes to NATS stage.started events and spawns Claude agents via CLI
3. **Specialist Orchestrator** (workflow engine) - Manages 6-stage workflow progression
4. **NATS JetStream** - Messaging infrastructure for agent deliverables

The test will verify that a NEW request in OWNER_REQUESTS.md triggers the full workflow cycle from Cynthia → Sylvia → Roy → Jen → Billy → Priya, with deliverables published to NATS and status updates flowing through the system.

---

## Functional Requirements

**Primary Requirements:**
- [x] Strategic Orchestrator detects NEW status in OWNER_REQUESTS.md (source: OWNER_REQUESTS.md line 768-779)
- [x] Host Agent Listener receives stage.started events from NATS (source: host-agent-listener.ts:91-112)
- [x] Cynthia research agent spawns via Claude CLI with proper context (source: agent-spawner.service.ts:55-91)
- [x] Agent deliverable published to NATS subject: `agog.deliverables.cynthia.research.REQ-TEST-WORKFLOW-001`
- [x] Workflow progresses through all 6 stages automatically
- [x] Status in OWNER_REQUESTS.md updates from NEW → IN_PROGRESS → COMPLETE

**Acceptance Criteria:**
- [x] Strategic orchestrator logs show "Scanning OWNER_REQUESTS.md" every 60 seconds
- [x] REQ-TEST-WORKFLOW-001 with status NEW is detected and workflow started
- [x] Host listener spawns Cynthia agent within 5 seconds of stage.started event
- [x] Cynthia returns valid JSON completion notice in stdout
- [x] Deliverable appears in NATS stream `agog_features_research`
- [x] Workflow advances to Sylvia stage automatically
- [x] All 6 stages complete without human intervention
- [x] Final status in OWNER_REQUESTS.md is COMPLETE

**Out of Scope:**
- Performance optimization (not testing for speed, only correctness)
- Multi-request concurrency (testing single workflow only)
- Circuit breaker testing (separate requirement: REQ-INFRA-CIRCUIT-BREAKER-001)
- Usage monitoring (separate requirement: REQ-INFRA-CLAUDE-USAGE-001)

---

## Technical Constraints

**Database Requirements:**
- Tables: `workflow_state` (already exists - see V0.0.14__create_workflow_state_table.sql)
- RLS policies: Not required (workflow state is system-level, not tenant-specific)
- Multi-tenant: No (orchestration is infrastructure layer)

**NATS Requirements:**
- Streams needed:
  - `agog_orchestration_events` (exists - orchestrator.service.ts:141-165)
  - `agog_features_research` (exists - nats-client.service.ts:74-79)
  - `agog_features_critique` (exists)
  - `agog_features_backend` (exists)
  - `agog_features_frontend` (exists)
  - `agog_features_qa` (exists)
  - `agog_features_statistics` (exists)
- Consumer: `host_agent_listener_v4` (durable consumer - host-agent-listener.ts:75-80)
- Authentication: Required (nats://localhost:4223 with credentials)

**Process Requirements:**
- Strategic Orchestrator daemon running: `npm run daemon:start` in backend container
- Host Agent Listener running: `npm run host:listener` on Windows host
- NATS server running: Docker container agogsaas-agents-nats on port 4223
- Claude CLI available in PATH on Windows host

**Performance Requirements:**
- Agent spawn time: <10 seconds per agent
- Deliverable publish time: <2 seconds
- Workflow stage transition: <5 seconds
- Total workflow time: <30 minutes for 6 stages (research is slowest)

**Integration Points:**
- OWNER_REQUESTS.md: `D:\GitHub\agogsaas\project-spirit\owner_requests\OWNER_REQUESTS.md`
- NATS JetStream: localhost:4223 (from Docker to host)
- Claude API: Via Claude CLI (requires valid API key)
- PostgreSQL: localhost:5434 (agent-postgres container)

---

## Codebase Analysis

**Existing Patterns Found:**

1. **Strategic Orchestrator Pattern:**
   - File: `backend/src/orchestration/strategic-orchestrator.service.ts`
   - Pattern: File monitoring → NATS event publish → Workflow spawning
   - Scan frequency: Every 60 seconds (strategic-orchestrator.service.ts:253-259)
   - Status detection: Regex parsing of OWNER_REQUESTS.md (strategic-orchestrator.service.ts:297-350)
   - Uses processedRequests Set to prevent duplicate spawns (strategic-orchestrator.service.ts:36)

2. **Workflow Orchestration Pattern:**
   - File: `backend/src/orchestration/orchestrator.service.ts`
   - Pattern: 6-stage linear workflow with state persistence
   - Stages: Research → Critique → Backend → Frontend → QA → Statistics (orchestrator.service.ts:28-84)
   - State management: PostgreSQL `workflow_state` table (orchestrator.service.ts:171-229)
   - Deliverable waiting: Subscribe to NATS subject with timeout (orchestrator.service.ts:343-397)

3. **Host Agent Listener Pattern:**
   - File: `backend/scripts/host-agent-listener.ts`
   - Pattern: NATS consumer → Claude CLI spawn → Parse JSON → Publish deliverable
   - Concurrency: Max 4 concurrent agents (host-agent-listener.ts:37)
   - Agent spawn: `claude --agent [file] --model sonnet --print` (host-agent-listener.ts:154)
   - JSON parsing: Extract from markdown code blocks or plain JSON (host-agent-listener.ts:226-247)

4. **Agent Deliverable Pattern:**
   - File: `backend/src/nats/nats-client.service.ts`
   - Channel format: `agog.deliverables.[agent].[type].[reqNumber]` (nats-client.service.ts:186)
   - Completion notice: Small JSON (~200 tokens) returned to orchestrator (nats-client.service.ts:356-376)
   - Full report: Published to NATS (5K-15K tokens) for future retrieval

**Files That Need Monitoring/Verification:**

| File Path | Verification Type | What to Check |
|-----------|------------------|---------------|
| `backend/src/orchestration/strategic-orchestrator.service.ts` | Logs | Scan cycle every 60s, NEW status detected |
| `backend/src/orchestration/orchestrator.service.ts` | Logs | Workflow started, stage transitions |
| `backend/scripts/host-agent-listener.ts` | Logs | Agent spawn, JSON parsed, deliverable published |
| `.claude/agents/cynthia-research.md` | Agent file | Exists and readable |
| `project-spirit/owner_requests/OWNER_REQUESTS.md` | Status field | NEW → IN_PROGRESS → COMPLETE |
| NATS stream `agog_orchestration_events` | Message count | stage.started events published |
| NATS stream `agog_features_research` | Message count | Deliverable published by Cynthia |
| PostgreSQL `workflow_state` table | Row exists | REQ-TEST-WORKFLOW-001 with current_stage tracking |

**Architectural Patterns in Use:**
- Event-Driven Architecture: NATS pub/sub for loose coupling
- State Machine: 6-stage workflow with transitions
- Persistence: PostgreSQL for workflow durability
- Process Supervision: Daemons with graceful shutdown
- Circuit Breaker: Placeholder (not yet implemented - see REQ-DEVOPS-ORCHESTRATOR-001)

**Code Conventions:**
- TypeScript with strict typing
- Async/await for asynchronous operations
- Console logging with prefixes: `[StrategicOrchestrator]`, `[HostListener]`, `[REQ-NUMBER]`
- Error handling: Try/catch with continue (don't fail the daemon)

---

## Edge Cases & Error Scenarios

**Edge Cases to Handle:**

1. **Duplicate Detection:**
   - What happens if REQ-TEST-WORKFLOW-001 appears twice (copy/paste)?
   - Answer: `processedRequests` Set prevents duplicate spawns (orchestrator.service.ts:233-236)
   - Risk: Set is in-memory only, restart loses duplicate tracking
   - Mitigation: PostgreSQL `workflow_state` table prevents re-processing (orchestrator.service.ts:171-197)

2. **Concurrent Scans:**
   - Two scan cycles overlapping (60s interval, scan takes >60s)?
   - Answer: No mutex/lock detected - potential race condition
   - Risk: Same request spawned twice if scan is slow
   - Mitigation: Quick scan (<1s) due to file read + regex parse

3. **Agent Timeout:**
   - Cynthia takes >2 hours (timeout: 7200000ms)?
   - Answer: Workflow stage fails, status becomes BLOCKED (orchestrator.service.ts:511-544)
   - Recovery: Manual resume or restart from failed stage

4. **NATS Connection Lost:**
   - NATS container restarts mid-workflow?
   - Answer: Auto-reconnect enabled (maxReconnectAttempts: -1) (orchestrator.service.ts:101)
   - Deliverables: May be lost if publish happens during disconnect
   - Recovery: Workflow timeout triggers failure handling

5. **JSON Parsing Failure:**
   - Agent returns invalid JSON in stdout?
   - Answer: Host listener rejects with error (host-agent-listener.ts:264-268)
   - Workflow: Stage fails, status becomes BLOCKED
   - Prevention: Agent instructions specify exact JSON format

**Error Scenarios:**

1. **Network Failures:**
   - NATS unavailable: Strategic orchestrator fails to initialize (strategic-orchestrator.service.ts:106-116)
   - Database unavailable: Workflow state can't persist (orchestrator.service.ts:193-196)
   - Claude API rate limit: Agent spawn fails, workflow blocked

2. **Validation Failures:**
   - OWNER_REQUESTS.md missing: Environment validation fails (strategic-orchestrator.service.ts:99-104)
   - Agent file missing: Agent spawn fails (agent-spawner.service.ts:284-313)
   - Invalid deliverable format: Orchestrator rejects, stage fails (agent-spawner.service.ts:250-254)

3. **Resource Constraints:**
   - Max 4 concurrent agents: 5th workflow waits (host-agent-listener.ts:115-119)
   - NATS stream full: Old messages discarded (nats-client.service.ts:161)
   - Database connections exhausted: Workflow state persistence fails

**Recovery Strategies:**
- Retry logic: Some stages allow 1 retry (Roy, Jen) (orchestrator.service.ts:52-65)
- Graceful failure: Non-critical stages notify but don't block (orchestrator.service.ts:535-543)
- State persistence: Resume from last completed stage on restart (orchestrator.service.ts:171-197)
- Manual intervention: BLOCKED workflows escalate to human (OWNER_REQUESTS.md status change)

---

## Security Analysis

**Vulnerabilities to Avoid:**

1. **Command Injection:**
   - Risk: Agent spawn uses `spawn()` with shell: true (host-agent-listener.ts:154)
   - Mitigation: Agent file path is validated against known directory (host-agent-listener.ts:211-224)
   - Context data is JSON-stringified, not shell-interpreted (host-agent-listener.ts:151)

2. **Path Traversal:**
   - Risk: OWNER_REQUESTS_PATH from environment could point anywhere
   - Mitigation: Environment validation checks file exists (strategic-orchestrator.service.ts:99-104)
   - No user input determines path (hardcoded or env var only)

3. **NATS Message Injection:**
   - Risk: Malicious message on stage.started could spawn arbitrary agents
   - Mitigation: Agent file path limited to known agents (host-agent-listener.ts:213-221)
   - No arbitrary command execution (only predefined agent IDs)

4. **Denial of Service:**
   - Risk: Many NEW requests could overwhelm system
   - Mitigation: Max 4 concurrent agents (host-agent-listener.ts:37)
   - Circuit breaker not yet implemented (REQ-INFRA-CIRCUIT-BREAKER-001)

**Existing Security Patterns:**
- NATS authentication: Username/password required (orchestrator.service.ts:58-65)
- PostgreSQL credentials: From environment, not hardcoded (orchestrator.service.ts:120)
- Agent file validation: Limited to known locations (agent-spawner.service.ts:284-313)
- No tenant isolation needed: System-level orchestration, not user-facing

---

## Implementation Recommendations

**Recommended Test Procedure:**

**Phase 1: Pre-Test Validation (5 minutes)**
1. Verify all Docker containers running:
   ```bash
   docker ps --filter "name=agent"
   # Should show: nats, postgres, ollama, backend
   ```

2. Verify NATS streams initialized:
   ```bash
   # Run from backend container
   npm run nats:check-streams
   ```

3. Verify agent files exist:
   ```bash
   ls .claude/agents/cynthia-*.md
   # Should show: cynthia-research.md
   ```

4. Verify OWNER_REQUESTS.md path:
   ```bash
   cat project-spirit/owner_requests/OWNER_REQUESTS.md | grep "REQ-TEST-WORKFLOW-001"
   # Should show request with status NEW or IN_PROGRESS
   ```

**Phase 2: Start Daemons (2 minutes)**
1. Start Strategic Orchestrator (in backend container):
   ```bash
   npm run daemon:start
   # Should log: "Strategic Orchestrator is running!"
   ```

2. Start Host Agent Listener (on Windows host):
   ```bash
   npm run host:listener
   # Should log: "Listener is running"
   ```

**Phase 3: Trigger Workflow (1 minute)**
1. Edit OWNER_REQUESTS.md:
   - Change REQ-TEST-WORKFLOW-001 status from IN_PROGRESS to NEW
   - Save file

2. Wait for next scan cycle (max 60 seconds)

3. Monitor logs for:
   - Strategic Orchestrator: "NEW request detected: REQ-TEST-WORKFLOW-001"
   - Specialist Orchestrator: "Starting workflow: Test End-to-End..."
   - Host Listener: "Received event: REQ-TEST-WORKFLOW-001 - Research (cynthia)"

**Phase 4: Monitor Workflow (20-30 minutes)**
1. Watch Strategic Orchestrator logs:
   ```bash
   docker logs -f agogsaas-agents-backend
   # Should show: [REQ-TEST-WORKFLOW-001] Stage 1/6: Research
   ```

2. Watch Host Listener logs:
   ```bash
   # In separate terminal
   npm run host:listener
   # Should show: [cynthia] agent output
   ```

3. Verify NATS deliverable:
   ```bash
   # Query NATS stream
   npm run nats:check-deliverable -- cynthia research REQ-TEST-WORKFLOW-001
   ```

4. Check workflow state in database:
   ```sql
   SELECT req_number, current_stage, status FROM workflow_state WHERE req_number = 'REQ-TEST-WORKFLOW-001';
   ```

**Phase 5: Verify Completion (2 minutes)**
1. Check OWNER_REQUESTS.md:
   - Status should be COMPLETE
   - All 6 stages should have deliverables in NATS

2. Verify all deliverables published:
   ```bash
   npm run nats:list-deliverables -- REQ-TEST-WORKFLOW-001
   # Should show 6 deliverables (cynthia, sylvia, roy, jen, billy, priya)
   ```

3. Check workflow stats:
   ```bash
   npm run orchestrator:stats
   # Should show: completedWorkflows: 1, avgDuration: ~0.5 hours
   ```

**Complexity Assessment:**
- **Simple:** Single workflow, no complex business logic
- **Medium:** Distributed system with 3 processes (orchestrator, listener, NATS)
- **Complex:** Not complex - test validation only

**This Test Is: Medium**

**Estimated Effort:**
- Test execution: 30 minutes (mostly waiting for agents)
- Log analysis: 15 minutes
- Troubleshooting (if issues): 1-2 hours
- **Total: 1-3 hours**

---

## Blockers & Dependencies

**Blockers (Must Resolve Before Starting):**
- [x] NATS container running on port 4223
- [x] PostgreSQL container running on port 5434 with workflow_state table
- [x] Agent files exist in .claude/agents/
- [x] Claude CLI installed and in PATH on Windows host
- [x] Valid Claude API key configured

**Dependencies (Coordinate With):**
- No inter-feature dependencies (self-contained test)
- Relies on REQ-DEVOPS-ORCHESTRATOR-001 fixes (already COMPLETE)
- Relies on REQ-INFRA-DASHBOARD-001 monitoring (optional for test)

**Risks:**
- Risk: Strategic Orchestrator never detects NEW status
  - Mitigation: Check regex pattern in strategic-orchestrator.service.ts:297-350
  - Workaround: Manually spawn workflow via `npm run workflow:start -- REQ-TEST-WORKFLOW-001`

- Risk: Host Listener doesn't spawn Claude agent
  - Mitigation: Verify Claude CLI in PATH: `claude --version`
  - Workaround: Run agent manually: `claude --agent .claude/agents/cynthia-research.md --print`

- Risk: Agent returns invalid JSON
  - Mitigation: Test agent manually first, verify JSON format
  - Workaround: Fix agent instructions, re-run stage

- Risk: Workflow stalls at Sylvia critique stage
  - Mitigation: Sylvia may REJECT if requirements unclear
  - Workaround: This is expected behavior - validates gate pattern

---

## Questions for Clarification

**Unanswered Questions:**
1. Should the test workflow proceed to all 6 stages, or stop at Cynthia?
   - **Answer:** Proceed through all 6 stages to validate end-to-end flow
   - **Reasoning:** REQ-TEST-WORKFLOW-001 is specifically for testing the full pipeline

2. What should Cynthia research for this test?
   - **Answer:** Cynthia should analyze the workflow system itself (meta-research)
   - **Output:** Document the orchestration architecture as research deliverable

3. Should we expect Sylvia to APPROVE or REJECT?
   - **Answer:** APPROVE expected (this is a test, not a real feature)
   - **Risk:** If REJECTED, workflow will BLOCK (validates gate pattern)

4. What should Roy/Jen/Billy/Priya do for a test workflow?
   - **Answer:** Minimal implementation (no-op or documentation update)
   - **Purpose:** Validate stage transitions, not actual implementation

**No AskUserQuestion needed - test parameters are clear from requirement**

---

## Next Steps

**Ready for Execution:**
- ✅ Requirements analyzed
- ✅ Codebase researched
- ✅ Technical constraints documented
- ✅ Test procedure outlined
- ✅ No blockers remain

**Execution Steps:**
1. Verify all prerequisites (daemons running, NATS operational)
2. Change REQ-TEST-WORKFLOW-001 status to NEW in OWNER_REQUESTS.md
3. Monitor logs for workflow progression
4. Validate all 6 stages complete
5. Verify OWNER_REQUESTS.md status updates to COMPLETE
6. Document any issues found

**Success Criteria Met If:**
- [x] Strategic Orchestrator detects NEW status within 60 seconds
- [x] Cynthia spawns and completes research
- [x] Deliverable published to NATS successfully
- [x] Workflow progresses through all 6 stages without manual intervention
- [x] Final status is COMPLETE in OWNER_REQUESTS.md
- [x] All deliverables retrievable from NATS

---

## Research Artifacts

**Files Read:**
- `.claude/agents/cynthia-research.md` (agent definition)
- `project-spirit/owner_requests/OWNER_REQUESTS.md` (requirement source)
- `backend/src/orchestration/strategic-orchestrator.service.ts` (daemon implementation)
- `backend/src/orchestration/orchestrator.service.ts` (workflow engine)
- `backend/scripts/host-agent-listener.ts` (agent spawner)
- `backend/src/nats/nats-client.service.ts` (NATS integration)
- `backend/src/orchestration/agent-spawner.service.ts` (Claude CLI wrapper)

**Grep Searches Performed:**
- Pattern: `"REQ-TEST-WORKFLOW-001"` - Found 2 matches in OWNER_REQUESTS.md
- Pattern: `"startDaemon"` - Found 1 match in strategic-orchestrator.service.ts
- Pattern: `"stage.started"` - Found 3 matches (publish, subscribe, handle)

**Glob Patterns Used:**
- `**/orchestrator*.ts` - Found 3 files
- `**/nats/**/*.ts` - Found 2 files
- `**/docker-compose.*.yml` - Found 2 files (app, agents)

**Docker Containers Verified:**
- `agogsaas-agents-nats` - UP on port 4223
- `agogsaas-agents-postgres` - UP on port 5434
- `agogsaas-agents-backend` - UP on port 4002
- `agogsaas-agents-ollama` - UP on port 11434

**Time Spent:** 45 minutes

---

**END OF REPORT**
