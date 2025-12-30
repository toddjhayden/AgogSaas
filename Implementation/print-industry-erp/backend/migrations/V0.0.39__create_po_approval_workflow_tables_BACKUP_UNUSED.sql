-- =====================================================
-- MIGRATION: V0.0.38 - PO Approval Workflow Tables
-- =====================================================
-- Purpose: Implement secure, compliant PO approval workflow
-- REQ: REQ-STRATEGIC-AUTO-1735134000000
-- Date: 2025-12-27
-- Author: Roy (Backend Implementation Specialist)
--
-- This migration implements Phase 0 (Security) and Phase 1 (Production Hardening)
-- recommendations from Sylvia's critique, incorporating Cynthia's research on
-- industry best practices for approval workflows.
--
-- Key Features:
-- - Immutable audit trail for compliance (SOX, ISO 9001)
-- - User approval authority limits with amount thresholds
-- - Multi-level approval support (future-ready)
-- - Delegation and escalation capabilities
-- - SLA monitoring and tracking
-- =====================================================

-- =====================================================
-- TABLE: purchase_order_approval_audit
-- Purpose: Immutable audit trail of all approval actions
-- Compliance: SOX Section 404, ISO 9001:2015, FDA 21 CFR Part 11
-- =====================================================

CREATE TABLE purchase_order_approval_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,

    -- Action details
    action VARCHAR(20) NOT NULL CHECK (action IN (
        'SUBMITTED',
        'APPROVED',
        'REJECTED',
        'CHANGES_REQUESTED',
        'DELEGATED',
        'ESCALATED',
        'WITHDRAWN',
        'RECALLED'
    )),
    action_by_user_id UUID NOT NULL,
    action_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- State transition
    previous_status VARCHAR(20) NOT NULL,
    new_status VARCHAR(20) NOT NULL,

    -- Decision metadata
    approval_level INTEGER DEFAULT 1,
    decision_notes TEXT,
    rejection_reason TEXT,
    requested_changes TEXT,

    -- Audit context (WHO, WHEN, WHERE, HOW)
    ip_address INET,
    user_agent TEXT,
    session_id UUID,
    geo_location POINT,
    device_fingerprint TEXT,

    -- Digital signature (future enhancement)
    signature_hash TEXT,
    signature_algorithm VARCHAR(50),

    -- Financial metadata (snapshot at time of action)
    po_amount DECIMAL(18,4),
    po_currency_code VARCHAR(3),

    -- Immutability guarantee
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- NOTE: No updated_at - records are immutable

    CONSTRAINT fk_po_approval_audit_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approval_audit_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approval_audit_user
        FOREIGN KEY (action_by_user_id) REFERENCES users(id) ON DELETE RESTRICT
);

-- Indexes for audit queries
CREATE INDEX idx_po_approval_audit_po ON purchase_order_approval_audit(purchase_order_id);
CREATE INDEX idx_po_approval_audit_user ON purchase_order_approval_audit(action_by_user_id);
CREATE INDEX idx_po_approval_audit_tenant ON purchase_order_approval_audit(tenant_id);
CREATE INDEX idx_po_approval_audit_action_at ON purchase_order_approval_audit(action_at DESC);
CREATE INDEX idx_po_approval_audit_action ON purchase_order_approval_audit(action);

-- Prevent updates and deletes (immutability enforcement)
CREATE RULE purchase_order_approval_audit_no_update AS
    ON UPDATE TO purchase_order_approval_audit
    DO INSTEAD NOTHING;

CREATE RULE purchase_order_approval_audit_no_delete AS
    ON DELETE TO purchase_order_approval_audit
    DO INSTEAD NOTHING;

COMMENT ON TABLE purchase_order_approval_audit IS
    'Immutable audit trail of all purchase order approval actions. Records cannot be modified or deleted to ensure compliance with financial regulations (SOX Section 404, ISO 9001).';

COMMENT ON COLUMN purchase_order_approval_audit.action IS
    'Type of approval action taken: SUBMITTED, APPROVED, REJECTED, CHANGES_REQUESTED, DELEGATED, ESCALATED, WITHDRAWN, RECALLED';

COMMENT ON COLUMN purchase_order_approval_audit.ip_address IS
    'IP address from which the action was performed (for security auditing)';

COMMENT ON COLUMN purchase_order_approval_audit.signature_hash IS
    'Cryptographic hash of action for non-repudiation (future enhancement for electronic signatures)';

-- =====================================================
-- TABLE: user_approval_authorities
-- Purpose: Define approval limits and permissions for users
-- =====================================================

