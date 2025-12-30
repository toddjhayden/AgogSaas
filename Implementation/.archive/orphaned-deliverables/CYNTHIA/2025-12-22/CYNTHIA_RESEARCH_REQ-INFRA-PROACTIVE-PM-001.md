# Cynthia Research Report: Project Manager Autonomous Roadmap Management

**Feature:** REQ-INFRA-PROACTIVE-PM-001 / Project Manager Autonomous Roadmap Management
**Researched By:** Cynthia
**Date:** 2025-12-22
**Complexity:** Medium
**Estimated Effort:** 3-4 weeks

---

## Executive Summary

This feature enables the Project Manager agent to operate autonomously in managing roadmap.md, decomposing strategic initiatives, and auto-generating phased feature requests. The implementation converts the Project Manager from a manual spawn model to a daemon service that subscribes to NATS recommendation streams, maintains roadmap state, and integrates with the strategic orchestrator for seamless work generation.

**Key Findings:**
- Project Manager agent definition exists at `.claude/agents/project-manager.md` with comprehensive role specification
- No existing `roadmap.md` or `roadmap-archive.md` files found in codebase
- Strategic orchestrator already has NATS infrastructure (agog_strategic_* streams)
- No existing daemon infrastructure for Project Manager (all current daemons are agent spawns)
- Need new NATS stream `agog_recommendations_strategic` for value-chain-expert integration
- Requires PostgreSQL schema for roadmap state persistence
- Git integration needed for version control of roadmap changes

---

## Functional Requirements

**Primary Requirements:**
- [x] Convert Project Manager from manual spawn to autonomous daemon operation (source: REQ-INFRA-PROACTIVE-PM-001 requirements)
- [x] Subscribe to `agog.recommendations.strategic` NATS subject for strategic initiatives (source: REQ-PROACTIVE-001 blueprint)
- [x] Create and maintain `roadmap.md` as single source of truth (source: project-manager.md:22)
- [x] Decompose strategic initiatives into atomic phases (S/M effort sizing) (source: project-manager.md:75-90)
- [x] Identify dependencies and optimal sequencing (source: project-manager.md:121-132)
- [x] Auto-generate phased feature requests in OWNER_REQUESTS.md (source: REQ-INFRA-PROACTIVE-PM-001:330)
- [x] Detect roadmap gaps (features without follow-up phases) (source: REQ-INFRA-PROACTIVE-PM-001:331)
- [x] Archive completed work to `roadmap-archive.md` (source: project-manager.md:262-292)
- [x] Version control integration (git commit roadmap changes) (source: REQ-INFRA-PROACTIVE-PM-001:333)

**Acceptance Criteria:**
- [x] Daemon starts automatically when orchestrator starts
- [x] roadmap.md is created if missing and maintained automatically
- [x] Strategic recommendations decomposed within 5 minutes of publication
- [x] Phased requests auto-added to OWNER_REQUESTS.md with proper formatting
- [x] Completed phases archived within 24 hours of completion
- [x] All roadmap changes committed to git with descriptive messages
- [x] Zero manual backlog grooming required after implementation

**Out of Scope:**
- Value Chain Expert daemon (separate requirement: REQ-INFRA-PROACTIVE-DAEMON-001)
- Metrics Provider service (separate requirement: REQ-INFRA-METRICS-001)
- Product Owner (Marcus/Sarah/Alex) daemon mode (separate requirement: REQ-INFRA-PROACTIVE-PO-001)
- Recommendation Publisher service (separate requirement: REQ-INFRA-RECOMMENDATION-PUB-001)

---

## Technical Constraints

**Database Requirements:**
- Tables needed:
  - `roadmap_phases` (new table for roadmap state persistence)
  - `roadmap_archive` (new table for completed phases)
