-- =====================================================
-- Migration: V0.0.15 - Add Bin Utilization Tracking
-- =====================================================
-- Description: Adds calculated fields and tracking tables for bin utilization optimization
-- Date: 2025-12-22
-- Requirement: REQ-STRATEGIC-AUTO-1766436689295
-- =====================================================

-- Add calculated utilization fields to inventory_locations
ALTER TABLE inventory_locations
ADD COLUMN IF NOT EXISTS current_weight_lbs DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_cubic_feet DECIMAL(10,2) DEFAULT 0;

-- Note: PostgreSQL doesn't support GENERATED ALWAYS AS STORED for complex calculations
-- involving JOINs, so we'll use a trigger instead

-- Create function to calculate bin utilization
CREATE OR REPLACE FUNCTION calculate_bin_utilization()
RETURNS TRIGGER AS $$
BEGIN
  -- This trigger would update utilization when lots change
  -- For now, utilization is calculated on-demand in queries
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Material Velocity Metrics Table
-- =====================================================
-- Tracks ABC classification and velocity metrics over time

CREATE TABLE IF NOT EXISTS material_velocity_metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,

  -- Material reference
  material_id UUID NOT NULL,

  -- Time period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,

  -- Velocity metrics
  total_picks INTEGER DEFAULT 0,
  total_quantity_picked DECIMAL(15,4) DEFAULT 0,
  total_value_picked DECIMAL(15,2) DEFAULT 0,

  -- Classification
  abc_classification CHAR(1) CHECK (abc_classification IN ('A', 'B', 'C')),
  velocity_rank INTEGER,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,

  -- Constraints
  CONSTRAINT fk_material_velocity_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_material_velocity_material
    FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT unique_material_period
    UNIQUE (material_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_material_velocity_material
  ON material_velocity_metrics(material_id);

CREATE INDEX IF NOT EXISTS idx_material_velocity_period
  ON material_velocity_metrics(period_start, period_end);

CREATE INDEX IF NOT EXISTS idx_material_velocity_abc
  ON material_velocity_metrics(abc_classification);

COMMENT ON TABLE material_velocity_metrics IS 'Tracks material velocity and ABC classification over time for warehouse slotting optimization';
COMMENT ON COLUMN material_velocity_metrics.total_picks IS 'Number of times this material was picked in the period';
COMMENT ON COLUMN material_velocity_metrics.total_value_picked IS 'Total dollar value picked in the period';
COMMENT ON COLUMN material_velocity_metrics.abc_classification IS 'ABC classification: A (high velocity), B (medium), C (low)';
COMMENT ON COLUMN material_velocity_metrics.velocity_rank IS 'Rank by velocity (1 = highest velocity)';

-- =====================================================
-- Putaway Recommendations Table
-- =====================================================
-- Tracks putaway recommendations and actual decisions

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
  reason TEXT,

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

CREATE INDEX IF NOT EXISTS idx_putaway_rec_material
  ON putaway_recommendations(material_id);

CREATE INDEX IF NOT EXISTS idx_putaway_rec_created
  ON putaway_recommendations(created_at);

CREATE INDEX IF NOT EXISTS idx_putaway_rec_accepted
  ON putaway_recommendations(accepted) WHERE accepted IS NOT NULL;

COMMENT ON TABLE putaway_recommendations IS 'Tracks putaway location recommendations and actual decisions for machine learning feedback';
COMMENT ON COLUMN putaway_recommendations.algorithm_used IS 'Algorithm that generated the recommendation (e.g., ABC_VELOCITY_BEST_FIT)';
COMMENT ON COLUMN putaway_recommendations.confidence_score IS 'Confidence score 0-1 for the recommendation';
COMMENT ON COLUMN putaway_recommendations.accepted IS 'Whether the recommendation was accepted (true) or overridden (false)';

-- =====================================================
-- Reslotting History Table
-- =====================================================
-- Tracks dynamic re-slotting operations

CREATE TABLE IF NOT EXISTS reslotting_history (
  reslot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Material/Lot being moved
  material_id UUID NOT NULL,
  lot_number VARCHAR(100),
  quantity DECIMAL(15,4),

  -- Movement
  from_location_id UUID NOT NULL,
  to_location_id UUID NOT NULL,

  -- Reason
  reslot_type VARCHAR(50), -- CONSOLIDATE, REBALANCE, RELOCATE, ABC_CHANGE
  reason TEXT,
  velocity_change DECIMAL(5,2), -- Percentage change in velocity

  -- Impact
  estimated_efficiency_gain DECIMAL(5,2), -- Percentage
  actual_efficiency_gain DECIMAL(5,2),    -- Measured post-reslotting

  -- Execution
  status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, CANCELLED
  executed_at TIMESTAMP,
  executed_by UUID,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,

  -- Constraints
  CONSTRAINT fk_reslot_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_facility
    FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_material
    FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_from_location
    FOREIGN KEY (from_location_id) REFERENCES inventory_locations(location_id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_to_location
    FOREIGN KEY (to_location_id) REFERENCES inventory_locations(location_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reslot_material
  ON reslotting_history(material_id);

CREATE INDEX IF NOT EXISTS idx_reslot_facility
  ON reslotting_history(facility_id);

CREATE INDEX IF NOT EXISTS idx_reslot_status
  ON reslotting_history(status);

CREATE INDEX IF NOT EXISTS idx_reslot_created
  ON reslotting_history(created_at);

COMMENT ON TABLE reslotting_history IS 'Tracks dynamic re-slotting operations for continuous warehouse optimization';
COMMENT ON COLUMN reslotting_history.reslot_type IS 'Type of re-slotting: CONSOLIDATE, REBALANCE, RELOCATE, ABC_CHANGE';
COMMENT ON COLUMN reslotting_history.velocity_change IS 'Percentage change in pick velocity that triggered re-slotting';
COMMENT ON COLUMN reslotting_history.estimated_efficiency_gain IS 'Estimated efficiency improvement percentage';

-- =====================================================
-- Warehouse Optimization Settings Table
-- =====================================================
-- Configurable thresholds for optimization algorithms

CREATE TABLE IF NOT EXISTS warehouse_optimization_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID,

  -- Setting
  setting_key VARCHAR(100) NOT NULL,
  setting_value DECIMAL(10,2),
  setting_description TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,

  -- Constraints
  CONSTRAINT fk_optimization_settings_tenant
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_optimization_settings_facility
    FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE,
  CONSTRAINT unique_setting_per_facility
    UNIQUE (tenant_id, facility_id, setting_key)
);

COMMENT ON TABLE warehouse_optimization_settings IS 'Configurable thresholds and settings for bin utilization optimization algorithms';

-- Insert default optimization settings
INSERT INTO warehouse_optimization_settings (tenant_id, setting_key, setting_value, setting_description)
SELECT
  tenant_id,
  'OPTIMAL_UTILIZATION_PCT',
  80,
  'Target bin utilization percentage (optimal: 80%)'
FROM tenants
ON CONFLICT DO NOTHING;

INSERT INTO warehouse_optimization_settings (tenant_id, setting_key, setting_value, setting_description)
SELECT
  tenant_id,
  'UNDERUTILIZED_THRESHOLD_PCT',
  30,
  'Bins below this utilization should be consolidated'
FROM tenants
ON CONFLICT DO NOTHING;

INSERT INTO warehouse_optimization_settings (tenant_id, setting_key, setting_value, setting_description)
SELECT
  tenant_id,
  'OVERUTILIZED_THRESHOLD_PCT',
  95,
  'Bins above this utilization risk overflow'
FROM tenants
ON CONFLICT DO NOTHING;

INSERT INTO warehouse_optimization_settings (tenant_id, setting_key, setting_value, setting_description)
SELECT
  tenant_id,
  'ABC_A_CUTOFF_PCT',
  40,
  'Top materials generating this % of value are A items'
FROM tenants
ON CONFLICT DO NOTHING;

INSERT INTO warehouse_optimization_settings (tenant_id, setting_key, setting_value, setting_description)
SELECT
  tenant_id,
  'ABC_C_CUTOFF_PCT',
  80,
  'Bottom materials below this cumulative % are C items'
FROM tenants
ON CONFLICT DO NOTHING;

-- =====================================================
-- Add ABC Classification to Materials
-- =====================================================
-- If not already present, add ABC classification tracking

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'materials' AND column_name = 'abc_classification'
  ) THEN
    ALTER TABLE materials
    ADD COLUMN abc_classification CHAR(1) CHECK (abc_classification IN ('A', 'B', 'C')),
    ADD COLUMN velocity_rank INTEGER,
    ADD COLUMN last_abc_analysis TIMESTAMP;

    COMMENT ON COLUMN materials.abc_classification IS 'ABC classification: A (high velocity), B (medium), C (low)';
    COMMENT ON COLUMN materials.velocity_rank IS 'Velocity ranking (1 = highest)';
    COMMENT ON COLUMN materials.last_abc_analysis IS 'Timestamp of last ABC analysis';
  END IF;
END $$;

-- =====================================================
-- Create View: Bin Utilization Summary
-- =====================================================
-- Real-time view of bin utilization metrics

CREATE OR REPLACE VIEW bin_utilization_summary AS
WITH location_usage AS (
  SELECT
    il.location_id,
    il.tenant_id,
    il.facility_id,
    il.location_code,
    il.location_type,
    il.zone_code,
    il.abc_classification as location_abc,
    il.cubic_feet as total_cubic_feet,
    il.max_weight_lbs as max_weight,

    -- Calculate current usage from lots
    COALESCE(SUM(
      l.quantity_on_hand *
      (m.width_inches * m.height_inches * COALESCE(m.thickness_inches, 1)) / 1728.0
    ), 0) as used_cubic_feet,

    COALESCE(SUM(l.quantity_on_hand * m.weight_lbs_per_unit), 0) as current_weight,
    COUNT(DISTINCT l.lot_number) as lot_count,
    COUNT(DISTINCT l.material_id) as material_count

  FROM inventory_locations il
  LEFT JOIN lots l ON il.location_id = l.location_id AND l.quality_status = 'RELEASED'
  LEFT JOIN materials m ON l.material_id = m.material_id
  WHERE il.is_active = TRUE
    AND il.deleted_at IS NULL
  GROUP BY il.location_id, il.tenant_id, il.facility_id, il.location_code,
           il.location_type, il.zone_code, il.abc_classification,
           il.cubic_feet, il.max_weight_lbs
)
SELECT
  location_id,
  tenant_id,
  facility_id,
  location_code,
  location_type,
  zone_code,
  location_abc,
  total_cubic_feet,
  used_cubic_feet,
  (total_cubic_feet - used_cubic_feet) as available_cubic_feet,
  max_weight,
  current_weight,
  (max_weight - current_weight) as available_weight,
  lot_count,
  material_count,

  -- Utilization percentages
  CASE
    WHEN total_cubic_feet > 0
    THEN (used_cubic_feet / total_cubic_feet) * 100
    ELSE 0
  END as volume_utilization_pct,

  CASE
    WHEN max_weight > 0
    THEN (current_weight / max_weight) * 100
    ELSE 0
  END as weight_utilization_pct,

  -- Status flags
  CASE
    WHEN total_cubic_feet > 0 AND (used_cubic_feet / total_cubic_feet) * 100 < 30
    THEN 'UNDERUTILIZED'
    WHEN total_cubic_feet > 0 AND (used_cubic_feet / total_cubic_feet) * 100 > 95
    THEN 'OVERUTILIZED'
    WHEN total_cubic_feet > 0 AND (used_cubic_feet / total_cubic_feet) * 100 BETWEEN 60 AND 85
    THEN 'OPTIMAL'
    ELSE 'NORMAL'
  END as utilization_status

FROM location_usage;

COMMENT ON VIEW bin_utilization_summary IS 'Real-time bin utilization metrics for warehouse optimization monitoring';

-- =====================================================
-- Grant Permissions
-- =====================================================

-- Grant permissions on new tables to application role
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE material_velocity_metrics TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE putaway_recommendations TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reslotting_history TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE warehouse_optimization_settings TO agogsaas_user;
    GRANT SELECT ON bin_utilization_summary TO agogsaas_user;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.15 completed: Bin utilization tracking tables and views created';
END $$;
