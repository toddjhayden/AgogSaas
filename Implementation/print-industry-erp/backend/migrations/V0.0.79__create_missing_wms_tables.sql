-- =====================================================
-- FLYWAY MIGRATION V0.0.79
-- =====================================================
-- Purpose: Create missing WMS tables and views referenced in code
-- Tables: bin_optimization_data_quality (view)
--         bin_optimization_statistical_summary (materialized view)
-- Dependencies: V0.0.4 (WMS core), V0.0.37 (WMS optimization tables)
-- Created: 2026-01-04
-- Requirement: REQ-DATABASE-WMS-1766892755200
-- =====================================================

-- =====================================================
-- VIEW: bin_optimization_data_quality
-- =====================================================
-- Purpose: Data quality metrics view for bin optimization system
-- Aggregates material dimension verifications, capacity failures,
-- cross-dock cancellations, and remediation tracking

CREATE OR REPLACE VIEW bin_optimization_data_quality AS
WITH material_verifications AS (
  SELECT
    mdv.tenant_id,
    f.facility_id,
    f.facility_name,
    COUNT(*) as materials_verified_count,
    COUNT(*) FILTER (WHERE mdv.variance_percentage > 5.0) as materials_with_variance,
    AVG(
      CASE
        WHEN mdv.validation_type = 'CUBIC_FEET'
        THEN mdv.variance_percentage
        ELSE 0
      END
    ) as avg_cubic_feet_variance_pct,
    AVG(
      CASE
        WHEN mdv.validation_type = 'WEIGHT'
        THEN mdv.variance_percentage
        ELSE 0
      END
    ) as avg_weight_variance_pct
  FROM wms_dimension_validations mdv
  INNER JOIN materials m ON mdv.material_id = m.material_id
  INNER JOIN facilities f ON mdv.tenant_id = f.tenant_id
  WHERE mdv.validated_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY mdv.tenant_id, f.facility_id, f.facility_name
),
capacity_failures AS (
  SELECT
    cv.tenant_id,
    f.facility_id,
    COUNT(*) as capacity_failures_count,
    COUNT(*) FILTER (WHERE cv.status = 'PENDING') as unresolved_failures_count
  FROM capacity_validation_failures cv
  INNER JOIN facilities f ON cv.tenant_id = f.tenant_id
  WHERE cv.created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY cv.tenant_id, f.facility_id
),
crossdock_cancellations AS (
  SELECT
    cc.tenant_id,
    cc.facility_id,
    COUNT(*) as crossdock_cancellations_count
  FROM cross_dock_cancellations cc
  WHERE cc.cancelled_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY cc.tenant_id, cc.facility_id
),
pending_relocations AS (
  SELECT
    rh.tenant_id,
    rh.facility_id,
    COUNT(*) as pending_relocations_count
  FROM reslotting_history rh
  WHERE rh.status = 'PENDING'
    AND rh.created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY rh.tenant_id, rh.facility_id
),
remediation_tracking AS (
  SELECT
    rem.tenant_id,
    rem.facility_id,
    COUNT(*) FILTER (WHERE rem.remediation_status = 'AUTO_REMEDIATED') as auto_remediation_count,
    COUNT(*) FILTER (WHERE rem.remediation_status = 'FAILED') as failed_remediation_count
  FROM bin_optimization_remediation_log rem
  WHERE rem.created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY rem.tenant_id, rem.facility_id
)
SELECT
  COALESCE(mv.facility_id, cf.facility_id, cc.facility_id, pr.facility_id, rt.facility_id) as facility_id,
  COALESCE(mv.facility_name, f.facility_name) as facility_name,
  COALESCE(mv.tenant_id, cf.tenant_id, cc.tenant_id, pr.tenant_id, rt.tenant_id) as tenant_id,
  COALESCE(mv.materials_verified_count, 0) as materials_verified_count,
  COALESCE(mv.materials_with_variance, 0) as materials_with_variance,
  COALESCE(mv.avg_cubic_feet_variance_pct, 0) as avg_cubic_feet_variance_pct,
  COALESCE(mv.avg_weight_variance_pct, 0) as avg_weight_variance_pct,
  COALESCE(cf.capacity_failures_count, 0) as capacity_failures_count,
  COALESCE(cf.unresolved_failures_count, 0) as unresolved_failures_count,
  COALESCE(cc.crossdock_cancellations_count, 0) as crossdock_cancellations_count,
  COALESCE(pr.pending_relocations_count, 0) as pending_relocations_count,
  COALESCE(rt.auto_remediation_count, 0) as auto_remediation_count,
  COALESCE(rt.failed_remediation_count, 0) as failed_remediation_count