- New columns needed:
  ```sql
  roadmap_phases:
    - phase_id VARCHAR(50) PRIMARY KEY (e.g., "BATCH-1-PHASE-1")
    - req_number VARCHAR(50) UNIQUE (e.g., "REQ-ITEM-MASTER-001")
    - title TEXT NOT NULL
    - status VARCHAR(20) NOT NULL (NOT_STARTED, IN_PROGRESS, BLOCKED, COMPLETE)
    - effort_size VARCHAR(1) NOT NULL (S or M)
    - assigned_agent VARCHAR(50)
    - batch_number INT
    - dependencies JSONB (array of req_numbers)
    - tasks JSONB (array of task objects)
    - completion_criteria JSONB (array of criteria)
    - files_affected JSONB (array of file paths)
    - constraints JSONB (array of constraint strings)
    - created_at TIMESTAMP DEFAULT NOW()
    - updated_at TIMESTAMP DEFAULT NOW()
    - started_at TIMESTAMP
    - completed_at TIMESTAMP
    - archived_at TIMESTAMP

  roadmap_archive:
    - archive_id SERIAL PRIMARY KEY
    - phase_id VARCHAR(50) NOT NULL
    - req_number VARCHAR(50) NOT NULL
    - title TEXT NOT NULL
    - completed_by VARCHAR(50)
    - effort_actual_hours DECIMAL(5,2)
    - tasks_completed INT
    - notes TEXT
    - archived_at TIMESTAMP DEFAULT NOW()
    - metadata JSONB
  ```
- RLS policies required: No (roadmap is global, not tenant-scoped)
- Multi-tenant: No (roadmap management is system-level)

**API Requirements:**
- GraphQL queries needed: None (daemon operates via NATS, not GraphQL)
- GraphQL mutations needed: None
- REST endpoints needed: None
- NATS subjects needed:
  - Subscribe: `agog.recommendations.strategic` (from value-chain-expert)
  - Subscribe: `agog.orchestration.events.workflow.completed` (workflow completions)
  - Subscribe: `agog.orchestration.events.stage.completed` (stage completions for roadmap updates)
  - Publish: `agog.roadmap.phase.created` (new phase added to roadmap)
  - Publish: `agog.roadmap.phase.updated` (phase status changed)
  - Publish: `agog.roadmap.phase.archived` (phase archived)

**Security Requirements:**
- Tenant isolation: Not Required (system-level service)
- RLS enforcement: No
- Permission checks: File system write access to roadmap.md, OWNER_REQUESTS.md
- Input validation:
  - Validate strategic recommendations have required fields (title, business_value, req_number)
  - Validate effort sizing is only S or M (reject L/XL)
  - Validate req_number format matches REQ-{DOMAIN}-{NUMBER}
  - Validate dependencies reference valid req_numbers

**Performance Requirements:**
- Expected load: 5-10 strategic recommendations per week
- Response time target: Decompose recommendation within 300 seconds (5 minutes)
- Data volume: ~500 roadmap phases per year

**Integration Points:**
- Existing systems:
  - Strategic Orchestrator (strategic-orchestrator.service.ts) - subscribe to workflow events
  - NATS JetStream - pub/sub for recommendations and events
  - File system - read/write roadmap.md and OWNER_REQUESTS.md
  - Git - commit roadmap changes
  - PostgreSQL - persist roadmap state
- External APIs: None
- NATS channels:
  - agog_recommendations_strategic (NEW stream to create)
  - agog_orchestration_events (existing)
  - agog_roadmap_events (NEW stream to create)

---

## Codebase Analysis

**Existing Patterns Found:**

1. **Strategic Orchestrator Daemon Pattern**
   - Files: `print-industry-erp/backend/src/orchestration/strategic-orchestrator.service.ts`
   - Pattern: Daemon service with NATS subscriptions, file system monitoring, interval-based scanning
   - Can reuse:
     - Daemon initialization pattern (lines 41-87)
     - NATS stream creation pattern (lines 192-238)
     - File monitoring pattern (scanOwnerRequests at lines 297-398)
     - Environment validation pattern (lines 93-187)
   - Lessons learned:
     - Use `validateEnvironment()` to fail fast on misconfiguration
     - Initialize NATS streams on startup (lines 73, 192-238)
     - Use durable consumers for reliable message processing
     - Track processed items to prevent duplicates (line 36: processedRequests Set)

2. **Agent Spawner Integration**
   - Files: `print-industry-erp/backend/src/orchestration/agent-spawner.service.ts`
   - Pattern: Spawn Claude agents via API with context data
   - Can reuse: Agent spawning pattern for decomposing recommendations (if needed)
   - Note: May not need agent spawning if decomposition is rule-based

3. **Workflow State Management**
   - Files: `print-industry-erp/backend/src/orchestration/orchestrator.service.ts`
   - Pattern: In-memory Map for workflow state (lines 89: workflows Map)
   - Limitation: State lost on restart (identified blocker in REQ-DEVOPS-ORCHESTRATOR-001:153)
   - Improvement needed: PostgreSQL persistence for roadmap phases

