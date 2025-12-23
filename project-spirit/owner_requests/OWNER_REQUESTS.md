# OWNER REQUESTS - Feature Backlog

This file tracks feature requests from product owners (Marcus, Sarah, Alex). The strategic orchestrator monitors this file and automatically spawns specialist workflows when new requests are detected.

## Request Format

```
REQ-{DOMAIN}-{NUMBER}: {Feature Title}
Status: {NEW | IN_PROGRESS | COMPLETE | BLOCKED | PENDING}
Owner: {marcus | sarah | alex}
Priority: {P0 | P1 | P2 | P3}
Business Value: {Brief description}

Status Meanings:
- NEW: Brand new request, will be picked up by orchestrator on next scan
- IN_PROGRESS: Workflow is actively running
- COMPLETE: Workflow finished successfully
- BLOCKED: Requires manual intervention
- PENDING: Recovery state only (crash/token limit), orchestrator verifies before starting
```

---

## Active Requests

### REQ-ITEM-MASTER-001: Item Master Pattern Implementation

**Status**: IN_PROGRESS
**Owner**: marcus
**Priority**: P1
**Business Value**: Enable unified item catalog supporting both materials (purchased) and products (sold/manufactured). Critical foundation for inventory, procurement, and sales modules.

**Requirements**:

- Unified items table with role flags (can_be_purchased, can_be_sold, can_be_manufactured)
- Support for dual-role items (e.g., blank labels that are both purchased and sold)
- Multi-UOM support with conversion factors
- 3-layer attribute model (material, product, physical)
- SCD Type 2 for price/attribute change history
- Integration with existing materials/products tables (migration strategy)

