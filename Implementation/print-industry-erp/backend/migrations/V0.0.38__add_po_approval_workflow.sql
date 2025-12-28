-- =====================================================
-- FLYWAY MIGRATION V0.0.38
-- =====================================================
-- Purpose: Add Purchase Order Approval Workflow
-- REQ: REQ-STRATEGIC-AUTO-1766676891764
-- Author: Roy (Backend Specialist)
-- Date: 2025-12-27
-- =====================================================
-- Description:
--   This migration implements a comprehensive multi-level approval workflow
--   system for purchase orders. It includes:
--   - Configurable approval workflows with amount-based routing
--   - Multi-step approval chains (sequential, parallel, any-one)
--   - Complete audit trail of all approval actions
--   - SLA tracking and escalation support
--   - Delegation capabilities
-- =====================================================

-- =====================================================
-- TABLE: po_approval_workflows
-- =====================================================
-- Purpose: Define approval workflow rules and routing logic
-- This table stores reusable workflow configurations that can be
-- applied to purchase orders based on criteria (amount, facility, etc.)

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
    approval_type VARCHAR(20) NOT NULL DEFAULT 'SEQUENTIAL',
    -- SEQUENTIAL: Must approve in order (step 1, then step 2, etc.)
    -- PARALLEL: All approvers notified, must all approve
    -- ANY_ONE: Any single approver can approve

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

    CONSTRAINT fk_po_approval_workflow_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_approval_workflow_escalation_user FOREIGN KEY (escalation_user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_po_approval_workflow_name UNIQUE (tenant_id, workflow_name),
    CONSTRAINT chk_po_approval_workflow_type CHECK (approval_type IN ('SEQUENTIAL', 'PARALLEL', 'ANY_ONE')),
    CONSTRAINT chk_po_approval_workflow_amount_range CHECK (
        min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount
    )
);

CREATE INDEX idx_po_approval_workflows_tenant ON po_approval_workflows(tenant_id);
CREATE INDEX idx_po_approval_workflows_active ON po_approval_workflows(tenant_id, is_active)
    WHERE is_active = TRUE;
CREATE INDEX idx_po_approval_workflows_amount_range ON po_approval_workflows(min_amount, max_amount)
    WHERE is_active = TRUE;

COMMENT ON TABLE po_approval_workflows IS 'Configurable approval workflow definitions for purchase orders';
COMMENT ON COLUMN po_approval_workflows.approval_type IS 'SEQUENTIAL (in order), PARALLEL (all must approve), ANY_ONE (first approver wins)';
COMMENT ON COLUMN po_approval_workflows.priority IS 'Higher priority workflows take precedence when multiple match';

-- =====================================================
-- TABLE: po_approval_workflow_steps
-- =====================================================
-- Purpose: Define individual approval steps within a workflow
-- Each step represents one level of approval with specific approver criteria

