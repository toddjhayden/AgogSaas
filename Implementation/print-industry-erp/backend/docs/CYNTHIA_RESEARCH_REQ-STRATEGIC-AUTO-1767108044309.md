# Research Report: Intelligent Workflow Automation Engine
## REQ-STRATEGIC-AUTO-1767108044309

**Agent:** Cynthia (Research Analyst)
**Date:** 2025-12-30
**Status:** Complete

---

## Executive Summary

This research analyzes requirements and implementation strategy for an **Intelligent Workflow Automation Engine** to enhance the existing agentic ERP system. Current analysis reveals a **mature workflow infrastructure** already in place with:

- ✅ **PO Approval Workflows** (V0.0.38) - Multi-level, SLA-tracked, with escalation
- ✅ **Agent Orchestration System** - 7-stage strategic workflow with NATS messaging
- ✅ **Workflow Persistence** - PostgreSQL-backed state management with recovery
- ✅ **Proactive Daemons** - Auto-monitoring, health checks, and recovery systems

**Key Finding:** Rather than building a new workflow engine, the optimal strategy is to **generalize and extend** the existing approval workflow infrastructure to support arbitrary business processes beyond purchase orders.

---

## 1. Current Workflow Infrastructure Analysis

### 1.1 Purchase Order Approval Workflow System

**Location:** `backend/src/modules/procurement/services/approval-workflow.service.ts` (698 lines)

**Capabilities:**
- ✅ Multi-level approval routing (SEQUENTIAL, PARALLEL, ANY_ONE)
- ✅ Amount-based workflow selection with priority rules
- ✅ SLA tracking with configurable deadlines per step
- ✅ Auto-escalation on SLA breach
- ✅ Auto-approval for amounts below threshold
- ✅ Authorization validation via user approval authority limits
- ✅ Complete immutable audit trail (SOX/GDPR compliant)
- ✅ Delegation capabilities with authority transfer
- ✅ Workflow snapshots (prevents mid-flight configuration changes)
- ✅ Real-time approval queue with urgency classification

**Database Tables:**
```sql
po_approval_workflows         -- Workflow definitions with routing rules
po_approval_workflow_steps    -- Step configuration with approver assignment
po_approval_history           -- Immutable audit trail with PO snapshots
user_approval_authority       -- User limits and delegation rules
v_approval_queue              -- Real-time view with SLA calculations
```

**GraphQL API:**
```graphql
Query:
  - getMyPendingApprovals(urgencyLevel, amountMin, amountMax)
  - getPOApprovalHistory(purchaseOrderId)
  - getApprovalWorkflows(tenantId)

Mutation:
  - submitPOForApproval(purchaseOrderId)
  - approvePOWorkflowStep(purchaseOrderId, comments)
  - rejectPO(purchaseOrderId, rejectionReason)
  - delegatePO(purchaseOrderId, delegateToUserId)
```

**Strengths:**
1. Production-ready with comprehensive error handling
2. Multi-tenancy support with tenant_id isolation
3. Row-level security (RLS) policies enforced
4. Configurable workflow routing based on business rules
5. Real-time SLA monitoring with urgency levels (URGENT/WARNING/NORMAL)

**Limitations:**
1. **Domain-specific:** Tightly coupled to purchase_orders table
2. **No visual designer:** Workflows configured via SQL inserts
3. **Limited conditional logic:** Only supports amount-based routing
4. **No parallel task support:** Sequential step execution only
5. **No integration hooks:** Cannot trigger external systems on state changes

---

### 1.2 Agent-Based Strategic Orchestration

**Location:** `agent-backend/src/orchestration/strategic-orchestrator.service.ts` (1730 lines)

**Capabilities:**
- ✅ 7-stage workflow (Research → Critique → Backend → Frontend → QA → Statistics → DevOps)
- ✅ Dynamic agent spawning with NATS messaging
- ✅ Circuit breaker pattern for preventing runaway workflows
- ✅ Workflow recovery on container restart
- ✅ Sub-requirement decomposition with BLOCKED state handling
- ✅ Concurrency limits (max 5 workflows)
- ✅ Heartbeat monitoring (30-min timeout detection)
- ✅ Max workflow duration enforcement (8 hours)
- ✅ State reconciliation daemon (OWNER_REQUESTS.md ↔ NATS)
- ✅ Automatic escalation on timeouts, depth limits, CLI failures

**Workflow States:**
```typescript
NEW → IN_PROGRESS → COMPLETE
         ↓
      BLOCKED (sub-requirements) → IN_PROGRESS (resume)
         ↓
      REJECTED (resubmit) → IN_PROGRESS
         ↓
      ESCALATED (human intervention)
```