4. **OWNER_REQUESTS.md Parsing**
   - Files: `strategic-orchestrator.service.ts:310-320`
   - Pattern: Regex parsing of markdown file to extract requests
   - Can reuse: Request parsing pattern for validating req_numbers before adding

**Files That Need Modification:**

| File Path | Change Type | Reason |
|-----------|-------------|--------|
| `print-industry-erp/backend/src/orchestration/project-manager-daemon.service.ts` | Create | New daemon service for autonomous roadmap management |
| `print-industry-erp/backend/migrations/V0.0.15__create_roadmap_tables.sql` | Create | Database schema for roadmap persistence |
| `print-industry-erp/backend/scripts/start-project-manager-daemon.ts` | Create | Startup script for daemon |
| `print-industry-erp/backend/package.json` | Modify | Add daemon start script |
| `print-industry-erp/docker-compose.agents.yml` | Modify | Add project-manager-daemon container |
| `D:\GitHub\agogsaas\plans\roadmap.md` | Create | Single source of truth for active roadmap |
| `D:\GitHub\agogsaas\plans\completed\roadmap-archive.md` | Create | Historical record of completed phases |

**Architectural Patterns in Use:**
- Daemon Pattern: Yes (strategic-orchestrator.service.ts)
- NATS Pub/Sub: Yes (JetStream for event-driven architecture)
- File System Monitoring: Yes (scanOwnerRequests pattern)
- PostgreSQL Persistence: Partial (needs expansion for roadmap state)
- Git Integration: Partial (manual commits exist, need automation)

**Code Conventions:**
- Naming: camelCase for variables, PascalCase for types/interfaces
- File structure: Service-based (orchestration/ directory)
- Error Handling: Try/catch with console logging
- TypeScript: Strict typing with interfaces
- NATS: JetStream with durable consumers

---

## Edge Cases & Error Scenarios

**Edge Cases to Handle:**

1. **Empty Recommendations:**
   - What happens when value-chain-expert publishes malformed recommendation?
   - Should validate required fields (title, business_value, req_number)
   - Log validation error and skip invalid recommendations

2. **Duplicate Req Numbers:**
   - Strategic recommendation uses req_number that already exists in roadmap
   - Check roadmap_phases table before creating new phase
   - Skip duplicate with warning log

3. **Circular Dependencies:**
   - Phase A depends on Phase B, Phase B depends on Phase A
   - Detect cycles during dependency resolution
   - Reject recommendation with circular dependencies

4. **roadmap.md Missing:**
   - First startup when roadmap.md doesn't exist
   - Create from template with initial structure
   - Log creation event

5. **Git Conflicts:**
   - Human edits roadmap.md while daemon tries to commit
   - Detect merge conflicts before commit
   - Retry with pull + merge, or escalate to human

6. **Large Recommendations:**
   - Strategic initiative requires >10 phases
   - Auto-split into multiple batches
   - Set batch dependencies

**Error Scenarios:**

1. **NATS Connection Failures:**
   - NATS server unavailable during subscription
   - Retry connection with exponential backoff
   - Log failure and alert monitoring

2. **Database Write Failures:**
   - PostgreSQL connection lost during phase creation
   - Rollback transaction
   - Retry phase creation

3. **File System Errors:**
   - roadmap.md locked by another process
   - Permission denied writing to file
   - Retry with delay or escalate

4. **Git Command Failures:**
   - Git not installed or configured
   - Merge conflicts unresolvable
   - Log error and continue without commit (degrade gracefully)

**Recovery Strategies:**
- Retry logic for transient errors (NATS, DB, file system)
- Graceful degradation: Continue without git commits if git unavailable
- Dead letter queue for failed recommendations
- Health check endpoint to detect daemon failures

---

## Security Analysis

**Vulnerabilities to Avoid:**

1. **File System Injection:**
   - MUST sanitize req_numbers before using in file paths
   - Validate req_number matches pattern: `^REQ-[A-Z-]+-\d+$`
   - NEVER allow `../` or absolute paths in recommendations

2. **Command Injection:**
   - MUST sanitize all inputs before git commands
   - Use parameterized git commands (not string concatenation)
   - Validate commit messages for special characters

