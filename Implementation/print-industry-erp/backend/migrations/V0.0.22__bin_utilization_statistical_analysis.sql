-- Migration: V0.0.22 - Bin Utilization Statistical Analysis
-- Author: Priya (Statistical Analysis Expert)
-- Requirement: REQ-STRATEGIC-AUTO-1766545799451
-- Purpose: Add comprehensive statistical analysis and validation framework
-- Stage: Statistical Analysis

-- =====================================================
-- STATISTICAL METRICS TRACKING TABLE
-- =====================================================
-- Purpose: Track algorithm performance metrics over time
-- Statistical methods: Time series analysis, regression, hypothesis testing

CREATE TABLE IF NOT EXISTS bin_optimization_statistical_metrics (
  metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Temporal tracking
  measurement_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  measurement_period_start TIMESTAMP NOT NULL,
  measurement_period_end TIMESTAMP NOT NULL,

  -- Algorithm performance metrics
  algorithm_version VARCHAR(50) NOT NULL DEFAULT 'V2.0_ENHANCED',
  total_recommendations_generated INTEGER NOT NULL DEFAULT 0,
  recommendations_accepted INTEGER NOT NULL DEFAULT 0,
  recommendations_rejected INTEGER NOT NULL DEFAULT 0,
  acceptance_rate DECIMAL(5,4) NOT NULL DEFAULT 0, -- 0.0000 to 1.0000

  -- Utilization statistics
  avg_volume_utilization DECIMAL(5,2) NOT NULL, -- percentage
  std_dev_volume_utilization DECIMAL(5,2),
  median_volume_utilization DECIMAL(5,2),
  p25_volume_utilization DECIMAL(5,2), -- 25th percentile
  p75_volume_utilization DECIMAL(5,2), -- 75th percentile
  p95_volume_utilization DECIMAL(5,2), -- 95th percentile

  avg_weight_utilization DECIMAL(5,2) NOT NULL,
  std_dev_weight_utilization DECIMAL(5,2),

  -- Target achievement
  locations_in_optimal_range INTEGER NOT NULL DEFAULT 0, -- 60-80% utilization
  locations_underutilized INTEGER NOT NULL DEFAULT 0,    -- <60%
  locations_overutilized INTEGER NOT NULL DEFAULT 0,     -- >80%
  target_achievement_rate DECIMAL(5,4),                   -- % in optimal range

  -- Performance improvement metrics
  avg_pick_travel_distance_reduction DECIMAL(5,2), -- percentage improvement
  avg_putaway_time_reduction DECIMAL(5,2),         -- percentage improvement
  space_utilization_improvement DECIMAL(5,2),      -- percentage improvement

  -- ML model statistics
  ml_model_accuracy DECIMAL(5,4),
  ml_model_precision DECIMAL(5,4),
  ml_model_recall DECIMAL(5,4),
  ml_model_f1_score DECIMAL(5,4),

  -- Confidence score statistics
  avg_confidence_score DECIMAL(4,3),
  std_dev_confidence_score DECIMAL(4,3),
  median_confidence_score DECIMAL(4,3),

  -- Sample size for statistical validity
  sample_size INTEGER NOT NULL,
  is_statistically_significant BOOLEAN DEFAULT FALSE,
  confidence_interval_95_lower DECIMAL(5,4),
  confidence_interval_95_upper DECIMAL(5,4),

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,

  -- Foreign keys
  CONSTRAINT fk_stat_metrics_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_stat_metrics_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

-- Indexes for time-series analysis
CREATE INDEX idx_stat_metrics_tenant_facility
  ON bin_optimization_statistical_metrics(tenant_id, facility_id);
CREATE INDEX idx_stat_metrics_timestamp
  ON bin_optimization_statistical_metrics(measurement_timestamp DESC);
CREATE INDEX idx_stat_metrics_period
  ON bin_optimization_statistical_metrics(measurement_period_start, measurement_period_end);
CREATE INDEX idx_stat_metrics_algorithm
  ON bin_optimization_statistical_metrics(algorithm_version, measurement_timestamp DESC);

COMMENT ON TABLE bin_optimization_statistical_metrics IS
  'Time-series tracking of bin utilization algorithm performance with statistical validation';

-- =====================================================
-- A/B TEST RESULTS TABLE
-- =====================================================
-- Purpose: Track A/B test results between algorithm versions

CREATE TABLE IF NOT EXISTS bin_optimization_ab_test_results (
  test_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,

  -- Test configuration
  test_name VARCHAR(200) NOT NULL,
  test_start_date TIMESTAMP NOT NULL,
  test_end_date TIMESTAMP,
  test_status VARCHAR(50) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, CANCELLED

  -- Control group (baseline algorithm)
  control_algorithm_version VARCHAR(50) NOT NULL,
  control_sample_size INTEGER NOT NULL DEFAULT 0,
  control_acceptance_rate DECIMAL(5,4),
  control_avg_utilization DECIMAL(5,2),
  control_avg_confidence DECIMAL(4,3),

  -- Treatment group (new/enhanced algorithm)
  treatment_algorithm_version VARCHAR(50) NOT NULL,
  treatment_sample_size INTEGER NOT NULL DEFAULT 0,
  treatment_acceptance_rate DECIMAL(5,4),
  treatment_avg_utilization DECIMAL(5,2),
  treatment_avg_confidence DECIMAL(4,3),

  -- Statistical test results
  test_type VARCHAR(50) NOT NULL, -- t-test, chi-square, mann-whitney
  test_statistic DECIMAL(10,6),
  p_value DECIMAL(10,8),
  is_significant BOOLEAN DEFAULT FALSE,
  significance_level DECIMAL(3,2) DEFAULT 0.05,

  -- Effect size
  effect_size DECIMAL(10,6), -- Cohen's d, Cramér's V, etc.
  effect_interpretation VARCHAR(50), -- SMALL, MEDIUM, LARGE

  -- Conclusion
  winner VARCHAR(50), -- CONTROL, TREATMENT, NO_DIFFERENCE
  recommendation TEXT,

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,

  CONSTRAINT fk_ab_test_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_ab_test_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

CREATE INDEX idx_ab_test_tenant_facility
  ON bin_optimization_ab_test_results(tenant_id, facility_id);
CREATE INDEX idx_ab_test_status
  ON bin_optimization_ab_test_results(test_status, test_start_date DESC);
CREATE INDEX idx_ab_test_dates
  ON bin_optimization_ab_test_results(test_start_date, test_end_date);

COMMENT ON TABLE bin_optimization_ab_test_results IS
  'A/B testing results for algorithm version comparison with statistical hypothesis testing';

-- =====================================================
-- CORRELATION ANALYSIS TABLE
-- =====================================================
-- Purpose: Track correlations between features and outcomes

CREATE TABLE IF NOT EXISTS bin_optimization_correlation_analysis (
  correlation_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  analysis_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Feature pairs
  feature_x VARCHAR(100) NOT NULL,
  feature_y VARCHAR(100) NOT NULL,

  -- Correlation statistics
  pearson_correlation DECIMAL(10,6), -- Linear correlation (-1 to 1)
  spearman_correlation DECIMAL(10,6), -- Rank correlation (-1 to 1)
  correlation_strength VARCHAR(50), -- VERY_WEAK, WEAK, MODERATE, STRONG, VERY_STRONG

  -- Statistical significance
  p_value DECIMAL(10,8),
  is_significant BOOLEAN DEFAULT FALSE,
  sample_size INTEGER NOT NULL,

  -- Regression analysis (if applicable)
  regression_slope DECIMAL(10,6),
  regression_intercept DECIMAL(10,6),
  r_squared DECIMAL(10,6), -- Coefficient of determination

  -- Interpretation
  relationship_type VARCHAR(50), -- POSITIVE, NEGATIVE, NONE
  interpretation TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_correlation_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_correlation_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

CREATE INDEX idx_correlation_tenant_facility
  ON bin_optimization_correlation_analysis(tenant_id, facility_id);
CREATE INDEX idx_correlation_features
  ON bin_optimization_correlation_analysis(feature_x, feature_y);
CREATE INDEX idx_correlation_date
  ON bin_optimization_correlation_analysis(analysis_date DESC);

COMMENT ON TABLE bin_optimization_correlation_analysis IS
  'Correlation analysis between algorithm features and performance outcomes';

-- =====================================================
-- STATISTICAL VALIDATION RESULTS TABLE
-- =====================================================
-- Purpose: Track statistical validation of algorithm assumptions

CREATE TABLE IF NOT EXISTS bin_optimization_statistical_validations (
  validation_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  validation_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Validation type
  validation_type VARCHAR(100) NOT NULL, -- NORMALITY, HOMOGENEITY, INDEPENDENCE, etc.
  validation_method VARCHAR(100) NOT NULL, -- Shapiro-Wilk, Levene, Durbin-Watson, etc.

  -- Test results
  test_statistic DECIMAL(10,6),
  p_value DECIMAL(10,8),
  passes_validation BOOLEAN DEFAULT FALSE,
  significance_level DECIMAL(3,2) DEFAULT 0.05,

  -- Context
  data_field VARCHAR(100) NOT NULL, -- Which metric was tested
  sample_size INTEGER NOT NULL,

  -- Interpretation
  result_interpretation TEXT,
  remediation_required BOOLEAN DEFAULT FALSE,
  remediation_action TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_validation_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_validation_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

CREATE INDEX idx_validation_tenant_facility
  ON bin_optimization_statistical_validations(tenant_id, facility_id);
CREATE INDEX idx_validation_type
  ON bin_optimization_statistical_validations(validation_type, validation_timestamp DESC);
CREATE INDEX idx_validation_passes
  ON bin_optimization_statistical_validations(passes_validation, validation_timestamp DESC);

COMMENT ON TABLE bin_optimization_statistical_validations IS
  'Statistical validation results for algorithm assumptions and data quality';

-- =====================================================
-- OUTLIER DETECTION TABLE
-- =====================================================
-- Purpose: Track outliers in utilization and performance metrics

CREATE TABLE IF NOT EXISTS bin_optimization_outliers (
  outlier_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  location_id UUID,
  material_id UUID,

  detection_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Outlier details
  metric_name VARCHAR(100) NOT NULL, -- volume_utilization, pick_time, etc.
  metric_value DECIMAL(10,2) NOT NULL,

  -- Statistical bounds
  detection_method VARCHAR(50) NOT NULL, -- IQR, Z_SCORE, MODIFIED_Z_SCORE, ISOLATION_FOREST
  lower_bound DECIMAL(10,2),
  upper_bound DECIMAL(10,2),
  z_score DECIMAL(10,4),

  -- Outlier classification
  outlier_severity VARCHAR(50), -- MILD, MODERATE, SEVERE, EXTREME
  outlier_type VARCHAR(50), -- HIGH, LOW

  -- Impact assessment
  requires_investigation BOOLEAN DEFAULT FALSE,
  investigation_status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, RESOLVED, IGNORED
  root_cause TEXT,
  corrective_action TEXT,

  -- Resolution
  resolved_at TIMESTAMP,
  resolved_by UUID,
  resolution_notes TEXT,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_outlier_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_outlier_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE,
  CONSTRAINT fk_outlier_location FOREIGN KEY (location_id)
    REFERENCES inventory_locations(location_id) ON DELETE SET NULL,
  CONSTRAINT fk_outlier_material FOREIGN KEY (material_id)
    REFERENCES materials(material_id) ON DELETE SET NULL
);

CREATE INDEX idx_outlier_tenant_facility
  ON bin_optimization_outliers(tenant_id, facility_id);
CREATE INDEX idx_outlier_detection
  ON bin_optimization_outliers(detection_timestamp DESC);
CREATE INDEX idx_outlier_status
  ON bin_optimization_outliers(investigation_status, detection_timestamp DESC);
CREATE INDEX idx_outlier_severity
  ON bin_optimization_outliers(outlier_severity, requires_investigation);

COMMENT ON TABLE bin_optimization_outliers IS
  'Outlier detection and tracking for bin utilization metrics with investigation workflow';

-- =====================================================
-- MATERIALIZED VIEW: STATISTICAL SUMMARY
-- =====================================================
-- Purpose: Provide quick access to latest statistical metrics

CREATE MATERIALIZED VIEW IF NOT EXISTS bin_optimization_statistical_summary AS
WITH latest_metrics AS (
  SELECT DISTINCT ON (tenant_id, facility_id)
    tenant_id,
    facility_id,
    measurement_timestamp,
    algorithm_version,
    acceptance_rate,
    avg_volume_utilization,
    std_dev_volume_utilization,
    target_achievement_rate,
    ml_model_accuracy,
    sample_size,
    is_statistically_significant
  FROM bin_optimization_statistical_metrics
  ORDER BY tenant_id, facility_id, measurement_timestamp DESC
),
trend_analysis AS (
  SELECT
    tenant_id,
    facility_id,
    -- Linear regression for trend (slope calculation)
    REGR_SLOPE(avg_volume_utilization, EXTRACT(EPOCH FROM measurement_timestamp)) as utilization_trend_slope,
    REGR_SLOPE(acceptance_rate, EXTRACT(EPOCH FROM measurement_timestamp)) as acceptance_trend_slope,
    COUNT(*) as measurement_count,
    MIN(measurement_timestamp) as first_measurement,
    MAX(measurement_timestamp) as last_measurement
  FROM bin_optimization_statistical_metrics
  WHERE measurement_timestamp >= CURRENT_TIMESTAMP - INTERVAL '30 days'
  GROUP BY tenant_id, facility_id
),
active_outliers AS (
  SELECT
    tenant_id,
    facility_id,
    COUNT(*) as active_outlier_count,
    COUNT(*) FILTER (WHERE outlier_severity IN ('SEVERE', 'EXTREME')) as critical_outlier_count
  FROM bin_optimization_outliers
  WHERE investigation_status IN ('PENDING', 'IN_PROGRESS')
  GROUP BY tenant_id, facility_id
)
SELECT
  lm.tenant_id,
  lm.facility_id,
  lm.measurement_timestamp as last_update,
  lm.algorithm_version,

  -- Current performance
  lm.acceptance_rate as current_acceptance_rate,
  lm.avg_volume_utilization as current_avg_utilization,
  lm.std_dev_volume_utilization as current_std_dev_utilization,
  lm.target_achievement_rate as current_target_achievement,
  lm.ml_model_accuracy as current_ml_accuracy,

  -- Statistical validity
  lm.sample_size as current_sample_size,
  lm.is_statistically_significant,

  -- Trends
  ta.utilization_trend_slope,
  CASE
    WHEN ta.utilization_trend_slope > 0.0001 THEN 'IMPROVING'
    WHEN ta.utilization_trend_slope < -0.0001 THEN 'DECLINING'
    ELSE 'STABLE'
  END as utilization_trend_direction,

  ta.acceptance_trend_slope,
  CASE
    WHEN ta.acceptance_trend_slope > 0.0001 THEN 'IMPROVING'
    WHEN ta.acceptance_trend_slope < -0.0001 THEN 'DECLINING'
    ELSE 'STABLE'
  END as acceptance_trend_direction,

  -- Time span
  ta.measurement_count as measurements_in_30d,
  ta.first_measurement,
  ta.last_measurement,

  -- Data quality
  COALESCE(ao.active_outlier_count, 0) as active_outliers,
  COALESCE(ao.critical_outlier_count, 0) as critical_outliers

FROM latest_metrics lm
LEFT JOIN trend_analysis ta USING (tenant_id, facility_id)
LEFT JOIN active_outliers ao USING (tenant_id, facility_id);

CREATE UNIQUE INDEX idx_stat_summary_tenant_facility
  ON bin_optimization_statistical_summary(tenant_id, facility_id);
CREATE INDEX idx_stat_summary_last_update
  ON bin_optimization_statistical_summary(last_update DESC);

COMMENT ON MATERIALIZED VIEW bin_optimization_statistical_summary IS
  'Latest statistical metrics with trend analysis and data quality indicators';

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON bin_optimization_statistical_metrics TO wms_application_role;
GRANT SELECT, INSERT, UPDATE ON bin_optimization_ab_test_results TO wms_application_role;
GRANT SELECT, INSERT ON bin_optimization_correlation_analysis TO wms_application_role;
GRANT SELECT, INSERT ON bin_optimization_statistical_validations TO wms_application_role;
GRANT SELECT, INSERT, UPDATE ON bin_optimization_outliers TO wms_application_role;
GRANT SELECT ON bin_optimization_statistical_summary TO wms_application_role;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bin_optimization_statistical_metrics') THEN
    RAISE EXCEPTION 'Table bin_optimization_statistical_metrics was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bin_optimization_ab_test_results') THEN
    RAISE EXCEPTION 'Table bin_optimization_ab_test_results was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bin_optimization_correlation_analysis') THEN
    RAISE EXCEPTION 'Table bin_optimization_correlation_analysis was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bin_optimization_statistical_validations') THEN
    RAISE EXCEPTION 'Table bin_optimization_statistical_validations was not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bin_optimization_outliers') THEN
    RAISE EXCEPTION 'Table bin_optimization_outliers was not created';
  END IF;

  -- Verify materialized view exists
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'bin_optimization_statistical_summary') THEN
    RAISE EXCEPTION 'Materialized view bin_optimization_statistical_summary was not created';
  END IF;

  RAISE NOTICE 'Statistical analysis schema created successfully';
END $$;
