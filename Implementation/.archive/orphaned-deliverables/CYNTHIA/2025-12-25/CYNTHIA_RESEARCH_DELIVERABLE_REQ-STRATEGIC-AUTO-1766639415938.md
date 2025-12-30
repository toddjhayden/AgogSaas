# Research Deliverable: PO Approval Workflow
## REQ-STRATEGIC-AUTO-1766639415938

**Agent**: Cynthia (Research Specialist)
**Date**: 2025-12-26
**Status**: COMPLETE
**Priority**: High
**Assigned To**: Marcus (Implementation Lead)

---

## Executive Summary

This research deliverable provides a comprehensive analysis of the Purchase Order (PO) Approval Workflow requirements for the AGOG Print Industry ERP system. The analysis reveals that while the system has a **solid foundation** with existing PO management infrastructure, it currently implements only a **basic single-step approval workflow**. To meet enterprise requirements, a **multi-tier, rule-based approval workflow** system is needed.

### Key Findings

1. **Existing Infrastructure**: Complete PO data models, GraphQL API, and frontend pages exist
2. **Current Approval**: Single-step binary approval (approved/not approved) with user attribution
3. **Gap Analysis**: No multi-step chains, role-based routing, threshold-based automation, or audit trails
4. **Industry Standards**: 2025 best practices emphasize AI-assisted risk scoring, automated routing, and mobile approvals
5. **Technical Architecture**: State machine pattern recommended for workflow management

---

## 1. Current State Analysis

### 1.1 Database Schema

#### Purchase Orders Table (`purchase_orders`)
**Location**: `print-industry-erp/backend/migrations/V0.0.6__create_sales_materials_procurement.sql:391`

**Key Approval-Related Fields**:
```sql
requires_approval BOOLEAN DEFAULT FALSE
approved_by_user_id UUID REFERENCES users(id)
approved_at TIMESTAMPTZ
status VARCHAR(20) DEFAULT 'DRAFT'
```

**Status Enum Values**:
- DRAFT
- ISSUED
- ACKNOWLEDGED
- PARTIALLY_RECEIVED
- RECEIVED
- CLOSED
- CANCELLED

**Current Limitations**:
- ❌ No multi-step approval support
- ❌ No approval workflow state tracking
- ❌ No approval threshold configuration
- ❌ No delegation or escalation tracking
- ❌ No approval history/audit trail
- ✅ Multi-tenant isolation via `tenant_id`
- ✅ Facility-level routing via `facility_id`, `ship_to_facility_id`

#### YAML Schema Definition
**Location**: `print-industry-erp/backend/data-models/schemas/procurement/purchase-order.yaml`

Defines additional status values not in SQL:
- `pending_approval` (line 83)
- `approved` (line 84)
- `sent_to_vendor` (line 85)

**Approval Fields** (lines 144-159):
```yaml
requested_by: uuid (FK users.id)
approved_by: uuid (FK users.id)
approved_at: timestamp
```

### 1.2 GraphQL API

#### Schema Definition
**Location**: `print-industry-erp/backend/src/graphql/schema/sales-materials.graphql:367-426`

**PurchaseOrder Type** (lines 367-426):
```graphql
type PurchaseOrder {
  id: ID!
  tenantId: ID!
  facilityId: ID!
  # ... header fields ...
  status: PurchaseOrderStatus!
  requiresApproval: Boolean!
  approvedByUserId: ID
  approvedAt: DateTime
  # ... other fields ...
}

enum PurchaseOrderStatus {
  DRAFT
  ISSUED
  ACKNOWLEDGED
  PARTIALLY_RECEIVED
  RECEIVED
  CLOSED
  CANCELLED
}
```

**Mutations** (lines 1434-1451):
```graphql
createPurchaseOrder(
  tenantId: ID!
  facilityId: ID!
  vendorId: ID!
  purchaseOrderDate: Date!
  poCurrencyCode: String!
  totalAmount: Float!
): PurchaseOrder!

updatePurchaseOrder(
  id: ID!
  status: PurchaseOrderStatus
  promisedDeliveryDate: Date
): PurchaseOrder!

approvePurchaseOrder(id: ID!, approvedByUserId: ID!): PurchaseOrder!
receivePurchaseOrder(id: ID!, receiptDetails: JSON!): PurchaseOrder!
closePurchaseOrder(id: ID!): PurchaseOrder!
```

