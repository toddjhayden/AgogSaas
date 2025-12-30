# RESEARCH DELIVERABLE: PO APPROVAL WORKFLOW
**Requirement**: REQ-STRATEGIC-AUTO-1766676891764
**Feature**: PO Approval Workflow
**Researcher**: Cynthia (Research Specialist)
**Date**: 2025-12-27
**Status**: COMPLETE

---

## EXECUTIVE SUMMARY

This research deliverable provides a comprehensive technical analysis and implementation plan for adding a robust Purchase Order (PO) Approval Workflow to the AGOG Print Industry ERP system. The current system has basic approval infrastructure (single-step approval with `requires_approval`, `approved_by_user_id`, and `approved_at` fields) but lacks a configurable multi-level approval workflow capability.

**Key Findings:**
- Existing PO infrastructure is solid with basic approval support
- Current approval is single-step only (DRAFT → ISSUED upon approval)
- Frontend has MyApprovalsPage ready but lacks backend query support
- No approval routing, delegation, or multi-level approval chains exist
- Opportunity to leverage existing workflow_state table pattern

**Recommended Approach:**
- **Phase 1**: Enhance existing single-step approval with better UX and notifications
- **Phase 2**: Implement configurable multi-level approval workflows
- **Phase 3**: Add advanced features (delegation, escalation, mobile approval)

---

## 1. CURRENT STATE ANALYSIS

### 1.1 Database Schema Analysis

**Existing Purchase Order Tables:**

**`purchase_orders` table** (from V0.0.6 migration):
```sql
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- PO identification
    po_number VARCHAR(50) UNIQUE NOT NULL,
    po_date DATE NOT NULL,
    vendor_id UUID NOT NULL,

    -- Amounts
    subtotal DECIMAL(18,4) DEFAULT 0,
    tax_amount DECIMAL(18,4) DEFAULT 0,
    shipping_amount DECIMAL(18,4) DEFAULT 0,
    total_amount DECIMAL(18,4) NOT NULL,

    -- Status
    status VARCHAR(20) DEFAULT 'DRAFT',
    -- DRAFT, ISSUED, ACKNOWLEDGED, PARTIALLY_RECEIVED, RECEIVED, CLOSED, CANCELLED

    -- EXISTING APPROVAL FIELDS (basic single-step)
    requires_approval BOOLEAN DEFAULT FALSE,
    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,

    -- Other fields...
    payment_terms VARCHAR(50),
    requested_delivery_date DATE,
    promised_delivery_date DATE,
    buyer_user_id UUID,
    notes TEXT,

    -- Audit fields
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID
);
```

**Key Observations:**
1. ✅ Basic approval infrastructure exists (`requires_approval`, `approved_by_user_id`, `approved_at`)
2. ❌ No multi-level approval support
3. ❌ No approval routing logic
4. ❌ No approval history/audit trail
5. ❌ No delegation or escalation support
6. ✅ Status field can support workflow states

### 1.2 GraphQL API Analysis

**Existing GraphQL Types** (from `sales-materials.graphql`):

