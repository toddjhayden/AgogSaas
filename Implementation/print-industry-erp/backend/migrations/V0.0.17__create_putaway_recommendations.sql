-- =====================================================
-- Migration: V0.0.17 - Create Putaway Recommendations Table
-- =====================================================
-- Description: Creates critical table for ML feedback loop
-- Date: 2025-12-23
-- Requirement: REQ-STRATEGIC-AUTO-1766516759426
-- =====================================================
-- CRITICAL FIX: This table was missing from Phase 1 research
-- Enables ML feedback loop to function properly
-- =====================================================

-- =====================================================
-- Putaway Recommendations Table
-- =====================================================
-- Tracks putaway location recommendations and actual decisions
-- for machine learning feedback
-- =====================================================

CREATE TABLE IF NOT EXISTS putaway_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Lot/Material reference
  lot_number VARCHAR(100) NOT NULL,
  material_id UUID NOT NULL,
  quantity DECIMAL(15,4),

  -- Recommendation
  recommended_location_id UUID NOT NULL,
  algorithm_used VARCHAR(50),
  confidence_score DECIMAL(3,2),
  ml_adjusted_confidence DECIMAL(3,2),
  reason TEXT,

  -- Features used (for ML retraining)
  features JSONB,

  -- Decision tracking
  accepted BOOLEAN,
  actual_location_id UUID,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  decided_at TIMESTAMP,
  decided_by UUID,

  -- Constraints
  CONSTRAINT fk_putaway_rec_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_facility
    FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_material
    FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_recommended_location
    FOREIGN KEY (recommended_location_id) REFERENCES inventory_locations(location_id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_actual_location
    FOREIGN KEY (actual_location_id) REFERENCES inventory_locations(location_id) ON DELETE CASCADE
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_putaway_rec_material
  ON putaway_recommendations(material_id);

CREATE INDEX IF NOT EXISTS idx_putaway_rec_created
  ON putaway_recommendations(created_at);

CREATE INDEX IF NOT EXISTS idx_putaway_rec_accepted
  ON putaway_recommendations(accepted) WHERE accepted IS NOT NULL;

-- Partial index for pending decisions (recommended in Phase 2)
CREATE INDEX IF NOT EXISTS idx_putaway_recommendations_pending
  ON putaway_recommendations(created_at DESC)
  WHERE decided_at IS NULL;

-- Index for ML training queries
CREATE INDEX IF NOT EXISTS idx_putaway_rec_training
  ON putaway_recommendations(decided_at, accepted)
  WHERE decided_at IS NOT NULL;

-- Table comments
COMMENT ON TABLE putaway_recommendations IS 'Tracks putaway location recommendations and actual decisions for machine learning feedback';
COMMENT ON COLUMN putaway_recommendations.algorithm_used IS 'Algorithm that generated the recommendation (e.g., BEST_FIT_DECREASING_ENHANCED)';
COMMENT ON COLUMN putaway_recommendations.confidence_score IS 'Base confidence score 0-1 for the recommendation';
COMMENT ON COLUMN putaway_recommendations.ml_adjusted_confidence IS 'ML-adjusted confidence score 0-1';
COMMENT ON COLUMN putaway_recommendations.accepted IS 'Whether the recommendation was accepted (true) or overridden (false)';
COMMENT ON COLUMN putaway_recommendations.features IS 'JSONB of features used for ML training';

-- Grant permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    GRANT SELECT, INSERT, UPDATE ON TABLE putaway_recommendations TO agogsaas_user;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.17 completed: Putaway recommendations table created';
  RAISE NOTICE '  - CRITICAL: ML feedback loop now functional';
  RAISE NOTICE '  - Table tracks all putaway decisions for learning';
  RAISE NOTICE '  - Indexes optimized for training queries';
END $$;