**Current Approval Mutation**: Simple single-step approval that sets `approved_by_user_id` and `approved_at` timestamp.

### 1.3 Backend Resolver

#### Resolver Implementation
**Location**: `print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts`

**Key Implementation Details**:
- Direct PostgreSQL pool queries with NestJS GraphQL decorators
- No validation of user permissions for approval
- No workflow state management
- No approval routing logic
- Basic tenant validation via security utilities

**Approval Mutation Pattern**:
```typescript
@Mutation('approvePurchaseOrder')
async approvePurchaseOrder(
  @Args('id') id: string,
  @Args('approvedByUserId') approvedByUserId: string,
  @Context() context: any
) {
  // Updates PO with:
  // - approved_by_user_id
  // - approved_at (current timestamp)
  // - status change (DRAFT -> next appropriate state)
}
```

### 1.4 Frontend Implementation

#### Purchase Orders List Page
**Location**: `print-industry-erp/frontend/src/pages/PurchaseOrdersPage.tsx`

**Features**:
- Query: `GET_PURCHASE_ORDERS` with filters (status, date range)
- Summary cards: Total Orders, Pending Approval, Received, Total Value
- Status filtering dropdown
- Data table with sortable columns
- Links to detail pages

#### Purchase Order Detail Page
**Location**: `print-industry-erp/frontend/src/pages/PurchaseOrderDetailPage.tsx`

**Current Approval UI**:
- Alert when `requiresApproval=true` and not yet approved
- **Approve button** (visible when DRAFT + requires_approval=true + not approved)
- Approval modal confirmation dialog
- Uses `APPROVE_PURCHASE_ORDER` mutation

**Action Buttons** (context-sensitive):
- Approve (when conditions met)
- Issue (when approved but not yet issued)
- Close (when status=RECEIVED)
- Print & Export PDF

### 1.5 Security & Authorization

#### Tenant Validation
**Location**: `print-industry-erp/backend/src/common/security/tenant-validation.ts`

**Key Functions**:
```typescript
validateTenantAccess(context, requestedTenantId)
getTenantIdFromContext(context)
getUserIdFromContext(context)
```

**Security Checks**:
- ✅ Multi-tenant isolation enforced
- ✅ JWT-based authentication required
- ✅ Tenant mismatch throws `ForbiddenException`
- ❌ No role-based access control (RBAC) for approvals
- ❌ No permission checks on approve mutation
- ❌ All authenticated users can approve any PO

**Current User/Role Structure**:
- References to `roles`, `permissions`, `security_clearance_level` exist
- RBAC structure defined but **not enforced in approval workflow**

### 1.6 Related Systems

#### Vendor Performance Service
**Location**: `print-industry-erp/backend/src/modules/procurement/services/vendor-performance.service.ts`

- Calculates vendor metrics from PO and receipt data
- Uses PO status and dates for delivery performance tracking
- No direct integration with approval workflow

#### Workflow State Persistence
**Location**: `print-industry-erp/backend/migrations/V0.0.14__create_workflow_state_table.sql`

**Purpose**: Persist orchestrator workflow state (agent/daemon workflows)
**Note**: This is for **agent orchestration**, NOT PO approval workflows

---

## 2. Gap Analysis

### 2.1 Missing Workflow Capabilities

| Capability | Current State | Required State |
|-----------|---------------|----------------|
| **Approval Steps** | Single-step only | Multi-step sequential chains |
| **Approval Routing** | Manual assignment | Automatic role/threshold-based routing |
| **Delegation** | Not supported | Support for delegation to others |
| **Escalation** | Not supported | Time-based escalation rules |
| **Parallel Approvals** | Not supported | Multiple concurrent approvers |
| **Conditional Logic** | Binary flag only | Amount, vendor, category-based rules |
| **Audit Trail** | Limited (single approver) | Complete approval history with timestamps |
| **Notifications** | None | Email/mobile notifications per step |
| **SLA Tracking** | None | Per-step SLA monitoring |
| **Auto-Approval** | None | Threshold-based auto-approval |