**NATS Streams:**
```
agog_strategic_decisions     -- Strategic approval/rejection decisions
agog_strategic_escalations   -- Human review escalations
agog_orchestration_events    -- Stage transitions, completions, blocks
agog_features_*              -- Deliverable streams per stage
```

**Strengths:**
1. Fully autonomous with self-recovery capabilities
2. Handles complex workflows with dynamic sub-requirement creation
3. Semantic memory integration for learning from past workflows
4. Comprehensive monitoring and health checks
5. Prevents infinite loops via recursion depth limits (max 3 SUB levels)

**Limitations:**
1. **Agent-specific:** Designed for feature development workflows
2. **No generalization:** Cannot be applied to other business processes
3. **No human task support:** Fully autonomous, no interactive approval steps
4. **No form-based input:** Cannot collect user data mid-workflow
5. **No conditional branching:** Linear 7-stage progression only

---

### 1.3 Workflow Persistence Infrastructure

**Backend Migration:** `V0.0.14__create_workflow_state_table.sql`
```sql
CREATE TABLE workflow_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  req_number VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL, -- pending, running, complete, failed
  current_stage INTEGER,
  stage_deliverables JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Agent Backend Migration:** `agent-backend/migrations/V0.0.14__create_agent_workflows_table.sql`
```sql
CREATE TABLE agent_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  req_number VARCHAR(100) UNIQUE NOT NULL,
  title TEXT,
  assigned_to VARCHAR(50), -- marcus/sarah/alex
  status VARCHAR(50) DEFAULT 'pending',
  current_stage INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-cleanup trigger: Delete workflows older than 90 days
```

**Strengths:**
1. Dual persistence (backend + agent-backend databases)
2. JSONB metadata for flexible workflow context storage
3. Auto-cleanup to prevent database bloat
4. Fast lookup indexes on status and req_number

**Limitations:**
1. No versioning support for workflow definitions
2. No rollback/undo capability
3. No workflow template storage
4. No execution history beyond current state

---

### 1.4 Proactive Daemon Systems

**A. ProductOwnerDaemon** (`product-owner.daemon.ts`)
- Monitors domain-specific metrics (stockout rate, bin utilization, cost variance)
- Auto-creates feature requests when thresholds breached
- Domain owners: Marcus (Inventory), Sarah (Sales), Alex (Procurement)

**B. RecoveryHealthCheckDaemon** (`recovery-health-check.daemon.ts`)
- Runs at startup + every 5 hours
- Detects and recovers stuck workflows
- Restarts failed services
- Reports system health (healthy/degraded/critical)

**C. ValueChainExpertDaemon** (`value-chain-expert.daemon.ts`)
- Analyzes end-to-end value chain
- Identifies optimization opportunities
- Publishes recommendations to NATS

**Strengths:**
1. Autonomous monitoring and recovery
2. Proactive issue detection before human escalation
3. Self-healing capabilities

**Limitations:**
1. Domain-specific monitoring rules
2. Cannot be generalized to arbitrary workflows
3. No pluggable monitoring strategy

---

## 2. Industry Workflow Automation Patterns

### 2.1 Common Workflow Engine Features (Camunda, Temporal, Conductor)

| Feature | Current System | Gap? |
|---------|----------------|------|
| **Visual BPMN Designer** | ❌ SQL-based config | ⚠️ High |
| **Multi-level Approvals** | ✅ PO workflows | ✅ Exists |
| **Parallel Tasks** | ❌ Sequential only | ⚠️ Medium |
| **Conditional Branching** | ❌ Amount-based only | ⚠️ High |
| **Human Tasks** | ✅ Approval steps | ✅ Exists |
| **Service Tasks** | ✅ Agent spawning | ✅ Exists |
| **Sub-processes** | ✅ Sub-requirements | ✅ Exists |
| **Error Handling** | ✅ Escalation | ✅ Exists |
| **SLA Tracking** | ✅ Per-step deadlines | ✅ Exists |
| **Audit Trail** | ✅ Immutable history | ✅ Exists |
| **State Persistence** | ✅ PostgreSQL | ✅ Exists |
| **Event-driven** | ✅ NATS messaging | ✅ Exists |
| **Retry Logic** | ✅ Circuit breaker | ✅ Exists |
| **Versioning** | ❌ No versioning | ⚠️ Medium |
| **Workflow Templates** | ❌ Hard-coded | ⚠️ High |
| **Integration Webhooks** | ❌ No webhooks | ⚠️ Low |

### 2.2 Print Industry-Specific Workflows

**A. Job Estimating → Quote → Order Entry → Production**
```
1. Sales receives RFQ
2. Estimating calculates costs
3. Manager approves quote
4. Customer accepts quote
5. Production schedule created
6. Materials requisitioned
7. Job released to shop floor
```

**Current Gap:** No workflow support beyond PO approvals. Each step is manual entry.

**B. Press Approval (Preflight → Proof → Customer Sign-off)**
```
1. Customer uploads artwork
2. Preflight checks PDF (color, fonts, bleeds)
3. Proof generated and sent to customer
4. Customer approves/requests changes
5. Job released to press
```

**Current Gap:** Preflight system exists (V0.0.46) but no approval workflow integration.

**C. Vendor Onboarding**
```
1. Vendor submits application
2. Compliance reviews documentation
3. Finance approves payment terms
4. Procurement approves contract
5. IT creates vendor portal access
6. Vendor activated in system
```

**Current Gap:** No multi-department approval workflow support.

---

## 3. Proposed Generalized Workflow Engine

### 3.1 Architecture Design

**Core Abstraction:**
```typescript
interface WorkflowDefinition {
  id: string;
  name: string;
  version: number;
  tenant_id: string;