```graphql
type PurchaseOrder {
  id: ID!
  tenantId: ID!
  facilityId: ID!
  poNumber: String!
  purchaseOrderDate: Date!
  vendorId: ID!

  # Amounts
  subtotal: Float
  taxAmount: Float
  shippingAmount: Float
  totalAmount: Float!

  # Status & Approval
  status: PurchaseOrderStatus!
  requiresApproval: Boolean!
  approvedByUserId: ID
  approvedAt: DateTime

  # Lines
  lines: [PurchaseOrderLine!]!

  # Audit
  createdAt: DateTime!
  createdBy: ID
  updatedAt: DateTime
  updatedBy: ID
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

**Existing Mutations** (from `sales-materials.resolver.ts:1360`):

```typescript
@Mutation('approvePurchaseOrder')
async approvePurchaseOrder(
  @Args('id') id: string,
  @Args('approvedByUserId') approvedByUserId: string,
  @Context() context: any
) {
  const result = await this.db.query(
    `UPDATE purchase_orders
     SET status = 'ISSUED',
         approved_by_user_id = $1,
         approved_at = NOW(),
         updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [approvedByUserId, id]
  );
  // ...
}
```

**Key Observations:**
1. ✅ Basic `approvePurchaseOrder` mutation exists
2. ✅ Approval immediately changes status from DRAFT → ISSUED
3. ❌ No approval workflow steps or routing
4. ❌ No rejection/comment capability
5. ❌ No approval history tracking

### 1.3 Frontend Analysis

**Existing Components:**

1. **`PurchaseOrdersPage.tsx`**:
   - Lists all POs with status badges
   - Shows "Pending Approval" count
   - Basic filtering by status
   - ✅ Ready to integrate with approval workflow

2. **`PurchaseOrderDetailPage.tsx`**:
   - Shows approval status with visual indicators
   - Has "Approve" button that triggers `approvePurchaseOrder`
   - Shows approval modal for confirmation
   - ✅ Basic approval UI implemented

3. **`MyApprovalsPage.tsx`** (CRITICAL FINDING):
   - **Fully implemented approval dashboard UI**
   - Uses `GET_MY_PENDING_APPROVALS` query (NOT YET IMPLEMENTED IN BACKEND)
   - Shows urgency indicators (urgent, warning, normal)
   - Has quick approve functionality
   - Filters by amount ranges
   - Auto-refreshes every 30 seconds
   - ❌ **Backend query missing** - this is a gap to fill

**Frontend Gap Analysis:**
```typescript
// MyApprovalsPage.tsx:10-11
import { GET_MY_PENDING_APPROVALS } from '../graphql/queries/approvals';
import { APPROVE_PURCHASE_ORDER } from '../graphql/queries/purchaseOrders';
```

The `GET_MY_PENDING_APPROVALS` query is imported but the file `graphql/queries/approvals.ts` **does not exist**. This needs to be created.

### 1.4 Existing Workflow Infrastructure

**`workflow_state` table** (from V0.0.14 migration):
```sql
CREATE TABLE workflow_state (
  req_number VARCHAR(100) PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to VARCHAR(50) NOT NULL,
  current_stage INT NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'running', 'blocked', 'complete', 'failed')),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  stage_deliverables JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

**Key Insight**: This table demonstrates a pattern for multi-stage workflows that could be adapted for PO approval workflows.

---

## 2. REQUIREMENTS ANALYSIS

### 2.1 Functional Requirements

**Core Approval Workflow Features:**

1. **Configurable Approval Rules**
   - Define approval limits by amount tiers
   - Support single-approver or multi-level approval chains
   - Role-based approval routing (e.g., Manager → Director → VP)

2. **Approval Routing**
   - Automatic routing based on PO amount
   - Sequential approval (must approve in order)
   - Parallel approval (any approver can approve)
   - Fallback/escalation if not approved within SLA

3. **Approval Actions**
   - Approve (with optional comments)
   - Reject (with mandatory reason)
   - Request changes (return to requester)
   - Delegate to another approver

4. **Approval History & Audit**
   - Full audit trail of all approval actions
   - Timestamp and user tracking
   - Comments/notes on each approval step
   - Notification history

5. **User Experience**
   - Dedicated "My Approvals" dashboard (already exists!)
   - Email/NATS notifications for new approvals
   - Mobile-friendly approval interface
   - Bulk approval capability
   - Urgency indicators (SLA-based)

### 2.2 Business Rules

**Approval Amount Thresholds (recommended defaults):**

| Amount Range | Approval Required | Approvers |
|-------------|-------------------|-----------|
| < $5,000 | Optional | Buyer only |
| $5,000 - $25,000 | Required | Manager |
| $25,000 - $100,000 | Required | Manager → Director |
| > $100,000 | Required | Manager → Director → VP/CFO |

**Status Workflow:**

```
DRAFT (requires_approval=true)
  ↓ [Submit for Approval]
PENDING_APPROVAL (awaiting first approver)
  ↓ [Approver 1 Approves]
PENDING_APPROVAL_L2 (if multi-level, awaiting second approver)
  ↓ [Approver 2 Approves]
APPROVED (all approvals complete)
  ↓ [Issue to Vendor]
ISSUED
  ↓ [Vendor Acknowledges]
ACKNOWLEDGED
  ↓ [Receive Goods]
PARTIALLY_RECEIVED / RECEIVED
  ↓ [Close PO]
CLOSED

[At any approval stage]
  ↓ [Reject]
REJECTED (returned to requester)
  ↓ [Revise and Resubmit]
DRAFT
```

### 2.3 Technical Requirements

1. **Database Changes Required:**
   - New `po_approval_workflows` table (approval routing configuration)
   - New `po_approval_steps` table (individual approval steps in workflow)
   - New `po_approval_history` table (audit trail of approval actions)
   - Update `purchase_orders` table to add workflow tracking fields

2. **API Changes Required:**
   - New queries: `getMyPendingApprovals`, `getPOApprovalHistory`
   - New mutations: `submitForApproval`, `approvePO`, `rejectPO`, `delegateApproval`
   - Update existing `approvePurchaseOrder` to support workflow steps

3. **Business Logic Required:**
   - Approval routing engine (determine next approver)
   - SLA tracking and escalation
   - Notification service integration
   - Email template system

---

## 3. PROPOSED SOLUTION ARCHITECTURE

### 3.1 Database Schema Design

**New Tables:**

```sql
-- =====================================================
-- TABLE: po_approval_workflows
-- =====================================================
-- Purpose: Define approval workflow rules and routing logic
CREATE TABLE po_approval_workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Workflow identification
    workflow_name VARCHAR(100) NOT NULL,
    description TEXT,

    -- Activation rules (when does this workflow apply?)
    applies_to_facility_ids UUID[],  -- NULL = all facilities
    min_amount DECIMAL(18,4),         -- NULL = no minimum
    max_amount DECIMAL(18,4),         -- NULL = no maximum

    -- Workflow configuration
    approval_type VARCHAR(20) NOT NULL, -- SEQUENTIAL, PARALLEL, ANY_ONE
    is_active BOOLEAN DEFAULT TRUE,
    priority INT DEFAULT 0,  -- Higher priority workflows take precedence

    -- SLA configuration
    sla_hours_per_step INT DEFAULT 24,
    escalation_enabled BOOLEAN DEFAULT FALSE,
    escalation_user_id UUID,  -- Who to escalate to if SLA breached

    -- Auto-approval configuration
    auto_approve_under_amount DECIMAL(18,4),  -- Auto-approve if under this amount

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_approval_workflow_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_approval_workflow_name UNIQUE (tenant_id, workflow_name)
);

CREATE INDEX idx_po_approval_workflows_tenant ON po_approval_workflows(tenant_id);
CREATE INDEX idx_po_approval_workflows_active ON po_approval_workflows(is_active) WHERE is_active = TRUE;

-- =====================================================
-- TABLE: po_approval_workflow_steps
-- =====================================================
-- Purpose: Define individual approval steps within a workflow
CREATE TABLE po_approval_workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    workflow_id UUID NOT NULL,

    -- Step configuration
    step_number INT NOT NULL,  -- 1, 2, 3... (order matters for SEQUENTIAL)
    step_name VARCHAR(100) NOT NULL,

    -- Approver configuration
    approver_role VARCHAR(50),      -- e.g., 'MANAGER', 'DIRECTOR', 'VP'
    approver_user_id UUID,          -- Specific user (takes precedence over role)
    approver_user_group_id UUID,    -- Or group of users (any can approve)

    -- Step behavior
    is_required BOOLEAN DEFAULT TRUE,
    can_delegate BOOLEAN DEFAULT TRUE,
    can_skip BOOLEAN DEFAULT FALSE,

    -- Constraints
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_approval_step_workflow FOREIGN KEY (workflow_id)
        REFERENCES po_approval_workflows(id) ON DELETE CASCADE,
    CONSTRAINT uq_workflow_step_number UNIQUE (workflow_id, step_number)
);