### 2.2 Missing Business Logic

1. **Threshold-Based Routing**:
   - No amount-based approval levels (e.g., <$5k, $5k-$25k, >$25k)
   - No vendor-specific approval requirements
   - No category-based routing (IT, CAPEX, services)

2. **Role-Based Approval**:
   - No approval based on user roles/permissions
   - No department/cost center approval routing
   - No finance/legal approval triggers

3. **Risk-Based Approval**:
   - No new vendor checks
   - No off-contract item detection
   - No split PO detection

4. **CAPEX vs OPEX Routing**:
   - No differentiation between capital and operational expenses
   - No investment committee routing for CAPEX

### 2.3 Missing Data Structures

**Required Tables/Structures**:

1. **Approval Workflow Definitions**: Template/configuration for approval rules
2. **Approval Thresholds**: Amount-based routing configuration
3. **Approval Step Instances**: Track individual approval steps for each PO
4. **Approval History**: Complete audit trail of all approval actions
5. **Approval Delegation**: Track who delegated to whom
6. **Approval SLAs**: Per-role/step SLA configuration
7. **Approval Notifications**: Notification templates and delivery tracking

---

## 3. Industry Best Practices (2025)

### 3.1 Core Best Practices

Based on current industry research, modern PO approval workflows should include:

#### 1. Clear Approval Hierarchies
- **Amount Bands**:
  - ≤$5k: Budget owner
  - $5k–$25k: Budget owner + director
  - >$25k: Add finance approval
- **Department/Cost Center**: Route based on organizational structure
- **Category Type**: Different rules for IT, services, CAPEX
- **Vendor Relationships**: New vendors require additional approval

#### 2. Workflow Automation
- **Auto-routing**: Automatic routing to appropriate approvers based on hierarchy
- **Exception Handling**: Flag exceptions for manual review
- **Straight-Through Processing**: Auto-approve low-risk, policy-compliant requests
- **Parallel Processing**: Multiple approvers can review simultaneously

#### 3. ERP Integration Patterns
Modern 2025 pattern: **Workflow-first, then ERP**
- Run decisioning in workflow layer (chat/web)
- Create PO in ERP **only after approval**
- Result: Clean, policy-vetted orders in ledger
- Capture all request/review documents in workflow before ERP creation

#### 4. AI and Risk Scoring (2025 Innovation)
- **Statistical Risk Signals**:
  - Unusual supplier patterns
  - Line-item anomalies vs category norms
  - Late delivery risk from prior receipts
- **Smart Auto-Approval**: Only when risk is low AND policy is met
- **Trigger Signals**: New vendor, off-contract item, split POs automatically trigger stricter review

#### 5. CAPEX vs OPEX Differentiation
- **CAPEX Requirements**:
  - Investment Committee/PMO approval
  - Asset tag requirement
  - Mandatory GRN or service acceptance before payment
- **OPEX Routing**: Standard approval chain
- **SaaS Renewals**: Contract-aware checks

#### 6. Multi-Channel Approvals
- **Mobile Approvals**: Speed up approval cycles
- **Email Approvals**: Approve from inbox
- **Automatic Reminders**: Keep requests flowing
- **Escalation Rules**: Auto-escalate stalled approvals

#### 7. Key Performance Indicators
**Essential Metrics**:
- Approval cycle time (target: <24-48 hours)
- Policy compliance rate (target: >95%)
- Rework rate (target: <5%)
- Straight-through approval rate
- Exception rate
- SLA adherence per role/step

### 3.2 State Machine Implementation Pattern

**Recommended Approach**: Finite State Machine (FSM) for approval workflows

**State Definitions**:
```
DRAFT → PENDING_APPROVAL_L1 → PENDING_APPROVAL_L2 → PENDING_APPROVAL_L3
  → APPROVED → ISSUED → ACKNOWLEDGED → PARTIALLY_RECEIVED → RECEIVED → CLOSED

Alternative paths:
  → REJECTED → (return to DRAFT or CANCELLED)
  → CANCELLED
```