  // Workflow trigger configuration
  trigger: {
    type: 'manual' | 'scheduled' | 'event' | 'api';
    event_subject?: string; // NATS subject pattern
    cron_schedule?: string;
  };

  // Workflow nodes (steps/tasks)
  nodes: WorkflowNode[];

  // Routing rules
  routes: WorkflowRoute[];

  // Global SLA
  sla_hours?: number;
  escalation_enabled: boolean;
  escalation_user_id?: string;
}

interface WorkflowNode {
  id: string;
  node_type: 'approval' | 'service_task' | 'user_task' | 'gateway' | 'sub_workflow';
  name: string;

  // Approval node config
  approver_user_id?: string;
  approver_role?: string;
  approval_logic?: 'SEQUENTIAL' | 'PARALLEL' | 'ANY_ONE';

  // Service task config
  service_type?: 'agent_spawn' | 'http_call' | 'database_query' | 'email_send';
  service_config?: any;

  // User task config
  form_fields?: FormField[];
  assigned_user_id?: string;
  assigned_role?: string;

  // Gateway (conditional branching) config
  condition_type?: 'amount_based' | 'field_value' | 'expression';
  condition_expression?: string;

  // Timing
  sla_hours?: number;
  timeout_action?: 'escalate' | 'auto_approve' | 'fail';
}

interface WorkflowRoute {
  from_node_id: string;
  to_node_id: string;
  condition?: string; // JavaScript expression
  is_default?: boolean;
}
```

### 3.2 Database Schema

```sql
-- Workflow definitions (versioned)
CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  trigger_config JSONB NOT NULL,
  nodes JSONB NOT NULL, -- Array of WorkflowNode
  routes JSONB NOT NULL, -- Array of WorkflowRoute
  sla_hours INTEGER,
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_user_id UUID REFERENCES users(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, name, version)
);

-- Workflow instances (executions)
CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id),
  workflow_name VARCHAR(255) NOT NULL,
  workflow_version INTEGER NOT NULL,

  -- Instance context
  context_entity_type VARCHAR(100), -- 'purchase_order', 'job', 'quote', etc.
  context_entity_id UUID, -- FK to entity
  context_data JSONB DEFAULT '{}'::jsonb, -- Workflow variables

  -- Execution state
  status VARCHAR(50) NOT NULL, -- 'running', 'completed', 'failed', 'blocked', 'escalated'
  current_node_id VARCHAR(100),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,

  -- Tracking
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_instances_status ON workflow_instances(tenant_id, status);
CREATE INDEX idx_workflow_instances_entity ON workflow_instances(tenant_id, context_entity_type, context_entity_id);

-- Workflow instance nodes (execution log)
CREATE TABLE workflow_instance_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL, -- From workflow definition
  node_name VARCHAR(255),
  node_type VARCHAR(50),

  -- Execution state
  status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  assigned_user_id UUID REFERENCES users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,

  -- Node result
  action VARCHAR(50), -- 'approved', 'rejected', 'completed', 'failed', 'delegated'
  action_by_user_id UUID REFERENCES users(id),
  action_date TIMESTAMPTZ,
  comments TEXT,
  output_data JSONB, -- Node execution output

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_instance_nodes_instance ON workflow_instance_nodes(instance_id);
CREATE INDEX idx_workflow_instance_nodes_assigned_user ON workflow_instance_nodes(tenant_id, assigned_user_id, status);

