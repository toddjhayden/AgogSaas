-- ============================================================================
-- V0.0.35: Recommendations Table
-- Stores AI-generated recommendations for system improvements
-- ============================================================================

CREATE TABLE IF NOT EXISTS recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identification
  rec_number VARCHAR(100) NOT NULL UNIQUE,
  title VARCHAR(500) NOT NULL,
  description TEXT,
  rationale TEXT,
  expected_benefits TEXT,

  -- Source and attribution
  recommended_by_agent VARCHAR(100),
  recommendation_type VARCHAR(50) DEFAULT 'enhancement',
  source_req_number VARCHAR(100),

  -- Priority and impact
  urgency VARCHAR(20) DEFAULT 'medium' CHECK (urgency IN ('critical', 'high', 'medium', 'low')),
  impact_level VARCHAR(20) DEFAULT 'medium' CHECK (impact_level IN ('critical', 'high', 'medium', 'low')),
  affected_bus TEXT[] DEFAULT '{}',

  -- Status tracking
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'implemented', 'deferred')),
  reviewed_by VARCHAR(100),
  reviewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_urgency ON recommendations(urgency);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recommendations_rec_number ON recommendations(rec_number);

COMMENT ON TABLE recommendations IS 'AI-generated recommendations for system improvements';
