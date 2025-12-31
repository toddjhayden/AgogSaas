-- V1.2.20: Create Deployment Approval Workflow Tables
-- Description: Database schema for deployment approval workflows with SLA tracking and audit trail

-- ==============================================================================
-- DEPLOYMENT APPROVAL WORKFLOWS TABLE
-- ==============================================================================
CREATE TABLE deployment_approval_workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL,

  -- Workflow Identity
  workflow_name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Environment Targeting
  environment VARCHAR(50) NOT NULL CHECK (environment IN ('STAGING', 'PRE_PRODUCTION', 'PRODUCTION', 'DISASTER_RECOVERY')),

  -- SLA Configuration
  default_sla_hours INT NOT NULL DEFAULT 24,
  escalation_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Auto-Approval Rules
  auto_approve_for_minor_updates BOOLEAN DEFAULT FALSE,
  auto_approve_max_severity VARCHAR(20) CHECK (auto_approve_max_severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  -- Status & Priority
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,

  -- Audit Fields
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  CONSTRAINT unique_workflow_name_per_tenant UNIQUE (tenant_id, workflow_name)
);

CREATE INDEX idx_deployment_workflows_tenant ON deployment_approval_workflows(tenant_id);
CREATE INDEX idx_deployment_workflows_environment ON deployment_approval_workflows(environment);
CREATE INDEX idx_deployment_workflows_active ON deployment_approval_workflows(is_active, priority DESC);

COMMENT ON TABLE deployment_approval_workflows IS 'Deployment approval workflow configurations per environment';

-- ==============================================================================
-- DEPLOYMENT APPROVAL WORKFLOW STEPS TABLE
-- ==============================================================================
CREATE TABLE deployment_approval_workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID NOT NULL REFERENCES deployment_approval_workflows(id) ON DELETE CASCADE,
  tenant_id VARCHAR(50) NOT NULL,

  -- Step Configuration
  step_number INT NOT NULL,
  step_name VARCHAR(200) NOT NULL,
  description TEXT,

  -- Approver Assignment (ONE of these should be set)
  approver_id VARCHAR(100),         -- Specific user ID
  approver_role VARCHAR(100),       -- Role-based (e.g., 'devops_lead', 'cto')
  approver_group VARCHAR(100),      -- Group-based (e.g., 'release_managers')

  -- Step Settings
  sla_hours INT,
  allow_delegation BOOLEAN NOT NULL DEFAULT TRUE,
  can_skip BOOLEAN NOT NULL DEFAULT FALSE,
  requires_all_approvers BOOLEAN NOT NULL DEFAULT FALSE,

  -- Audit
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT unique_step_per_workflow UNIQUE (workflow_id, step_number)
);

CREATE INDEX idx_workflow_steps_workflow ON deployment_approval_workflow_steps(workflow_id);
CREATE INDEX idx_workflow_steps_approver_role ON deployment_approval_workflow_steps(approver_role);

COMMENT ON TABLE deployment_approval_workflow_steps IS 'Individual approval steps within deployment workflows';

-- ==============================================================================
-- DEPLOYMENTS TABLE
-- ==============================================================================
CREATE TABLE deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL,
  deployment_number VARCHAR(50) NOT NULL,

  -- Deployment Details
  title VARCHAR(300) NOT NULL,
  description TEXT,
  environment VARCHAR(50) NOT NULL CHECK (environment IN ('STAGING', 'PRE_PRODUCTION', 'PRODUCTION', 'DISASTER_RECOVERY')),
  version VARCHAR(100) NOT NULL,
  deployed_by VARCHAR(100) NOT NULL,

  -- Deployment Metadata
  git_commit_hash VARCHAR(100),
  git_branch VARCHAR(200),
  release_notes TEXT,

  -- Status & Timing
  status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'IN_PROGRESS', 'DEPLOYED', 'FAILED', 'ROLLED_BACK', 'CANCELLED')
  ),
  scheduled_deployment_time TIMESTAMP,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP,
  deployed_at TIMESTAMP,

  -- Approval Workflow
  current_approval_workflow_id UUID REFERENCES deployment_approval_workflows(id),
  current_approval_step INT,
  approval_started_at TIMESTAMP,
  approval_completed_at TIMESTAMP,
  pending_approver_id VARCHAR(100),

  -- Health & Rollback
  pre_deployment_health_check VARCHAR(20) CHECK (pre_deployment_health_check IN ('PENDING', 'PASSED', 'FAILED', 'SKIPPED')),
  post_deployment_health_check VARCHAR(20) CHECK (post_deployment_health_check IN ('PENDING', 'PASSED', 'FAILED', 'SKIPPED')),
  rollback_available BOOLEAN NOT NULL DEFAULT TRUE,
  auto_rollback_enabled BOOLEAN NOT NULL DEFAULT TRUE,

  -- Urgency & SLA
  urgency VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (urgency IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  sla_deadline TIMESTAMP,

  -- Audit Trail
  created_by VARCHAR(100) NOT NULL,
  updated_by VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  CONSTRAINT unique_deployment_number UNIQUE (tenant_id, deployment_number)
);