FROM material_verifications mv
FULL OUTER JOIN capacity_failures cf
  ON mv.tenant_id = cf.tenant_id AND mv.facility_id = cf.facility_id
FULL OUTER JOIN crossdock_cancellations cc
  ON COALESCE(mv.tenant_id, cf.tenant_id) = cc.tenant_id
  AND COALESCE(mv.facility_id, cf.facility_id) = cc.facility_id
FULL OUTER JOIN pending_relocations pr
  ON COALESCE(mv.tenant_id, cf.tenant_id, cc.tenant_id) = pr.tenant_id
  AND COALESCE(mv.facility_id, cf.facility_id, cc.facility_id) = pr.facility_id
FULL OUTER JOIN remediation_tracking rt
  ON COALESCE(mv.tenant_id, cf.tenant_id, cc.tenant_id, pr.tenant_id) = rt.tenant_id
  AND COALESCE(mv.facility_id, cf.facility_id, cc.facility_id, pr.facility_id) = rt.facility_id
LEFT JOIN facilities f
  ON COALESCE(mv.facility_id, cf.facility_id, cc.facility_id, pr.facility_id, rt.facility_id) = f.facility_id;

COMMENT ON VIEW bin_optimization_data_quality IS 'Data quality metrics for bin optimization system - aggregates verifications, failures, cancellations, and remediations';

-- =====================================================
-- MATERIALIZED VIEW: bin_optimization_statistical_summary
-- =====================================================
-- Purpose: Statistical summary for bin utilization optimization performance
-- Aggregates performance metrics, trends, and statistical significance