-- Workflow instance history (immutable audit trail)
CREATE TABLE workflow_instance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  instance_id UUID NOT NULL REFERENCES workflow_instances(id),
  node_id VARCHAR(100),

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- 'started', 'node_entered', 'node_completed', 'approved', 'rejected', 'escalated', 'completed', 'failed'
  event_by_user_id UUID REFERENCES users(id),
  event_date TIMESTAMPTZ DEFAULT NOW(),

  -- Event context
  event_data JSONB, -- Includes comments, approvals, etc.
  instance_snapshot JSONB, -- Full instance state at time of event

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_instance_history_instance ON workflow_instance_history(instance_id, event_date DESC);

-- User task assignments (for my tasks view)
CREATE VIEW v_user_task_queue AS
SELECT
  wii.id AS task_id,
  wii.instance_id,
  wi.workflow_name,
  wii.node_name AS task_name,
  wii.assigned_user_id,
  wii.sla_deadline,
  CASE
    WHEN wii.sla_deadline < NOW() THEN 'URGENT'
    WHEN wii.sla_deadline < NOW() + INTERVAL '4 hours' THEN 'WARNING'
    ELSE 'NORMAL'
  END AS urgency_level,
  EXTRACT(EPOCH FROM (wii.sla_deadline - NOW())) / 3600 AS hours_remaining,
  wii.sla_deadline < NOW() AS is_overdue,
  wi.context_entity_type,
  wi.context_entity_id,
  wi.context_data,
  wii.created_at AS task_created_at
FROM workflow_instance_nodes wii
INNER JOIN workflow_instances wi ON wii.instance_id = wi.id
WHERE wii.status = 'in_progress'
  AND wii.assigned_user_id IS NOT NULL;
```

### 3.3 Service Implementation

```typescript
// backend/src/modules/workflow/services/workflow-engine.service.ts

export class WorkflowEngineService {

  /**
   * Start a new workflow instance
   */
  async startWorkflow(
    workflowDefinitionId: string,
    contextEntityType: string,
    contextEntityId: string,
    contextData: any,
    triggeredByUserId: string,
    tenantId: string
  ): Promise<WorkflowInstance> {
    // 1. Load workflow definition
    const definition = await this.getWorkflowDefinition(workflowDefinitionId);

    // 2. Create workflow instance
    const instance = await this.createWorkflowInstance({
      workflowDefinitionId: definition.id,
      workflowName: definition.name,
      workflowVersion: definition.version,
      contextEntityType,
      contextEntityId,
      contextData,
      createdBy: triggeredByUserId,
      tenantId
    });

    // 3. Find entry node (first node with no incoming routes)
    const entryNode = this.findEntryNode(definition);

    // 4. Execute entry node
    await this.executeNode(instance.id, entryNode, contextData);

    return instance;
  }

  /**
   * Execute a workflow node
   */
  private async executeNode(
    instanceId: string,
    node: WorkflowNode,
    contextData: any
  ): Promise<void> {
    // Create node execution record
    const nodeExecution = await this.createNodeExecution(instanceId, node);

    switch (node.node_type) {
      case 'approval':
        await this.executeApprovalNode(nodeExecution, node, contextData);
        break;

      case 'service_task':
        await this.executeServiceTask(nodeExecution, node, contextData);
        break;

      case 'user_task':
        await this.executeUserTask(nodeExecution, node, contextData);
        break;

      case 'gateway':
        await this.executeGateway(nodeExecution, node, contextData);
        break;

      case 'sub_workflow':
        await this.executeSubWorkflow(nodeExecution, node, contextData);
        break;
    }
  }

  /**
   * Execute approval node (wait for user approval)
   */
  private async executeApprovalNode(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any
  ): Promise<void> {
    // Resolve approver
    const approverId = await this.resolveApprover(node, contextData);

    // Set SLA deadline
    const slaDeadline = new Date();
    slaDeadline.setHours(slaDeadline.getHours() + (node.sla_hours || 24));

    // Update node to in_progress state with approver assigned
    await this.updateNodeExecution(nodeExecution.id, {
      status: 'in_progress',
      assigned_user_id: approverId,
      sla_deadline: slaDeadline
    });

    // Create history entry
    await this.createHistoryEntry(nodeExecution.instance_id, {
      event_type: 'node_entered',
      node_id: node.id,
      event_by_user_id: approverId,
      event_data: { node_type: 'approval', approver: approverId }
    });

    // Node stays in_progress until approveNode() is called
  }