CREATE TABLE po_approval_workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    workflow_id UUID NOT NULL,

    -- Step configuration
    step_number INT NOT NULL,  -- 1, 2, 3... (order matters for SEQUENTIAL)
    step_name VARCHAR(100) NOT NULL,

    -- Approver configuration (at least one must be specified)
    approver_role VARCHAR(50),      -- e.g., 'PROCUREMENT_MANAGER', 'DIRECTOR', 'VP'
    approver_user_id UUID,          -- Specific user (takes precedence over role)
    approver_user_group_id UUID,    -- Or group of users (any can approve)

    -- Step behavior
    is_required BOOLEAN DEFAULT TRUE,
    can_delegate BOOLEAN DEFAULT TRUE,
    can_skip BOOLEAN DEFAULT FALSE,

    -- Minimum approval authority (amount limit)
    min_approval_limit DECIMAL(18,4),

    -- Constraints
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_po_approval_step_workflow FOREIGN KEY (workflow_id)
        REFERENCES po_approval_workflows(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_approval_step_approver_user FOREIGN KEY (approver_user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT uq_po_workflow_step_number UNIQUE (workflow_id, step_number),
    CONSTRAINT chk_po_approval_step_has_approver CHECK (
        approver_role IS NOT NULL OR
        approver_user_id IS NOT NULL OR
        approver_user_group_id IS NOT NULL
    )
);

CREATE INDEX idx_po_approval_steps_workflow ON po_approval_workflow_steps(workflow_id);
CREATE INDEX idx_po_approval_steps_step_number ON po_approval_workflow_steps(workflow_id, step_number);
CREATE INDEX idx_po_approval_steps_approver_user ON po_approval_workflow_steps(approver_user_id)
    WHERE approver_user_id IS NOT NULL;

COMMENT ON TABLE po_approval_workflow_steps IS 'Individual approval steps within workflows';
COMMENT ON COLUMN po_approval_workflow_steps.step_number IS 'Determines order for SEQUENTIAL workflows';
COMMENT ON COLUMN po_approval_workflow_steps.approver_role IS 'Role-based approver (e.g., MANAGER, DIRECTOR)';

-- =====================================================
-- TABLE: po_approval_history
-- =====================================================
-- Purpose: Complete audit trail of all approval actions
-- This table is append-only for compliance (SOX, GDPR audit trail)

CREATE TABLE po_approval_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    purchase_order_id UUID NOT NULL,
    workflow_id UUID,
    step_id UUID,

    -- Action details
    action VARCHAR(20) NOT NULL,
    -- SUBMITTED, APPROVED, REJECTED, DELEGATED, ESCALATED, REQUESTED_CHANGES, CANCELLED
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

    -- Snapshot of PO at time of action (for audit compliance)
    po_snapshot JSONB,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_po_approval_history_po FOREIGN KEY (purchase_order_id)
        REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_approval_history_workflow FOREIGN KEY (workflow_id)
        REFERENCES po_approval_workflows(id) ON DELETE SET NULL,
    CONSTRAINT fk_po_approval_history_step FOREIGN KEY (step_id)
        REFERENCES po_approval_workflow_steps(id) ON DELETE SET NULL,
    CONSTRAINT fk_po_approval_history_user FOREIGN KEY (action_by_user_id)
        REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approval_history_delegated_from FOREIGN KEY (delegated_from_user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_po_approval_history_delegated_to FOREIGN KEY (delegated_to_user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_po_approval_action CHECK (action IN (
        'SUBMITTED', 'APPROVED', 'REJECTED', 'DELEGATED',
        'ESCALATED', 'REQUESTED_CHANGES', 'CANCELLED'
    ))
);

CREATE INDEX idx_po_approval_history_po ON po_approval_history(purchase_order_id);
CREATE INDEX idx_po_approval_history_user ON po_approval_history(action_by_user_id);
CREATE INDEX idx_po_approval_history_action_date ON po_approval_history(action_date DESC);
CREATE INDEX idx_po_approval_history_workflow ON po_approval_history(workflow_id)
    WHERE workflow_id IS NOT NULL;

COMMENT ON TABLE po_approval_history IS 'Immutable audit trail of all PO approval actions';
COMMENT ON COLUMN po_approval_history.po_snapshot IS 'JSONB snapshot of PO state at time of action for compliance';

-- =====================================================
-- TABLE: user_approval_authority
-- =====================================================
-- Purpose: Define approval authority limits for users
-- This table controls who can approve what based on role and amount

CREATE TABLE user_approval_authority (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,

    -- Authority configuration
    approval_limit DECIMAL(18,4) NOT NULL,
    currency_code VARCHAR(3) DEFAULT 'USD',

    -- Optional role-based authority
    role_name VARCHAR(50),

    -- Effective dates
    effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to_date DATE,

    -- Delegation
    can_delegate BOOLEAN DEFAULT TRUE,

    -- Authority grant tracking
    granted_by_user_id UUID,
    granted_at TIMESTAMPTZ DEFAULT NOW(),

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_user_approval_authority_tenant FOREIGN KEY (tenant_id)
        REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_approval_authority_user FOREIGN KEY (user_id)
        REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_approval_authority_granted_by FOREIGN KEY (granted_by_user_id)
        REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT chk_user_approval_authority_dates CHECK (
        effective_to_date IS NULL OR effective_to_date >= effective_from_date
    ),
    CONSTRAINT chk_user_approval_authority_limit CHECK (approval_limit > 0)
);

CREATE INDEX idx_user_approval_authority_tenant_user ON user_approval_authority(tenant_id, user_id);
CREATE INDEX idx_user_approval_authority_user ON user_approval_authority(user_id);
CREATE INDEX idx_user_approval_authority_effective_dates ON user_approval_authority(
    effective_from_date, effective_to_date
) WHERE effective_to_date IS NULL OR effective_to_date >= CURRENT_DATE;

COMMENT ON TABLE user_approval_authority IS 'Defines approval authority limits for users';
COMMENT ON COLUMN user_approval_authority.approval_limit IS 'Maximum PO amount user can approve';

-- =====================================================
-- ALTER: purchase_orders table
-- =====================================================
-- Add workflow tracking fields to existing purchase_orders table

ALTER TABLE purchase_orders
    ADD COLUMN current_approval_workflow_id UUID,
    ADD COLUMN current_approval_step_number INT DEFAULT 0,
    ADD COLUMN approval_started_at TIMESTAMPTZ,
    ADD COLUMN approval_completed_at TIMESTAMPTZ,
    ADD COLUMN pending_approver_user_id UUID,
    ADD COLUMN workflow_snapshot JSONB,  -- Snapshot of workflow config at submission time

    ADD CONSTRAINT fk_po_current_workflow
        FOREIGN KEY (current_approval_workflow_id)
        REFERENCES po_approval_workflows(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_po_pending_approver
        FOREIGN KEY (pending_approver_user_id)
        REFERENCES users(id) ON DELETE SET NULL;

-- Update status enum to include new approval states
ALTER TABLE purchase_orders
    DROP CONSTRAINT IF EXISTS purchase_orders_status_check;

ALTER TABLE purchase_orders
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

CREATE INDEX idx_purchase_orders_pending_approver ON purchase_orders(pending_approver_user_id)
    WHERE pending_approver_user_id IS NOT NULL;
CREATE INDEX idx_purchase_orders_workflow ON purchase_orders(current_approval_workflow_id)
    WHERE current_approval_workflow_id IS NOT NULL;
CREATE INDEX idx_purchase_orders_approval_status ON purchase_orders(status)
    WHERE status IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED');

COMMENT ON COLUMN purchase_orders.current_approval_workflow_id IS 'Active workflow (NULL if not in approval)';
COMMENT ON COLUMN purchase_orders.current_approval_step_number IS 'Current step in workflow (0 = not started)';
COMMENT ON COLUMN purchase_orders.workflow_snapshot IS 'Snapshot of workflow config at submission (prevents mid-flight changes)';

-- =====================================================
-- VIEW: v_approval_queue
-- =====================================================
-- Purpose: Optimized view for "My Pending Approvals" queries
-- This view pre-joins all necessary data for the approval queue page

CREATE OR REPLACE VIEW v_approval_queue AS
SELECT
    po.id AS purchase_order_id,
    po.tenant_id,
    po.po_number,
    po.po_date,
    po.vendor_id,
    v.vendor_name,
    po.facility_id,
    f.facility_name,
    po.total_amount,
    po.po_currency_code,
    po.status,
    po.requested_delivery_date,
    po.current_approval_workflow_id,
    po.current_approval_step_number,
    po.approval_started_at,
    po.pending_approver_user_id,

    -- Workflow step info
    ws.step_name AS current_step_name,
    ws.sla_hours_per_step,

    -- SLA calculation
    po.approval_started_at + (ws.sla_hours_per_step || ' hours')::INTERVAL AS sla_deadline,
    EXTRACT(EPOCH FROM (po.approval_started_at + (ws.sla_hours_per_step || ' hours')::INTERVAL - NOW())) / 3600 AS hours_remaining,
    CASE
        WHEN NOW() > (po.approval_started_at + (ws.sla_hours_per_step || ' hours')::INTERVAL) THEN TRUE
        ELSE FALSE
    END AS is_overdue,

    -- Urgency level
    CASE
        WHEN NOW() > (po.approval_started_at + (ws.sla_hours_per_step || ' hours')::INTERVAL)
            OR po.total_amount > 100000 THEN 'URGENT'
        WHEN EXTRACT(EPOCH FROM (po.approval_started_at + (ws.sla_hours_per_step || ' hours')::INTERVAL - NOW())) / 3600 < 8
            OR po.total_amount > 25000 THEN 'WARNING'
        ELSE 'NORMAL'
    END AS urgency_level,

    -- Requester info
    po.created_by AS requester_user_id,
    u.first_name || ' ' || u.last_name AS requester_name,

    -- Audit
    po.created_at,
    po.updated_at

FROM purchase_orders po
INNER JOIN vendors v ON po.vendor_id = v.id
INNER JOIN facilities f ON po.facility_id = f.id
LEFT JOIN po_approval_workflows wf ON po.current_approval_workflow_id = wf.id
LEFT JOIN po_approval_workflow_steps ws ON ws.workflow_id = wf.id
    AND ws.step_number = po.current_approval_step_number
LEFT JOIN users u ON po.created_by = u.id
WHERE po.status = 'PENDING_APPROVAL'
    AND po.pending_approver_user_id IS NOT NULL;

COMMENT ON VIEW v_approval_queue IS 'Optimized view for approval queue queries with SLA and urgency calculations';

-- =====================================================
-- FUNCTION: get_applicable_workflow
-- =====================================================
-- Purpose: Determine which workflow applies to a PO based on amount and facility
-- Returns the highest priority active workflow that matches criteria

CREATE OR REPLACE FUNCTION get_applicable_workflow(
    p_tenant_id UUID,
    p_facility_id UUID,
    p_total_amount DECIMAL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_workflow_id UUID;
BEGIN
    SELECT id INTO v_workflow_id
    FROM po_approval_workflows
    WHERE tenant_id = p_tenant_id
        AND is_active = TRUE
        AND (applies_to_facility_ids IS NULL OR p_facility_id = ANY(applies_to_facility_ids))
        AND (min_amount IS NULL OR p_total_amount >= min_amount)
        AND (max_amount IS NULL OR p_total_amount <= max_amount)
    ORDER BY priority DESC, min_amount DESC NULLS LAST
    LIMIT 1;

    RETURN v_workflow_id;
END;
$$;

COMMENT ON FUNCTION get_applicable_workflow IS 'Returns applicable workflow ID based on PO criteria (highest priority match)';

-- =====================================================
-- FUNCTION: create_approval_history_entry
-- =====================================================
-- Purpose: Helper function to create audit trail entries
-- Ensures consistent audit logging across all approval operations

CREATE OR REPLACE FUNCTION create_approval_history_entry(
    p_purchase_order_id UUID,
    p_workflow_id UUID,
    p_step_id UUID,
    p_action VARCHAR(20),
    p_action_by_user_id UUID,
    p_step_number INT DEFAULT NULL,
    p_step_name VARCHAR(100) DEFAULT NULL,
    p_comments TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL,
    p_delegated_from_user_id UUID DEFAULT NULL,
    p_delegated_to_user_id UUID DEFAULT NULL,
    p_sla_deadline TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_history_id UUID;
    v_po_snapshot JSONB;
BEGIN
    -- Capture PO snapshot
    SELECT to_jsonb(po.*) INTO v_po_snapshot
    FROM purchase_orders po
    WHERE id = p_purchase_order_id;

    -- Insert history entry
    INSERT INTO po_approval_history (
        purchase_order_id,
        workflow_id,
        step_id,
        action,
        action_by_user_id,
        step_number,
        step_name,
        comments,
        rejection_reason,
        delegated_from_user_id,
        delegated_to_user_id,
        sla_deadline,
        po_snapshot
    ) VALUES (
        p_purchase_order_id,
        p_workflow_id,
        p_step_id,
        p_action,
        p_action_by_user_id,
        p_step_number,
        p_step_name,
        p_comments,
        p_rejection_reason,
        p_delegated_from_user_id,
        p_delegated_to_user_id,
        p_sla_deadline,
        v_po_snapshot
    )
    RETURNING id INTO v_history_id;

    RETURN v_history_id;
END;
$$;

COMMENT ON FUNCTION create_approval_history_entry IS 'Creates audit trail entry with PO snapshot for compliance';

-- =====================================================
-- SAMPLE DATA: Default approval workflows
-- =====================================================
-- Insert sample approval workflows for testing
-- These can be customized per tenant

-- Sample workflow 1: Simple 2-level approval (< $25,000)
-- Manager approval only
INSERT INTO po_approval_workflows (
    tenant_id,
    workflow_name,
    description,
    min_amount,
    max_amount,
    approval_type,
    is_active,
    priority,
    sla_hours_per_step,
    escalation_enabled
) VALUES (
    (SELECT id FROM tenants LIMIT 1),  -- Use first tenant
    'Standard Approval (< $25k)',
    'Single-level manager approval for purchase orders under $25,000',
    0,
    25000,
    'SEQUENTIAL',
    TRUE,
    10,
    24,
    FALSE
);

-- Sample workflow 2: Multi-level approval (>= $25,000)
-- Manager → Director → VP
INSERT INTO po_approval_workflows (
    tenant_id,
    workflow_name,
    description,
    min_amount,
    max_amount,
    approval_type,
    is_active,
    priority,
    sla_hours_per_step,
    escalation_enabled
) VALUES (
    (SELECT id FROM tenants LIMIT 1),
    'Executive Approval (>= $25k)',
    'Multi-level approval for purchase orders $25,000 and above',
    25000,
    NULL,
    'SEQUENTIAL',
    TRUE,
    20,
    48,
    TRUE
);

COMMENT ON TABLE po_approval_workflows IS 'Sample workflows inserted for testing. Customize per tenant.';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- - Added 4 new tables: po_approval_workflows, po_approval_workflow_steps,
--   po_approval_history, user_approval_authority
-- - Extended purchase_orders table with workflow tracking fields
-- - Added new PO status values: PENDING_APPROVAL, APPROVED, REJECTED
-- - Created optimized view v_approval_queue for approval dashboard
-- - Added helper functions for workflow selection and audit logging
-- - Inserted sample workflows for testing
-- =====================================================