3. **Resource Exhaustion:**
   - MUST limit number of phases per recommendation (max 20)
   - MUST limit roadmap.md file size (max 10MB)
   - MUST throttle roadmap updates (max 1 per second)

**Existing Security Patterns:**
- See `strategic-orchestrator.service.ts:93-187` for environment validation
- See NATS authentication at `strategic-orchestrator.service.ts:46-65`
- PostgreSQL connection uses environment variables (no hardcoded credentials)

---

## Implementation Recommendations

**Recommended Approach:**

**Phase 1: Database Schema & NATS Streams (Miki - DevOps)**
- Create `V0.0.15__create_roadmap_tables.sql` migration
- Create NATS streams: `agog_recommendations_strategic`, `agog_roadmap_events`
- Test roadmap_phases CRUD operations
- **Duration:** 4-6 hours

**Phase 2: Core Daemon Service (Roy - Backend)**
- Implement `ProjectManagerDaemonService` class
- Subscribe to `agog.recommendations.strategic`
- Implement recommendation decomposition logic
- Implement roadmap.md file generation
- Write unit tests for decomposition logic
- **Duration:** 1.5-2 weeks

**Phase 3: OWNER_REQUESTS.md Integration (Roy - Backend)**
- Implement auto-append logic for phased requests
- Validate req_number uniqueness
- Format requests per owner guidelines
- Test duplicate prevention
- **Duration:** 3-4 days

**Phase 4: Git Integration (Roy - Backend)**
- Implement git commit automation
- Handle merge conflicts
- Add rollback on commit failure
- Test with concurrent edits
- **Duration:** 2-3 days

**Phase 5: Archive & Cleanup (Roy - Backend)**
- Subscribe to workflow completion events
- Implement archive-to-roadmap-archive.md logic
- Implement cleanup of completed phases from roadmap.md
- Test archival process
- **Duration:** 2-3 days

**Phase 6: Daemon Deployment (Miki - DevOps)**
- Add daemon container to docker-compose.agents.yml
- Create startup script
- Configure environment variables
- Deploy and monitor
- **Duration:** 1-2 days

**Phase 7: QA Testing (Billy)**
- Manual testing of full workflow
- Test error scenarios (NATS down, DB down, git conflicts)
- Load testing (10 recommendations simultaneously)
- Security validation (injection tests)
- **Duration:** 1 week

**Phase 8: Monitoring & Statistics (Priya)**
- Add Prometheus metrics for daemon health
- Track decomposition performance
- Measure roadmap update frequency
- Generate usage reports
- **Duration:** 3-4 days

**Libraries/Tools Recommended:**
- `simple-git` (npm): For programmatic git operations (100k+ weekly downloads, actively maintained)
- `js-yaml` (npm): For potential YAML roadmap format (if markdown proves limiting)
- Existing: `nats` library already in use
- Existing: `pg` (PostgreSQL client) already in use

**Implementation Order:**
1. Database schema first (blocks everything)
2. Core daemon service second (core logic)
3. NATS integration third (event-driven architecture)
4. Git integration fourth (version control)
5. Archive logic fifth (cleanup)
6. Deployment sixth (operationalization)
7. Testing seventh (validation)
8. Monitoring last (observability)

**Complexity Assessment:**
- **Medium:** Multiple integrations (NATS, PostgreSQL, Git, File System), business logic complexity (decomposition, dependency resolution), daemon lifecycle management

**This Feature Is: Medium**

**Estimated Effort:**
- Miki (Database & DevOps): 1-2 days
- Roy (Backend): 3 weeks (daemon + NATS + git + archive)
- Billy (QA): 1 week
- Priya (Statistics): 3-4 days
- **Total: 3-4 weeks**

---

## Blockers & Dependencies

**Blockers (Must Resolve Before Starting):**
- [ ] REQ-INFRA-PROACTIVE-DAEMON-001 (value-chain-expert daemon) should be implemented first to generate recommendations
- [ ] PostgreSQL migration system must be operational (verify Flyway or migration runner works)
- [ ] NATS infrastructure must be fully operational (verify streams can be created)

**Dependencies (Coordinate With):**
- **Value Chain Expert**: Will publish to `agog.recommendations.strategic` (REQ-INFRA-PROACTIVE-DAEMON-001)
- **Strategic Orchestrator**: Already publishes workflow completion events (existing)
- **Recommendation Publisher**: May need coordination if implementing REQ-INFRA-RECOMMENDATION-PUB-001 simultaneously