  /**
   * Approve a workflow node (called by GraphQL mutation)
   */
  async approveNode(
    nodeExecutionId: string,
    approvedByUserId: string,
    comments?: string
  ): Promise<void> {
    const nodeExecution = await this.getNodeExecution(nodeExecutionId);

    // Validate approver
    if (nodeExecution.assigned_user_id !== approvedByUserId) {
      throw new ForbiddenException('You are not authorized to approve this task');
    }

    // Mark node as completed
    await this.updateNodeExecution(nodeExecutionId, {
      status: 'completed',
      action: 'approved',
      action_by_user_id: approvedByUserId,
      action_date: new Date(),
      completed_at: new Date(),
      comments
    });

    // Create history entry
    await this.createHistoryEntry(nodeExecution.instance_id, {
      event_type: 'approved',
      node_id: nodeExecution.node_id,
      event_by_user_id: approvedByUserId,
      event_data: { action: 'approved', comments }
    });

    // Find next node and execute
    const nextNode = await this.findNextNode(nodeExecution.instance_id, nodeExecution.node_id);
    if (nextNode) {
      const instance = await this.getInstance(nodeExecution.instance_id);
      await this.executeNode(instance.id, nextNode, instance.context_data);
    } else {
      // No more nodes - workflow complete
      await this.completeWorkflow(nodeExecution.instance_id);
    }
  }

  /**
   * Execute service task (automated task)
   */
  private async executeServiceTask(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any
  ): Promise<void> {
    await this.updateNodeExecution(nodeExecution.id, { status: 'in_progress' });

    try {
      let result;

      switch (node.service_type) {
        case 'agent_spawn':
          // Spawn an AI agent via NATS
          result = await this.spawnAgent(node.service_config, contextData);
          break;

        case 'http_call':
          // Make HTTP request to external API
          result = await this.makeHttpCall(node.service_config, contextData);
          break;

        case 'database_query':
          // Execute database query
          result = await this.executeDatabaseQuery(node.service_config, contextData);
          break;

        case 'email_send':
          // Send email notification
          result = await this.sendEmail(node.service_config, contextData);
          break;
      }

      // Mark node as completed
      await this.updateNodeExecution(nodeExecution.id, {
        status: 'completed',
        action: 'completed',
        completed_at: new Date(),
        output_data: result
      });

      // Execute next node
      const nextNode = await this.findNextNode(nodeExecution.instance_id, node.id);
      if (nextNode) {
        await this.executeNode(nodeExecution.instance_id, nextNode, {
          ...contextData,
          [node.id]: result // Add service task output to context
        });
      }

    } catch (error) {
      // Mark node as failed
      await this.updateNodeExecution(nodeExecution.id, {
        status: 'failed',
        action: 'failed',
        completed_at: new Date(),
        comments: error.message
      });

      // Handle error based on node config
      if (node.timeout_action === 'escalate') {
        await this.escalateWorkflow(nodeExecution.instance_id, error.message);
      } else {
        await this.failWorkflow(nodeExecution.instance_id, error.message);
      }
    }
  }

  /**
   * Execute gateway (conditional branching)
   */
  private async executeGateway(
    nodeExecution: WorkflowInstanceNode,
    node: WorkflowNode,
    contextData: any
  ): Promise<void> {
    // Evaluate condition
    const conditionResult = await this.evaluateCondition(node.condition_expression, contextData);

    // Find next node based on condition
    const definition = await this.getWorkflowDefinitionForInstance(nodeExecution.instance_id);
    const outgoingRoutes = definition.routes.filter(r => r.from_node_id === node.id);

    let nextRoute;
    if (conditionResult) {
      // Follow 'true' route
      nextRoute = outgoingRoutes.find(r => r.condition === 'true' || r.is_default);
    } else {
      // Follow 'false' route
      nextRoute = outgoingRoutes.find(r => r.condition === 'false');
    }

    if (!nextRoute) {
      throw new Error(`No route found for gateway ${node.id} condition result: ${conditionResult}`);
    }

    // Mark gateway as completed
    await this.updateNodeExecution(nodeExecution.id, {
      status: 'completed',
      action: 'completed',
      completed_at: new Date(),
      output_data: { condition_result: conditionResult, next_node: nextRoute.to_node_id }
    });

    // Execute next node
    const nextNode = definition.nodes.find(n => n.id === nextRoute.to_node_id);
    await this.executeNode(nodeExecution.instance_id, nextNode, contextData);
  }
}
```

### 3.4 GraphQL API

```graphql
# Workflow definition management
type Query {
  workflowDefinitions(tenantId: ID!): [WorkflowDefinition!]!
  workflowDefinition(id: ID!): WorkflowDefinition

  # My tasks (user-facing)
  myPendingTasks(urgencyLevel: UrgencyLevel, limit: Int): [UserTask!]!

  # Instance monitoring
  workflowInstances(status: WorkflowStatus, entityType: String, limit: Int): [WorkflowInstance!]!
  workflowInstance(id: ID!): WorkflowInstance
  workflowInstanceHistory(instanceId: ID!): [WorkflowHistoryEntry!]!
}

