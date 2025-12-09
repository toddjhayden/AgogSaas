-- Layer 2: Monitoring Tables
-- Created: 2025-12-09

-- System errors tracking table
CREATE TABLE IF NOT EXISTS system_errors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('CRITICAL', 'ERROR', 'WARNING', 'INFO')),
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'IGNORED')),
  message TEXT NOT NULL,
  stack_trace TEXT,
  component VARCHAR(100) NOT NULL,
  user_id UUID,
  first_occurred TIMESTAMP DEFAULT NOW(),
  last_occurred TIMESTAMP DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  assigned_to VARCHAR(100),
  resolved_by VARCHAR(100),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_errors_severity ON system_errors(severity);
CREATE INDEX IF NOT EXISTS idx_errors_status ON system_errors(status);
CREATE INDEX IF NOT EXISTS idx_errors_component ON system_errors(component);
CREATE INDEX IF NOT EXISTS idx_errors_occurred ON system_errors(last_occurred DESC);
CREATE INDEX IF NOT EXISTS idx_errors_tenant ON system_errors(tenant_id) WHERE tenant_id IS NOT NULL;

-- Health monitoring history table
CREATE TABLE IF NOT EXISTS health_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  component VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('OPERATIONAL', 'DEGRADED', 'DOWN', 'UNKNOWN')),
  response_time INTEGER,
  error TEXT,
  metadata JSONB,
  checked_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_component_time ON health_history(component, checked_at DESC);

COMMENT ON TABLE system_errors IS 'Layer 2: Tracks system errors and their resolution status';
COMMENT ON TABLE health_history IS 'Layer 2: Historical health check results for system components';

-- Layer 4: Memory System Tables
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID,
  agent_id VARCHAR(50) NOT NULL,
  memory_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING ivfflat (embedding vector_cosine_ops);

COMMENT ON TABLE memories IS 'Layer 4: Agent memory storage with semantic search';
