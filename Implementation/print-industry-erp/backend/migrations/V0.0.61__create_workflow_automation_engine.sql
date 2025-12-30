-- =====================================================
-- Workflow Automation Engine - Core Infrastructure
-- Migration: V0.0.61
-- Description: Create generalized workflow automation engine
--              Extends existing PO approval workflow patterns
-- REQ: REQ-STRATEGIC-AUTO-1767108044309
-- =====================================================

-- =====================================================
-- 1. WORKFLOW DEFINITIONS (Templates)
-- =====================================================

CREATE TABLE workflow_definitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  -- Definition metadata
  name VARCHAR(255) NOT NULL,
  description TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,
  category VARCHAR(100), -- 'approval', 'automation', 'notification', etc.

  -- Trigger configuration
  trigger_config JSONB NOT NULL DEFAULT '{
    "type": "manual",
    "event_subject": null,
    "cron_schedule": null
  }'::jsonb,
  -- trigger_config structure:
  -- {
  --   "type": "manual" | "scheduled" | "event" | "api",
  --   "event_subject": "agog.entity.created" (for event triggers),
  --   "cron_schedule": "0 9 * * *" (for scheduled triggers)
  -- }

  -- Workflow nodes (steps/tasks)
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- nodes structure: array of WorkflowNode
  -- {
  --   "id": "node_1",
  --   "node_type": "approval" | "service_task" | "user_task" | "gateway" | "sub_workflow",
  --   "name": "Manager Approval",
  --   "approver_user_id": "uuid",
  --   "approver_role": "manager",
  --   "approval_logic": "SEQUENTIAL" | "PARALLEL" | "ANY_ONE",
  --   "service_type": "agent_spawn" | "http_call" | "database_query" | "email_send",
  --   "service_config": {...},
  --   "form_fields": [...],
  --   "assigned_user_id": "uuid",
  --   "assigned_role": "estimator",
  --   "condition_type": "amount_based" | "field_value" | "expression",
  --   "condition_expression": "context.amount > 10000",
  --   "sla_hours": 24,
  --   "timeout_action": "escalate" | "auto_approve" | "fail"
  -- }

  -- Routing rules
  routes JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- routes structure: array of WorkflowRoute
  -- {
  --   "from_node_id": "node_1",
  --   "to_node_id": "node_2",
  --   "condition": "context.approved === true",
  --   "is_default": false
  -- }

  -- Global SLA and escalation
  sla_hours INTEGER,
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_user_id UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Audit fields
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workflow_definitions_name_version_unique UNIQUE (tenant_id, name, version)
);

CREATE INDEX idx_workflow_definitions_tenant ON workflow_definitions(tenant_id);
CREATE INDEX idx_workflow_definitions_active ON workflow_definitions(tenant_id, is_active) WHERE is_active = true;
CREATE INDEX idx_workflow_definitions_category ON workflow_definitions(tenant_id, category);

COMMENT ON TABLE workflow_definitions IS 'Workflow templates - versioned definitions of business processes';
COMMENT ON COLUMN workflow_definitions.nodes IS 'Array of workflow nodes (tasks/approvals/gateways)';
COMMENT ON COLUMN workflow_definitions.routes IS 'Array of routing rules between nodes';
COMMENT ON COLUMN workflow_definitions.trigger_config IS 'Configuration for how workflow is triggered';

-- =====================================================
-- 2. WORKFLOW INSTANCES (Executions)
-- =====================================================

CREATE TABLE workflow_instances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE RESTRICT,
  workflow_name VARCHAR(255) NOT NULL,
  workflow_version INTEGER NOT NULL,

  -- Context (what is this workflow operating on?)
  context_entity_type VARCHAR(100), -- 'purchase_order', 'job', 'quote', 'vendor', etc.
  context_entity_id UUID, -- Foreign key to entity (polymorphic - not enforced)
  context_data JSONB DEFAULT '{}'::jsonb, -- Workflow variables and state

  -- Execution state
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  -- Status values: 'running', 'completed', 'failed', 'blocked', 'escalated', 'cancelled'
  current_node_id VARCHAR(100),

  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,

  -- Tracking
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workflow_instances_status_check CHECK (
    status IN ('running', 'completed', 'failed', 'blocked', 'escalated', 'cancelled')
  )
);

CREATE INDEX idx_workflow_instances_tenant_status ON workflow_instances(tenant_id, status);
CREATE INDEX idx_workflow_instances_entity ON workflow_instances(tenant_id, context_entity_type, context_entity_id);
CREATE INDEX idx_workflow_instances_sla ON workflow_instances(tenant_id, sla_deadline) WHERE status = 'running';
CREATE INDEX idx_workflow_instances_definition ON workflow_instances(workflow_definition_id);