CREATE INDEX idx_deployments_tenant ON deployments(tenant_id);
CREATE INDEX idx_deployments_status ON deployments(status);
CREATE INDEX idx_deployments_environment ON deployments(environment);
CREATE INDEX idx_deployments_pending_approver ON deployments(pending_approver_id);
CREATE INDEX idx_deployments_sla_deadline ON deployments(sla_deadline) WHERE status = 'PENDING_APPROVAL';
CREATE INDEX idx_deployments_scheduled ON deployments(scheduled_deployment_time) WHERE status = 'APPROVED';

COMMENT ON TABLE deployments IS 'Deployment requests requiring approval and tracking';

-- ==============================================================================
-- DEPLOYMENT APPROVAL HISTORY TABLE
-- ==============================================================================
CREATE TABLE deployment_approval_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  tenant_id VARCHAR(50) NOT NULL,

  -- Action Details
  action VARCHAR(50) NOT NULL CHECK (
    action IN ('SUBMITTED', 'APPROVED', 'REJECTED', 'DELEGATED', 'ESCALATED',
               'REQUESTED_CHANGES', 'CANCELLED', 'HEALTH_CHECK_PASSED',
               'HEALTH_CHECK_FAILED', 'DEPLOYED', 'ROLLED_BACK')
  ),
  action_by_user_id VARCHAR(100),
  action_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Approval Context
  approval_step INT,
  comments TEXT,

  -- Delegation
  delegated_to_user_id VARCHAR(100),

  -- Escalation
  is_escalated BOOLEAN NOT NULL DEFAULT FALSE,
  escalation_reason TEXT,

  -- Change Request
  change_request TEXT,

  -- Metadata
  metadata JSONB,

  -- Immutable audit record
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_deployment_history_deployment ON deployment_approval_history(deployment_id, action_at DESC);
CREATE INDEX idx_deployment_history_tenant ON deployment_approval_history(tenant_id);
CREATE INDEX idx_deployment_history_action ON deployment_approval_history(action);
CREATE INDEX idx_deployment_history_user ON deployment_approval_history(action_by_user_id);

COMMENT ON TABLE deployment_approval_history IS 'Immutable audit trail for all deployment approval actions';

-- ==============================================================================
-- DEPLOYMENT APPROVAL QUEUE VIEW
-- ==============================================================================
CREATE OR REPLACE VIEW v_pending_deployment_approvals AS
SELECT
  d.id AS deployment_id,
  d.deployment_number,
  d.tenant_id,
  d.title,
  d.environment,
  d.version,
  d.deployed_by,
  d.requested_at,
  d.current_approval_step AS current_step,
  daw.workflow_name,
  daws.step_name AS step_description,
  d.pending_approver_id,
  d.urgency,
  d.sla_deadline,
  d.pre_deployment_health_check,

  -- Calculate SLA remaining hours
  CASE
    WHEN d.sla_deadline IS NULL THEN NULL
    ELSE EXTRACT(EPOCH FROM (d.sla_deadline - CURRENT_TIMESTAMP)) / 3600
  END AS sla_remaining_hours,

  -- Determine if overdue
  CASE
    WHEN d.sla_deadline IS NOT NULL AND CURRENT_TIMESTAMP > d.sla_deadline THEN TRUE
    ELSE FALSE
  END AS is_overdue,

  -- Urgency level for dashboard
  CASE
    WHEN d.sla_deadline IS NOT NULL AND CURRENT_TIMESTAMP > d.sla_deadline THEN 'URGENT'
    WHEN d.sla_deadline IS NOT NULL AND (EXTRACT(EPOCH FROM (d.sla_deadline - CURRENT_TIMESTAMP)) / 3600) < 4 THEN 'WARNING'
    ELSE 'NORMAL'
  END AS urgency_level,

  -- Count total steps in workflow
  (SELECT COUNT(*) FROM deployment_approval_workflow_steps WHERE workflow_id = d.current_approval_workflow_id) AS total_steps

