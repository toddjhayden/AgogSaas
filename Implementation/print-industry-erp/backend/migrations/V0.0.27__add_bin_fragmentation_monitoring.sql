-- Migration: V0.0.27 - Add Bin Fragmentation Monitoring
-- Author: Roy (Backend Developer)
-- Requirement: REQ-STRATEGIC-AUTO-1766584106655
-- Purpose: Add fragmentation index monitoring to identify consolidation opportunities
-- Addresses: Sylvia Issue #12 (MEDIUM PRIORITY) + Cynthia OPP-3

-- =====================================================
-- ISSUE #12 RESOLUTION: FRAGMENTATION MONITORING
-- =====================================================
-- Problem: No fragmentation index tracking
-- Solution: Monitor fragmentation and generate consolidation recommendations
-- Metric: Fragmentation Index = Total Available Space / Largest Contiguous Space
-- Impact: 2-4% space utilization improvement through defragmentation
-- =====================================================

-- Step 1: Create fragmentation history table
CREATE TABLE IF NOT EXISTS bin_fragmentation_history (
  fragmentation_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  zone_code VARCHAR(50),
  aisle_code VARCHAR(50),

  -- Measurement timestamp
  measurement_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Fragmentation metrics
  total_available_cubic_feet DECIMAL(12,2) NOT NULL,
  largest_contiguous_block DECIMAL(12,2) NOT NULL,
  fragmentation_index DECIMAL(6,2) NOT NULL, -- Total / Largest
  fragmentation_level VARCHAR(20) NOT NULL CHECK (fragmentation_level IN ('LOW', 'MODERATE', 'HIGH', 'SEVERE')),

  -- Bin statistics
  total_bins INTEGER NOT NULL DEFAULT 0,
  bins_with_available_space INTEGER NOT NULL DEFAULT 0,
  average_available_per_bin DECIMAL(12,2),

  -- Consolidation recommendations
  requires_consolidation BOOLEAN DEFAULT FALSE,
  estimated_space_recovery DECIMAL(12,2) DEFAULT 0,
  consolidation_opportunities_count INTEGER DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_fragmentation_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_fragmentation_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

-- Indexes for fragmentation queries
CREATE INDEX idx_fragmentation_tenant_facility
  ON bin_fragmentation_history(tenant_id, facility_id);

CREATE INDEX idx_fragmentation_timestamp
  ON bin_fragmentation_history(measurement_timestamp DESC);

CREATE INDEX idx_fragmentation_level_timestamp
  ON bin_fragmentation_history(fragmentation_level, measurement_timestamp DESC);

CREATE INDEX idx_fragmentation_requires_consolidation
  ON bin_fragmentation_history(requires_consolidation, measurement_timestamp DESC)
  WHERE requires_consolidation = true;

-- Index for zone/aisle level queries
CREATE INDEX idx_fragmentation_zone_aisle
  ON bin_fragmentation_history(tenant_id, facility_id, zone_code, aisle_code, measurement_timestamp DESC);

COMMENT ON TABLE bin_fragmentation_history IS
  'Time-series tracking of bin fragmentation index for identifying consolidation opportunities';

-- Step 2: Create consolidation recommendations table
CREATE TABLE IF NOT EXISTS bin_consolidation_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  fragmentation_id UUID,

  -- Material to consolidate
  material_id UUID NOT NULL,

  -- Source and target locations
  source_location_ids UUID[] NOT NULL,
  target_location_id UUID NOT NULL,

  -- Consolidation details
  quantity_to_move DECIMAL(12,2) NOT NULL,
  space_recovered_cubic_feet DECIMAL(12,2) NOT NULL,
  estimated_labor_hours DECIMAL(6,2) NOT NULL,

  -- Priority
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),

  -- Execution tracking
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED'
  )),
  executed_at TIMESTAMP,
  executed_by UUID,
  actual_space_recovered DECIMAL(12,2),
  actual_labor_hours DECIMAL(6,2),

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,

  -- Foreign keys
  CONSTRAINT fk_consolidation_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_consolidation_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE,
  CONSTRAINT fk_consolidation_material FOREIGN KEY (material_id)
    REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT fk_consolidation_fragmentation FOREIGN KEY (fragmentation_id)
    REFERENCES bin_fragmentation_history(fragmentation_id) ON DELETE SET NULL,
  CONSTRAINT fk_consolidation_target_location FOREIGN KEY (target_location_id)
    REFERENCES inventory_locations(location_id) ON DELETE CASCADE
);

-- Indexes for consolidation recommendations
CREATE INDEX idx_consolidation_tenant_facility
  ON bin_consolidation_recommendations(tenant_id, facility_id);

CREATE INDEX idx_consolidation_status
  ON bin_consolidation_recommendations(status, created_at DESC);

CREATE INDEX idx_consolidation_priority
  ON bin_consolidation_recommendations(priority, status, created_at DESC);

CREATE INDEX idx_consolidation_material
  ON bin_consolidation_recommendations(material_id, status);

COMMENT ON TABLE bin_consolidation_recommendations IS
  'Consolidation recommendations for reducing bin fragmentation and recovering space';