CREATE INDEX idx_po_approval_steps_workflow ON po_approval_workflow_steps(workflow_id);

-- =====================================================
-- TABLE: po_approval_history
-- =====================================================
-- Purpose: Audit trail of all approval actions
CREATE TABLE po_approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    purchase_order_id UUID NOT NULL,
    workflow_id UUID,
    step_id UUID,

    -- Action details
    action VARCHAR(20) NOT NULL, -- SUBMITTED, APPROVED, REJECTED, DELEGATED, ESCALATED
    action_by_user_id UUID NOT NULL,
    action_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Step tracking
    step_number INT,
    step_name VARCHAR(100),

    -- Comments
    comments TEXT,
    rejection_reason TEXT,

    -- Delegation
    delegated_from_user_id UUID,
    delegated_to_user_id UUID,

    -- SLA tracking
    sla_deadline TIMESTAMPTZ,
    was_escalated BOOLEAN DEFAULT FALSE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_approval_history_po FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_history_user FOREIGN KEY (action_by_user_id)
        REFERENCES users(id)
);

CREATE INDEX idx_po_approval_history_po ON po_approval_history(purchase_order_id);
CREATE INDEX idx_po_approval_history_user ON po_approval_history(action_by_user_id);
CREATE INDEX idx_po_approval_history_action_date ON po_approval_history(action_date);
```

**Updates to Existing `purchase_orders` Table:**

```sql
-- Add new approval workflow tracking fields
ALTER TABLE purchase_orders
    ADD COLUMN current_approval_workflow_id UUID,
    ADD COLUMN current_approval_step_number INT DEFAULT 0,
    ADD COLUMN approval_started_at TIMESTAMPTZ,
    ADD COLUMN approval_completed_at TIMESTAMPTZ,
    ADD COLUMN pending_approver_user_id UUID,

    ADD CONSTRAINT fk_po_current_workflow
        FOREIGN KEY (current_approval_workflow_id)
        REFERENCES po_approval_workflows(id);

-- Update status enum to include new approval states
ALTER TABLE purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_status_check,
    ADD CONSTRAINT purchase_orders_status_check
        CHECK (status IN (
            'DRAFT',
            'PENDING_APPROVAL',     -- NEW: Awaiting approval
            'APPROVED',             -- NEW: Approved but not yet issued
            'REJECTED',             -- NEW: Rejected by approver
            'ISSUED',
            'ACKNOWLEDGED',
            'PARTIALLY_RECEIVED',
            'RECEIVED',
            'CLOSED',
            'CANCELLED'
        ));
```

### 3.2 GraphQL API Design

**New Types:**

```graphql
type POApprovalWorkflow {
  id: ID!
  tenantId: ID!
  workflowName: String!
  description: String
  appliesToFacilityIds: [ID]
  minAmount: Float
  maxAmount: Float
  approvalType: ApprovalType!
  isActive: Boolean!
  priority: Int!
  slaHoursPerStep: Int
  escalationEnabled: Boolean!
  escalationUserId: ID
  autoApproveUnderAmount: Float
  steps: [POApprovalWorkflowStep!]!
  createdAt: DateTime!
  updatedAt: DateTime
}

enum ApprovalType {
  SEQUENTIAL   # Must approve in order (step 1, then step 2, etc.)
  PARALLEL     # All approvers notified, must all approve
  ANY_ONE      # Any single approver can approve
}