**Benefits of State Machine Pattern**:
1. **Clear State Transitions**: Each state has defined entry/exit rules
2. **Validation**: Prevent invalid state transitions
3. **Audit Trail**: Track all state changes with timestamps
4. **Event-Driven**: React to events (approval, rejection, timeout)
5. **Extensibility**: Easy to add new states/transitions

**Implementation Considerations**:
- Store current state in `purchase_orders.status`
- Store workflow instance state in `approval_workflow_instances` table
- Track individual step completions in `approval_steps` table
- Use triggers/events for state transitions
- Log all transitions in audit table

---

## 4. Technical Architecture Recommendations

### 4.1 Database Schema Enhancements

#### 4.1.1 New Tables Required

**1. `approval_workflow_templates`**
```sql
CREATE TABLE approval_workflow_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Template identification
    template_code VARCHAR(50) NOT NULL,
    template_name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Workflow type
    workflow_type VARCHAR(50) NOT NULL,
    -- PURCHASE_ORDER, QUOTE, SALES_ORDER, VENDOR_APPROVAL, etc.

    -- Template configuration (JSONB for flexibility)
    approval_steps JSONB NOT NULL,
    -- [{step: 1, role: 'BUDGET_OWNER', sla_hours: 24},
    --  {step: 2, role: 'DIRECTOR', sla_hours: 48}, ...]

    -- Routing rules (JSONB)
    routing_rules JSONB,
    -- {amount_thresholds: [{max: 5000, steps: [1]},
    --                       {min: 5001, max: 25000, steps: [1,2]},
    --                       {min: 25001, steps: [1,2,3]}],
    --  vendor_type: {NEW: true, EXISTING: false},
    --  category: {CAPEX: [1,2,3,4], OPEX: [1,2]}}

    -- Auto-approval rules
    auto_approval_enabled BOOLEAN DEFAULT FALSE,
    auto_approval_max_amount DECIMAL(18,4),
    auto_approval_conditions JSONB,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES users(id),

    CONSTRAINT uq_workflow_template_code UNIQUE (tenant_id, template_code)
);
```

**2. `approval_workflow_instances`**
```sql
CREATE TABLE approval_workflow_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Workflow linkage
    template_id UUID NOT NULL REFERENCES approval_workflow_templates(id),

    -- Entity linkage (polymorphic)
    entity_type VARCHAR(50) NOT NULL,
    -- PURCHASE_ORDER, QUOTE, SALES_ORDER, etc.
    entity_id UUID NOT NULL,

    -- Workflow state
    current_step INTEGER NOT NULL DEFAULT 1,
    total_steps INTEGER NOT NULL,
    workflow_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING, IN_PROGRESS, APPROVED, REJECTED, CANCELLED, EXPIRED

    -- Initiator
    initiated_by UUID NOT NULL REFERENCES users(id),
    initiated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Completion
    completed_at TIMESTAMPTZ,
    completion_reason TEXT,

    -- SLA tracking
    sla_deadline TIMESTAMPTZ,
    is_sla_breached BOOLEAN DEFAULT FALSE,

    -- Notes
    notes TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_instances_entity ON approval_workflow_instances(entity_type, entity_id);
CREATE INDEX idx_approval_instances_status ON approval_workflow_instances(workflow_status);
CREATE INDEX idx_approval_instances_sla ON approval_workflow_instances(sla_deadline)
    WHERE is_sla_breached = FALSE AND workflow_status IN ('PENDING', 'IN_PROGRESS');
```