COMMENT ON TABLE workflow_instances IS 'Running or completed workflow executions';
COMMENT ON COLUMN workflow_instances.context_entity_type IS 'Type of entity this workflow operates on';
COMMENT ON COLUMN workflow_instances.context_entity_id IS 'ID of entity (polymorphic reference)';
COMMENT ON COLUMN workflow_instances.context_data IS 'Workflow variables and execution state';

-- =====================================================
-- 3. WORKFLOW INSTANCE NODES (Execution Log)
-- =====================================================

CREATE TABLE workflow_instance_nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100) NOT NULL, -- From workflow definition
  node_name VARCHAR(255),
  node_type VARCHAR(50),

  -- Execution state
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  -- Status values: 'pending', 'in_progress', 'completed', 'failed', 'skipped'
  assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  sla_deadline TIMESTAMPTZ,

  -- Node result
  action VARCHAR(50), -- 'approved', 'rejected', 'completed', 'failed', 'delegated'
  action_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action_date TIMESTAMPTZ,
  comments TEXT,
  output_data JSONB, -- Node execution output/result

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workflow_instance_nodes_status_check CHECK (
    status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped')
  ),
  CONSTRAINT workflow_instance_nodes_action_check CHECK (
    action IS NULL OR action IN ('approved', 'rejected', 'completed', 'failed', 'delegated', 'escalated')
  )
);

CREATE INDEX idx_workflow_instance_nodes_instance ON workflow_instance_nodes(instance_id, created_at DESC);
CREATE INDEX idx_workflow_instance_nodes_assigned_user ON workflow_instance_nodes(tenant_id, assigned_user_id, status) WHERE status = 'in_progress';
CREATE INDEX idx_workflow_instance_nodes_sla ON workflow_instance_nodes(tenant_id, sla_deadline) WHERE status = 'in_progress' AND sla_deadline IS NOT NULL;

COMMENT ON TABLE workflow_instance_nodes IS 'Execution log of individual workflow nodes';
COMMENT ON COLUMN workflow_instance_nodes.node_id IS 'Node ID from workflow definition';
COMMENT ON COLUMN workflow_instance_nodes.output_data IS 'Data produced by this node execution';

-- =====================================================
-- 4. WORKFLOW INSTANCE HISTORY (Immutable Audit Trail)
-- =====================================================

CREATE TABLE workflow_instance_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
  node_id VARCHAR(100),

  -- Event details
  event_type VARCHAR(50) NOT NULL,
  -- Event types: 'started', 'node_entered', 'node_completed', 'approved', 'rejected',
  --              'escalated', 'completed', 'failed', 'delegated', 'cancelled'
  event_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_date TIMESTAMPTZ DEFAULT NOW(),

  -- Event context
  event_data JSONB, -- Event-specific data (comments, approvals, errors, etc.)
  instance_snapshot JSONB, -- Full instance state at time of event (for compliance)

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT workflow_instance_history_event_type_check CHECK (
    event_type IN ('started', 'node_entered', 'node_completed', 'approved', 'rejected',
                   'escalated', 'completed', 'failed', 'delegated', 'cancelled', 'sla_breached')
  )
);

CREATE INDEX idx_workflow_instance_history_instance ON workflow_instance_history(instance_id, event_date DESC);
CREATE INDEX idx_workflow_instance_history_event_type ON workflow_instance_history(tenant_id, event_type, event_date DESC);

COMMENT ON TABLE workflow_instance_history IS 'Immutable audit trail of all workflow events (SOX/GDPR compliance)';
COMMENT ON COLUMN workflow_instance_history.instance_snapshot IS 'Full state snapshot for compliance and rollback';

-- =====================================================
-- 5. USER TASK QUEUE (My Tasks View)
-- =====================================================

CREATE OR REPLACE VIEW v_user_task_queue AS
SELECT
  wii.id AS task_id,
  wii.instance_id,
  wi.workflow_name,
  wii.node_name AS task_name,
  wii.node_type,
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
  wii.created_at AS task_created_at,
  wii.tenant_id
FROM workflow_instance_nodes wii
INNER JOIN workflow_instances wi ON wii.instance_id = wi.id
WHERE wii.status = 'in_progress'
  AND wii.assigned_user_id IS NOT NULL;

COMMENT ON VIEW v_user_task_queue IS 'User-facing task queue with SLA urgency calculations';

-- =====================================================
-- 6. WORKFLOW ANALYTICS VIEW
-- =====================================================