**Risks:**
- **Risk 1:** Git conflicts from concurrent human edits to roadmap.md
  - **Mitigation:** Implement conflict detection + retry with pull/merge. Add advisory lock during write operations.
- **Risk 2:** Decomposition logic complexity (hard to get right algorithmically)
  - **Mitigation:** Start with simple rule-based decomposition. Use agent spawning for complex decomposition if needed.
- **Risk 3:** Daemon failure goes unnoticed, roadmap becomes stale
  - **Mitigation:** Implement health checks, Prometheus metrics, alerting on prolonged inactivity.

---

## Questions for Clarification

**Unanswered Questions:**
1. **Decomposition Strategy:** Should decomposition be rule-based (algorithmic) or LLM-based (spawn agent)?
   - Rule-based: Faster, cheaper, deterministic
   - LLM-based: Smarter, handles complex cases, costs API tokens
   - **Recommendation:** Start rule-based, fall back to LLM for complex cases

2. **Roadmap Format:** Markdown or YAML or hybrid?
   - Markdown: Human-readable, easy to edit manually
   - YAML: Machine-parseable, easier to process
   - Hybrid: YAML metadata + Markdown rendering
   - **Recommendation:** Start with Markdown (matches existing patterns)

3. **Batch Organization:** How to determine optimal batches?
   - Dependency analysis (topological sort)
   - Agent capacity limits (max 4 concurrent)
   - Priority-based (P0 first, then P1)
   - **Recommendation:** Dependency-first, then priority-based tie-breaking

4. **Archive Frequency:** Immediate archival or batched?
   - Immediate: Keeps roadmap clean, more commits
   - Batched (daily): Fewer commits, slightly stale roadmap
   - **Recommendation:** Immediate archival (within 5 minutes of completion)

**Recommended: Use AskUserQuestion tool to clarify decomposition strategy and roadmap format before proceeding.**

---

## Next Steps

**Ready for Sylvia Critique:**
- ✅ Requirements analyzed
- ✅ Codebase researched
- ✅ Technical constraints documented
- ✅ Implementation approach recommended

**Sylvia Should Review:**
1. Is the recommended decomposition strategy (rule-based + LLM fallback) sound?
2. Are database schema and NATS streams properly designed?
3. Are security risks (file injection, command injection) adequately addressed?
4. Is the complexity estimate (Medium, 3-4 weeks) realistic?
5. Should we proceed with implementation after clarifying unanswered questions?

---

## Research Artifacts

**Files Read:**
- `.claude/agents/cynthia-research.md` (agent definition)
- `.claude/agents/marcus-warehouse-po.md` (product owner agent pattern)
- `.claude/agents/project-manager.md` (project manager agent specification)
- `project-spirit/owner_requests/OWNER_REQUESTS.md` (requirements source)
- `print-industry-erp/backend/src/orchestration/strategic-orchestrator.service.ts` (daemon pattern)
- `print-industry-erp/backend/src/orchestration/orchestrator.service.ts` (workflow pattern)

**Grep Searches Performed:**
- Pattern: `roadmap|ROADMAP` - Found 7 matches (mostly in documentation, no active roadmap.md)
- Pattern: `project.manager|project-manager` - Found 0 matches (no existing PM daemon)
- Pattern: `orchestrat*.ts` - Found 2 matches (strategic and main orchestrators)

**Glob Patterns Used:**
- `**/roadmap*.md` - Found 0 files (no existing roadmap files)
- `**/plans/**/*.md` - Found 0 files (no plans directory)
- `**/orchestrat*.ts` - Found 2 files

**Time Spent:** 2 hours

---

**Recommendation:** PROCEED TO CRITIQUE

This feature is well-scoped, follows existing patterns, and has clear acceptance criteria. The main complexity is in decomposition logic and dependency resolution. Security risks are manageable with proper input validation. Estimated effort of 3-4 weeks is realistic for a Medium complexity feature.

**Critical Success Factors:**
1. Robust decomposition algorithm (rule-based + LLM fallback)
2. Reliable NATS integration (durable consumers, error handling)
3. Git conflict resolution (handle concurrent edits)
4. Health monitoring (detect daemon failures)

---

**END OF REPORT**