**3. `approval_steps`**
```sql
CREATE TABLE approval_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Workflow instance
    workflow_instance_id UUID NOT NULL REFERENCES approval_workflow_instances(id),

    -- Step configuration
    step_number INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    required_role VARCHAR(100),
    -- BUDGET_OWNER, DIRECTOR, CFO, LEGAL, PROCUREMENT_MANAGER, etc.

    -- Approver assignment
    assigned_to_user_id UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ,

    -- Delegation
    delegated_to_user_id UUID REFERENCES users(id),
    delegated_by_user_id UUID REFERENCES users(id),
    delegated_at TIMESTAMPTZ,
    delegation_reason TEXT,

    -- Step status
    step_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    -- PENDING, IN_PROGRESS, APPROVED, REJECTED, DELEGATED, ESCALATED, SKIPPED

    -- Decision
    decision VARCHAR(20),
    -- APPROVE, REJECT, REQUEST_INFO, DELEGATE
    decision_by_user_id UUID REFERENCES users(id),
    decision_at TIMESTAMPTZ,
    decision_comments TEXT,

    -- SLA
    sla_hours INTEGER,
    sla_deadline TIMESTAMPTZ,
    is_sla_breached BOOLEAN DEFAULT FALSE,

    -- Escalation
    escalated BOOLEAN DEFAULT FALSE,
    escalated_to_user_id UUID REFERENCES users(id),
    escalated_at TIMESTAMPTZ,
    escalation_reason TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ
);

CREATE INDEX idx_approval_steps_workflow ON approval_steps(workflow_instance_id);
CREATE INDEX idx_approval_steps_assignee ON approval_steps(assigned_to_user_id, step_status);
CREATE INDEX idx_approval_steps_sla ON approval_steps(sla_deadline)
    WHERE is_sla_breached = FALSE AND step_status = 'PENDING';
```

**4. `approval_history`**
```sql
CREATE TABLE approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Workflow linkage
    workflow_instance_id UUID NOT NULL REFERENCES approval_workflow_instances(id),
    approval_step_id UUID REFERENCES approval_steps(id),

    -- Action details
    action_type VARCHAR(50) NOT NULL,
    -- INITIATED, ASSIGNED, APPROVED, REJECTED, DELEGATED, ESCALATED,
    -- CANCELLED, EXPIRED, COMPLETED, COMMENT_ADDED

    action_by_user_id UUID REFERENCES users(id),
    action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Previous and new values
    previous_state VARCHAR(50),
    new_state VARCHAR(50),

    -- Action details
    comments TEXT,
    metadata JSONB,
    -- Store additional context like IP address, device info, etc.

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_history_workflow ON approval_history(workflow_instance_id);
CREATE INDEX idx_approval_history_user ON approval_history(action_by_user_id);
CREATE INDEX idx_approval_history_action_at ON approval_history(action_at DESC);
```

**5. `approval_thresholds`**
```sql
CREATE TABLE approval_thresholds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Threshold configuration
    threshold_name VARCHAR(255) NOT NULL,
    threshold_type VARCHAR(50) NOT NULL,
    -- AMOUNT, VENDOR_TYPE, CATEGORY, DEPARTMENT, CAPEX_OPEX

    -- Amount thresholds
    min_amount DECIMAL(18,4),
    max_amount DECIMAL(18,4),
    currency_code VARCHAR(3) DEFAULT 'USD',

    -- Category/type filters
    category_filter VARCHAR(100),
    vendor_type_filter VARCHAR(50),
    material_type_filter VARCHAR(50),

    -- Required approval levels
    required_approval_steps JSONB NOT NULL,
    -- [{role: 'BUDGET_OWNER', sla_hours: 24},
    --  {role: 'DIRECTOR', sla_hours: 48}]

    -- Auto-approval
    allow_auto_approval BOOLEAN DEFAULT FALSE,
    auto_approval_conditions JSONB,

    -- Priority
    priority INTEGER DEFAULT 10,
    -- Lower number = higher priority when multiple thresholds match

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Effective dating
    effective_from DATE NOT NULL,
    effective_to DATE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    updated_at TIMESTAMPTZ,
    updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_approval_thresholds_tenant ON approval_thresholds(tenant_id);
CREATE INDEX idx_approval_thresholds_type ON approval_thresholds(threshold_type);
CREATE INDEX idx_approval_thresholds_active ON approval_thresholds(is_active);
CREATE INDEX idx_approval_thresholds_dates ON approval_thresholds(effective_from, effective_to);
```

