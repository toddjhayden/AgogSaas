-- Migration: V0.0.20 - Fix Bin Optimization Data Quality Issues
-- Author: Roy (Backend Developer)
-- Requirement: REQ-STRATEGIC-AUTO-1766545799451
-- Purpose: Address critical data quality and schema issues identified in Sylvia's critique
-- Related: Sylvia critique lines 626-639, 587-601, 999-1049

-- =====================================================
-- ISSUE 1: Fix confidence_score precision (CRITICAL)
-- =====================================================
-- Problem: DECIMAL(3,2) allows 0.00-9.99 but should be 0.00-1.00
-- Impact: Values > 1.00 would cause INSERT failures
-- Reference: Sylvia critique lines 626-639

ALTER TABLE putaway_recommendations
  ALTER COLUMN confidence_score TYPE DECIMAL(4,3);

-- Add constraint to enforce valid range
ALTER TABLE putaway_recommendations
  ADD CONSTRAINT chk_confidence_score_range
  CHECK (confidence_score BETWEEN 0 AND 1);

COMMENT ON COLUMN putaway_recommendations.confidence_score IS
  'ML confidence score (0.000-1.000). Higher values indicate higher confidence in recommendation.';

-- =====================================================
-- ISSUE 2: Add Material Dimension Verification Tables
-- =====================================================
-- Purpose: Track dimension verification to improve data quality
-- Reference: Sylvia critique lines 999-1049, 1267-1327

CREATE TABLE IF NOT EXISTS material_dimension_verifications (
  verification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  material_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Master data dimensions (from materials table)
  master_cubic_feet DECIMAL(10,4),
  master_weight_lbs DECIMAL(10,4),
  master_width_inches DECIMAL(10,4),
  master_height_inches DECIMAL(10,4),
  master_thickness_inches DECIMAL(10,4),

  -- Measured dimensions (from warehouse staff)
  measured_cubic_feet DECIMAL(10,4) NOT NULL,
  measured_weight_lbs DECIMAL(10,4) NOT NULL,
  measured_width_inches DECIMAL(10,4),
  measured_height_inches DECIMAL(10,4),
  measured_thickness_inches DECIMAL(10,4),

  -- Variance analysis
  cubic_feet_variance_pct DECIMAL(6,2),
  weight_variance_pct DECIMAL(6,2),

  -- Verification metadata
  verification_status VARCHAR(20) CHECK (verification_status IN ('VERIFIED', 'VARIANCE_DETECTED', 'MASTER_DATA_UPDATED')),
  variance_threshold_exceeded BOOLEAN DEFAULT FALSE,
  auto_updated_master_data BOOLEAN DEFAULT FALSE,

  -- Audit columns
  verified_by UUID NOT NULL,
  verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,

  CONSTRAINT fk_dim_verify_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_dim_verify_material FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT fk_dim_verify_facility FOREIGN KEY (facility_id) REFERENCES facilities(facility_id) ON DELETE CASCADE,
  CONSTRAINT fk_dim_verify_verifier FOREIGN KEY (verified_by) REFERENCES users(user_id)
);

CREATE INDEX idx_dim_verify_material ON material_dimension_verifications(material_id);
CREATE INDEX idx_dim_verify_facility ON material_dimension_verifications(facility_id);
CREATE INDEX idx_dim_verify_status ON material_dimension_verifications(verification_status);
CREATE INDEX idx_dim_verify_tenant ON material_dimension_verifications(tenant_id);
CREATE INDEX idx_dim_verify_variance ON material_dimension_verifications(variance_threshold_exceeded)
  WHERE variance_threshold_exceeded = TRUE;

COMMENT ON TABLE material_dimension_verifications IS
  'Tracks warehouse staff verification of material dimensions to improve data quality and prevent putaway failures';

-- =====================================================
-- ISSUE 3: Add Capacity Validation Failure Tracking
-- =====================================================
-- Purpose: Alert on capacity validation failures for safety and data quality
-- Reference: Sylvia critique lines 1291-1317

CREATE TABLE IF NOT EXISTS capacity_validation_failures (
  failure_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  location_id UUID NOT NULL,
  material_id UUID NOT NULL,
  lot_number VARCHAR(100),

  -- Capacity requirements vs availability
  required_cubic_feet DECIMAL(10,4) NOT NULL,
  available_cubic_feet DECIMAL(10,4) NOT NULL,
  required_weight_lbs DECIMAL(10,4) NOT NULL,
  available_weight_lbs DECIMAL(10,4) NOT NULL,

  -- Failure analysis
  failure_type VARCHAR(30) CHECK (failure_type IN ('CUBIC_FEET_EXCEEDED', 'WEIGHT_EXCEEDED', 'BOTH_EXCEEDED')),
  cubic_feet_overflow_pct DECIMAL(6,2),
  weight_overflow_pct DECIMAL(6,2),

  -- Context
  recommendation_id UUID,
  putaway_user_id UUID,

  -- Alert status
  alert_sent BOOLEAN DEFAULT FALSE,
  alert_sent_at TIMESTAMP,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMP,
  resolved_by UUID,
  resolution_notes TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,

  CONSTRAINT fk_capacity_fail_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_capacity_fail_location FOREIGN KEY (location_id) REFERENCES inventory_locations(location_id) ON DELETE CASCADE,
  CONSTRAINT fk_capacity_fail_material FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT fk_capacity_fail_recommendation FOREIGN KEY (recommendation_id) REFERENCES putaway_recommendations(recommendation_id) ON DELETE SET NULL
);

