-- Agent workflow state persistence
-- Ensures workflows survive container restarts

CREATE TABLE IF NOT EXISTS agent_workflows (
  req_number VARCHAR(50) PRIMARY KEY,
  title TEXT NOT NULL,
  assigned_to VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  current_stage INT NOT NULL DEFAULT 0,
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  metadata JSONB DEFAULT '{}'::jsonb,

  CONSTRAINT check_status CHECK (status IN ('pending', 'running', 'blocked', 'complete', 'failed')),
  CONSTRAINT check_stage CHECK (current_stage >= 0 AND current_stage <= 6)
);

-- Index for fast status queries
CREATE INDEX IF NOT EXISTS idx_agent_workflows_status ON agent_workflows(status);

-- Index for fast lookup by assigned_to
CREATE INDEX IF NOT EXISTS idx_agent_workflows_assigned_to ON agent_workflows(assigned_to);

-- Index for cleanup of old workflows
CREATE INDEX IF NOT EXISTS idx_agent_workflows_completed_at ON agent_workflows(completed_at);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_agent_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_workflows_updated_at
BEFORE UPDATE ON agent_workflows
FOR EACH ROW
EXECUTE FUNCTION update_agent_workflows_updated_at();

-- Cleanup old completed workflows (>90 days)
CREATE OR REPLACE FUNCTION cleanup_old_workflows()
RETURNS void AS $$
BEGIN
  DELETE FROM agent_workflows
  WHERE status = 'complete'
    AND completed_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