**6. `approval_notifications`**
```sql
CREATE TABLE approval_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Workflow linkage
    workflow_instance_id UUID NOT NULL REFERENCES approval_workflow_instances(id),
    approval_step_id UUID REFERENCES approval_steps(id),

    -- Notification type
    notification_type VARCHAR(50) NOT NULL,
    -- APPROVAL_REQUESTED, APPROVAL_REMINDER, APPROVAL_ESCALATION,
    -- APPROVAL_APPROVED, APPROVAL_REJECTED, APPROVAL_COMPLETED

    -- Recipient
    recipient_user_id UUID NOT NULL REFERENCES users(id),
    recipient_email VARCHAR(255),

    -- Notification channels
    sent_via_email BOOLEAN DEFAULT FALSE,
    sent_via_sms BOOLEAN DEFAULT FALSE,
    sent_via_push BOOLEAN DEFAULT FALSE,

    -- Delivery status
    sent_at TIMESTAMPTZ,
    delivery_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, SENT, DELIVERED, FAILED, BOUNCED

    delivery_error TEXT,

    -- Click tracking
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,

    -- Notification content
    subject VARCHAR(500),
    message TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_approval_notifications_workflow ON approval_notifications(workflow_instance_id);
CREATE INDEX idx_approval_notifications_recipient ON approval_notifications(recipient_user_id);
CREATE INDEX idx_approval_notifications_status ON approval_notifications(delivery_status);
```

#### 4.1.2 Modifications to Existing Tables

**`purchase_orders` table modifications**:
```sql
-- Add new columns for workflow integration
ALTER TABLE purchase_orders ADD COLUMN approval_workflow_instance_id UUID
    REFERENCES approval_workflow_instances(id);

ALTER TABLE purchase_orders ADD COLUMN approval_workflow_status VARCHAR(20);
-- DRAFT, PENDING_APPROVAL, APPROVED, REJECTED

-- Keep existing columns for backward compatibility
-- requires_approval BOOLEAN
-- approved_by_user_id UUID
-- approved_at TIMESTAMPTZ
```

**Migration Strategy**:
- Keep existing approval fields for backward compatibility
- New POs use workflow system via `approval_workflow_instance_id`
- Legacy POs continue to use `approved_by_user_id` / `approved_at`

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Deliverables**:
1. Database schema creation (all 6 new tables)
2. Basic workflow service layer
3. GraphQL schema and resolvers for workflow types
4. Unit tests for core workflow logic

**Tasks**:
- Create migration scripts for new tables
- Implement `ApprovalWorkflowService` with basic CRUD
- Implement `ApprovalRoutingService` with simple threshold logic
- Create GraphQL types and basic queries/mutations
- Write unit tests (>80% coverage target)

**Acceptance Criteria**:
- All tables created successfully
- Can create workflow template
- Can initiate workflow instance
- Can approve/reject single step
- All tests passing

### Phase 2: Routing & Thresholds (Weeks 3-4)

**Deliverables**:
1. Threshold evaluation engine
2. Automated routing based on amount/category/vendor
3. Auto-approval logic
4. Integration with PO creation flow

**Tasks**:
- Implement threshold matching algorithm
- Build routing decision tree
- Add auto-approval logic
- Integrate with existing PO mutations
- Create threshold administration UI

**Acceptance Criteria**:
- Correct threshold selection based on PO amount
- Auto-approval works for qualified POs
- Manual approval workflow initiates for POs above threshold
- Can configure thresholds via admin UI

### Phase 3: Advanced Features (Weeks 5-6)

**Deliverables**:
1. Delegation support
2. Escalation rules
3. Parallel approvals
4. SLA monitoring
5. Approval history/audit trail

**Tasks**:
- Implement delegation mechanism
- Build escalation service with scheduled jobs
- Add parallel approval step support
- Create SLA monitoring daemon
- Build comprehensive audit trail

**Acceptance Criteria**:
- Can delegate approval to another user
- Auto-escalation triggers after SLA breach
- Parallel approvals work correctly (all must approve)
- SLA deadlines calculated and monitored
- Complete audit trail captured

