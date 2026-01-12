-- ============================================================================
-- V0.0.30: Workflow Directives
-- Flexible system for CTO/PMO to control agent workflow focus
-- ============================================================================

-- Main directives table - flexible, not enum-based
CREATE TABLE workflow_directives (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- What kind of directive (flexible string, not enum)
  -- Examples: 'focus', 'pause', 'priority_override', 'time_box', 'exclude'
  directive_type VARCHAR(100) NOT NULL,

  -- Human-readable name for GUI display
  display_name VARCHAR(255) NOT NULL,

  -- Target specification (what to focus on)
  -- Examples: 'blocker_chain', 'req', 'customer', 'tag', 'bu', 'priority', 'phase'
  target_type VARCHAR(100),
  target_value TEXT,                    -- The specific target (req number, customer name, etc.)
  target_req_numbers TEXT[],            -- Resolved list of REQ numbers in scope

  -- Flexible filter criteria (JSONB for any combination)
  -- Examples: {"priority": ["high", "critical"], "bu": ["core-infra"], "max_hours": 4}
  filter_criteria JSONB DEFAULT '{}',

  -- Time constraints
  expires_at TIMESTAMPTZ,               -- Auto-clear after this time (null = no expiry)

  -- Behavior flags
  auto_restore BOOLEAN DEFAULT true,    -- Restore previous state when complete?
  exclusive BOOLEAN DEFAULT true,       -- Block work outside this directive?

  -- Status
  is_active BOOLEAN DEFAULT true,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  deactivated_at TIMESTAMPTZ,
  deactivated_reason VARCHAR(255),      -- 'completed', 'expired', 'user_cancelled', 'superseded'

  -- Progress tracking
  total_items INTEGER DEFAULT 0,
  completed_items INTEGER DEFAULT 0,

  -- Audit
  created_by VARCHAR(100) NOT NULL,     -- 'ai-assist', 'gui', user email, etc.
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active directive at a time (for now - could relax later)
CREATE UNIQUE INDEX idx_workflow_directives_single_active
ON workflow_directives (is_active)
WHERE is_active = true;

-- Fast lookup for active directive
CREATE INDEX idx_workflow_directives_active
ON workflow_directives (is_active, activated_at DESC);

-- Track what agents were working on before directive activated
-- Allows restoration when directive completes
CREATE TABLE workflow_saved_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  directive_id UUID NOT NULL REFERENCES workflow_directives(id) ON DELETE CASCADE,

  -- What was being worked on
  agent_type VARCHAR(100),              -- 'orchestrator', 'roy', 'jen', 'sam', etc.
  agent_instance_id VARCHAR(255),       -- Specific instance if multiple

  previous_req_number VARCHAR(100),
  previous_phase VARCHAR(50),
  previous_context JSONB,               -- Any other state to restore

  -- Status
  restored BOOLEAN DEFAULT false,
  restored_at TIMESTAMPTZ,

  saved_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_saved_state_directive
ON workflow_saved_state (directive_id);

-- Function to get current active directive (if any)
CREATE OR REPLACE FUNCTION get_active_workflow_directive()
RETURNS TABLE (
  id UUID,
  directive_type VARCHAR(100),
  display_name VARCHAR(255),
  target_type VARCHAR(100),
  target_value TEXT,
  target_req_numbers TEXT[],
  filter_criteria JSONB,
  expires_at TIMESTAMPTZ,
  auto_restore BOOLEAN,
  exclusive BOOLEAN,
  total_items INTEGER,
  completed_items INTEGER,
  created_by VARCHAR(100),
  reason TEXT,
  activated_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    d.id,
    d.directive_type,
    d.display_name,
    d.target_type,
    d.target_value,
    d.target_req_numbers,
    d.filter_criteria,
    d.expires_at,
    d.auto_restore,
    d.exclusive,
    d.total_items,
    d.completed_items,
    d.created_by,
    d.reason,
    d.activated_at
  FROM workflow_directives d
  WHERE d.is_active = true
  ORDER BY d.activated_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a REQ is in scope of active directive
CREATE OR REPLACE FUNCTION is_req_in_active_scope(req_number_param VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  active_directive RECORD;
BEGIN
  SELECT * INTO active_directive FROM get_active_workflow_directive();

  -- No active directive = everything in scope
  IF active_directive.id IS NULL THEN
    RETURN true;
  END IF;

  -- Non-exclusive directive = everything in scope
  IF NOT active_directive.exclusive THEN
    RETURN true;
  END IF;

  -- Check if REQ is in target list
  IF active_directive.target_req_numbers IS NOT NULL THEN
    RETURN req_number_param = ANY(active_directive.target_req_numbers);
  END IF;

  -- No target list = everything in scope
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to deactivate directive with reason
CREATE OR REPLACE FUNCTION deactivate_workflow_directive(
  directive_id_param UUID,
  reason_param VARCHAR DEFAULT 'user_cancelled'
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE workflow_directives
  SET
    is_active = false,
    deactivated_at = NOW(),
    deactivated_reason = reason_param,
    updated_at = NOW()
  WHERE id = directive_id_param AND is_active = true;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE workflow_directives IS
'Flexible workflow control for CTO/PMO. Supports various directive types:
- Focus on blocker chain
- Weekend push (easy tasks)
- Customer priority
- Tag-based focus
- BU-based focus
- Time-boxed sprints
- Pause/resume
And any other pattern needed.';