type POApprovalWorkflowStep {
  id: ID!
  workflowId: ID!
  stepNumber: Int!
  stepName: String!
  approverRole: String
  approverUserId: ID
  approverUserGroupId: ID
  isRequired: Boolean!
  canDelegate: Boolean!
  canSkip: Boolean!
}

type POApprovalHistoryEntry {
  id: ID!
  purchaseOrderId: ID!
  workflowId: ID
  stepId: ID
  action: ApprovalAction!
  actionByUserId: ID!
  actionByUserName: String
  actionDate: DateTime!
  stepNumber: Int
  stepName: String
  comments: String
  rejectionReason: String
  delegatedFromUserId: ID
  delegatedToUserId: ID
  slaDeadline: DateTime
  wasEscalated: Boolean!
}

enum ApprovalAction {
  SUBMITTED
  APPROVED
  REJECTED
  DELEGATED
  ESCALATED
  REQUESTED_CHANGES
}

# Update PurchaseOrder type to include workflow fields
type PurchaseOrder {
  # ... existing fields ...

  # NEW: Approval workflow fields
  currentApprovalWorkflowId: ID
  currentApprovalStepNumber: Int
  approvalStartedAt: DateTime
  approvalCompletedAt: DateTime
  pendingApproverUserId: ID
  approvalHistory: [POApprovalHistoryEntry!]!

  # Computed fields
  isAwaitingMyApproval(userId: ID!): Boolean
  approvalProgress: ApprovalProgress
}

type ApprovalProgress {
  currentStep: Int!
  totalSteps: Int!
  percentComplete: Float!
  nextApproverName: String
  slaDeadline: DateTime
  hoursRemaining: Float
  isOverdue: Boolean!
}
```

**New Queries:**

```graphql
type Query {
  # Get all pending approvals for a specific user
  getMyPendingApprovals(
    tenantId: ID!
    userId: ID!
    amountMin: Float
    amountMax: Float
    urgencyLevel: UrgencyLevel
  ): [PurchaseOrder!]!

  # Get approval history for a PO
  getPOApprovalHistory(purchaseOrderId: ID!): [POApprovalHistoryEntry!]!

  # Get all approval workflows
  getApprovalWorkflows(
    tenantId: ID!
    isActive: Boolean
  ): [POApprovalWorkflow!]!

  # Get applicable workflow for a PO
  getApplicableWorkflow(
    tenantId: ID!
    facilityId: ID
    amount: Float!
  ): POApprovalWorkflow
}

enum UrgencyLevel {
  URGENT    # Over SLA or >$100k
  WARNING   # Approaching SLA or >$25k
  NORMAL    # Within SLA and <$25k
}
```

**New Mutations:**

```graphql
type Mutation {
  # Submit PO for approval (initiates workflow)
  submitPOForApproval(
    purchaseOrderId: ID!
    submittedByUserId: ID!
  ): PurchaseOrder!

  # Approve PO (advances workflow or completes it)
  approvePOWorkflowStep(
    purchaseOrderId: ID!
    approvedByUserId: ID!
    comments: String
  ): PurchaseOrder!

  # Reject PO (returns to requester)
  rejectPO(
    purchaseOrderId: ID!
    rejectedByUserId: ID!
    rejectionReason: String!
  ): PurchaseOrder!

  # Delegate approval to another user
  delegateApproval(
    purchaseOrderId: ID!
    delegatedByUserId: ID!
    delegatedToUserId: ID!
    comments: String
  ): PurchaseOrder!

  # Request changes from requester
  requestPOChanges(
    purchaseOrderId: ID!
    requestedByUserId: ID!
    changeRequest: String!
  ): PurchaseOrder!

  # Admin: Create/update approval workflow
  upsertApprovalWorkflow(
    id: ID
    tenantId: ID!
    workflowName: String!
    description: String
    minAmount: Float
    maxAmount: Float
    approvalType: ApprovalType!
    slaHoursPerStep: Int
    steps: [ApprovalWorkflowStepInput!]!
  ): POApprovalWorkflow!
}

input ApprovalWorkflowStepInput {
  stepNumber: Int!
  stepName: String!
  approverRole: String
  approverUserId: ID
  isRequired: Boolean
  canDelegate: Boolean
}
```

### 3.3 Business Logic Components

**Core Services to Implement:**

1. **`ApprovalWorkflowService`**
   - Determines which workflow applies to a PO
   - Manages workflow state transitions
   - Handles workflow completion

2. **`ApprovalRoutingService`**
   - Determines next approver in workflow
   - Resolves approver from role/user/group
   - Handles delegation logic

3. **`ApprovalNotificationService`**
   - Sends notifications to approvers
   - Escalation notifications
   - Approval status updates to requester

4. **`ApprovalSLAService`**
   - Tracks SLA deadlines
   - Triggers escalations
   - Generates urgency indicators

**Implementation Pattern:**

```typescript
// src/modules/procurement/services/approval-workflow.service.ts
export class ApprovalWorkflowService {
  constructor(
    @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly routingService: ApprovalRoutingService,
    private readonly notificationService: ApprovalNotificationService,
    private readonly slaService: ApprovalSLAService
  ) {}

