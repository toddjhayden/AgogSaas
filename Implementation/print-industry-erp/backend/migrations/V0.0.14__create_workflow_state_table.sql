-- Migration: Add workflow state persistence table
-- Purpose: Store orchestrator workflow state to prevent data loss on server restart
-- Related to: REQ-DEVOPS-ORCHESTRATOR-001 - Critical Issue #1

-- Create workflow_state table
CREATE TABLE IF NOT EXISTS workflow_state (
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

-- Add index for status queries (find running/blocked workflows)
CREATE INDEX idx_workflow_state_status ON workflow_state(status) WHERE status IN ('running', 'blocked');

-- Add index for started_at (for monitoring oldest workflows)
CREATE INDEX idx_workflow_state_started_at ON workflow_state(started_at);

-- Add trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_workflow_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_state_updated_at
  BEFORE UPDATE ON workflow_state
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_state_updated_at();

-- Add comment
COMMENT ON TABLE workflow_state IS 'Persistent storage for orchestrator workflow state to survive server restarts';
COMMENT ON COLUMN workflow_state.req_number IS 'Unique requirement number (e.g., REQ-ITEM-MASTER-001)';
COMMENT ON COLUMN workflow_state.stage_deliverables IS 'JSON array of [stageIndex, deliverableData] tuples';