CREATE MATERIALIZED VIEW IF NOT EXISTS bin_optimization_statistical_summary AS
WITH recent_metrics AS (
  SELECT
    tenant_id,
    facility_id,
    algorithm_version,
    AVG(acceptance_rate) as current_acceptance_rate,
    AVG(avg_utilization_pct) as current_avg_utilization,
    STDDEV(avg_utilization_pct) as current_std_dev_utilization,
    AVG(target_achievement_pct) as current_target_achievement,
    AVG(ml_accuracy_pct) as current_ml_accuracy,
    COUNT(*) as current_sample_size,
    MAX(measurement_date) as last_measurement
  FROM bin_optimization_statistical_metrics
  WHERE measurement_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY tenant_id, facility_id, algorithm_version
),
historical_metrics AS (
  SELECT
    tenant_id,
    facility_id,
    MIN(measurement_date) as first_measurement,
    COUNT(*) as measurements_in_30d
  FROM bin_optimization_statistical_metrics
  WHERE measurement_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY tenant_id, facility_id
),
utilization_trend AS (
  SELECT
    tenant_id,
    facility_id,
    REGR_SLOPE(avg_utilization_pct, EXTRACT(EPOCH FROM measurement_date)) as utilization_trend_slope,
    CASE
      WHEN REGR_SLOPE(avg_utilization_pct, EXTRACT(EPOCH FROM measurement_date)) > 0.01 THEN 'IMPROVING'
      WHEN REGR_SLOPE(avg_utilization_pct, EXTRACT(EPOCH FROM measurement_date)) < -0.01 THEN 'DECLINING'
      ELSE 'STABLE'
    END as utilization_trend_direction
  FROM bin_optimization_statistical_metrics
  WHERE measurement_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY tenant_id, facility_id
),
acceptance_trend AS (
  SELECT
    tenant_id,
    facility_id,
    REGR_SLOPE(acceptance_rate, EXTRACT(EPOCH FROM measurement_date)) as acceptance_trend_slope,
    CASE
      WHEN REGR_SLOPE(acceptance_rate, EXTRACT(EPOCH FROM measurement_date)) > 0.01 THEN 'IMPROVING'
      WHEN REGR_SLOPE(acceptance_rate, EXTRACT(EPOCH FROM measurement_date)) < -0.01 THEN 'DECLINING'
      ELSE 'STABLE'
    END as acceptance_trend_direction
  FROM bin_optimization_statistical_metrics
  WHERE measurement_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY tenant_id, facility_id
)
SELECT
  rm.tenant_id,
  rm.facility_id,
  CURRENT_TIMESTAMP as last_update,
  rm.algorithm_version,
  rm.current_acceptance_rate,
  rm.current_avg_utilization,
  rm.current_std_dev_utilization,
  rm.current_target_achievement,
  rm.current_ml_accuracy,
  rm.current_sample_size,
  CASE
    WHEN rm.current_sample_size >= 30 THEN true
    ELSE false
  END as is_statistically_significant,
  COALESCE(ut.utilization_trend_slope, 0) as utilization_trend_slope,
  COALESCE(ut.utilization_trend_direction, 'STABLE') as utilization_trend_direction,
  COALESCE(at.acceptance_trend_slope, 0) as acceptance_trend_slope,
  COALESCE(at.acceptance_trend_direction, 'STABLE') as acceptance_trend_direction,
  hm.measurements_in_30d,
  hm.first_measurement,
  rm.last_measurement
FROM recent_metrics rm
LEFT JOIN historical_metrics hm
  ON rm.tenant_id = hm.tenant_id AND rm.facility_id = hm.facility_id
LEFT JOIN utilization_trend ut
  ON rm.tenant_id = ut.tenant_id AND rm.facility_id = ut.facility_id
LEFT JOIN acceptance_trend at
  ON rm.tenant_id = at.tenant_id AND rm.facility_id = at.facility_id;

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_bin_opt_stat_summary_unique
  ON bin_optimization_statistical_summary(tenant_id, facility_id, algorithm_version);

CREATE INDEX IF NOT EXISTS idx_bin_opt_stat_summary_facility
  ON bin_optimization_statistical_summary(facility_id);

CREATE INDEX IF NOT EXISTS idx_bin_opt_stat_summary_last_update
  ON bin_optimization_statistical_summary(last_update);

COMMENT ON MATERIALIZED VIEW bin_optimization_statistical_summary IS 'Statistical performance summary for bin optimization - refreshed concurrently, provides trends and significance analysis';

-- =====================================================
-- Grant Permissions
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    GRANT SELECT ON bin_optimization_data_quality TO agogsaas_user;
    GRANT SELECT ON bin_optimization_statistical_summary TO agogsaas_user;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.79 completed: Missing WMS tables and views created';
  RAISE NOTICE '  - bin_optimization_data_quality (view)';
  RAISE NOTICE '  - bin_optimization_statistical_summary (materialized view)';
  RAISE NOTICE '';
  RAISE NOTICE 'NOTE: The following table names are CTEs (Common Table Expressions) in queries, not actual tables:';
  RAISE NOTICE '  - bin_availability (CTE in bin-fragmentation-monitoring)';
  RAISE NOTICE '  - material_spread (CTE in bin-fragmentation-monitoring)';
  RAISE NOTICE '  - recent_velocity (CTE in bin-utilization-optimization-enhanced)';
  RAISE NOTICE '  - historical_velocity (CTE in bin-utilization-optimization-enhanced)';
  RAISE NOTICE '  - reslotting_events (CTE in bin-algorithm-tuner)';
END $$;