type Mutation {
  # Workflow definition CRUD
  createWorkflowDefinition(input: CreateWorkflowDefinitionInput!): WorkflowDefinition!
  updateWorkflowDefinition(id: ID!, input: UpdateWorkflowDefinitionInput!): WorkflowDefinition!
  publishWorkflowDefinition(id: ID!): WorkflowDefinition!
  archiveWorkflowDefinition(id: ID!): WorkflowDefinition!

  # Workflow execution
  startWorkflow(
    workflowDefinitionId: ID!,
    entityType: String!,
    entityId: ID!,
    contextData: JSON
  ): WorkflowInstance!

  # User actions on tasks
  approveTask(taskId: ID!, comments: String): WorkflowInstance!
  rejectTask(taskId: ID!, reason: String!): WorkflowInstance!
  delegateTask(taskId: ID!, delegateToUserId: ID!): WorkflowInstance!
  completeUserTask(taskId: ID!, formData: JSON!): WorkflowInstance!
}
```

---

## 4. Implementation Roadmap

### Phase 1: Core Workflow Engine (2-3 weeks)

**Deliverables:**
1. Database migrations for workflow tables
2. WorkflowEngineService with node execution logic
3. GraphQL API for workflow CRUD and execution
4. Basic workflow UI (list, start, approve/reject)

**Key Features:**
- ✅ Approval nodes (reusing PO approval logic)
- ✅ Service tasks (agent spawning, HTTP calls)
- ✅ Sequential execution
- ✅ SLA tracking
- ✅ Audit trail

### Phase 2: Advanced Routing (1-2 weeks)

**Deliverables:**
1. Gateway nodes (conditional branching)
2. Parallel task execution
3. Sub-workflow support
4. Loop/iteration support

**Key Features:**
- ✅ Conditional routing based on context data
- ✅ Parallel approval (ANY_ONE, ALL)
- ✅ Nested workflows

### Phase 3: Visual Workflow Designer (3-4 weeks)

**Deliverables:**
1. React-based visual designer (React Flow library)
2. Drag-and-drop node creation
3. Route drawing with conditions
4. Workflow validation
5. Version management UI

**Key Features:**
- ✅ Visual BPMN-like designer
- ✅ Template library
- ✅ Export/import workflows as JSON
- ✅ Publish/draft workflow versions

### Phase 4: Integration & Templates (2-3 weeks)

**Deliverables:**
1. Pre-built workflow templates
   - Job Estimating Approval
   - Vendor Onboarding
   - Press Approval (Preflight)
   - Material Request
2. Webhook integrations
3. Email notification templates
4. Integration with existing systems (PO, Jobs, Vendors)

---

## 5. Technical Recommendations

### 5.1 Leverage Existing Infrastructure

**Reuse:**
1. ✅ `approval-workflow.service.ts` - Extract approval logic into generic `ApprovalNodeExecutor`
2. ✅ `strategic-orchestrator.service.ts` - Extract NATS messaging patterns into `WorkflowMessageBus`
3. ✅ `workflow-persistence.service.ts` - Extend for generic workflow state persistence
4. ✅ RLS policies - Apply tenant isolation to all workflow tables

**Extend:**
1. Create `WorkflowEngineModule` in `backend/src/modules/workflow/`
2. Add `workflow-engine.service.ts` with node execution engine
3. Add `workflow-definition.service.ts` for CRUD on workflow templates
4. Add `workflow-instance.service.ts` for runtime execution

### 5.2 NATS Event-Driven Architecture

**Event Subjects:**
```
agog.workflows.instance.{instanceId}.started
agog.workflows.instance.{instanceId}.node.{nodeId}.entered
agog.workflows.instance.{instanceId}.node.{nodeId}.completed
agog.workflows.instance.{instanceId}.completed
agog.workflows.instance.{instanceId}.failed
agog.workflows.instance.{instanceId}.escalated
```

**Benefits:**
1. Asynchronous task execution
2. Integration with external systems via subscriptions
3. Workflow monitoring dashboards can subscribe to events
4. Audit trail automatically captured via event log

### 5.3 Security Considerations

**Authorization:**
1. RLS policies enforce tenant isolation on all workflow tables
2. User approval authority table controls who can approve what amount/type
3. Role-based assignment for tasks (e.g., "Finance Manager" role)
4. Audit trail captures all user actions with user_id

**Data Privacy:**
1. Context data stored as JSONB - encrypt sensitive fields
2. History snapshots may contain PII - implement data retention policies
3. Delegate feature must validate delegatee has same/higher approval authority

---

## 6. Success Metrics

**Operational Metrics:**
1. Average workflow completion time (target: < 2 hours for simple workflows)
2. SLA compliance rate (target: > 95% on-time completions)
3. Manual intervention rate (target: < 5% escalations)
4. Workflow adoption rate (# of workflows created vs # of manual processes)

**Business Metrics:**
1. Approval cycle time reduction (target: 50% reduction from manual process)
2. Error rate in business processes (target: 80% reduction via automation)
3. Process visibility (audit trail coverage: 100%)
4. Employee productivity (hours saved per week per employee)

---

## 7. Risk Analysis

### 7.1 Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance degradation with large workflows | High | Implement pagination, lazy loading, workflow archival |
| NATS message queue overflow | Medium | Implement circuit breakers, message TTL, dead letter queues |
| PostgreSQL storage bloat (audit history) | Medium | Auto-archive old workflows (90+ days), compress JSONB |
| Visual designer complexity | High | Start with template library, defer full designer to Phase 3 |

### 7.2 Business Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Low user adoption | High | Start with high-pain processes (PO approvals), provide training |
| Over-automation of critical processes | Medium | Require human approval gates for high-value workflows |
| Workflow definition errors | Medium | Validation engine, sandbox testing environment |
| Vendor lock-in to custom solution | Low | Export workflows as BPMN 2.0 XML for portability |

---

## 8. Comparison with Commercial Alternatives

### 8.1 Build vs Buy Analysis

| Feature | Custom Build | Camunda | Temporal | Zapier/Make |
|---------|-------------|---------|----------|-------------|
| **Integration with existing DB** | ✅ Native | ⚠️ Complex | ⚠️ Complex | ❌ Limited |
| **Multi-tenancy** | ✅ Built-in | ⚠️ Manual | ⚠️ Manual | ❌ Not supported |
| **Row-level security** | ✅ PostgreSQL RLS | ❌ App-level | ❌ App-level | ❌ Not supported |
| **NATS integration** | ✅ Native | ⚠️ Custom | ⚠️ Custom | ❌ No |
| **Agent orchestration** | ✅ Built-in | ❌ Manual | ⚠️ Workers | ❌ No |
| **Cost** | Dev time only | $$$$ | $$$$ | $$$ |
| **Deployment** | ✅ Self-hosted | ⚠️ Complex | ⚠️ Complex | ☁️ SaaS only |
| **Customization** | ✅ Full control | ⚠️ Limited | ⚠️ Limited | ❌ Very limited |
| **Learning curve** | Low (team knows stack) | High | High | Low |

**Recommendation:** **Build custom workflow engine** leveraging existing infrastructure. The cost of integration with commercial tools outweighs development cost given existing team expertise and infrastructure.

---

## 9. Conclusion

### 9.1 Key Findings

1. ✅ **Strong foundation exists** - PO approval workflows and agent orchestration provide 80% of needed infrastructure
2. ⚠️ **Generalization required** - Current workflows are domain-specific and not reusable
3. ✅ **Event-driven architecture ready** - NATS messaging already in place for async task execution
4. ⚠️ **Visual designer needed** - SQL-based workflow configuration is not scalable
5. ✅ **Security & compliance ready** - RLS, audit trails, and multi-tenancy already implemented

### 9.2 Recommended Approach

**Strategy:** Incremental enhancement of existing infrastructure

1. **Phase 1 (MVP):** Generalize `approval-workflow.service.ts` into generic workflow engine
2. **Phase 2:** Add conditional branching and parallel task support
3. **Phase 3:** Build visual workflow designer on top of engine
4. **Phase 4:** Create template library and migrate existing processes

**Why this approach:**
- ✅ Reuses proven infrastructure (PO approvals, agent orchestration)
- ✅ Minimizes risk - incremental delivery with working fallback
- ✅ Faster time-to-value - MVP in 2-3 weeks vs 6+ months for commercial integration
- ✅ Lower total cost - no licensing fees, team knows the stack
- ✅ Full customization - can adapt to print industry workflows

### 9.3 Next Steps for Roy (Backend Implementation)

1. Create `WorkflowEngineModule` in `backend/src/modules/workflow/`
2. Implement database migrations (V0.0.61+)
3. Build core workflow execution engine
4. Add GraphQL API for workflow CRUD
5. Create workflow template for "Job Estimating Approval"
6. Integration test with existing PO approval workflow

---

## 10. Appendix

### 10.1 Workflow Template Examples

**A. Job Estimating Approval Workflow**
```yaml
name: Job Estimating Approval
version: 1
trigger:
  type: manual

