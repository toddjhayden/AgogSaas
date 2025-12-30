-- ============================================================================
-- AgogSaaS Agent Memory Database - Initialization
-- ============================================================================
-- This database stores agent learnings, strategic decisions, and context
-- DEVELOPMENT ONLY - Never deployed to production
-- ============================================================================

-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Agent Memory Table - Vector Embeddings Storage
-- ============================================================================
CREATE TABLE IF NOT EXISTS memories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(100) NOT NULL,
  memory_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),  -- nomic-embed-text model uses 768 dimensions
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  accessed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  access_count INTEGER DEFAULT 0,
  relevance_score FLOAT DEFAULT 0.0
);

CREATE INDEX IF NOT EXISTS idx_memories_agent_id ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_memories_created ON memories(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON memories USING hnsw (embedding vector_cosine_ops);

-- ============================================================================
-- Strategic Decisions Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS strategic_decisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  req_number VARCHAR(50) NOT NULL,
  agent VARCHAR(50) NOT NULL,
  decision VARCHAR(20) NOT NULL,
  reasoning TEXT,
  instructions_for_roy TEXT,
  instructions_for_jen TEXT,
  priority_fixes TEXT[],
  deferred_items TEXT[],
  business_context TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_strategic_req_number ON strategic_decisions(req_number);
CREATE INDEX IF NOT EXISTS idx_strategic_agent ON strategic_decisions(agent);
CREATE INDEX IF NOT EXISTS idx_strategic_decision ON strategic_decisions(decision);

-- ============================================================================
-- Workflow State Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  req_number VARCHAR(50) NOT NULL UNIQUE,
  current_stage INTEGER NOT NULL DEFAULT 0,
  status VARCHAR(20) NOT NULL,
  assigned_to VARCHAR(50),
  started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_workflow_req_number ON workflow_state(req_number);
CREATE INDEX IF NOT EXISTS idx_workflow_status ON workflow_state(status);
CREATE INDEX IF NOT EXISTS idx_workflow_assigned ON workflow_state(assigned_to);

-- ============================================================================
-- Agent Learnings Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_learnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id VARCHAR(100) NOT NULL,
  learning_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  example_context TEXT,
  confidence_score FLOAT DEFAULT 0.5,
  times_applied INTEGER DEFAULT 0,
  times_failed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_applied_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_learnings_agent ON agent_learnings(agent_id);
CREATE INDEX IF NOT EXISTS idx_learnings_type ON agent_learnings(learning_type);
CREATE INDEX IF NOT EXISTS idx_learnings_confidence ON agent_learnings(confidence_score DESC);

-- ============================================================================
-- NATS Deliverable Cache
-- ============================================================================
CREATE TABLE IF NOT EXISTS nats_deliverable_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  req_number VARCHAR(50) NOT NULL,
  agent VARCHAR(50) NOT NULL,
  stage INTEGER NOT NULL,
  deliverable JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(req_number, agent, stage)
);

CREATE INDEX IF NOT EXISTS idx_deliverable_req ON nats_deliverable_cache(req_number);
CREATE INDEX IF NOT EXISTS idx_deliverable_agent ON nats_deliverable_cache(agent);

-- ============================================================================
-- Helper Functions
-- ============================================================================

CREATE OR REPLACE FUNCTION update_workflow_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_workflow_updated
  BEFORE UPDATE ON workflow_state
  FOR EACH ROW
  EXECUTE FUNCTION update_workflow_timestamp();

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE memories IS 'Agent vector memory storage for semantic search';
COMMENT ON TABLE strategic_decisions IS 'Strategic decisions by planning agents';
COMMENT ON TABLE workflow_state IS 'Current state of feature request workflows';
COMMENT ON TABLE agent_learnings IS 'Long-term learnings by agents';
COMMENT ON TABLE nats_deliverable_cache IS 'Cache of NATS deliverables';

SELECT 'AgogSaaS Agent Memory Database Initialized' AS status;