### Phase 4: Notifications & UX (Weeks 7-8)

**Deliverables**:
1. Email notification system
2. My Approvals dashboard (frontend)
3. Workflow tracker page (frontend)
4. Mobile-optimized approval UI
5. Real-time updates

**Tasks**:
- Integrate email service
- Create HTML email templates
- Build My Approvals page with filters
- Create workflow tracker with stepper component
- Implement real-time status updates
- Mobile-responsive design

**Acceptance Criteria**:
- Emails sent for all approval events
- Users can view pending approvals
- Can approve/reject from web UI
- Workflow progress visible in tracker
- Real-time status updates work

---

## 6. Success Criteria

**Project considered successful when**:

1. ✅ All 6 database tables created and integrated
2. ✅ Multi-step approval workflows operational
3. ✅ Threshold-based routing working correctly
4. ✅ Auto-approval reduces manual workload by 30%+
5. ✅ SLA compliance >95%
6. ✅ Approval cycle time <48 hours median
7. ✅ Users can approve from web UI and email
8. ✅ Complete audit trail captured for all approvals
9. ✅ Admin can configure workflows and thresholds
10. ✅ >85% test coverage achieved

---

## 7. References & Research Sources

### Industry Best Practices Sources:

1. [PO Approval Workflow with AI - ApproveIt (2025)](https://approveit.today/blog/purchase-order-approval-workflow-with-ai-rules-thresholds-templates-(2025))
2. [Top 7 Purchase Order Management Best Practices 2025 - Invensis](https://www.invensis.net/blog/purchase-order-management-best-practices)
3. [Build a better purchase order approval workflow - Stampli](https://www.stampli.com/blog/accounts-payable/purchase-order-approval-workflow/)
4. [Purchase order approval workflow: A guide to getting audit-ready - Moxo](https://www.moxo.com/blog/purchase-order-approval-workflows)
5. [The essential guide to purchase order approvals & workflows - Zip HQ](https://ziphq.com/blog/the-essential-guide-to-purchase-order-approvals-and-workflows-at-fast-growing-companies)
6. [Ultimate Guide to Purchase Order Approval Process for 2026 - GEP Blog](https://www.gep.com/blog/strategy/purchase-order-approval-process-guide)
7. [Complete Guide To Purchase Order Approval Process 2025 - Cflow](https://www.cflowapps.com/purchase-order-approval-process/)

### State Machine Implementation Sources:

8. [Simplifying Approval Process with State Machine - Medium](https://medium.com/@wacsk19921002/simplifying-approval-process-with-state-machine-a-practical-guide-part-1-modeling-26d8999002b0)
9. [Workflow Engine vs. State Machine](https://workflowengine.io/blog/workflow-engine-vs-state-machine/)
10. [How to set up Multi-tier Approval Workflows - EZOfficeInventory](https://ezo.io/ezofficeinventory/blog/multi-tier-approval/)

---

## 8. Next Steps for Implementation Team

### For Marcus (Implementation Lead):

1. **Review & Approve Architecture**: Review this document and propose any modifications
2. **Prioritize Features**: Decide which features are MVP vs future enhancements
3. **Estimate Effort**: Provide development estimates for each phase
4. **Team Assignment**: Assign developers to frontend/backend/database tasks
5. **Sprint Planning**: Break down Phase 1 into 2-week sprint tasks

### Recommended Approach:

1. **Start with Database**: Create all 6 tables in development environment
2. **Build Core Service**: Implement basic `ApprovalWorkflowService` with CRUD operations
3. **Add Routing Logic**: Implement threshold evaluation and routing
4. **Integrate with PO**: Modify PO creation to trigger workflows
5. **Build Frontend**: Create "My Approvals" page for users
6. **Iterate**: Add advanced features (delegation, escalation, notifications) incrementally

---

**END OF DELIVERABLE**

This comprehensive research deliverable provides Marcus and the implementation team with everything needed to build a robust, enterprise-grade PO Approval Workflow system following 2025 industry best practices.