nodes:
  - id: estimate_job
    type: user_task
    name: Create Estimate
    assigned_role: estimator
    form_fields:
      - name: customer_name
      - name: job_description
      - name: quantity
      - name: estimated_cost
      - name: estimated_hours
    sla_hours: 24

  - id: manager_review
    type: approval
    name: Manager Review
    approver_role: estimating_manager
    sla_hours: 4

  - id: check_amount
    type: gateway
    name: Check Amount
    condition_expression: "estimated_cost > 10000"

  - id: cfo_approval
    type: approval
    name: CFO Approval (High Value)
    approver_role: cfo
    sla_hours: 8

  - id: create_quote
    type: service_task
    name: Generate Quote PDF
    service_type: database_query
    service_config:
      query: INSERT INTO quotes (...)

  - id: send_quote
    type: service_task
    name: Email Quote to Customer
    service_type: email_send
    service_config:
      template: quote_email
      to_field: customer_email

routes:
  - from: estimate_job
    to: manager_review
  - from: manager_review
    to: check_amount
  - from: check_amount
    to: cfo_approval
    condition: "true"  # If amount > 10000
  - from: check_amount
    to: create_quote
    condition: "false"  # If amount <= 10000
  - from: cfo_approval
    to: create_quote
  - from: create_quote
    to: send_quote