FROM deployments d
LEFT JOIN deployment_approval_workflows daw ON d.current_approval_workflow_id = daw.id
LEFT JOIN deployment_approval_workflow_steps daws ON daw.id = daws.workflow_id AND daws.step_number = d.current_approval_step

WHERE d.status = 'PENDING_APPROVAL'
  AND d.pending_approver_id IS NOT NULL;

COMMENT ON VIEW v_pending_deployment_approvals IS 'Optimized view for pending deployment approval dashboard with SLA calculations';

-- ==============================================================================
-- DEPLOYMENT APPROVAL STATISTICS FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION get_deployment_approval_stats(p_tenant_id VARCHAR)
RETURNS TABLE (
  total_pending BIGINT,
  critical_pending BIGINT,
  overdue_count BIGINT,
  warning_count BIGINT,
  production_pending BIGINT,
  staging_pending BIGINT,
  approved_last_24h BIGINT,
  rejected_last_24h BIGINT,
  deployed_last_24h BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total pending approvals
    (SELECT COUNT(*) FROM deployments WHERE tenant_id = p_tenant_id AND status = 'PENDING_APPROVAL')::BIGINT,

    -- Critical urgency pending
    (SELECT COUNT(*) FROM deployments WHERE tenant_id = p_tenant_id AND status = 'PENDING_APPROVAL' AND urgency = 'CRITICAL')::BIGINT,

    -- Overdue count
    (SELECT COUNT(*) FROM deployments WHERE tenant_id = p_tenant_id AND status = 'PENDING_APPROVAL' AND sla_deadline < CURRENT_TIMESTAMP)::BIGINT,

    -- Warning count (approaching SLA, < 4 hours)
    (SELECT COUNT(*) FROM deployments
     WHERE tenant_id = p_tenant_id
       AND status = 'PENDING_APPROVAL'
       AND sla_deadline IS NOT NULL
       AND EXTRACT(EPOCH FROM (sla_deadline - CURRENT_TIMESTAMP)) / 3600 < 4
       AND sla_deadline >= CURRENT_TIMESTAMP)::BIGINT,

    -- Production pending
    (SELECT COUNT(*) FROM deployments WHERE tenant_id = p_tenant_id AND status = 'PENDING_APPROVAL' AND environment = 'PRODUCTION')::BIGINT,

    -- Staging pending
    (SELECT COUNT(*) FROM deployments WHERE tenant_id = p_tenant_id AND status = 'PENDING_APPROVAL' AND environment = 'STAGING')::BIGINT,

    -- Approved last 24h
    (SELECT COUNT(*) FROM deployment_approval_history
     WHERE tenant_id = p_tenant_id
       AND action = 'APPROVED'
       AND action_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours')::BIGINT,

    -- Rejected last 24h
    (SELECT COUNT(*) FROM deployment_approval_history
     WHERE tenant_id = p_tenant_id
       AND action = 'REJECTED'
       AND action_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours')::BIGINT,

    -- Deployed last 24h
    (SELECT COUNT(*) FROM deployment_approval_history
     WHERE tenant_id = p_tenant_id
       AND action = 'DEPLOYED'
       AND action_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours')::BIGINT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_deployment_approval_stats IS 'Calculate deployment approval statistics for dashboard';

-- ==============================================================================
-- DEPLOYMENT NUMBER SEQUENCE FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION generate_deployment_number(p_tenant_id VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_next_num INT;
  v_deployment_number VARCHAR;
BEGIN
  -- Get the next deployment number for this tenant
  SELECT COALESCE(MAX(CAST(SUBSTRING(deployment_number FROM 'DEPLOY-(\d+)') AS INT)), 0) + 1
  INTO v_next_num
  FROM deployments
  WHERE tenant_id = p_tenant_id;

  -- Format as DEPLOY-XXXXXX
  v_deployment_number := 'DEPLOY-' || LPAD(v_next_num::TEXT, 6, '0');

  RETURN v_deployment_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_deployment_number IS 'Generate sequential deployment numbers per tenant';

-- ==============================================================================
-- SAMPLE DATA: DEFAULT DEPLOYMENT WORKFLOWS
-- ==============================================================================

-- Production Deployment Workflow (High Security)
INSERT INTO deployment_approval_workflows (
  tenant_id, workflow_name, description, environment,
  default_sla_hours, escalation_enabled, priority,
  is_active, created_by
) VALUES (
  'default', 'Production Standard Approval',
  'Standard multi-level approval for production deployments',
  'PRODUCTION', 24, TRUE, 100, TRUE, 'system'
);

-- Get the workflow ID for adding steps
DO $$
DECLARE
  v_workflow_id UUID;
BEGIN
  SELECT id INTO v_workflow_id
  FROM deployment_approval_workflows
  WHERE tenant_id = 'default' AND workflow_name = 'Production Standard Approval';

  -- Step 1: DevOps Lead Approval
  INSERT INTO deployment_approval_workflow_steps (
    workflow_id, tenant_id, step_number, step_name, description,
    approver_role, sla_hours, allow_delegation, can_skip, requires_all_approvers
  ) VALUES (
    v_workflow_id, 'default', 1, 'DevOps Lead Review',
    'DevOps lead reviews deployment plan and health checks',
    'devops_lead', 8, TRUE, FALSE, FALSE
  );

  -- Step 2: Engineering Manager Approval
  INSERT INTO deployment_approval_workflow_steps (
    workflow_id, tenant_id, step_number, step_name, description,
    approver_role, sla_hours, allow_delegation, can_skip, requires_all_approvers
  ) VALUES (
    v_workflow_id, 'default', 2, 'Engineering Manager Approval',
    'Engineering manager approves production deployment',
    'engineering_manager', 8, TRUE, FALSE, FALSE
  );

  -- Step 3: CTO Final Approval (for critical deployments)
  INSERT INTO deployment_approval_workflow_steps (
    workflow_id, tenant_id, step_number, step_name, description,
    approver_role, sla_hours, allow_delegation, can_skip, requires_all_approvers
  ) VALUES (
    v_workflow_id, 'default', 3, 'CTO Final Approval',
    'CTO final sign-off for production deployment',
    'cto', 8, FALSE, TRUE, FALSE
  );
END $$;

-- Staging Deployment Workflow (Faster Approval)
INSERT INTO deployment_approval_workflows (
  tenant_id, workflow_name, description, environment,
  default_sla_hours, escalation_enabled, priority,
  is_active, created_by
) VALUES (
  'default', 'Staging Fast Track',
  'Simplified approval for staging deployments',
  'STAGING', 4, TRUE, 100, TRUE, 'system'
);

DO $$
DECLARE
  v_workflow_id UUID;
BEGIN
  SELECT id INTO v_workflow_id
  FROM deployment_approval_workflows
  WHERE tenant_id = 'default' AND workflow_name = 'Staging Fast Track';

  -- Single step: DevOps Lead Approval
  INSERT INTO deployment_approval_workflow_steps (
    workflow_id, tenant_id, step_number, step_name, description,
    approver_role, sla_hours, allow_delegation, can_skip, requires_all_approvers
  ) VALUES (
    v_workflow_id, 'default', 1, 'DevOps Approval',
    'DevOps approval for staging deployment',
    'devops_lead', 4, TRUE, FALSE, FALSE
  );
END $$;

-- Critical Hotfix Workflow (Emergency)
INSERT INTO deployment_approval_workflows (
  tenant_id, workflow_name, description, environment,
  default_sla_hours, escalation_enabled, priority,
  auto_approve_for_minor_updates, auto_approve_max_severity,
  is_active, created_by
) VALUES (
  'default', 'Emergency Hotfix',
  'Expedited approval for critical production hotfixes',
  'PRODUCTION', 2, TRUE, 200, FALSE, NULL, TRUE, 'system'
);

DO $$
DECLARE
  v_workflow_id UUID;
BEGIN
  SELECT id INTO v_workflow_id
  FROM deployment_approval_workflows
  WHERE tenant_id = 'default' AND workflow_name = 'Emergency Hotfix';

  -- Fast-tracked approval
  INSERT INTO deployment_approval_workflow_steps (
    workflow_id, tenant_id, step_number, step_name, description,
    approver_role, sla_hours, allow_delegation, can_skip, requires_all_approvers
  ) VALUES (
    v_workflow_id, 'default', 1, 'On-Call Approval',
    'On-call engineer approves emergency hotfix',
    'on_call_engineer', 1, TRUE, FALSE, FALSE
  );
END $$;

-- ==============================================================================
-- GRANTS
-- ==============================================================================
GRANT SELECT, INSERT, UPDATE ON deployment_approval_workflows TO app_user;
GRANT SELECT, INSERT ON deployment_approval_workflow_steps TO app_user;
GRANT SELECT, INSERT, UPDATE ON deployments TO app_user;
GRANT SELECT, INSERT ON deployment_approval_history TO app_user;
GRANT SELECT ON v_pending_deployment_approvals TO app_user;
GRANT EXECUTE ON FUNCTION get_deployment_approval_stats TO app_user;
GRANT EXECUTE ON FUNCTION generate_deployment_number TO app_user;
