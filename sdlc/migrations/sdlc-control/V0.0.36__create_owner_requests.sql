-- ============================================================================
-- V0.0.36: Owner Requests Table
-- Stores owner/CTO requests for features, bugs, and improvements
-- ============================================================================

CREATE TABLE IF NOT EXISTS owner_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  req_number VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,

  -- Classification
  request_type VARCHAR(50) DEFAULT 'feature' CHECK (request_type IN ('feature', 'bug', 'improvement', 'refactor', 'infra', 'urgent')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  -- Organization
  primary_bu VARCHAR(100) DEFAULT 'core-infra',
  affected_bus TEXT[] DEFAULT '{}',
  affected_entities TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',

  -- Status and workflow
  current_phase VARCHAR(50) DEFAULT 'backlog',
  is_blocked BOOLEAN DEFAULT false,
  blocked_reason TEXT,
  assigned_to VARCHAR(100),

  -- Source tracking
  source VARCHAR(100) DEFAULT 'orchestrator',
  source_reference VARCHAR(255),
  created_by VARCHAR(100) DEFAULT 'orchestrator',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_owner_requests_req_number ON owner_requests(req_number);
CREATE INDEX IF NOT EXISTS idx_owner_requests_current_phase ON owner_requests(current_phase);
CREATE INDEX IF NOT EXISTS idx_owner_requests_priority ON owner_requests(priority);
CREATE INDEX IF NOT EXISTS idx_owner_requests_is_blocked ON owner_requests(is_blocked);
CREATE INDEX IF NOT EXISTS idx_owner_requests_created_at ON owner_requests(created_at DESC);

-- Request blockers junction table
CREATE TABLE IF NOT EXISTS request_blockers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocked_request_id UUID NOT NULL REFERENCES owner_requests(id) ON DELETE CASCADE,
  blocking_request_id UUID NOT NULL REFERENCES owner_requests(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocked_request_id, blocking_request_id)
);

CREATE INDEX IF NOT EXISTS idx_request_blockers_blocked ON request_blockers(blocked_request_id);
CREATE INDEX IF NOT EXISTS idx_request_blockers_blocking ON request_blockers(blocking_request_id);

COMMENT ON TABLE owner_requests IS 'Owner/CTO requests for features, bugs, and improvements';
COMMENT ON TABLE request_blockers IS 'Junction table for request blocking relationships';