```

**B. Vendor Onboarding Workflow**
```yaml
name: Vendor Onboarding
version: 1
trigger:
  type: event
  event_subject: agog.vendors.new_application

nodes:
  - id: compliance_review
    type: approval
    name: Compliance Document Review
    approver_role: compliance_officer
    sla_hours: 48

  - id: finance_review
    type: approval
    name: Finance Terms Approval
    approver_role: finance_manager
    sla_hours: 24

  - id: procurement_review
    type: approval
    name: Procurement Contract Review
    approver_role: procurement_manager
    sla_hours: 24
    approval_logic: PARALLEL  # Finance and Procurement can happen in parallel

  - id: create_vendor_account
    type: service_task
    name: Create Vendor Portal Account
    service_type: database_query
    service_config:
      query: INSERT INTO vendors (...)

  - id: notify_vendor
    type: service_task
    name: Send Welcome Email
    service_type: email_send
    service_config:
      template: vendor_welcome
      to_field: vendor_email

routes:
  - from: compliance_review
    to: finance_review
  - from: finance_review
    to: procurement_review
  - from: procurement_review
    to: create_vendor_account
  - from: create_vendor_account
    to: notify_vendor
```

### 10.2 References

**Internal Documentation:**
- `backend/src/modules/procurement/services/approval-workflow.service.ts`
- `agent-backend/src/orchestration/strategic-orchestrator.service.ts`
- `backend/migrations/V0.0.38__add_po_approval_workflow.sql`
- `backend/migrations/V0.0.14__create_workflow_state_table.sql`

**External References:**
- [Camunda BPMN 2.0 Implementation Reference](https://docs.camunda.org/manual/latest/reference/bpmn20/)
- [Temporal Workflow Patterns](https://docs.temporal.io/workflows)
- [PostgreSQL Row Level Security](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [NATS JetStream Patterns](https://docs.nats.io/nats-concepts/jetstream)

---

**END OF RESEARCH REPORT**

---

## Deliverable Metadata

```json
{
  "agent": "cynthia",
  "req_number": "REQ-STRATEGIC-AUTO-1767108044309",
  "status": "COMPLETE",
  "deliverable_type": "research",
  "key_findings": [
    "Existing PO approval workflow provides 80% of needed infrastructure",
    "Agent orchestration system demonstrates event-driven workflow capabilities",
    "Generalization of existing systems more cost-effective than commercial tools",
    "Visual workflow designer is critical gap for business user adoption",
    "Print industry workflows (estimating, preflight, vendor onboarding) have no automation"
  ],
  "recommendations": [
    "Build custom workflow engine extending existing approval workflow service",
    "Implement generic WorkflowDefinition and WorkflowInstance tables",
    "Create node execution engine supporting approval, service task, user task, gateway, sub-workflow nodes",
    "Build GraphQL API for workflow CRUD and task assignment",
    "Defer visual designer to Phase 3 after core engine proven"
  ],
  "estimated_complexity": "HIGH",
  "estimated_duration": "8-12 weeks for full implementation",
  "dependencies": [
    "Requires PostgreSQL 14+ (for JSONB improvements)",
    "Requires NATS JetStream (already deployed)",
    "Requires React Flow library for visual designer (Phase 3)"
  ],
  "risks": [
    "Performance degradation with large workflows - mitigate with archival",
    "Low user adoption - mitigate with template library and training",
    "Workflow definition errors - mitigate with validation engine"
  ]
}
```