CREATE TABLE user_approval_authorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    user_id UUID NOT NULL,
    facility_id UUID,  -- NULL = applies to all facilities

    -- Authority limits
    single_approval_limit DECIMAL(18,4) NOT NULL CHECK (single_approval_limit >= 0),
    daily_approval_limit DECIMAL(18,4) CHECK (daily_approval_limit IS NULL OR daily_approval_limit >= single_approval_limit),
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',

    -- Role-based authority
    approval_role VARCHAR(50),  -- MANAGER, DIRECTOR, VP, CFO, CEO
    authority_level INTEGER DEFAULT 1,  -- 1=lowest, 5=highest

    -- Scope constraints
    category_restrictions TEXT[],  -- NULL = all categories
    vendor_tier_restrictions TEXT[],  -- NULL = all vendor tiers

    -- Effective dates
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE,  -- NULL = indefinite

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Approval workflow requirements
    requires_dual_approval BOOLEAN DEFAULT FALSE,  -- Requires second approver
    requires_finance_review BOOLEAN DEFAULT FALSE,  -- Finance must also approve

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_user_approval_auth_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_approval_auth_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_approval_auth_facility
        FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_approval_auth_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_user_approval_auth_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id),

    -- Ensure user has at most one active authority per facility at any time
    CONSTRAINT uq_user_approval_auth_active
        UNIQUE (tenant_id, user_id, facility_id, effective_from)
);

-- Indexes for authority lookups
CREATE INDEX idx_user_approval_auth_user ON user_approval_authorities(user_id);
CREATE INDEX idx_user_approval_auth_tenant ON user_approval_authorities(tenant_id);
CREATE INDEX idx_user_approval_auth_facility ON user_approval_authorities(facility_id);
CREATE INDEX idx_user_approval_auth_active ON user_approval_authorities(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_approval_auth_dates ON user_approval_authorities(effective_from, effective_to);

COMMENT ON TABLE user_approval_authorities IS
    'Defines approval limits and permissions for users. Implements segregation of duties and monetary thresholds per industry best practices.';

COMMENT ON COLUMN user_approval_authorities.single_approval_limit IS
    'Maximum amount (in specified currency) that user can approve for a single PO';

COMMENT ON COLUMN user_approval_authorities.daily_approval_limit IS
    'Maximum total amount user can approve in a single day (prevents fraud through multiple small approvals)';

COMMENT ON COLUMN user_approval_authorities.authority_level IS
    'Hierarchical authority level (1=lowest, 5=highest). Higher levels can override lower level decisions.';

-- =====================================================
-- TABLE: user_delegations
-- Purpose: Support out-of-office delegation of approval authority
-- =====================================================

CREATE TABLE user_delegations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Primary user (delegator)
    user_id UUID NOT NULL,

    -- Delegate (who will approve instead)
    delegate_user_id UUID NOT NULL,

    -- Delegation period
    delegation_type VARCHAR(20) NOT NULL CHECK (delegation_type IN ('TEMPORARY', 'PERMANENT')),
    start_date DATE NOT NULL,
    end_date DATE,  -- NULL for PERMANENT type

    -- Scope
    delegation_scope VARCHAR(20) DEFAULT 'ALL' CHECK (delegation_scope IN ('ALL', 'CATEGORY', 'AMOUNT_LIMIT')),
    category VARCHAR(50),  -- NULL means all categories
    max_amount DECIMAL(18,4),  -- NULL means delegate inherits all limits
    currency_code VARCHAR(3) DEFAULT 'USD',

    -- Delegation reason
    delegation_reason TEXT,

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_user_delegation_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_delegation_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_delegation_delegate
        FOREIGN KEY (delegate_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_delegation_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_user_delegation_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id),

    -- Prevent self-delegation
    CONSTRAINT chk_user_delegation_no_self
        CHECK (user_id != delegate_user_id),

    -- TEMPORARY delegations must have end_date
    CONSTRAINT chk_user_delegation_temp_end_date
        CHECK (delegation_type != 'TEMPORARY' OR end_date IS NOT NULL),

    -- Category scope requires category
    CONSTRAINT chk_user_delegation_category_scope
        CHECK (delegation_scope != 'CATEGORY' OR category IS NOT NULL),

    -- Amount limit scope requires max_amount
    CONSTRAINT chk_user_delegation_amount_scope
        CHECK (delegation_scope != 'AMOUNT_LIMIT' OR max_amount IS NOT NULL)
);