CREATE OR REPLACE VIEW v_workflow_analytics AS
SELECT
  wd.id AS workflow_definition_id,
  wd.name AS workflow_name,
  wd.version AS workflow_version,
  wd.category,
  wd.tenant_id,
  COUNT(wi.id) AS total_instances,
  COUNT(wi.id) FILTER (WHERE wi.status = 'completed') AS completed_instances,
  COUNT(wi.id) FILTER (WHERE wi.status = 'failed') AS failed_instances,
  COUNT(wi.id) FILTER (WHERE wi.status = 'running') AS running_instances,
  COUNT(wi.id) FILTER (WHERE wi.status = 'escalated') AS escalated_instances,
  AVG(EXTRACT(EPOCH FROM (wi.completed_at - wi.started_at)) / 3600)
    FILTER (WHERE wi.status = 'completed') AS avg_completion_hours,
  COUNT(wi.id) FILTER (WHERE wi.status = 'completed' AND wi.completed_at <= wi.sla_deadline) AS on_time_completions,
  COUNT(wi.id) FILTER (WHERE wi.status = 'completed' AND wi.completed_at > wi.sla_deadline) AS late_completions,
  CASE
    WHEN COUNT(wi.id) FILTER (WHERE wi.status = 'completed') > 0
    THEN (COUNT(wi.id) FILTER (WHERE wi.status = 'completed' AND wi.completed_at <= wi.sla_deadline)::DECIMAL /
          COUNT(wi.id) FILTER (WHERE wi.status = 'completed')::DECIMAL) * 100
    ELSE NULL
  END AS sla_compliance_percentage
FROM workflow_definitions wd
LEFT JOIN workflow_instances wi ON wd.id = wi.workflow_definition_id
GROUP BY wd.id, wd.name, wd.version, wd.category, wd.tenant_id;

COMMENT ON VIEW v_workflow_analytics IS 'Workflow performance metrics and SLA compliance statistics';

-- =====================================================
-- 7. ROW LEVEL SECURITY POLICIES
-- =====================================================

ALTER TABLE workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instance_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_instance_history ENABLE ROW LEVEL SECURITY;

-- Workflow Definitions Policies
CREATE POLICY workflow_definitions_tenant_isolation ON workflow_definitions
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY workflow_definitions_insert ON workflow_definitions
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::UUID);

-- Workflow Instances Policies
CREATE POLICY workflow_instances_tenant_isolation ON workflow_instances
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY workflow_instances_insert ON workflow_instances
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::UUID);

-- Workflow Instance Nodes Policies
CREATE POLICY workflow_instance_nodes_tenant_isolation ON workflow_instance_nodes
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY workflow_instance_nodes_insert ON workflow_instance_nodes
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::UUID);

-- Workflow Instance History Policies (read-only for users)
CREATE POLICY workflow_instance_history_tenant_isolation ON workflow_instance_history
  USING (tenant_id = current_setting('app.current_tenant')::UUID);

CREATE POLICY workflow_instance_history_insert ON workflow_instance_history
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant')::UUID);

-- =====================================================
-- 8. UPDATED_AT TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_workflow_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_definitions_updated_at
  BEFORE UPDATE ON workflow_definitions
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

CREATE TRIGGER workflow_instances_updated_at
  BEFORE UPDATE ON workflow_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_updated_at();

-- =====================================================
-- 9. SAMPLE WORKFLOW TEMPLATES
-- =====================================================

-- Insert sample workflow: Simple Approval Workflow
-- Note: This would typically be created via API, but included for testing
INSERT INTO workflow_definitions (
  tenant_id,
  name,
  description,
  version,
  is_active,
  category,
  trigger_config,
  nodes,
  routes,
  sla_hours,
  escalation_enabled
) VALUES (
  (SELECT id FROM tenants LIMIT 1), -- Use first tenant for demo
  'Simple Purchase Approval',
  'Basic approval workflow for purchase orders under $10,000',
  1,
  true,
  'approval',
  '{
    "type": "manual",
    "event_subject": null,
    "cron_schedule": null
  }'::jsonb,
  '[
    {
      "id": "start",
      "node_type": "approval",
      "name": "Manager Approval",
      "approver_role": "manager",
      "approval_logic": "SEQUENTIAL",
      "sla_hours": 24,
      "timeout_action": "escalate"
    },
    {
      "id": "end",
      "node_type": "service_task",
      "name": "Complete Order",
      "service_type": "database_query",
      "service_config": {
        "action": "update_status",
        "table": "purchase_orders",
        "status": "approved"
      }
    }
  ]'::jsonb,
  '[
    {
      "from_node_id": "start",
      "to_node_id": "end",
      "is_default": true
    }
  ]'::jsonb,
  48,
  true
) ON CONFLICT DO NOTHING;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

COMMENT ON SCHEMA public IS 'Workflow Automation Engine v0.0.61 - Generic workflow infrastructure for business process automation';
