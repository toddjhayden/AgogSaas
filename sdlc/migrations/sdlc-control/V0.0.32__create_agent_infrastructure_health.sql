-- ============================================================================
-- V0.0.32: Create Agent Infrastructure Health Table
-- ============================================================================
-- Purpose: Track health status of agent infrastructure components
-- The orchestrator/agents publish their health here, GUI queries it
-- Solves the problem of VPS-hosted GUI not being able to check local services
-- ============================================================================

-- Agent Infrastructure Health table
CREATE TABLE IF NOT EXISTS agent_infrastructure_health (
    id SERIAL PRIMARY KEY,

    -- Component identification
    component VARCHAR(50) NOT NULL UNIQUE,  -- 'nats', 'ollama', 'agent_db', 'orchestrator', 'host_listener'
    display_name VARCHAR(100) NOT NULL,

    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'unknown',  -- 'healthy', 'degraded', 'unavailable', 'unknown'

    -- Component-specific details (connections, version, etc.)
    details JSONB DEFAULT '{}',

    -- Health metrics
    last_heartbeat TIMESTAMP,
    heartbeat_interval_seconds INTEGER DEFAULT 60,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for quick lookups
CREATE INDEX idx_agent_health_status ON agent_infrastructure_health(status);
CREATE INDEX idx_agent_health_heartbeat ON agent_infrastructure_health(last_heartbeat);

-- Comments
COMMENT ON TABLE agent_infrastructure_health IS 'Health status of agent infrastructure components, published by orchestrator';
COMMENT ON COLUMN agent_infrastructure_health.component IS 'Unique component identifier (nats, ollama, agent_db, orchestrator, host_listener)';
COMMENT ON COLUMN agent_infrastructure_health.status IS 'Current health status: healthy, degraded, unavailable, unknown';
COMMENT ON COLUMN agent_infrastructure_health.details IS 'Component-specific details like connection count, version, etc.';
COMMENT ON COLUMN agent_infrastructure_health.last_heartbeat IS 'Last time this component reported health';

-- ============================================================================
-- Seed initial components (status unknown until orchestrator reports)
-- ============================================================================
INSERT INTO agent_infrastructure_health (component, display_name, status, details) VALUES
    ('nats', 'NATS Messaging', 'unknown', '{"description": "Message queue for agent communication"}'),
    ('ollama', 'Ollama LLM', 'unknown', '{"description": "Local LLM inference server"}'),
    ('agent_db', 'Agent Database', 'unknown', '{"description": "PostgreSQL for workflow persistence"}'),
    ('orchestrator', 'Strategic Orchestrator', 'unknown', '{"description": "Coordinates agent workflows"}'),
    ('host_listener', 'Host Listener', 'unknown', '{"description": "Spawns Claude CLI agents on Windows host"}')
ON CONFLICT (component) DO NOTHING;

-- ============================================================================
-- Function to update component health
-- ============================================================================
CREATE OR REPLACE FUNCTION update_agent_health(
    p_component VARCHAR(50),
    p_status VARCHAR(20),
    p_details JSONB DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE agent_infrastructure_health
    SET status = p_status,
        details = COALESCE(p_details, details),
        last_heartbeat = NOW(),
        updated_at = NOW()
    WHERE component = p_component;

    -- Insert if doesn't exist
    IF NOT FOUND THEN
        INSERT INTO agent_infrastructure_health (component, display_name, status, details, last_heartbeat)
        VALUES (p_component, p_component, p_status, COALESCE(p_details, '{}'), NOW());
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function to get all health statuses with staleness check
-- ============================================================================
CREATE OR REPLACE FUNCTION get_agent_infrastructure_health()
RETURNS TABLE (
    component VARCHAR(50),
    display_name VARCHAR(100),
    status VARCHAR(20),
    details JSONB,
    last_heartbeat TIMESTAMP,
    is_stale BOOLEAN,
    seconds_since_heartbeat INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        h.component,
        h.display_name,
        -- If heartbeat is stale (2x interval), mark as unknown
        CASE
            WHEN h.last_heartbeat IS NULL THEN 'unknown'::VARCHAR(20)
            WHEN EXTRACT(EPOCH FROM (NOW() - h.last_heartbeat)) > (h.heartbeat_interval_seconds * 2) THEN 'unknown'::VARCHAR(20)
            ELSE h.status
        END as status,
        h.details,
        h.last_heartbeat,
        CASE
            WHEN h.last_heartbeat IS NULL THEN TRUE
            WHEN EXTRACT(EPOCH FROM (NOW() - h.last_heartbeat)) > (h.heartbeat_interval_seconds * 2) THEN TRUE
            ELSE FALSE
        END as is_stale,
        CASE
            WHEN h.last_heartbeat IS NULL THEN NULL
            ELSE EXTRACT(EPOCH FROM (NOW() - h.last_heartbeat))::INTEGER
        END as seconds_since_heartbeat
    FROM agent_infrastructure_health h
    ORDER BY h.component;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- View for current infrastructure status
-- ============================================================================
CREATE OR REPLACE VIEW agent_infrastructure_status AS
SELECT * FROM get_agent_infrastructure_health();

COMMENT ON VIEW agent_infrastructure_status IS 'Current agent infrastructure health with staleness detection';