CREATE INDEX idx_capacity_fail_location ON capacity_validation_failures(location_id);
CREATE INDEX idx_capacity_fail_material ON capacity_validation_failures(material_id);
CREATE INDEX idx_capacity_fail_tenant ON capacity_validation_failures(tenant_id);
CREATE INDEX idx_capacity_fail_unresolved ON capacity_validation_failures(resolved) WHERE resolved = FALSE;
CREATE INDEX idx_capacity_fail_type ON capacity_validation_failures(failure_type);
CREATE INDEX idx_capacity_fail_created ON capacity_validation_failures(created_at DESC);

COMMENT ON TABLE capacity_validation_failures IS
  'Tracks capacity validation failures to prevent bin overflow and improve safety. Generates alerts for warehouse management.';

-- =====================================================
-- ISSUE 4: Add Cross-Dock Cancellation Tracking
-- =====================================================
-- Purpose: Handle cross-dock cancellation scenarios
-- Reference: Sylvia critique lines 390-417

CREATE TABLE IF NOT EXISTS cross_dock_cancellations (
  cancellation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  material_id UUID NOT NULL,
  lot_number VARCHAR(100) NOT NULL,

  -- Original cross-dock recommendation
  original_recommendation_id UUID,
  original_staging_location_id UUID,
  original_sales_order_id UUID,

  -- Cancellation reason
  cancellation_reason VARCHAR(50) CHECK (cancellation_reason IN (
    'ORDER_CANCELLED',
    'ORDER_DELAYED',
    'QUANTITY_MISMATCH',
    'MATERIAL_QUALITY_ISSUE',
    'MANUAL_OVERRIDE'
  )),

  -- New recommendation
  new_recommended_location_id UUID,
  new_recommendation_id UUID,
  relocation_completed BOOLEAN DEFAULT FALSE,
  relocation_completed_at TIMESTAMP,
  relocation_completed_by UUID,

  -- Audit
  cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  cancelled_by UUID NOT NULL,
  notes TEXT,

  CONSTRAINT fk_crossdock_cancel_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_crossdock_cancel_material FOREIGN KEY (material_id) REFERENCES materials(material_id) ON DELETE CASCADE,
  CONSTRAINT fk_crossdock_cancel_orig_rec FOREIGN KEY (original_recommendation_id) REFERENCES putaway_recommendations(recommendation_id) ON DELETE SET NULL
);

CREATE INDEX idx_crossdock_cancel_material ON cross_dock_cancellations(material_id);
CREATE INDEX idx_crossdock_cancel_lot ON cross_dock_cancellations(lot_number);
CREATE INDEX idx_crossdock_cancel_tenant ON cross_dock_cancellations(tenant_id);
CREATE INDEX idx_crossdock_cancel_pending ON cross_dock_cancellations(relocation_completed)
  WHERE relocation_completed = FALSE;

COMMENT ON TABLE cross_dock_cancellations IS
  'Tracks cancellation of cross-dock recommendations when sales orders are cancelled or delayed';

-- =====================================================
-- ISSUE 5: Add Auto-Remediation Event Log
-- =====================================================
-- Purpose: Track automated health monitoring remediation actions
-- Reference: Sylvia critique lines 512-545