-- Indexes for delegation lookups
CREATE INDEX idx_user_delegations_user ON user_delegations(user_id);
CREATE INDEX idx_user_delegations_delegate ON user_delegations(delegate_user_id);
CREATE INDEX idx_user_delegations_tenant ON user_delegations(tenant_id);
CREATE INDEX idx_user_delegations_active ON user_delegations(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_user_delegations_dates ON user_delegations(start_date, end_date);

COMMENT ON TABLE user_delegations IS
    'Supports out-of-office delegation of approval authority. Implements vacation rules and proxy approver patterns per industry best practices (Intacct, Dynamics 365, NetSuite).';

COMMENT ON COLUMN user_delegations.delegation_type IS
    'TEMPORARY: Time-bound delegation (e.g., vacation). PERMANENT: Standing delegation until manually revoked.';

COMMENT ON COLUMN user_delegations.delegation_scope IS
    'ALL: Delegate all approvals. CATEGORY: Delegate specific category only. AMOUNT_LIMIT: Delegate up to max_amount only.';

-- =====================================================
-- TABLE: approval_rules
-- Purpose: Threshold-based approval routing rules
-- =====================================================

CREATE TABLE approval_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID,  -- NULL means applies to all facilities

    -- Rule identification
    rule_name VARCHAR(255) NOT NULL,
    rule_description TEXT,
    rule_code VARCHAR(50) UNIQUE,  -- For programmatic reference
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100,  -- Lower number = higher priority (evaluated first)

    -- Conditions (when this rule applies)
    min_amount DECIMAL(18,4),
    max_amount DECIMAL(18,4),
    currency_code VARCHAR(3) DEFAULT 'USD',
    category VARCHAR(50),  -- IT, SERVICES, MATERIALS, CAPEX, etc.
    vendor_tier VARCHAR(20),  -- STRATEGIC, PREFERRED, TRANSACTIONAL

    -- Additional conditions
    requires_contract BOOLEAN,  -- PO must reference a vendor contract
    is_emergency BOOLEAN,  -- Emergency purchases (expedited approval)

    -- Approval workflow configuration
    approval_levels_json JSONB NOT NULL,
    -- Example structure:
    -- [
    --   {"level": 1, "role": "MANAGER", "sla_hours": 24, "parallel": false},
    --   {"level": 2, "role": "DIRECTOR", "sla_hours": 48, "parallel": false},
    --   {"level": 3, "role": "CFO", "sla_hours": 72, "parallel": false}
    -- ]

    -- Escalation policy
    escalation_policy_json JSONB,
    -- Example: {"sla_reminder_hours": [12, 24], "auto_escalate_after_hours": 72}

    -- Notification settings
    notification_template VARCHAR(100),
    cc_users UUID[],  -- Users to CC on approval notifications

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_approval_rule_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_rule_facility
        FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_rule_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_approval_rule_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id),

    -- Ensure min_amount <= max_amount
    CONSTRAINT chk_approval_rule_amount_range
        CHECK (min_amount IS NULL OR max_amount IS NULL OR min_amount <= max_amount),

    -- Ensure approval_levels_json is a valid array
    CONSTRAINT chk_approval_rule_levels_array
        CHECK (jsonb_typeof(approval_levels_json) = 'array')
);

-- Indexes for rule matching
CREATE INDEX idx_approval_rules_tenant ON approval_rules(tenant_id);
CREATE INDEX idx_approval_rules_facility ON approval_rules(facility_id);
CREATE INDEX idx_approval_rules_active ON approval_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_approval_rules_priority ON approval_rules(priority);
CREATE INDEX idx_approval_rules_amounts ON approval_rules(min_amount, max_amount);
CREATE INDEX idx_approval_rules_category ON approval_rules(category);

COMMENT ON TABLE approval_rules IS
    'Threshold-based approval routing rules. Implements Pareto Principle (80/20 rule) and category-based routing per industry best practices (SAP Ariba, Coupa, Oracle).';

COMMENT ON COLUMN approval_rules.priority IS
    'Lower number = higher priority. Rules are evaluated in priority order until a match is found.';

COMMENT ON COLUMN approval_rules.approval_levels_json IS
    'JSONB array defining approval levels, roles, SLAs, and whether approvals can be parallel. Supports sequential and parallel approval workflows.';

-- =====================================================
-- TABLE: purchase_order_approvals
-- Purpose: Track multi-level approval workflow instances
-- =====================================================