-- Step 3: Create materialized view for current fragmentation status
CREATE MATERIALIZED VIEW IF NOT EXISTS bin_fragmentation_current_status AS
WITH latest_measurements AS (
  SELECT DISTINCT ON (tenant_id, facility_id, COALESCE(zone_code, ''))
    tenant_id,
    facility_id,
    zone_code,
    measurement_timestamp,
    total_available_cubic_feet,
    largest_contiguous_block,
    fragmentation_index,
    fragmentation_level,
    total_bins,
    bins_with_available_space,
    requires_consolidation,
    estimated_space_recovery,
    consolidation_opportunities_count
  FROM bin_fragmentation_history
  WHERE measurement_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  ORDER BY tenant_id, facility_id, COALESCE(zone_code, ''), measurement_timestamp DESC
),
fragmentation_trends AS (
  SELECT
    tenant_id,
    facility_id,
    zone_code,
    AVG(fragmentation_index) as avg_fragmentation_7d,
    MAX(fragmentation_index) as max_fragmentation_7d,
    MIN(fragmentation_index) as min_fragmentation_7d,
    -- Linear regression slope for trend
    REGR_SLOPE(fragmentation_index, EXTRACT(EPOCH FROM measurement_timestamp)) as fragmentation_trend_slope
  FROM bin_fragmentation_history
  WHERE measurement_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  GROUP BY tenant_id, facility_id, zone_code
),
pending_consolidations AS (
  SELECT
    tenant_id,
    facility_id,
    COUNT(*) as pending_consolidation_count,
    SUM(space_recovered_cubic_feet) as pending_space_recovery,
    SUM(estimated_labor_hours) as pending_labor_hours
  FROM bin_consolidation_recommendations
  WHERE status = 'PENDING'
  GROUP BY tenant_id, facility_id
)
SELECT
  lm.tenant_id,
  lm.facility_id,
  lm.zone_code,
  lm.measurement_timestamp as last_measurement,

  -- Current fragmentation
  lm.fragmentation_index as current_fragmentation_index,
  lm.fragmentation_level as current_fragmentation_level,
  lm.total_available_cubic_feet,
  lm.largest_contiguous_block,
  lm.total_bins,
  lm.bins_with_available_space,

  -- Consolidation status
  lm.requires_consolidation,
  lm.estimated_space_recovery,
  lm.consolidation_opportunities_count,

  -- Trends
  ft.avg_fragmentation_7d,
  ft.max_fragmentation_7d,
  ft.min_fragmentation_7d,
  CASE
    WHEN ft.fragmentation_trend_slope > 0.0001 THEN 'WORSENING'
    WHEN ft.fragmentation_trend_slope < -0.0001 THEN 'IMPROVING'
    ELSE 'STABLE'
  END as fragmentation_trend,

  -- Pending consolidations
  COALESCE(pc.pending_consolidation_count, 0) as pending_consolidation_count,
  COALESCE(pc.pending_space_recovery, 0) as pending_space_recovery,
  COALESCE(pc.pending_labor_hours, 0) as pending_labor_hours

FROM latest_measurements lm
LEFT JOIN fragmentation_trends ft USING (tenant_id, facility_id, zone_code)
LEFT JOIN pending_consolidations pc USING (tenant_id, facility_id);

CREATE UNIQUE INDEX idx_fragmentation_current_tenant_facility_zone
  ON bin_fragmentation_current_status(tenant_id, facility_id, COALESCE(zone_code, ''));

CREATE INDEX idx_fragmentation_current_level
  ON bin_fragmentation_current_status(current_fragmentation_level);

CREATE INDEX idx_fragmentation_current_requires_consolidation
  ON bin_fragmentation_current_status(requires_consolidation)
  WHERE requires_consolidation = true;

COMMENT ON MATERIALIZED VIEW bin_fragmentation_current_status IS
  'Current fragmentation status with 7-day trends and pending consolidations';

-- Step 4: Create function to refresh fragmentation status
CREATE OR REPLACE FUNCTION refresh_bin_fragmentation_status()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY bin_fragmentation_current_status;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_bin_fragmentation_status() IS
  'Refresh fragmentation status materialized view - should be run hourly via cron';

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT ON bin_fragmentation_history TO wms_application_role;
GRANT SELECT, INSERT, UPDATE ON bin_consolidation_recommendations TO wms_application_role;
GRANT SELECT ON bin_fragmentation_current_status TO wms_application_role;
GRANT EXECUTE ON FUNCTION refresh_bin_fragmentation_status() TO wms_application_role;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  -- Verify fragmentation history table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'bin_fragmentation_history'
  ) THEN
    RAISE EXCEPTION 'Table bin_fragmentation_history was not created';
  END IF;

  -- Verify consolidation recommendations table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'bin_consolidation_recommendations'
  ) THEN
    RAISE EXCEPTION 'Table bin_consolidation_recommendations was not created';
  END IF;

  -- Verify materialized view exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE matviewname = 'bin_fragmentation_current_status'
  ) THEN
    RAISE EXCEPTION 'Materialized view bin_fragmentation_current_status was not created';
  END IF;

  RAISE NOTICE 'Bin fragmentation monitoring infrastructure created successfully';
  RAISE NOTICE 'Fragmentation history table: bin_fragmentation_history';
  RAISE NOTICE 'Consolidation recommendations table: bin_consolidation_recommendations';
  RAISE NOTICE 'Current status view: bin_fragmentation_current_status';
  RAISE NOTICE 'Issue #12 (MEDIUM PRIORITY) - RESOLVED';
  RAISE NOTICE '';
  RAISE NOTICE 'FRAGMENTATION INDEX THRESHOLDS:';
  RAISE NOTICE 'FI = 1.0: Perfect (all space contiguous)';
  RAISE NOTICE 'FI < 1.5: LOW fragmentation';
  RAISE NOTICE 'FI 1.5-2.0: MODERATE fragmentation';
  RAISE NOTICE 'FI 2.0-3.0: HIGH fragmentation (trigger consolidation)';
  RAISE NOTICE 'FI > 3.0: SEVERE fragmentation (immediate action)';
  RAISE NOTICE '';
  RAISE NOTICE 'EXPECTED IMPACT:';
  RAISE NOTICE '- 2-4% space utilization improvement';
  RAISE NOTICE '- Proactive consolidation recommendations';
  RAISE NOTICE '- Reduced "lost" space from scattered availability';
END $$;