  async submitForApproval(poId: string, submittedBy: string): Promise<void> {
    // 1. Get PO details
    const po = await this.getPO(poId);

    // 2. Determine applicable workflow
    const workflow = await this.getApplicableWorkflow(
      po.tenantId,
      po.facilityId,
      po.totalAmount
    );

    if (!workflow) {
      throw new Error('No approval workflow configured for this PO');
    }

    // 3. Initialize workflow on PO
    await this.db.query(
      `UPDATE purchase_orders
       SET status = 'PENDING_APPROVAL',
           current_approval_workflow_id = $1,
           current_approval_step_number = 1,
           approval_started_at = NOW(),
           updated_at = NOW()
       WHERE id = $2`,
      [workflow.id, poId]
    );

    // 4. Create history entry
    await this.createHistoryEntry(poId, workflow.id, null, 'SUBMITTED', submittedBy, null);

    // 5. Determine first approver
    const firstApprover = await this.routingService.getApproverForStep(workflow, 1);

    // 6. Update pending approver
    await this.db.query(
      `UPDATE purchase_orders SET pending_approver_user_id = $1 WHERE id = $2`,
      [firstApprover.userId, poId]
    );

    // 7. Send notification
    await this.notificationService.notifyApprover(firstApprover.userId, po);

    // 8. Set SLA deadline
    await this.slaService.setSLADeadline(poId, workflow.slaHoursPerStep);
  }

  async approvePOWorkflowStep(
    poId: string,
    approvedBy: string,
    comments?: string
  ): Promise<void> {
    // 1. Get current workflow state
    const po = await this.getPO(poId);
    const workflow = await this.getWorkflow(po.currentApprovalWorkflowId);

    // 2. Verify approver is authorized
    await this.verifyApprover(po, workflow, approvedBy);

    // 3. Create approval history entry
    await this.createHistoryEntry(
      poId,
      workflow.id,
      po.currentApprovalStepNumber,
      'APPROVED',
      approvedBy,
      comments
    );

    // 4. Check if workflow is complete
    const isComplete = po.currentApprovalStepNumber >= workflow.steps.length;

    if (isComplete) {
      // Workflow complete - mark as APPROVED
      await this.db.query(
        `UPDATE purchase_orders
         SET status = 'APPROVED',
             approval_completed_at = NOW(),
             approved_by_user_id = $1,
             approved_at = NOW(),
             current_approval_step_number = NULL,
             pending_approver_user_id = NULL,
             updated_at = NOW()
         WHERE id = $2`,
        [approvedBy, poId]
      );

      // Notify requester
      await this.notificationService.notifyApprovalComplete(po);
    } else {
      // Advance to next step
      const nextStepNumber = po.currentApprovalStepNumber + 1;
      const nextApprover = await this.routingService.getApproverForStep(
        workflow,
        nextStepNumber
      );

      await this.db.query(
        `UPDATE purchase_orders
         SET current_approval_step_number = $1,
             pending_approver_user_id = $2,
             updated_at = NOW()
         WHERE id = $3`,
        [nextStepNumber, nextApprover.userId, poId]
      );

      // Notify next approver
      await this.notificationService.notifyApprover(nextApprover.userId, po);

      // Set new SLA deadline
      await this.slaService.setSLADeadline(poId, workflow.slaHoursPerStep);
    }
  }