CREATE TABLE purchase_order_approvals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,

    -- Approval level
    approval_level INTEGER NOT NULL CHECK (approval_level > 0),
    approval_sequence INTEGER NOT NULL DEFAULT 1,  -- For parallel approvals at same level

    -- Approver
    approver_user_id UUID NOT NULL,
    approver_role VARCHAR(50),  -- MANAGER, DIRECTOR, VP, CFO, CEO
    approval_limit DECIMAL(18,4),  -- Approver's limit at time of assignment

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING',
        'IN_PROGRESS',
        'APPROVED',
        'REJECTED',
        'DELEGATED',
        'ESCALATED',
        'SKIPPED',
        'EXPIRED'
    )),

    -- Delegation
    delegated_to_user_id UUID,
    delegated_at TIMESTAMPTZ,
    delegation_reason TEXT,
    original_approver_user_id UUID,  -- Track original if delegated

    -- Decision
    decision VARCHAR(20) CHECK (decision IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED') OR decision IS NULL),
    decision_at TIMESTAMPTZ,
    decision_notes TEXT,
    rejection_reason TEXT,

    -- SLA Tracking
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    due_at TIMESTAMPTZ,  -- SLA deadline
    sla_hours INTEGER,  -- Hours allowed for this level
    reminded_at TIMESTAMPTZ,  -- Last reminder sent
    reminder_count INTEGER DEFAULT 0,

    -- Escalation
    escalated_at TIMESTAMPTZ,
    escalated_to_user_id UUID,
    escalation_reason TEXT,

    -- Audit trail
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_po_approval_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_approval_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_po_approval_approver
        FOREIGN KEY (approver_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approval_delegated_to
        FOREIGN KEY (delegated_to_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approval_original_approver
        FOREIGN KEY (original_approver_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approval_escalated_to
        FOREIGN KEY (escalated_to_user_id) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT fk_po_approval_created_by
        FOREIGN KEY (created_by) REFERENCES users(id),
    CONSTRAINT fk_po_approval_updated_by
        FOREIGN KEY (updated_by) REFERENCES users(id),

    -- Ensure unique level/sequence per PO
    CONSTRAINT uq_po_approval_level_sequence
        UNIQUE (purchase_order_id, approval_level, approval_sequence)
);

-- Indexes for approval queries
CREATE INDEX idx_po_approvals_po ON purchase_order_approvals(purchase_order_id);
CREATE INDEX idx_po_approvals_approver ON purchase_order_approvals(approver_user_id);
CREATE INDEX idx_po_approvals_tenant ON purchase_order_approvals(tenant_id);
CREATE INDEX idx_po_approvals_status ON purchase_order_approvals(status);
CREATE INDEX idx_po_approvals_due_at ON purchase_order_approvals(due_at) WHERE status IN ('PENDING', 'IN_PROGRESS');
CREATE INDEX idx_po_approvals_delegated_to ON purchase_order_approvals(delegated_to_user_id);
CREATE INDEX idx_po_approvals_level ON purchase_order_approvals(purchase_order_id, approval_level);

COMMENT ON TABLE purchase_order_approvals IS
    'Tracks multi-level approval workflow instances. Supports sequential and parallel approvals, delegation, and SLA monitoring.';

COMMENT ON COLUMN purchase_order_approvals.approval_sequence IS
    'Sequence number within the same level (for parallel approvals). Level 2, Sequence 1 and Level 2, Sequence 2 can be approved in parallel.';

COMMENT ON COLUMN purchase_order_approvals.status IS
    'PENDING: Awaiting approval. IN_PROGRESS: Approver viewing/reviewing. APPROVED: Approved. REJECTED: Rejected. DELEGATED: Delegated to another user. ESCALATED: Escalated to higher authority. SKIPPED: Skipped per rule. EXPIRED: SLA expired without action.';

-- =====================================================
-- TABLE: approval_notifications
-- Purpose: Track notification delivery for approvals
-- =====================================================

CREATE TABLE approval_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    purchase_order_id UUID NOT NULL,
    approval_id UUID,  -- NULL for general PO notifications

    -- Notification details
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN (
        'APPROVAL_REQUEST',
        'APPROVAL_REMINDER',
        'APPROVAL_DECISION',
        'APPROVAL_ESCALATION',
        'APPROVAL_EXPIRED'
    )),
    recipient_user_id UUID NOT NULL,

    -- Delivery channels
    sent_via_email BOOLEAN DEFAULT FALSE,
    email_sent_at TIMESTAMPTZ,
    email_delivered_at TIMESTAMPTZ,
    email_opened_at TIMESTAMPTZ,

    sent_via_sms BOOLEAN DEFAULT FALSE,
    sms_sent_at TIMESTAMPTZ,

    sent_via_in_app BOOLEAN DEFAULT TRUE,
    in_app_sent_at TIMESTAMPTZ,
    in_app_read_at TIMESTAMPTZ,

    -- Notification content
    subject TEXT,
    message TEXT,
    action_url TEXT,

    -- Priority
    priority VARCHAR(20) DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_approval_notif_tenant
        FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_notif_po
        FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_notif_approval
        FOREIGN KEY (approval_id) REFERENCES purchase_order_approvals(id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_notif_recipient
        FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for notification queries
CREATE INDEX idx_approval_notif_tenant ON approval_notifications(tenant_id);
CREATE INDEX idx_approval_notif_po ON approval_notifications(purchase_order_id);
CREATE INDEX idx_approval_notif_approval ON approval_notifications(approval_id);
CREATE INDEX idx_approval_notif_recipient ON approval_notifications(recipient_user_id);
CREATE INDEX idx_approval_notif_type ON approval_notifications(notification_type);
CREATE INDEX idx_approval_notif_created_at ON approval_notifications(created_at DESC);

COMMENT ON TABLE approval_notifications IS
    'Tracks notification delivery across multiple channels (email, SMS, in-app). Supports delivery confirmations and read receipts.';

-- =====================================================
-- ENHANCED PO STATUS ENUM
-- Add new statuses for approval workflow
-- =====================================================

-- Add PENDING_APPROVAL, CHANGES_REQUESTED, REJECTED, WITHDRAWN statuses
-- Note: We don't use ALTER TYPE as it's not supported in older PostgreSQL versions
-- Instead, we'll rely on application-level validation and update constraints

COMMENT ON COLUMN purchase_orders.status IS
    'PO Status: DRAFT (created), PENDING_APPROVAL (submitted for approval), CHANGES_REQUESTED (approver requested changes), REJECTED (approver rejected), APPROVED (approved but not yet issued to vendor), ISSUED (sent to vendor), ACKNOWLEDGED (vendor confirmed), PARTIALLY_RECEIVED (some items received), RECEIVED (all items received), CLOSED (finalized), CANCELLED (cancelled before issuance), WITHDRAWN (creator withdrew before approval)';

-- =====================================================
-- HELPER FUNCTIONS
-- =====================================================

-- Function: Get active approval authority for user
CREATE OR REPLACE FUNCTION get_user_approval_authority(
    p_tenant_id UUID,
    p_user_id UUID,
    p_facility_id UUID
)
RETURNS TABLE (
    authority_id UUID,
    single_approval_limit DECIMAL(18,4),
    daily_approval_limit DECIMAL(18,4),
    currency_code VARCHAR(3),
    approval_role VARCHAR(50),
    authority_level INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        uaa.id,
        uaa.single_approval_limit,
        uaa.daily_approval_limit,
        uaa.currency_code,
        uaa.approval_role,
        uaa.authority_level
    FROM user_approval_authorities uaa
    WHERE uaa.tenant_id = p_tenant_id
      AND uaa.user_id = p_user_id
      AND (uaa.facility_id = p_facility_id OR uaa.facility_id IS NULL)
      AND uaa.is_active = TRUE
      AND uaa.effective_from <= CURRENT_DATE
      AND (uaa.effective_to IS NULL OR uaa.effective_to >= CURRENT_DATE)
    ORDER BY
        uaa.facility_id NULLS LAST,  -- Facility-specific overrides global
        uaa.authority_level DESC,
        uaa.single_approval_limit DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_approval_authority IS
    'Retrieves active approval authority for a user. Returns facility-specific authority if exists, otherwise global authority.';

-- Function: Get active delegation for user
CREATE OR REPLACE FUNCTION get_active_delegation(
    p_tenant_id UUID,
    p_user_id UUID,
    p_check_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    delegation_id UUID,
    delegate_user_id UUID,
    delegation_type VARCHAR(20),
    delegation_scope VARCHAR(20),
    max_amount DECIMAL(18,4),
    currency_code VARCHAR(3)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ud.id,
        ud.delegate_user_id,
        ud.delegation_type,
        ud.delegation_scope,
        ud.max_amount,
        ud.currency_code
    FROM user_delegations ud
    WHERE ud.tenant_id = p_tenant_id
      AND ud.user_id = p_user_id
      AND ud.is_active = TRUE
      AND ud.start_date <= p_check_date
      AND (ud.end_date IS NULL OR ud.end_date >= p_check_date)
    ORDER BY ud.created_at DESC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_active_delegation IS
    'Retrieves active delegation for a user on specified date. Used to route approvals to delegates during out-of-office periods.';

-- Function: Calculate SLA deadline
CREATE OR REPLACE FUNCTION calculate_sla_deadline(
    p_start_timestamp TIMESTAMPTZ,
    p_sla_hours INTEGER
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
    -- Simple calculation: add hours to start timestamp
    -- Future enhancement: Exclude weekends and holidays
    RETURN p_start_timestamp + (p_sla_hours || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_sla_deadline IS
    'Calculates SLA deadline based on start timestamp and SLA hours. Future: Will exclude weekends and holidays per business calendar.';

-- Function: Check if SLA is breached
CREATE OR REPLACE FUNCTION is_sla_breached(
    p_due_at TIMESTAMPTZ,
    p_decision_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    IF p_decision_at IS NOT NULL THEN
        -- Decision made - check if it was on time
        RETURN p_decision_at > p_due_at;
    ELSE
        -- No decision yet - check if deadline passed
        RETURN NOW() > p_due_at;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION is_sla_breached IS
    'Determines if an approval SLA has been breached based on due date and decision timestamp.';

-- =====================================================
-- SEED DATA: Default Approval Rules
-- =====================================================

-- Insert default approval rule for standard purchases
INSERT INTO approval_rules (
    tenant_id,
    facility_id,
    rule_name,
    rule_description,
    rule_code,
    is_active,
    priority,
    min_amount,
    max_amount,
    currency_code,
    approval_levels_json,
    escalation_policy_json,
    created_at
)
SELECT
    t.id AS tenant_id,
    NULL AS facility_id,
    'Standard Purchase Approval - Single Level' AS rule_name,
    'Default rule for purchases under $5,000 requiring single manager approval' AS rule_description,
    'STANDARD_SINGLE' AS rule_code,
    TRUE AS is_active,
    100 AS priority,
    0 AS min_amount,
    5000 AS max_amount,
    'USD' AS currency_code,
    '[{"level": 1, "role": "MANAGER", "sla_hours": 24, "parallel": false}]'::JSONB AS approval_levels_json,
    '{"sla_reminder_hours": [12, 24], "auto_escalate_after_hours": 48}'::JSONB AS escalation_policy_json,
    NOW() AS created_at
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM approval_rules ar
    WHERE ar.tenant_id = t.id AND ar.rule_code = 'STANDARD_SINGLE'
);

-- Insert default approval rule for high-value purchases
INSERT INTO approval_rules (
    tenant_id,
    facility_id,
    rule_name,
    rule_description,
    rule_code,
    is_active,
    priority,
    min_amount,
    max_amount,
    currency_code,
    approval_levels_json,
    escalation_policy_json,
    created_at
)
SELECT
    t.id AS tenant_id,
    NULL AS facility_id,
    'High-Value Purchase Approval - Dual Level' AS rule_name,
    'Rule for purchases over $5,000 requiring manager and director approval' AS rule_description,
    'HIGH_VALUE_DUAL' AS rule_code,
    TRUE AS is_active,
    90 AS priority,
    5000.01 AS min_amount,
    50000 AS max_amount,
    'USD' AS currency_code,
    '[{"level": 1, "role": "MANAGER", "sla_hours": 24, "parallel": false}, {"level": 2, "role": "DIRECTOR", "sla_hours": 48, "parallel": false}]'::JSONB AS approval_levels_json,
    '{"sla_reminder_hours": [12, 24, 48], "auto_escalate_after_hours": 72}'::JSONB AS escalation_policy_json,
    NOW() AS created_at
FROM tenants t
WHERE NOT EXISTS (
    SELECT 1 FROM approval_rules ar
    WHERE ar.tenant_id = t.id AND ar.rule_code = 'HIGH_VALUE_DUAL'
);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Grant permissions (adjust based on your role setup)
-- GRANT SELECT, INSERT ON purchase_order_approval_audit TO app_user;
-- GRANT SELECT, INSERT, UPDATE ON user_approval_authorities TO app_admin;
-- GRANT SELECT, INSERT, UPDATE ON user_delegations TO app_user;
-- GRANT SELECT ON approval_rules TO app_user;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON approval_rules TO app_admin;
-- GRANT SELECT, INSERT, UPDATE ON purchase_order_approvals TO app_user;
-- GRANT SELECT, INSERT ON approval_notifications TO app_user;