CREATE TABLE IF NOT EXISTS bin_optimization_remediation_log (
  remediation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL,

  -- Health check context
  health_check_type VARCHAR(50) CHECK (health_check_type IN (
    'MATERIALIZED_VIEW_FRESHNESS',
    'ML_MODEL_ACCURACY',
    'CONGESTION_CACHE',
    'DB_PERFORMANCE',
    'ALGORITHM_PERFORMANCE'
  )),
  health_status VARCHAR(20) CHECK (health_status IN ('HEALTHY', 'DEGRADED', 'UNHEALTHY')),

  -- Remediation action taken
  remediation_action VARCHAR(50) CHECK (remediation_action IN (
    'CACHE_REFRESHED',
    'ML_RETRAINING_SCHEDULED',
    'CONGESTION_CACHE_CLEARED',
    'INDEX_REBUILT',
    'DEVOPS_ALERTED'
  )),

  -- Results
  action_successful BOOLEAN,
  pre_action_metric_value DECIMAL(10,4),
  post_action_metric_value DECIMAL(10,4),
  improvement_pct DECIMAL(6,2),

  -- Metadata
  error_message TEXT,
  execution_time_ms INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_remediation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE INDEX idx_remediation_tenant ON bin_optimization_remediation_log(tenant_id);
CREATE INDEX idx_remediation_check_type ON bin_optimization_remediation_log(health_check_type);
CREATE INDEX idx_remediation_created ON bin_optimization_remediation_log(created_at DESC);
CREATE INDEX idx_remediation_failed ON bin_optimization_remediation_log(action_successful)
  WHERE action_successful = FALSE;

COMMENT ON TABLE bin_optimization_remediation_log IS
  'Tracks automated remediation actions taken by health monitoring system';

-- =====================================================
-- FUNCTION: Calculate Dimension Variance
-- =====================================================

CREATE OR REPLACE FUNCTION calculate_dimension_variance(
  p_master_value DECIMAL,
  p_measured_value DECIMAL
)
RETURNS DECIMAL(6,2) AS $$
BEGIN
  IF p_master_value = 0 OR p_master_value IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN ((p_measured_value - p_master_value) / p_master_value) * 100;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_dimension_variance IS
  'Calculates percentage variance between master and measured dimensions';

-- =====================================================
-- VIEW: Data Quality Dashboard
-- =====================================================

CREATE OR REPLACE VIEW bin_optimization_data_quality AS
SELECT
  t.tenant_id,
  t.tenant_name,
  f.facility_id,
  f.facility_name,

  -- Dimension verification metrics
  COUNT(DISTINCT mdv.material_id) as materials_verified_count,
  COUNT(DISTINCT CASE WHEN mdv.variance_threshold_exceeded THEN mdv.material_id END) as materials_with_variance,
  ROUND(AVG(ABS(mdv.cubic_feet_variance_pct)), 2) as avg_cubic_feet_variance_pct,
  ROUND(AVG(ABS(mdv.weight_variance_pct)), 2) as avg_weight_variance_pct,

  -- Capacity validation failures
  COUNT(DISTINCT cvf.failure_id) as capacity_failures_count,
  COUNT(DISTINCT CASE WHEN cvf.resolved = FALSE THEN cvf.failure_id END) as unresolved_failures_count,

  -- Cross-dock cancellations
  COUNT(DISTINCT cdc.cancellation_id) as crossdock_cancellations_count,
  COUNT(DISTINCT CASE WHEN cdc.relocation_completed = FALSE THEN cdc.cancellation_id END) as pending_relocations_count,

  -- Auto-remediation
  COUNT(DISTINCT borl.remediation_id) as auto_remediation_count,
  COUNT(DISTINCT CASE WHEN borl.action_successful = FALSE THEN borl.remediation_id END) as failed_remediation_count

FROM tenants t
CROSS JOIN facilities f
LEFT JOIN material_dimension_verifications mdv ON t.tenant_id = mdv.tenant_id AND f.facility_id = mdv.facility_id
LEFT JOIN capacity_validation_failures cvf ON t.tenant_id = cvf.tenant_id AND f.facility_id = cvf.facility_id
LEFT JOIN cross_dock_cancellations cdc ON t.tenant_id = cdc.tenant_id AND f.facility_id = cdc.facility_id
LEFT JOIN bin_optimization_remediation_log borl ON t.tenant_id = borl.tenant_id

WHERE t.deleted_at IS NULL
  AND f.deleted_at IS NULL

GROUP BY t.tenant_id, t.tenant_name, f.facility_id, f.facility_name;

COMMENT ON VIEW bin_optimization_data_quality IS
  'Aggregated data quality metrics for bin optimization system';

-- =====================================================
-- GRANTS (adjust based on your role structure)
-- =====================================================

-- Grant SELECT on new tables to application role
GRANT SELECT ON material_dimension_verifications TO wms_application_role;
GRANT SELECT ON capacity_validation_failures TO wms_application_role;
GRANT SELECT ON cross_dock_cancellations TO wms_application_role;
GRANT SELECT ON bin_optimization_remediation_log TO wms_application_role;
GRANT SELECT ON bin_optimization_data_quality TO wms_application_role;

-- Grant INSERT/UPDATE for write operations
GRANT INSERT, UPDATE ON material_dimension_verifications TO wms_application_role;
GRANT INSERT, UPDATE ON capacity_validation_failures TO wms_application_role;
GRANT INSERT, UPDATE ON cross_dock_cancellations TO wms_application_role;
GRANT INSERT ON bin_optimization_remediation_log TO wms_application_role;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify confidence_score constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'putaway_recommendations'
    AND constraint_name = 'chk_confidence_score_range'
  ) THEN
    RAISE NOTICE 'SUCCESS: confidence_score constraint created';
  ELSE
    RAISE WARNING 'FAILED: confidence_score constraint not found';
  END IF;
END $$;

-- Verify new tables exist
DO $$
DECLARE
  v_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name IN (
    'material_dimension_verifications',
    'capacity_validation_failures',
    'cross_dock_cancellations',
    'bin_optimization_remediation_log'
  );

  IF v_table_count = 4 THEN
    RAISE NOTICE 'SUCCESS: All 4 new tables created';
  ELSE
    RAISE WARNING 'FAILED: Expected 4 tables, found %', v_table_count;
  END IF;
END $$;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================

-- Migration summary
COMMENT ON SCHEMA public IS
  'V0.0.20: Fixed confidence_score precision, added dimension verification, capacity failure tracking, cross-dock cancellation, and auto-remediation logging';