  async rejectPO(
    poId: string,
    rejectedBy: string,
    rejectionReason: string
  ): Promise<void> {
    // 1. Get current state
    const po = await this.getPO(poId);

    // 2. Create rejection history entry
    await this.createHistoryEntry(
      poId,
      po.currentApprovalWorkflowId,
      po.currentApprovalStepNumber,
      'REJECTED',
      rejectedBy,
      null,
      rejectionReason
    );

    // 3. Return PO to DRAFT status
    await this.db.query(
      `UPDATE purchase_orders
       SET status = 'REJECTED',
           current_approval_workflow_id = NULL,
           current_approval_step_number = NULL,
           pending_approver_user_id = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [poId]
    );

    // 4. Notify requester
    await this.notificationService.notifyRejection(po, rejectionReason);
  }
}
```

### 3.4 Frontend Enhancements

**Required Frontend Changes:**

1. **Create `graphql/queries/approvals.ts`:**
```typescript
import { gql } from '@apollo/client';

export const GET_MY_PENDING_APPROVALS = gql`
  query GetMyPendingApprovals(
    $tenantId: ID!
    $userId: ID!
    $amountMin: Float
    $amountMax: Float
    $urgencyLevel: UrgencyLevel
  ) {
    getMyPendingApprovals(
      tenantId: $tenantId
      userId: $userId
      amountMin: $amountMin
      amountMax: $amountMax
      urgencyLevel: $urgencyLevel
    ) {
      id
      poNumber
      purchaseOrderDate
      vendorId
      facilityId
      status
      totalAmount
      poCurrencyCode
      requestedDeliveryDate
      requiresApproval
      approvedAt
      createdAt
      createdBy
      currentApprovalStepNumber
      approvalProgress {
        currentStep
        totalSteps
        percentComplete
        nextApproverName
        slaDeadline
        hoursRemaining
        isOverdue
      }
    }
  }
`;

export const GET_PO_APPROVAL_HISTORY = gql`
  query GetPOApprovalHistory($purchaseOrderId: ID!) {
    getPOApprovalHistory(purchaseOrderId: $purchaseOrderId) {
      id
      action
      actionByUserId
      actionByUserName
      actionDate
      stepNumber
      stepName
      comments
      rejectionReason
      delegatedFromUserId
      delegatedToUserId
      slaDeadline
      wasEscalated
    }
  }
`;

export const SUBMIT_PO_FOR_APPROVAL = gql`
  mutation SubmitPOForApproval(
    $purchaseOrderId: ID!
    $submittedByUserId: ID!
  ) {
    submitPOForApproval(
      purchaseOrderId: $purchaseOrderId
      submittedByUserId: $submittedByUserId
    ) {
      id
      status
      currentApprovalStepNumber
      pendingApproverUserId
      approvalStartedAt
    }
  }
`;

export const APPROVE_PO_WORKFLOW_STEP = gql`
  mutation ApprovePOWorkflowStep(
    $purchaseOrderId: ID!
    $approvedByUserId: ID!
    $comments: String
  ) {
    approvePOWorkflowStep(
      purchaseOrderId: $purchaseOrderId
      approvedByUserId: $approvedByUserId
      comments: $comments
    ) {
      id
      status
      currentApprovalStepNumber
      approvalCompletedAt
    }
  }
`;

export const REJECT_PO = gql`
  mutation RejectPO(
    $purchaseOrderId: ID!
    $rejectedByUserId: ID!
    $rejectionReason: String!
  ) {
    rejectPO(
      purchaseOrderId: $purchaseOrderId
      rejectedByUserId: $rejectedByUserId
      rejectionReason: $rejectionReason
    ) {
      id
      status
    }
  }
`;
```

2. **Enhance `PurchaseOrderDetailPage.tsx`:**
   - Add approval history timeline component
   - Show current approval step progress
   - Add reject/delegate buttons
   - Add comments field for approval

3. **Update `MyApprovalsPage.tsx`:**
   - Connect to new backend query (already implemented in UI)
   - Add bulk approval capability
   - Add filter by urgency

4. **New Component: `ApprovalHistoryTimeline.tsx`:**
```typescript
// Visual timeline showing approval progress
export const ApprovalHistoryTimeline: React.FC<{ poId: string }> = ({ poId }) => {
  const { data, loading } = useQuery(GET_PO_APPROVAL_HISTORY, {
    variables: { purchaseOrderId: poId }
  });

  return (
    <div className="space-y-4">
      {data?.getPOApprovalHistory?.map((entry, idx) => (
        <div key={entry.id} className="flex items-start space-x-4">
          <div className="flex-shrink-0">
            {entry.action === 'APPROVED' && <CheckCircle className="h-6 w-6 text-green-600" />}
            {entry.action === 'REJECTED' && <XCircle className="h-6 w-6 text-red-600" />}
            {entry.action === 'SUBMITTED' && <Send className="h-6 w-6 text-blue-600" />}
          </div>
          <div className="flex-1">
            <p className="font-medium">{entry.actionByUserName}</p>
            <p className="text-sm text-gray-600">
              {entry.action} - {entry.stepName}
            </p>
            <p className="text-xs text-gray-500">
              {new Date(entry.actionDate).toLocaleString()}
            </p>
            {entry.comments && (
              <p className="mt-2 text-sm text-gray-700 bg-gray-50 p-2 rounded">
                {entry.comments}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
```

---

## 4. IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1-2)

**Scope**: Enhance existing single-step approval with better UX

**Tasks:**
1. ✅ Create missing `graphql/queries/approvals.ts` file
2. ✅ Implement `GET_MY_PENDING_APPROVALS` query in backend
3. ✅ Add rejection capability to existing approval mutation
4. ✅ Create `po_approval_history` table for audit trail
5. ✅ Update `approvePurchaseOrder` to log to history
6. ✅ Add approval comments field
7. ✅ Test MyApprovalsPage with real backend data

**Deliverables:**
- Working MyApprovalsPage connected to backend
- Approval history tracking
- Approve/Reject with comments
- Basic email notifications

**SQL Migration (V0.0.35):**
```sql
-- Phase 1: Add approval history table
CREATE TABLE po_approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    purchase_order_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL,
    action_by_user_id UUID NOT NULL,
    action_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    comments TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_approval_history_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE
);

CREATE INDEX idx_po_approval_history_po ON po_approval_history(purchase_order_id);

-- Add new status values
ALTER TABLE purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_status_check,
    ADD CONSTRAINT purchase_orders_status_check
        CHECK (status IN (
            'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED',
            'ISSUED', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED',
            'RECEIVED', 'CLOSED', 'CANCELLED'
        ));
```

### Phase 2: Multi-Level Workflow (Week 3-4)

**Scope**: Implement configurable multi-level approval workflows

**Tasks:**
1. ✅ Create workflow configuration tables
2. ✅ Implement `ApprovalWorkflowService`
3. ✅ Implement `ApprovalRoutingService`
4. ✅ Add workflow GraphQL mutations
5. ✅ Create workflow admin UI
6. ✅ Implement sequential approval logic
7. ✅ Add SLA tracking

**Deliverables:**
- Configurable approval workflows
- Multi-level sequential approvals
- Workflow admin interface
- SLA deadline tracking

**SQL Migration (V0.0.36):**
```sql
-- Phase 2: Add workflow tables (see section 3.1 for full schema)
CREATE TABLE po_approval_workflows (...);
CREATE TABLE po_approval_workflow_steps (...);

ALTER TABLE purchase_orders
    ADD COLUMN current_approval_workflow_id UUID,
    ADD COLUMN current_approval_step_number INT DEFAULT 0,
    ADD COLUMN approval_started_at TIMESTAMPTZ,
    ADD COLUMN approval_completed_at TIMESTAMPTZ,
    ADD COLUMN pending_approver_user_id UUID;
```

### Phase 3: Advanced Features (Week 5-6)

**Scope**: Add delegation, escalation, and mobile support

**Tasks:**
1. ✅ Implement delegation capability
2. ✅ Implement SLA escalation
3. ✅ Add parallel approval support
4. ✅ Create mobile-optimized approval UI
5. ✅ Add bulk approval
6. ✅ Implement approval analytics dashboard

**Deliverables:**
- Delegation workflow
- Auto-escalation on SLA breach
- Mobile approval interface
- Bulk approve capability
- Approval metrics dashboard

---

## 5. TESTING STRATEGY

### 5.1 Unit Tests

**Backend Services:**
```typescript
describe('ApprovalWorkflowService', () => {
  it('should determine correct workflow based on amount', async () => {
    // Test workflow selection logic
  });

  it('should advance to next approval step', async () => {
    // Test step progression
  });

  it('should complete workflow when all steps approved', async () => {
    // Test completion logic
  });

  it('should reject PO and return to DRAFT', async () => {
    // Test rejection flow
  });
});

describe('ApprovalRoutingService', () => {
  it('should resolve approver from role', async () => {
    // Test role-based routing
  });

  it('should handle delegation', async () => {
    // Test delegation logic
  });
});
```

### 5.2 Integration Tests

**Workflow End-to-End:**
```typescript
describe('PO Approval Workflow E2E', () => {
  it('should complete 3-level approval workflow', async () => {
    // 1. Create PO with amount $50,000
    // 2. Submit for approval
    // 3. Verify Manager gets notification
    // 4. Manager approves
    // 5. Verify Director gets notification
    // 6. Director approves
    // 7. Verify VP gets notification
    // 8. VP approves
    // 9. Verify PO status = APPROVED
    // 10. Verify all history entries created
  });

  it('should handle rejection and resubmit', async () => {
    // Test rejection flow
  });
});
```

### 5.3 UI Tests

**MyApprovalsPage:**
- Verify pending approvals load correctly
- Test quick approve button
- Test urgency indicators
- Test filtering
- Test auto-refresh

### 5.4 Performance Tests

**Load Testing:**
- 1000 concurrent pending approvals
- Query performance for `getMyPendingApprovals`
- Approval history with 100+ entries

---

## 6. RISKS & MITIGATIONS

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Complex workflow routing logic | High | Medium | Start with sequential-only, add parallel later |
| Performance issues with large approval queues | Medium | Low | Add pagination and indexes |
| User confusion with multi-level approvals | Medium | Medium | Clear UI indicators, progress bars |
| SLA tracking complexity | Medium | Medium | Use background job for SLA checks |
| Email notification delivery failures | High | Low | Use NATS for reliable messaging |
| Approval deadlock (no approver available) | High | Low | Always have escalation path configured |

---

## 7. OPEN QUESTIONS FOR STAKEHOLDERS

1. **Approval Authority Matrix**: Do we need a matrix defining who can approve what based on department/role/amount?

2. **Auto-Approval Rules**: Should certain vendors or recurring POs be auto-approved?

3. **Parallel vs Sequential**: Which approval types are most common in the organization?

4. **SLA Requirements**: What are the target SLA times for each approval level?

5. **Escalation Rules**: Who should receive escalations? Should escalations auto-approve?

6. **Mobile Requirements**: Do approvers need mobile app support, or is mobile web sufficient?

7. **Approval Limits**: Should individual users have approval limits, or only role-based limits?

8. **Weekend/Holiday Handling**: Should SLA timers pause on weekends/holidays?

---

## 8. SUCCESS METRICS

**After Phase 1:**
- ✅ 100% of approvals tracked in history
- ✅ <5 second load time for MyApprovalsPage
- ✅ 95%+ approval notification delivery rate

**After Phase 2:**
- ✅ Configurable workflows for 3+ amount tiers
- ✅ 90%+ approvals completed within SLA
- ✅ Zero approval routing errors

**After Phase 3:**
- ✅ 50%+ of approvals done via mobile
- ✅ Bulk approval reduces approval time by 50%
- ✅ Escalation rate <10%

---

## 9. DEPENDENCIES

**Internal Dependencies:**
1. User/role management system (for approver resolution)
2. Email/notification service (for approver notifications)
3. NATS messaging (for reliable notifications)

**External Dependencies:**
1. None (all internal)

---

## 10. TECHNICAL DEBT CONSIDERATIONS

**Current Technical Debt:**
1. `MyApprovalsPage.tsx` imports non-existent `approvals.ts` query file
2. Simple approval logic directly updates status without history
3. No approval audit trail
4. No notification system integration

**New Technical Debt to Avoid:**
1. Don't hard-code approval rules in code (use DB configuration)
2. Don't skip audit logging (always log to history)
3. Don't ignore SLA tracking from the start
4. Don't build UI without backend query first

---

## 11. REFERENCES

**Existing Code Locations:**
- Frontend Approval UI: `print-industry-erp/frontend/src/pages/MyApprovalsPage.tsx`
- Frontend PO Detail: `print-industry-erp/frontend/src/pages/PurchaseOrderDetailPage.tsx`
- Backend Approval Mutation: `print-industry-erp/backend/src/graphql/resolvers/sales-materials.resolver.ts:1360`
- Database Schema: `print-industry-erp/backend/migrations/V0.0.6__create_sales_materials_procurement.sql`
- GraphQL Schema: `print-industry-erp/backend/src/graphql/schema/sales-materials.graphql`

**Related Requirements:**
- Purchase Order Management (foundation for this feature)
- Vendor Management (supplier approval workflows)
- User/Role Management (approver resolution)

---

## 12. APPENDIX A: SAMPLE WORKFLOW CONFIGURATIONS

**Configuration 1: Simple Amount-Based Workflow**
```json
{
  "workflowName": "Standard PO Approval",
  "approvalType": "SEQUENTIAL",
  "minAmount": 5000,
  "maxAmount": null,
  "slaHoursPerStep": 24,
  "steps": [
    {
      "stepNumber": 1,
      "stepName": "Manager Approval",
      "approverRole": "PROCUREMENT_MANAGER"
    },
    {
      "stepNumber": 2,
      "stepName": "Director Approval",
      "approverRole": "PROCUREMENT_DIRECTOR",
      "isRequired": true,
      "appliesIf": "totalAmount > 25000"
    },
    {
      "stepNumber": 3,
      "stepName": "VP/CFO Approval",
      "approverRole": "VP_FINANCE",
      "isRequired": true,
      "appliesIf": "totalAmount > 100000"
    }
  ]
}
```

**Configuration 2: Fast-Track for Trusted Vendors**
```json
{
  "workflowName": "Trusted Vendor Fast-Track",
  "approvalType": "ANY_ONE",
  "minAmount": 0,
  "maxAmount": 25000,
  "autoApproveUnderAmount": 5000,
  "slaHoursPerStep": 4,
  "appliesToVendorIds": ["vendor-123", "vendor-456"],
  "steps": [
    {
      "stepNumber": 1,
      "stepName": "Manager Quick Approval",
      "approverRole": "PROCUREMENT_MANAGER"
    }
  ]
}
```

---

## 13. APPENDIX B: SAMPLE NOTIFICATION TEMPLATES

**Email Template: Approval Required**
```
Subject: Action Required: Purchase Order {PO_NUMBER} Awaiting Your Approval

Hello {APPROVER_NAME},

A purchase order requires your approval:

PO Number: {PO_NUMBER}
Vendor: {VENDOR_NAME}
Amount: {CURRENCY} {TOTAL_AMOUNT}
Requested By: {REQUESTER_NAME}
Date Submitted: {SUBMISSION_DATE}

SLA Deadline: {SLA_DEADLINE}
Time Remaining: {HOURS_REMAINING} hours

[Approve] [Reject] [View Details]

To approve or review, visit:
{APPROVAL_URL}

This is step {CURRENT_STEP} of {TOTAL_STEPS} in the approval workflow.

---
AGOG Print Industry ERP
```

**Email Template: Approval Complete**
```
Subject: Purchase Order {PO_NUMBER} Approved

Hello {REQUESTER_NAME},

Your purchase order has been fully approved and is ready to issue:

PO Number: {PO_NUMBER}
Vendor: {VENDOR_NAME}
Amount: {CURRENCY} {TOTAL_AMOUNT}
Approval Completed: {APPROVAL_DATE}

Approved By:
{APPROVAL_HISTORY}

[Issue to Vendor] [View PO]

---
AGOG Print Industry ERP
```

---

## CONCLUSION

The PO Approval Workflow feature will significantly enhance the procurement process by providing:
1. ✅ **Governance**: Proper authorization controls based on amount and role
2. ✅ **Transparency**: Full audit trail of all approval decisions
3. ✅ **Efficiency**: Automated routing and notifications reduce approval cycle time
4. ✅ **Compliance**: Documented approval history for audits
5. ✅ **Flexibility**: Configurable workflows to match business needs

The phased implementation approach allows for incremental delivery of value while managing complexity and risk.

**Recommended Next Steps:**
1. Review this research with stakeholders (Marcus, procurement team)
2. Confirm approval authority matrix and SLA requirements
3. Prioritize Phase 1 (enhanced single-step approval) for immediate value
4. Schedule kickoff for Phase 2 (multi-level workflow) based on Phase 1 learnings

---

**Research Complete**
**Deliverable Status**: READY FOR ENGINEERING (Marcus)
**Estimated Engineering Effort**: 6 weeks (3 phases × 2 weeks)
**Business Value**: HIGH (critical for procurement governance)
**Technical Risk**: MEDIUM (well-understood domain, good existing foundation)
