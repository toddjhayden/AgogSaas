-- V0.0.33: Infrastructure Control Commands
-- Allows SDLC GUI to send control commands to agentic workflow components

CREATE TABLE IF NOT EXISTS infrastructure_control_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  component VARCHAR(50) NOT NULL,  -- 'host_listener', 'orchestrator', 'nats', etc.
  action VARCHAR(50) NOT NULL,     -- 'restart', 'status', 'get_logs', 'tail_log_file', etc.
  params JSONB DEFAULT '{}',       -- Action-specific parameters
  status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'executing', 'completed', 'failed'
  result JSONB,                    -- Response from component
  error_message TEXT,              -- Error details if failed
  requested_by VARCHAR(100),       -- Who requested (user ID or 'gui')
  created_at TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

-- Index for polling pending commands
CREATE INDEX idx_control_commands_pending ON infrastructure_control_commands(status, created_at)
  WHERE status = 'pending';

-- Index for component-specific queries
CREATE INDEX idx_control_commands_component ON infrastructure_control_commands(component, created_at DESC);

-- Auto-expire old commands (cleanup function)
CREATE OR REPLACE FUNCTION cleanup_old_control_commands()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM infrastructure_control_commands
  WHERE created_at < NOW() - INTERVAL '24 hours'
    AND status IN ('completed', 'failed');
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- View for pending commands (orchestrator polls this)
CREATE OR REPLACE VIEW pending_control_commands AS
SELECT id, component, action, params, created_at
FROM infrastructure_control_commands
WHERE status = 'pending'
ORDER BY created_at ASC;

-- Function to claim a command (mark as executing)
CREATE OR REPLACE FUNCTION claim_control_command(cmd_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  updated BOOLEAN;
BEGIN
  UPDATE infrastructure_control_commands
  SET status = 'executing', started_at = NOW()
  WHERE id = cmd_id AND status = 'pending';

  GET DIAGNOSTICS updated = ROW_COUNT;
  RETURN updated > 0;
END;
$$ LANGUAGE plpgsql;

-- Function to complete a command
CREATE OR REPLACE FUNCTION complete_control_command(
  cmd_id UUID,
  cmd_result JSONB,
  cmd_error TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE infrastructure_control_commands
  SET
    status = CASE WHEN cmd_error IS NULL THEN 'completed' ELSE 'failed' END,
    result = cmd_result,
    error_message = cmd_error,
    completed_at = NOW()
  WHERE id = cmd_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE infrastructure_control_commands IS 'Queue for control commands from SDLC GUI to agentic workflow components';
