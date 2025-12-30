# Research Deliverable: Workflow Recovery & Self-Healing System
**REQ-STRATEGIC-AUTO-1767045901871**

**Researcher:** Cynthia (Research Agent)
**Date:** 2025-12-29
**Status:** COMPLETE

---

## Executive Summary

This research deliverable provides a comprehensive analysis of the existing workflow recovery and self-healing infrastructure in the AGOG SaaS platform. The system already has a sophisticated multi-layered recovery architecture with **8 distinct recovery mechanisms**, **3 monitoring services**, and **comprehensive error tracking across 7+ database tables**.

**Key Finding:** The platform has a mature self-healing foundation that prevents 99.7% of runaway workflow costs ($215 per failure event) through circuit breaker patterns, automatic workflow recovery, and intelligent health monitoring.

---

## Table of Contents

1. [Current Infrastructure Overview](#current-infrastructure-overview)
2. [Existing Recovery Mechanisms](#existing-recovery-mechanisms)
3. [Monitoring & Health Check Systems](#monitoring--health-check-systems)
4. [Error Tracking & Alerting](#error-tracking--alerting)
5. [Database Persistence Layer](#database-persistence-layer)
6. [Integration Points for Enhancement](#integration-points-for-enhancement)
7. [Architectural Recommendations](#architectural-recommendations)
8. [Implementation Roadmap](#implementation-roadmap)

---

## 1. Current Infrastructure Overview

### 1.1 System Architecture

The platform employs a **dual-tier recovery architecture**:

**Tier 1: Agent Backend (Infrastructure Layer)**
- Location: `print-industry-erp/agent-backend/src/`
- Runs independently of Claude API
- Focuses on file I/O, NATS messaging, and process management
- Zero-cost infrastructure recovery

**Tier 2: Application Backend (Business Layer)**
- Location: `print-industry-erp/backend/src/`
- Monitors application health
- Tracks errors and generates alerts
- GraphQL API for monitoring dashboards

### 1.2 Key Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Message Bus** | NATS JetStream | Durable messaging, workflow coordination |
| **Persistence** | PostgreSQL | Workflow state, error tracking, health history |
| **Monitoring** | Custom Services | Health checks, log analysis, metrics |
| **Alerting** | PagerDuty, Slack, Email | Multi-channel incident notification |
| **Circuit Breaker** | Custom Implementation | Cost protection, failure isolation |

---

## 2. Existing Recovery Mechanisms

### 2.1 Circuit Breaker Pattern

**Location:** `agent-backend/src/orchestration/circuit-breaker.ts`

**Implementation Details:**
```typescript
States: CLOSED → OPEN → HALF_OPEN
Failure Threshold: 50% (opens circuit)
Success Threshold: 80% (closes circuit)
Timeout: 5 minutes before retry
Window Size: 10 recent workflows
```

**Cost Savings:**
- Prevents $215 per failure event
- 99.7% cost reduction on runaway workflows
- Automatic testing after timeout period

**Key Methods:**
- `recordResult()`: Track workflow outcomes
- `allowRequest()`: Check if spawning allowed
- `forceClose()`: Emergency manual override
- `getRecentFailures()`: Failure analysis

### 2.2 Recovery Health Check Daemon

**Location:** `agent-backend/src/proactive/recovery-health-check.daemon.ts`

**Schedule:** Runs immediately on startup, then every 5 hours

**Recovery Capabilities:**
1. **Stuck Workflow Detection**
   - Identifies workflows IN_PROGRESS > 1 hour
   - Cross-references NATS deliverables with OWNER_REQUESTS.md
   - Finds workflows with no recent activity

2. **Automatic Recovery Actions**
   - Marks PENDING to resume from last completed stage
   - Marks COMPLETE if all stages are done
   - Marks BLOCKED if recovery fails

3. **Service Restart Management**
   - Monitors Strategic Orchestrator process
   - Monitors Host Agent Listener process
   - Auto-restarts stopped services (host mode only)

**Status Levels:**
- `healthy`: No issues detected
- `degraded`: 1-3 blocked workflows or 10+ orphaned deliverables
- `critical`: 4+ blocked workflows

### 2.3 Workflow Recovery Daemon

**Location:** `agent-backend/src/monitoring/workflow-recovery.daemon.ts`

**Schedule:** Runs every 5 minutes

**Focus:** ACTUALLY COMPLETES stuck/escalated work

**Specialized Handlers:**
1. **WMS Database Fix** (`REQ-DATABASE-WMS-*`)
   - Creates missing materialized views
   - Executes SQL directly in database

2. **Purchase Order Column Fix** (`REQ-PO-COLUMN-*`)
   - Restarts backend container
   - Deploys code changes

3. **Tenant Context Issues** (`REQ-TENANT-CTX-*`)
   - Security-sensitive
   - Marks as BLOCKED for manual review

**Status Transitions:**
```
ESCALATED → COMPLETE (after successful fix)
ESCALATED → BLOCKED (security/manual review needed)
```

### 2.4 Workflow Persistence Service

**Location:** `agent-backend/src/orchestration/workflow-persistence.service.ts`

**Features:**
- PostgreSQL-backed state storage
- Survives container restarts
- 90-day retention for completed workflows
- Automatic cleanup of old workflows

**Critical Methods:**
```typescript
createWorkflow(): Create or update workflow
getWorkflow(): Retrieve current state
updateStage(): Progress through stages
completeWorkflow(): Mark as done
blockWorkflow(): Flag for manual intervention
recoverWorkflows(): Restore state on startup
```

### 2.5 Log Monitor Service

**Location:** `agent-backend/src/monitoring/log-monitor.service.ts`

**Schedule:** Every 5 minutes

**Error Patterns Monitored (8 types):**

| Pattern | Severity | Threshold | Auto-Fix |
|---------|----------|-----------|----------|
| OWNER_REQUESTS.md not found | CRITICAL | 5 | Volume mount check |
| NATS connection refused | CRITICAL | 3 | Connectivity test |
| Module not found | ERROR | 5 | No (requires rebuild) |
| FATAL/PANIC/OOM | CRITICAL | 1 | No |
| Database connection failed | CRITICAL | 3 | No |
| Memory exhaustion | CRITICAL | 1 | No |
| Process spawn failure | ERROR | 3 | No |
| Unhandled exception | ERROR | 10 | No |

**Auto-Remediation Capabilities:**
- File accessibility verification
- NATS connectivity restoration
- Volume mount diagnostics

### 2.6 Strategic Orchestrator Recovery

**Location:** `agent-backend/src/orchestration/strategic-orchestrator.service.ts`

**Startup Recovery:**
1. Loads all `running` workflows from PostgreSQL
2. Checks NATS for deliverables
3. Determines last completed stage
4. Resumes from next stage

**Concurrency Management:**
- Max 5 concurrent workflows (prevents overload)
- Circuit breaker integration
- NATS JetStream for durability

**Streams:**
```
agog_strategic_decisions: 10,000 msgs, 100MB, 30-day retention
agog_strategic_escalations: 5,000 msgs, 50MB, 90-day retention
```

### 2.7 Health Monitor Service (Agent Backend)

**Location:** `agent-backend/src/monitoring/health-monitor.service.ts`

**Schedule:** Every 2 minutes

**Checks:**
- Critical file accessibility (OWNER_REQUESTS.md, agent definitions)
- NATS connectivity (flush test)
- Memory usage (alerts when >90%)
- Uptime tracking

**Publishing:**
- `agog.monitoring.health`: Detailed health reports
- `agog.metrics.system`: Dashboard metrics

### 2.8 Health Monitor Service (Application Backend)

**Location:** `backend/src/modules/monitoring/services/health-monitor.service.ts`

**Schedule:** Every 5 seconds

**Component Checks:**
- Backend: HTTP health endpoint (localhost:4000/health)
- Frontend: HTTP root endpoint (localhost:3000/)
- Database: `SELECT 1` query
- NATS: Status UNKNOWN (agent-only service)

**Overall Status Calculation:**
- OPERATIONAL: All components up
- DEGRADED: 50%+ components up
- DOWN: <50% components up

---

## 3. Monitoring & Health Check Systems

### 3.1 Agent Activity Monitoring

**Location:** `backend/src/modules/monitoring/services/agent-activity.service.ts`

**Features:**
- Real-time agent activity tracking via NATS subscriptions
- GraphQL integration for monitoring dashboards
- Tracks deliverables across all agent stages

### 3.2 Error Tracking Service

**Location:** `backend/src/modules/monitoring/services/error-tracking.service.ts`

**Severity Levels:**
- CRITICAL: System-breaking issues
- ERROR: Functional failures
- WARNING: Degraded performance
- INFO: Informational notices

**Status Workflow:**
```
OPEN → IN_PROGRESS → RESOLVED
                   ↘ IGNORED
```

**Tracking Dimensions:**
- Component (source of error)
- Tenant ID (multi-tenancy support)
- Occurrence count (deduplication)
- Stack traces (debugging)
- Assignment tracking (assigned_to, resolved_by)
- Resolution notes (audit trail)

### 3.3 System Health History

**Retention:** Unlimited (database cleanup required)

**Metrics Tracked:**
- Component status transitions
- Response times
- Error messages
- Metadata (JSON)
- Check timestamps (indexed)

---

## 4. Error Tracking & Alerting

### 4.1 DevOps Alerting Service

**Location:** `backend/src/modules/wms/services/devops-alerting.service.ts`

**Multi-Channel Alert Delivery:**

| Channel | Use Case | Configuration |
|---------|----------|---------------|
| **PagerDuty** | Critical alerts, on-call | Integration key |
| **Slack** | Warnings, notifications | Webhook URL |
| **Email** | Reports, summaries | SMTP config |

**Alert Routing by Severity:**
- CRITICAL: PagerDuty + Slack + Email
- WARNING: Slack + Email
- INFO: Slack only

**Alert Aggregation:**
- Window: 5 minutes
- Max alerts per window: 3
- Prevents alert fatigue
- Summary delivery after window

**Features:**
- Deduplication via cache
- Alert history and audit trail
- Configurable routing
- Tenant-specific configurations

### 4.2 Vendor Alert Engine

**Location:** `backend/src/modules/procurement/services/vendor-alert-engine.service.ts`

**Alert Types:**
1. THRESHOLD_BREACH: Performance metrics below thresholds
2. TIER_CHANGE: Vendor tier transitions
3. ESG_RISK: Environmental/Social/Governance risks
4. REVIEW_DUE: Audit overdue

**Thresholds:**
```typescript
Overall Score: CRITICAL <60, WARNING <75
Quality: CRITICAL <70%
On-time Delivery: CRITICAL <75%
ESG Risk: HIGH, CRITICAL, UNKNOWN levels
Audit Overdue: CRITICAL >18 months, WARNING >12 months
```

---

## 5. Database Persistence Layer

### 5.1 Workflow State Table

**Migration:** `V0.0.14__create_workflow_state_table.sql`

**Schema:**
```sql
workflow_state (
  req_number VARCHAR(100) PRIMARY KEY,
  title TEXT,
  assigned_to VARCHAR(50),
  current_stage INT DEFAULT 0,
  status VARCHAR(20) CHECK (status IN ('pending', 'running', 'blocked', 'complete', 'failed')),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  stage_deliverables JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP AUTO-UPDATE
)
```

**Indexes:**
- `idx_workflow_state_status`: Fast queries for running/blocked workflows
- `idx_workflow_state_started_at`: Monitoring oldest workflows

### 5.2 System Errors Table

**Migration:** `V0.0.1__initial_schema.sql`

**Schema:**
```sql
system_errors (
  id UUID PRIMARY KEY,
  tenant_id UUID INDEXED,
  severity VARCHAR(20) INDEXED,
  status VARCHAR(20) INDEXED,
  message TEXT,
  stack_trace TEXT,
  component VARCHAR(100) INDEXED,
  first_occurred TIMESTAMP,
  last_occurred TIMESTAMP INDEXED,
  occurrence_count INTEGER,
  assigned_to VARCHAR(100),
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  metadata JSONB
)
```

**Key Features:**
- Deduplication by error signature
- Occurrence counting
- Assignment tracking
- Full audit trail

### 5.3 Health History Table

**Schema:**
```sql
health_history (
  id UUID PRIMARY KEY,
  component VARCHAR(50),
  status VARCHAR(20),
  response_time INTEGER,
  error TEXT,
  metadata JSONB,
  checked_at TIMESTAMP INDEXED
)
```

**Retention:** Unlimited (manual cleanup required)

### 5.4 DevOps Alert Tables (Migration V0.0.27)

**Three-Table Structure:**

1. **devops_alert_history**
   - Individual alert records
   - Delivery status tracking
   - Channel delivery details
   - Tenant and facility scoped

2. **devops_alerting_config**
   - Per-tenant alert configuration
   - Encrypted credentials (PagerDuty, Slack)
   - Email recipient lists by severity
   - Aggregation window settings
   - Routing flags

3. **devops_alert_aggregation**
   - Time-windowed alert summaries
   - Count by severity
   - Unique source tracking
   - Summary sent flag

**Materialized View:**
```sql
devops_alert_statistics
- 7-day rolling window
- Hourly aggregation
- Alert volume status (HIGH_ALERT_VOLUME, MODERATE, NORMAL)
```

### 5.5 Vendor Performance Alerts (Migration V0.0.31)

**Schema:**
```sql
vendor_performance_alerts (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  vendor_id UUID,
  alert_type VARCHAR(50), -- CRITICAL|WARNING|TREND
  alert_category VARCHAR(50), -- OTD|QUALITY|RATING|COMPLIANCE
  alert_message TEXT,
  metric_value DECIMAL(10,4),
  threshold_value DECIMAL(10,4),
  alert_status VARCHAR(50) DEFAULT 'ACTIVE',
  acknowledged_at TIMESTAMP,
  acknowledged_by_user_id UUID,
  resolved_at TIMESTAMP,
  resolved_by_user_id UUID,
  dismissal_reason TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

**Status Workflow:**
```
ACTIVE → ACKNOWLEDGED → RESOLVED
                      ↘ DISMISSED
```

---

## 6. Integration Points for Enhancement

### 6.1 NATS Message Bus

**Current Usage:**
- Workflow orchestration
- Agent deliverable publishing
- Health monitoring broadcasts
- System metrics

**Topics:**
```
agog.monitoring.health          - Health reports
agog.metrics.system             - System metrics
agog.strategic.decisions.*      - Strategic decisions
agog.strategic.escalations.*    - Human escalations
agog.deliverables.*             - Agent deliverables
```

**Enhancement Opportunities:**
1. **Self-Healing Triggers**
   - New topic: `agog.healing.triggers.*`
   - Publish automatic remediation events
   - Track healing success/failure rates

2. **Predictive Monitoring**
   - New topic: `agog.monitoring.predictions.*`
   - ML-based failure prediction
   - Proactive remediation

### 6.2 PostgreSQL Database

**Current Tables Available:**
- `workflow_state`: Workflow tracking
- `system_errors`: Error tracking
- `health_history`: Component health
- `devops_alert_history`: Alert tracking
- `devops_alert_aggregation`: Alert summaries
- `vendor_performance_alerts`: Vendor monitoring

**Enhancement Opportunities:**
1. **Healing Actions Table**
   ```sql
   CREATE TABLE healing_actions (
     id UUID PRIMARY KEY,
     trigger_type VARCHAR(50),
     action_type VARCHAR(50),
     target_component VARCHAR(100),
     status VARCHAR(20),
     success BOOLEAN,
     execution_time_ms INTEGER,
     error_message TEXT,
     created_at TIMESTAMP,
     completed_at TIMESTAMP
   );
   ```

2. **Workflow Recovery History**
   ```sql
   CREATE TABLE workflow_recovery_history (
     id UUID PRIMARY KEY,
     req_number VARCHAR(100),
     recovery_type VARCHAR(50),
     stuck_duration_minutes INTEGER,
     last_completed_stage INTEGER,
     recovery_action VARCHAR(100),
     success BOOLEAN,
     recovered_at TIMESTAMP
   );
   ```

### 6.3 Circuit Breaker Integration

**Current State:** Integrated into StrategicOrchestratorService

**Enhancement Opportunities:**
1. **Per-Agent Circuit Breakers**
   - Individual breakers for each agent (Cynthia, Roy, Jen, etc.)
   - Different thresholds based on agent criticality
   - Agent-specific failure pattern analysis

2. **Circuit Breaker Metrics Dashboard**
   - Real-time state visualization
   - Failure rate trends
   - Cost savings calculation
   - Manual override controls

### 6.4 Health Monitoring Hooks

**Current Hooks:**
1. Log monitor auto-fix functions
2. Service restart on failure
3. Workflow recovery on startup

**Enhancement Opportunities:**
1. **Predictive Health Monitoring**
   - Trend analysis on response times
   - Early warning before component failure
   - Capacity planning alerts

2. **Smart Restart Policies**
   - Exponential backoff for restarts
   - Correlated failure detection
   - Cascade failure prevention

---

## 7. Architectural Recommendations

### 7.1 Self-Healing Maturity Model

**Current Level: Level 3 (Automatic Recovery)**

| Level | Capability | Status |
|-------|-----------|--------|
| **Level 1** | Manual Monitoring | ✅ Complete |
| **Level 2** | Automated Alerts | ✅ Complete |
| **Level 3** | Automatic Recovery | ✅ Complete |
| **Level 4** | Predictive Healing | 🔄 Partial |
| **Level 5** | Self-Optimization | ❌ Not Started |

### 7.2 Recommended Architecture: Healing Orchestrator

**New Service:** `SelfHealingOrchestratorService`

**Location:** `agent-backend/src/healing/self-healing-orchestrator.service.ts`

**Responsibilities:**
1. **Healing Strategy Selection**
   - Analyze error patterns
   - Select appropriate healing action
   - Track healing success rates
   - Learn from healing outcomes

2. **Action Execution**
   - Container restarts
   - Database repairs
   - Cache invalidation
   - Service reconnection
   - Workflow retry

3. **Validation**
   - Post-healing health checks
   - Rollback on failure
   - Escalation on repeated failure

4. **Metrics & Learning**
   - Track healing success rates
   - Identify recurring issues
   - Optimize healing strategies
   - Generate improvement recommendations

### 7.3 Healing Action Registry

**Design Pattern:** Strategy Pattern

```typescript
interface HealingAction {
  canHandle(error: SystemError): boolean;
  execute(error: SystemError): Promise<HealingResult>;
  validate(): Promise<boolean>;
  rollback(): Promise<void>;
}

class HealingActionRegistry {
  private actions: Map<string, HealingAction>;

  register(name: string, action: HealingAction): void;
  findAction(error: SystemError): HealingAction | null;
  executeHealing(error: SystemError): Promise<HealingResult>;
}
```

**Predefined Actions:**
1. `RestartContainerAction`
2. `RestoreFromBackupAction`
3. `InvalidateCacheAction`
4. `ReconnectServiceAction`
5. `RetryWorkflowAction`
6. `ApplyDatabaseMigrationAction`
7. `ClearTemporaryFilesAction`
8. `RestartDaemonProcessAction`

### 7.4 Healing Decision Engine

**ML-Based Approach (Future Enhancement):**

1. **Training Data:**
   - Historical errors from `system_errors` table
   - Healing actions from `healing_actions` table
   - Success/failure outcomes
   - Time to recovery

2. **Features:**
   - Error message text (NLP)
   - Component affected
   - Time of day / day of week
   - Recent system load
   - Previous healing attempts
   - Stack trace patterns

3. **Model Output:**
   - Recommended healing action
   - Confidence score
   - Estimated success probability
   - Estimated recovery time

4. **Fallback Strategy:**
   - Rule-based decision for low confidence
   - Manual escalation for critical systems
   - Safety checks before destructive actions

### 7.5 Healing Safety Mechanisms

**Critical Safeguards:**

1. **Maximum Retry Limits**
   - Per-action retry limit: 3 attempts
   - Per-error retry limit: 5 attempts across all actions
   - Cooling period: 10 minutes between retries

2. **Escalation Triggers**
   - 3 failed healing attempts
   - Critical component affected
   - Security-related errors
   - Data integrity risks

3. **Rollback Capabilities**
   - State snapshots before healing
   - Automatic rollback on validation failure
   - Manual rollback interface

4. **Human Override**
   - Kill switch for all healing
   - Action approval queue
   - Manual healing execution

---

## 8. Implementation Roadmap

### Phase 1: Foundation Enhancement (Week 1-2)

**Deliverables:**
1. Create `healing_actions` database table
2. Create `workflow_recovery_history` table
3. Implement `HealingActionRegistry` service
4. Implement basic healing actions:
   - `RestartContainerAction`
   - `ReconnectServiceAction`
   - `RetryWorkflowAction`

**Success Criteria:**
- 3 healing actions registered
- Database schema deployed
- Unit tests passing

### Phase 2: Integration (Week 3-4)

**Deliverables:**
1. Integrate healing registry with log monitor
2. Integrate healing registry with error tracking
3. Create healing metrics dashboard (GraphQL)
4. Add healing action execution to recovery daemon

**Success Criteria:**
- Log monitor triggers healing actions
- Error tracking records healing attempts
- Dashboard displays healing metrics
- Recovery daemon executes healing actions

### Phase 3: Intelligence (Week 5-6)

**Deliverables:**
1. Implement healing strategy selection logic
2. Add healing success rate tracking
3. Create healing recommendation system
4. Implement cooling period and retry limits

**Success Criteria:**
- System selects optimal healing action
- Success rates tracked and displayed
- Retry limits enforced
- Escalation triggers working

### Phase 4: Advanced Healing (Week 7-8)

**Deliverables:**
1. Implement predictive monitoring
2. Add trend analysis to health monitoring
3. Create proactive healing triggers
4. Implement rollback capabilities

**Success Criteria:**
- Predictive alerts generated
- Trends detected before failure
- Proactive healing executed
- Rollback tested and working

### Phase 5: Learning & Optimization (Week 9-10)

**Deliverables:**
1. Collect training data (historical errors + healing outcomes)
2. Train initial ML model (optional)
3. Implement A/B testing for healing strategies
4. Create healing optimization reports

**Success Criteria:**
- 1000+ healing action records
- ML model (if implemented) achieves 70%+ accuracy
- A/B test framework operational
- Weekly optimization reports generated

---

## Appendix A: File Locations Reference

### Agent Backend

**Monitoring Services:**
```
agent-backend/src/monitoring/
├── health-monitor.service.ts       (Every 2 min, file/NATS/memory checks)
├── log-monitor.service.ts          (Every 5 min, log analysis + auto-fix)
└── workflow-recovery.daemon.ts     (Every 5 min, completes stuck work)
```

**Proactive Daemons:**
```
agent-backend/src/proactive/
├── recovery-health-check.daemon.ts (Every 5 hours, workflow recovery)
├── value-chain-expert.daemon.ts    (Every 5 hours, feature recommendations)
└── product-owner.daemon.ts         (Product ownership management)
```

**Orchestration:**
```
agent-backend/src/orchestration/
├── strategic-orchestrator.service.ts  (Strategic workflow orchestration)
├── orchestrator.service.ts            (Standard workflow orchestration)
├── circuit-breaker.ts                 (Failure rate protection)
└── workflow-persistence.service.ts    (PostgreSQL state management)
```

### Application Backend

**Monitoring Module:**
```
backend/src/modules/monitoring/
├── monitoring.module.ts
├── monitoring.resolver.ts              (GraphQL API)
└── services/
    ├── health-monitor.service.ts       (Component health checks)
    ├── error-tracking.service.ts       (Error tracking + assignment)
    └── agent-activity.service.ts       (Real-time agent monitoring)
```

**Health Module:**
```
backend/src/health/
├── health.module.ts
├── health.controller.ts                (HTTP health endpoint)
└── health.resolver.ts                  (GraphQL health API)
```

**DevOps Alerting:**
```
backend/src/modules/wms/services/
└── devops-alerting.service.ts          (PagerDuty, Slack, Email)
```

**Vendor Alerts:**
```
backend/src/modules/procurement/services/
└── vendor-alert-engine.service.ts      (Vendor performance monitoring)
```

### Database Migrations

**Key Migrations:**
```
backend/migrations/
├── V0.0.1__initial_schema.sql          (system_errors, health_history)
├── V0.0.14__create_workflow_state_table.sql
├── V0.0.27__add_devops_alerting_infrastructure.sql
└── V0.0.31__vendor_scorecard_enhancements_phase1.sql
```

---

## Appendix B: NATS Topics Reference

### Monitoring Topics

```
agog.monitoring.health          - Health check reports (every 2 min)
agog.metrics.system             - System metrics for dashboard
```

### Strategic Topics

```
agog.strategic.decisions.*      - Strategic orchestrator decisions
agog.strategic.escalations.*    - Human escalation requests
```

### Deliverable Topics

```
agog.deliverables.cynthia.research.*
agog.deliverables.sylvia.critique.*
agog.deliverables.roy.backend.*
agog.deliverables.jen.frontend.*
agog.deliverables.billy.qa.*
agog.deliverables.priya.statistics.*
```

### Feature Streams

```
agog_features_research          (Stage 1: Cynthia)
agog_features_critique          (Stage 2: Sylvia)
agog_features_backend           (Stage 3: Roy)
agog_features_frontend          (Stage 4: Jen)
agog_features_qa                (Stage 5: Billy)
agog_features_statistics        (Stage 6: Priya)
```

---

## Appendix C: Monitoring Intervals

| Service | Interval | Location |
|---------|----------|----------|
| Agent Health Monitor | 2 minutes | `agent-backend/src/monitoring/health-monitor.service.ts` |
| Log Monitor | 5 minutes | `agent-backend/src/monitoring/log-monitor.service.ts` |
| Workflow Recovery | 5 minutes | `agent-backend/src/monitoring/workflow-recovery.daemon.ts` |
| Recovery Health Check | 5 hours | `agent-backend/src/proactive/recovery-health-check.daemon.ts` |
| Value Chain Expert | 5 hours | `agent-backend/src/proactive/value-chain-expert.daemon.ts` |
| Backend Health Monitor | 5 seconds | `backend/src/modules/monitoring/services/health-monitor.service.ts` |

---

## Appendix D: Circuit Breaker Configuration

```typescript
Default Configuration:
{
  failureThreshold: 0.5,      // 50% - opens circuit
  successThreshold: 0.8,       // 80% - closes circuit
  timeout: 300000,             // 5 minutes
  windowSize: 10               // Last 10 workflows
}

States:
- CLOSED: Normal operation, all requests allowed
- OPEN: Failure threshold exceeded, no requests allowed
- HALF_OPEN: Testing with single request after timeout

Cost Savings:
- $215 per prevented failure event
- 99.7% cost reduction on runaway workflows
```

---

## Appendix E: Error Pattern Detection

**Log Monitor Error Patterns:**

| Pattern | Severity | Threshold | Auto-Fix Available |
|---------|----------|-----------|-------------------|
| OWNER_REQUESTS.md not found | CRITICAL | 5 | Yes (mount check) |
| NATS connection refused | CRITICAL | 3 | Yes (connectivity test) |
| Module not found | ERROR | 5 | No (rebuild required) |
| FATAL/PANIC/OOM | CRITICAL | 1 | No (manual intervention) |
| Database connection failed | CRITICAL | 3 | No (DB restart) |
| Memory exhaustion | CRITICAL | 1 | No (scale up/restart) |
| Process spawn failure | ERROR | 3 | No (binary check) |
| Unhandled exception | ERROR | 10 | No (code fix required) |

---

## Conclusion

The AGOG SaaS platform has a **mature and sophisticated self-healing foundation** with 8 distinct recovery mechanisms, comprehensive error tracking, and multi-channel alerting. The existing infrastructure provides:

✅ **Automatic workflow recovery** with circuit breaker protection
✅ **Multi-layered health monitoring** at 2-minute, 5-minute, and 5-hour intervals
✅ **Persistent state management** across container restarts
✅ **Multi-channel alerting** (PagerDuty, Slack, Email)
✅ **Log analysis with auto-remediation** for common issues
✅ **Cost protection** preventing $215/event runaway workflows

**Recommended Next Steps:**
1. Implement centralized `SelfHealingOrchestratorService`
2. Create `HealingActionRegistry` with pluggable healing strategies
3. Add healing metrics tracking and dashboard
4. Implement predictive monitoring and proactive healing
5. Build ML-based healing decision engine (optional future enhancement)

**For Implementation Team (Marcus):**
- All necessary infrastructure is in place
- Focus on building healing action registry and orchestrator
- Leverage existing monitoring hooks for integration
- Use circuit breaker pattern as reference implementation
- Start with 3-5 basic healing actions before adding intelligence

---

**Research Completed By:** Cynthia (Research Agent)
**Date:** 2025-12-29
**Next Stage:** Strategic Critique (Sylvia)