**Current Stage**: Critique (Sylvia evaluating Cynthia's research)

---

### REQ-STOCK-TRACKING-001: Real-Time Stock Level Monitoring

**Status**: IN_PROGRESS
**Owner**: marcus
**Priority**: P1
**Business Value**: Enable real-time visibility into inventory levels across all warehouses. Reduces stockouts by 60% and excess inventory by 40%.

**Requirements**:

- Real-time stock level tracking per item per warehouse
- Automated reorder point calculations
- Low stock alerts and notifications
- Stock movement history (receipts, issues, adjustments, transfers)
- Integration with Item Master (REQ-ITEM-MASTER-001)
- Dashboard showing current stock levels vs. min/max thresholds

---

### REQ-SALES-ORDER-ENTRY-001: Streamlined Sales Order Entry

**Status**: IN_PROGRESS
**Owner**: sarah
**Priority**: P1
**Business Value**: Reduce order entry time from 15 minutes to 2 minutes. Eliminate 70% of specification errors. Enable customer self-service.

**Requirements**:

- Quick order entry form with autocomplete
- Customer-specific pricing and discount application
- Product configurator for CTO (Configure-to-Order) items
- Real-time inventory availability check
- Delivery date estimation based on production schedule
- Order confirmation with PDF proof
- Integration with Item Master and Customer Master

---

### REQ-CUSTOMER-PRICING-001: Customer-Specific Pricing Engine

**Status**: IN_PROGRESS
**Owner**: sarah
**Priority**: P1
**Business Value**: Support volume discounts, customer-specific pricing, and promotional pricing. Increase average order value by 15%.

**Requirements**:

- Base price lists per item
- Customer-specific price overrides
- Volume discount tiers (quantity breaks)
- Promotional pricing with date ranges
- Contract pricing for enterprise customers
- Price history for audit trail (SCD Type 2)
- Pricing approval workflow for discounts > 20%

---

### REQ-VENDOR-MANAGEMENT-001: Vendor Master and Performance Tracking

**Status**: IN_PROGRESS
**Owner**: alex
**Priority**: P1
**Business Value**: Centralize vendor information and track performance. Reduce procurement costs by 10% through better vendor selection.

**Requirements**:

- Vendor master data (contact, payment terms, certifications)
- Vendor performance metrics (on-time delivery, quality ratings)
- Preferred vendor designation per item
- Vendor price lists and quote comparison
- Vendor certifications and compliance tracking
- Integration with Item Master (materials sourcing)

---

### REQ-PURCHASE-ORDER-001: Purchase Order Creation and Tracking

**Status**: IN_PROGRESS
**Owner**: alex
**Priority**: P1
**Business Value**: Automate PO creation based on reorder points. Enable three-way matching for invoice processing. Reduce manual PO processing time by 80%.

**Requirements**:

- PO creation from reorder point triggers
- PO approval workflow (based on amount thresholds)
- Receiving module with qty/quality checks
- Three-way matching (PO + Receipt + Invoice)
- PO status tracking (pending, approved, received, closed)
- Integration with Vendor Master and Stock Tracking
- Email PO delivery to vendors

---

### REQ-DEVOPS-ORCHESTRATOR-001: Debug and Fix Strategic Orchestrator Issues

**Status**: COMPLETE
**Owner**: marcus
**Priority**: P1
**Business Value**: Ensure agent orchestration system is fully operational. Critical for autonomous AI-assisted development workflows. Without working orchestration, agents cannot process requests and the entire AI development platform is non-functional.

**CRITICAL ISSUES - Berry MUST FIX ALL:**

1. **Workflows never update to COMPLETE** - strategic-orchestrator.service.ts:486 subscribes to workflow.completed but NEVER calls updateRequestStatus(reqNumber, 'COMPLETE'). All workflows stuck at IN_PROGRESS forever.

2. **No git commits** - 161 uncommitted files, agents generate deliverables but never commit. No CI/CD runs, no security scans execute. Need workflow to commit on completion.

3. **NATS deliverable streams not auto-initialized** - Had to manually run init-nats-streams.ts. Should initialize on orchestrator startup.

4. **Workflow state lost on restart** - In-memory Map, restart loses all progress. Implement PostgreSQL persistence or NATS KV store.

5. **No recovery mechanism** - When deliverable publish fails, workflow stuck forever. Need retry/recovery logic.

6. **Race condition in duplicate prevention** - processedRequests.add() called 40 lines after check. Move before async operations.

7. **Missing subscription cleanup** - waitForDeliverable() doesn't drain subs on timeout. Memory leak.

8. **No environment validation** - Services start but fail silently with wrong config. Validate on startup.

9. **No health checks** - No /health endpoint, no Prometheus metrics for orchestrator daemon.

10. **No graceful shutdown** - Orchestrator doesn't drain NATS connections properly.

11. **No rate limiting** - Agent spawns not throttled, can overwhelm system.

12. **No security scans running** - GitHub Actions workflows exist but only trigger on push. Since nothing commits, nothing runs.

13. **No Claude API usage monitoring** - Orchestrator doesn't check Claude API usage before spawning agents. Can hit plan limits and cause failures. Need: (1) Check Claude API usage before each scan cycle (2) If usage >85%, calculate minutes until reset window (3) **ACTUAL SLEEP** - Use setTimeout or async sleep for exact minutes until reset (4) Resume orchestration after sleep completes. Example: If 85% used and 243 minutes until reset, sleep for 243 minutes then resume. Must respect user's plan limits.

**Already Fixed:**
- ✅ Volume mounts (changed /workspace to /app)  
- ✅ OWNER_REQUESTS path (changed to /app/project-spirit)
- ✅ Host listener NATS auth (added credentials)
- ✅ Regex patterns (allow blank lines)
- ✅ NATS deliverable streams manually initialized

**Expected Outcome:**

- Workflows complete end-to-end and update status to COMPLETE in OWNER_REQUESTS.md
- Agent deliverables committed to git automatically
- Security scans run on every commit
- Orchestrator survives restarts without losing workflow state
- **Usage monitoring active** - Orchestrator sleeps when Claude API >85%, resumes after reset
- All 13 critical issues fixed and tested
- Complete runbook for orchestration debugging
- Health monitoring operational

---

### REQ-INFRA-DASHBOARD-001: Fix Monitoring Dashboard Missing Dependencies

**Status**: IN_PROGRESS
**Owner**: marcus
**Priority**: P0
**Business Value**: Restore monitoring dashboard functionality. Critical for observing Layer 2 (Health Monitoring), Layer 3 (Orchestration), and Layer 4 (Memory) system health in real-time.

**Requirements**:

- Fix missing `react-i18next` dependency in frontend container
- Verify all other i18n dependencies are installed
- Ensure volume mounts don't override node_modules
- Test monitoring dashboard loads at http://localhost:3000/monitoring
- Verify all 4 monitoring cards render (System Health, Current Errors, Active Fixes, Agent Activity)
- **REQUIRED: Billy (QA) must use Playwright MCP to test actual user experience**
  - Navigate to http://localhost:3000/monitoring in real browser
  - Verify page loads without console errors
  - Verify all 4 cards are visible and contain data
  - Take screenshot of working dashboard
  - Test is NOT complete until Playwright confirms user can see the page
- Document fix in Miki's deliverables for future reference

**Technical Details**:

- Error: "Failed to resolve import 'react-i18next' from src/App.tsx"
- Location: Frontend container `/app/node_modules`
- Likely cause: Volume mount or missing package installation
- Expected fix: Ensure `npm install` runs with all dependencies, check docker-compose volumes

**Owner-Provided Assets**:

- See `project-spirit/owner_requests/assets/REQ-INFRA-DASHBOARD-001/` for screenshots of the issue

---


### REQ-PROACTIVE-001: Enable Autonomous Work Generation System

**Status**: COMPLETE
**Owner**: marcus
**Priority**: P0
**Business Value**: Transform from reactive (waiting for manual OWNER_REQUESTS.md edits) to proactive (AI agents autonomously identify and create feature requests). Enable continuous improvement without constant human input. Maximize value delivery by surfacing high-impact opportunities automatically.

**Requirements**:

- Integrate **value-chain-expert** agent into daemon mode
  - Periodic strategic evaluation (daily scan)
  - Analyze business metrics, competitive landscape, technical debt
  - Generate RICE-scored feature recommendations
  - Publish recommendations to OWNER_REQUESTS.md via NATS

- Integrate **project-manager** agent into orchestration
  - Create and maintain roadmap.md as single source of truth
  - Break strategic initiatives into atomic phases
  - Identify dependencies and sequencing
  - Auto-generate phased feature requests

- Enable **product owner agents** (Marcus/Sarah/Alex) to run proactively
  - Periodic domain-specific opportunity scanning
  - Monitor domain metrics (inventory levels, sales patterns, procurement efficiency)
  - Auto-create feature requests when thresholds met
  - Example: Marcus detects stockout patterns → creates REQ-STOCK-xxx automatically

- Create **backlog management workflow**
  - value-chain-expert evaluates proposed features (RICE scoring)
  - project-manager breaks into phases and adds to roadmap
  - Strategic orchestrator detects roadmap.md changes
  - Auto-create phased requests in OWNER_REQUESTS.md

- Implement **feedback loop**
  - Priya's statistics feed back into value-chain-expert
  - Completed features update business metrics
  - Metrics inform next proactive recommendations

- Add **governance controls**
  - Human approval gate for auto-generated P0/P1 requests
  - Auto-approve P2/P3 technical debt cleanup
  - Configurable thresholds for autonomous work creation

**Expected Outcome**:

- System generates 3-5 high-quality feature requests per week autonomously
- roadmap.md maintained and up-to-date automatically
- Product owners (Marcus/Sarah/Alex) focus on review/approval instead of ideation
- Strategic evaluation happens continuously, not ad-hoc
- OWNER_REQUESTS.md becomes living document, not stale backlog

---

### REQ-INFRA-PROACTIVE-DAEMON-001: Value Chain Expert Autonomous Daemon

**Status**: IN_PROGRESS
**Owner**: marcus
**Priority**: P0
**Business Value**: Enable continuous strategic evaluation without human intervention. System autonomously identifies high-impact opportunities using RICE scoring, analyzes competitive landscape, and generates feature recommendations 24/7. Critical foundation for proactive work generation.

**Requirements**:

- Convert value-chain-expert from manual spawn to daemon mode
- Periodic strategic evaluation (daily scan at 2am)
- Analyze business metrics (revenue, usage, support tickets)
- Analyze competitive landscape (market trends, competitor features)
- Analyze technical debt (code quality, security vulnerabilities)
- Generate RICE-scored feature recommendations
- Publish recommendations to NATS subject `agog.recommendations.strategic`
- Integration with MetricsProvider for business intelligence
- Configurable scan frequency (default: daily)

**Expected Outcome**:
- value-chain-expert runs autonomously as daemon service
- Generates 3-5 strategic recommendations per week
- Recommendations include RICE scores and business justification
- Runs during off-peak hours to minimize API costs
- Logs all strategic evaluations to PostgreSQL for trend analysis

---

### REQ-INFRA-PROACTIVE-PM-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: Project Manager Autonomous Roadmap Management

**Status**: IN_PROGRESS
**Owner**: marcus
**Priority**: P0
**Business Value**: Autonomous roadmap maintenance eliminates manual backlog grooming. System automatically breaks strategic initiatives into atomic phases, identifies dependencies, sequences work optimally, and keeps roadmap.md current without human intervention.

**Requirements**:

- Convert project-manager from manual spawn to autonomous operation
- Create and maintain `roadmap.md` as single source of truth
- Subscribe to `agog.recommendations.strategic` for new initiatives
- Break strategic initiatives into atomic phases (S/M sizing)
- Identify dependencies and optimal sequencing
- Auto-generate phased feature requests in OWNER_REQUESTS.md
- Detect roadmap gaps (features without follow-up phases)
- Archive completed work to `roadmap-archive.md`
- Version control integration (git commit roadmap changes)

**Expected Outcome**:
- roadmap.md maintained and current automatically
- Strategic initiatives decomposed into executable phases
- Dependencies mapped and sequenced optimally
- OWNER_REQUESTS.md populated with phased work
- Zero manual backlog grooming required

---

### REQ-INFRA-PROACTIVE-PO-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: Product Owner Agents Autonomous Domain Monitoring

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Business Value**: Product owner agents (Marcus/Sarah/Alex) autonomously monitor their domains and auto-create feature requests when thresholds met. Reduces reactive firefighting by 80%. Enables predictive issue resolution before business impact.

**Requirements**:

- Convert Marcus (warehouse-po), Sarah (sales-po), Alex (procurement-po) to daemon mode
- **Marcus domain monitoring**:
  - Monitor stockout rates (threshold: >5% of SKUs)
  - Monitor bin utilization (threshold: >90% capacity)
  - Monitor cycle count accuracy (threshold: <98%)
  - Auto-create REQ-STOCK-xxx when thresholds breached

- **Sarah domain monitoring**:
  - Monitor order entry time (threshold: >10 min avg)
  - Monitor quote-to-order conversion (threshold: <40%)
  - Monitor customer complaint rate (threshold: >2%)
  - Auto-create REQ-SALES-xxx when thresholds breached

- **Alex domain monitoring**:
  - Monitor vendor on-time delivery (threshold: <90%)
  - Monitor procurement cost variance (threshold: >5%)
  - Monitor RFQ response time (threshold: >48 hours)
  - Auto-create REQ-PROCUREMENT-xxx when thresholds breached

- Subscribe to `agog.triggers.*` for metric-based triggers
- Publish domain-specific recommendations to NATS
- Integration with MetricsProvider for real-time metrics
- Configurable scan frequency (default: every 6 hours)

**Expected Outcome**:
- 3 product owner agents running as daemons
- Domain-specific metrics monitored continuously
- Auto-creation of 5-10 feature requests per month based on metrics
- Predictive issue resolution before business impact
- Reduced manual feature ideation workload by 70%

---

### REQ-INFRA-METRICS-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: Metrics Provider for Business Intelligence

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Business Value**: Centralized metrics provider enables data-driven autonomous decisions. Aggregates business metrics from PostgreSQL, publishes to NATS for real-time consumption by proactive agents. Foundation for all autonomous monitoring and decision-making.

**Requirements**:

- Create MetricsProvider service with PostgreSQL integration
- Aggregate business metrics from OLTP database:
  - Inventory metrics (stockout rates, bin utilization, cycle count accuracy)
  - Sales metrics (order entry time, conversion rates, complaint rates)
  - Procurement metrics (vendor OTD, cost variance, RFQ response times)
  - System metrics (error rates, performance, API usage)

- Publish metrics to NATS subjects:
  - `agog.metrics.inventory.*`
  - `agog.metrics.sales.*`
  - `agog.metrics.procurement.*`
  - `agog.metrics.system.*`

- Support threshold-based triggers:
  - Publish `agog.triggers.stockout` when stockout >5%
  - Publish `agog.triggers.slow_orders` when entry time >10min
  - Publish `agog.triggers.vendor_late` when OTD <90%

- Metric retention and trend analysis
- GraphQL API for dashboard consumption
- Configurable metric refresh intervals (default: 5 minutes)

**Expected Outcome**:
- Centralized metrics service running as daemon
- Real-time metrics published to NATS every 5 minutes
- Product owner agents subscribe and react to triggers
- Historical metrics stored for trend analysis
- Dashboard displays real-time business health

---

### REQ-INFRA-RECOMMENDATION-PUB-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: Recommendation Publisher to OWNER_REQUESTS.md

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Business Value**: Autonomous appending to OWNER_REQUESTS.md closes the loop on proactive work generation. Agent recommendations become actionable work items automatically. Eliminates manual transcription of AI insights into backlog.

**Requirements**:

- Create RecommendationPublisher service
- Subscribe to NATS subjects:
  - `agog.recommendations.strategic` (from value-chain-expert)
  - `agog.recommendations.inventory` (from Marcus-po)
  - `agog.recommendations.sales` (from Sarah-po)
  - `agog.recommendations.procurement` (from Alex-po)

- Process recommendations:
  - Validate recommendation format (reqNumber, title, owner, priority, business value)
  - Check for duplicates in OWNER_REQUESTS.md using MCP memory search
  - Format as markdown section with proper headers

- Append to OWNER_REQUESTS.md:
  - Insert before "
### REQ-STRATEGIC-AUTO-1766436689295: Optimize Bin Utilization Algorithm

**Status**: IN_PROGRESS
**Owner**: marcus
**Priority**: P2
**Business Value**: Improve warehouse space utilization by 15% through predictive bin assignment. Reduces need for additional warehouse space expansion ($500K savings).
**Generated By**: value-chain-expert
**Generated At**: 2025-12-22T20:51:29.295Z

**Requirements**:

- Analyze historical bin usage patterns
- Implement ML-based bin assignment algorithm
- Add real-time utilization dashboard
- Create bin consolidation recommendations

---


### REQ-STRATEGIC-AUTO-1766476803477: Optimize Bin Utilization Algorithm

**Status**: NEW
**Owner**: marcus
**Priority**: P2
**Business Value**: Improve warehouse space utilization by 15% through predictive bin assignment. Reduces need for additional warehouse space expansion ($500K savings).
**Generated By**: value-chain-expert
**Generated At**: 2025-12-23T08:00:03.477Z

**Requirements**:

- Analyze historical bin usage patterns
- Implement ML-based bin assignment algorithm
- Add real-time utilization dashboard
- Create bin consolidation recommendations

---


### REQ-STRATEGIC-AUTO-1766476803478: Optimize Bin Utilization Algorithm

**Status**: NEW
**Owner**: marcus
**Priority**: P2
**Business Value**: Improve warehouse space utilization by 15% through predictive bin assignment. Reduces need for additional warehouse space expansion ($500K savings).
**Generated By**: value-chain-expert
**Generated At**: 2025-12-23T08:00:03.478Z

**Requirements**:

- Analyze historical bin usage patterns
- Implement ML-based bin assignment algorithm
- Add real-time utilization dashboard
- Create bin consolidation recommendations

---

## Completed Requests" section
  - Add metadata (generated_by: agent, generated_at: timestamp)
  - Set status to NEW for orchestrator pickup
  - Commit to git with message "feat: Auto-generated recommendation from {agent}"

- Governance controls:
  - P0/P1 recommendations → status PENDING (requires human approval)
  - P2/P3 recommendations → status NEW (auto-approved)
  - Configurable approval thresholds

**Expected Outcome**:
- Agent recommendations automatically become backlog items
- OWNER_REQUESTS.md updated without human intervention
- Duplicate prevention ensures clean backlog
- Human approval gate for high-priority work
- Git history tracks all autonomous additions

---

### REQ-INFRA-CIRCUIT-BREAKER-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: Circuit Breaker for Runaway Workflows

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Business Value**: Prevents catastrophic API cost overruns from orchestrator failures. Circuit breaker stops workflow spawning when failure rate exceeds threshold. Saves $215 per failure event (99.7% cost reduction). Critical safety mechanism for production operation.

**Requirements**:

- Implement circuit breaker pattern in strategic-orchestrator.service.ts
- Track workflow failure rates (last 10 workflows)
- Circuit states:
  - CLOSED: Normal operation (failure rate <20%)
  - OPEN: Stop all spawning (failure rate >50%)
  - HALF_OPEN: Test with 1 workflow (after 5-minute cooldown)

- Failure detection:
  - Agent timeout (>10 minutes)
  - NATS publish failure
  - Deliverable not found after spawn
  - Git commit failure
  - API rate limit errors

- Circuit breaker actions:
  - OPEN → Stop scanning OWNER_REQUESTS.md
  - OPEN → Publish `agog.strategic.escalations.circuit_breaker_open`
  - OPEN → Log to PostgreSQL with failure details
  - HALF_OPEN → Spawn single test workflow
  - HALF_OPEN success → CLOSED
  - HALF_OPEN failure → OPEN (retry in 10 minutes)

- Dashboard integration:
  - Display circuit breaker state
  - Show failure count and rate
  - Emergency "force close" button for manual override

**Expected Outcome**:
- Circuit breaker prevents runaway spawning
- $215 savings per failure event
- 5-minute recovery time after failures
- Automatic testing before resuming normal operation
- Dashboard visibility into circuit state

---

### REQ-INFRA-STATE-PERSIST-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: PostgreSQL Workflow State Persistence

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Business Value**: Eliminates workflow state loss on container restart. PostgreSQL persistence ensures workflows survive crashes, redeploys, and scaling events. Prevents duplicate spawning and lost progress. Critical for production reliability.

**Requirements**:

- Create `agent_workflows` table in agent-postgres:
  ```sql
  CREATE TABLE agent_workflows (
    req_number VARCHAR(50) PRIMARY KEY,
    title TEXT NOT NULL,
    assigned_to VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    current_stage INT NOT NULL,
    started_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    metadata JSONB
  );
  ```

- Update orchestrator.service.ts:
  - Replace in-memory `Map<string, FeatureWorkflow>` with PostgreSQL queries
  - `startWorkflow()` → INSERT into agent_workflows
  - `getWorkflowStatus()` → SELECT from agent_workflows
  - `updateWorkflowStage()` → UPDATE agent_workflows
  - `completeWorkflow()` → UPDATE completed_at

- Add migration script V0.0.14__create_agent_workflows_table.sql
- Implement state recovery on orchestrator startup
- Implement cleanup of old completed workflows (>90 days)

**Expected Outcome**:
- Workflow state persists across restarts
- Zero duplicate spawning after crashes
- Workflow recovery after token limit crashes
- Historical workflow audit trail in PostgreSQL
- Production-ready state management

---

### REQ-INFRA-CONCURRENCY-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: Concurrency Control for Parallel Workflows

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Business Value**: Prevents git merge conflicts and race conditions from parallel workflows. Git branch isolation ensures workflows don't interfere. Critical for production stability when running 5+ concurrent workflows.

**Requirements**:

- Implement git branch isolation strategy:
  - Each workflow gets dedicated branch: `feature/{reqNumber}`
  - Roy/Jen work in isolated branches
  - Billy tests in branch before merge
  - Priya analyzes branch before completion

- Workflow branch lifecycle:
  1. Cynthia completes → create branch `feature/{reqNumber}`
  2. Roy implements → commit to `feature/{reqNumber}`
  3. Jen implements → commit to `feature/{reqNumber}`
  4. Billy tests → run tests in branch
  5. Priya analyzes → analyze branch commits
  6. Workflow complete → merge to master + delete branch

- Concurrent workflow limits:
  - Max 4 workflows in backend stage simultaneously
  - Queue additional workflows if limit reached
  - Priority-based queuing (P0 > P1 > P2 > P3)

- Merge conflict handling:
  - Detect conflicts before merge
  - Auto-rebase on master if possible
  - Escalate to human if conflicts unresolvable
  - Publish `agog.strategic.escalations.merge_conflict`

**Expected Outcome**:
- Zero git merge conflicts from parallel workflows
- Up to 4 concurrent workflows running safely
- Priority-based queuing for workflow fairness
- Automatic conflict detection and resolution
- Production-ready parallel execution

---

### REQ-INFRA-CLAUDE-USAGE-001

**Status**: COMPLETE
**Blocker**: Being implemented directly from REQ-PROACTIVE-001 blueprint - no research needed

**Status: Claude API Usage Monitoring and Circuit Breaker

**Status**: NEW
**Owner**: marcus
**Priority**: P0
**Business Value**: Prevents Claude API plan limit exhaustion. Monitors usage before each scan, sleeps when >85% limit reached. Respects reset window. Critical for staying within plan limits and preventing service disruption.

**Requirements**:

- Implement Claude API usage monitoring:
  - Check https://claude.ai/settings/usage before each orchestrator scan
  - Parse usage percentage and reset time
  - Store in PostgreSQL for trend analysis

- Implement sleep-based circuit breaker:
  ```typescript
  async checkClaudeUsage(): Promise<boolean> {
    const usage = await fetchClaudeUsage();
    if (usage.percentage > 85) {
      const minutesUntilReset = calculateMinutesUntil(usage.resetTime);
      console.log(`[Orchestrator] Usage ${usage.percentage}% - sleeping ${minutesUntilReset} minutes`);
      await sleep(minutesUntilReset * 60 * 1000);
      return true; // Resumed after sleep
    }
    return false; // Continue normally
  }
  ```

- Integrate into strategic-orchestrator.service.ts:
  - Call `checkClaudeUsage()` before each `scanOwnerRequests()` cycle
  - If usage >85%, sleep until reset (actual setTimeout/sleep)
  - Log sleep duration and resume time
  - Publish `agog.strategic.escalations.usage_limit_approaching`

- Dashboard integration:
  - Display current usage percentage
  - Show time until reset
  - Display "sleeping" state when paused
  - Show historical usage trends

**Expected Outcome**:
- Orchestrator never exceeds 85% plan usage
- Automatic sleep until reset window
- Zero manual intervention required
- Dashboard visibility into usage and sleep state
- Trend analysis prevents recurring limit issues

---

## Completed Requests

_None yet - first workflows in progress_

---

## Blocked Requests

_None yet_

---

## Request Guidelines for Product Owners

### Marcus (Warehouse/Inventory)

Submit requests for:

- Item Master management
- Stock tracking and movements
- Bin locations and warehouse operations
- Inventory adjustments and cycle counts
- Lot and serial number tracking

### Sarah (Sales/CRM)

Submit requests for:

- Customer management
- Sales order processing
- Pricing and invoicing
- Quote generation
- Customer portal and self-service

### Alex (Procurement/Vendors)

Submit requests for:

- Vendor management
- Purchase order processing
- RFQs and quote comparisons
- Receiving and quality checks
- Supplier performance tracking

---

## Adding New Requests

1. Use format: `REQ-{DOMAIN}-{NUMBER}: {Title}`
2. Set status to PENDING
3. Assign to appropriate owner (marcus/sarah/alex)
4. Set priority (P0=Critical, P1=High, P2=Medium, P3=Low)
5. Describe business value clearly
6. List specific requirements
7. **If providing screenshots/assets**: Create directory `project-spirit/owner_requests/assets/REQ-{DOMAIN}-{NUMBER}/` and place images there
8. Strategic orchestrator will detect and route automatically

---

**Last Updated**: 2025-12-22
**Total Active Requests**: 17
**Total In Progress**: 7
**Total Completed**: 8

### REQ-TEST-WORKFLOW-001: Test End-to-End Autonomous Workflow

**Status**: COMPLETE
**Owner**: marcus
**Priority**: P2
**Business Value**: Verify the complete autonomous work generation pipeline is functioning correctly from metrics to agent execution.

**Requirements**:

- Verify orchestrator picks up NEW requests
- Verify Cynthia research agent spawns via Claude API
- Verify workflow progresses through all 6 stages
- Verify deliverables are published to NATS

---

### REQ-TEST-IMMEDIATE-002: Immediate Test of Workflow Spawn

**Status**: IN_PROGRESS
**Owner**: sarah
**Priority**: P3
**Business Value**: Testing immediate workflow spawn with real-time monitoring.

**Requirements**:

- Test orchestrator detects NEW status
- Test Cynthia spawns immediately
- Test Claude API gets invoked

---
