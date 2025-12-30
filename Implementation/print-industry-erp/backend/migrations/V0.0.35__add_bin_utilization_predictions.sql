-- =====================================================
-- Migration: V0.0.35 - Add Bin Utilization Predictions
-- =====================================================
-- REQ: REQ-STRATEGIC-AUTO-1766600259419
-- Feature: Optimize Bin Utilization Algorithm (OPP-1)
-- Author: Roy (Backend Implementation)
-- Date: 2025-12-27
--
-- Purpose:
-- Implement real-time utilization prediction capabilities
-- to enable proactive capacity planning and reduce
-- emergency re-slotting by 5-10%
--
-- Expected Impact:
-- - 5-10% reduction in emergency re-slotting
-- - 3-7% improvement in space utilization during peak periods
-- - Proactive ABC re-classification before demand spikes
-- =====================================================

-- =====================================================
-- TABLE: bin_utilization_predictions
-- =====================================================
-- Stores time-series predictions of bin utilization
-- Generated using SMA/EMA models with seasonal adjustment
-- =====================================================

CREATE TABLE IF NOT EXISTS bin_utilization_predictions (
  -- Primary Key
  prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Multi-Tenancy
  tenant_id UUID NOT NULL,

  -- Facility Reference
  facility_id UUID NOT NULL,

  -- Prediction Metadata
  prediction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  prediction_horizon_days INTEGER NOT NULL CHECK (prediction_horizon_days IN (7, 14, 30)),

  -- Predicted Metrics
  predicted_avg_utilization DECIMAL(5,2) NOT NULL CHECK (predicted_avg_utilization >= 0 AND predicted_avg_utilization <= 100),
  predicted_locations_optimal INTEGER NOT NULL DEFAULT 0,

  -- Model Confidence
  confidence_level DECIMAL(5,2) NOT NULL CHECK (confidence_level >= 0 AND confidence_level <= 100),
  model_version VARCHAR(50) NOT NULL DEFAULT 'SMA_EMA_v1.0',

  -- Trend Analysis
  trend VARCHAR(20) NOT NULL CHECK (trend IN ('INCREASING', 'DECREASING', 'STABLE')),
  seasonality_detected BOOLEAN NOT NULL DEFAULT FALSE,

  -- Recommendations
  recommended_actions JSONB NOT NULL DEFAULT '[]',

  -- Audit Fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Foreign Keys
  CONSTRAINT fk_prediction_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_prediction_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(id) ON DELETE CASCADE
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Primary lookup: Get latest predictions for facility
CREATE INDEX idx_bin_predictions_facility_date
  ON bin_utilization_predictions (facility_id, prediction_date DESC);

-- Tenant isolation
CREATE INDEX idx_bin_predictions_tenant
  ON bin_utilization_predictions (tenant_id);

-- Horizon filtering
CREATE INDEX idx_bin_predictions_horizon
  ON bin_utilization_predictions (prediction_horizon_days);

-- Alert queries: High utilization predictions
CREATE INDEX idx_bin_predictions_high_utilization
  ON bin_utilization_predictions (facility_id, predicted_avg_utilization DESC)
  WHERE predicted_avg_utilization > 85;

-- Composite: Facility + Trend for analysis
CREATE INDEX idx_bin_predictions_facility_trend
  ON bin_utilization_predictions (facility_id, trend, prediction_date DESC);

-- Seasonal pattern analysis
CREATE INDEX idx_bin_predictions_seasonal
  ON bin_utilization_predictions (facility_id, seasonality_detected)
  WHERE seasonality_detected = TRUE;

-- =====================================================
-- ROW-LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE bin_utilization_predictions ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant Isolation - Users can only see their tenant's predictions
CREATE POLICY tenant_isolation_policy ON bin_utilization_predictions
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Policy: Admin Access - System admins can see all predictions
CREATE POLICY admin_access_policy ON bin_utilization_predictions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = current_setting('app.current_user_id', TRUE)::UUID
        AND ur.role = 'SYSTEM_ADMIN'
    )
  );

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_bin_prediction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_bin_predictions_updated_at
  BEFORE UPDATE ON bin_utilization_predictions
  FOR EACH ROW
  EXECUTE FUNCTION update_bin_prediction_timestamp();

-- =====================================================
-- MATERIALIZED VIEW: prediction_accuracy_summary
-- =====================================================
-- Tracks prediction model accuracy over time
-- =====================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS prediction_accuracy_summary AS
WITH past_predictions AS (
  SELECT
    facility_id,
    tenant_id,
    prediction_date,
    prediction_horizon_days,
    predicted_avg_utilization,
    (prediction_date + (prediction_horizon_days || ' days')::INTERVAL) as target_date
  FROM bin_utilization_predictions
  WHERE prediction_date + (prediction_horizon_days || ' days')::INTERVAL <= NOW()
    AND prediction_date >= NOW() - INTERVAL '90 days'
),
actuals AS (
  SELECT
    facility_id,
    tenant_id,
    DATE(metric_timestamp) as metric_date,
    AVG(avg_volume_utilization) as actual_utilization
  FROM bin_optimization_statistical_metrics
  WHERE metric_timestamp >= NOW() - INTERVAL '90 days'
  GROUP BY facility_id, tenant_id, DATE(metric_timestamp)
)
SELECT
  pp.facility_id,
  pp.tenant_id,
  pp.prediction_horizon_days,
  COUNT(*) as prediction_count,
  AVG(ABS(pp.predicted_avg_utilization - a.actual_utilization)) as mae,
  SQRT(AVG(POWER(pp.predicted_avg_utilization - a.actual_utilization, 2))) as rmse,
  AVG(ABS((pp.predicted_avg_utilization - a.actual_utilization) / NULLIF(a.actual_utilization, 0)) * 100) as mape,
  (100 - AVG(ABS((pp.predicted_avg_utilization - a.actual_utilization) / NULLIF(a.actual_utilization, 0)) * 100)) as accuracy,
  NOW() as last_refreshed
FROM past_predictions pp
JOIN actuals a ON pp.facility_id = a.facility_id
  AND pp.tenant_id = a.tenant_id
  AND DATE(pp.target_date) = a.metric_date
GROUP BY pp.facility_id, pp.tenant_id, pp.prediction_horizon_days;

-- Index for fast accuracy lookups
CREATE UNIQUE INDEX idx_prediction_accuracy_facility_horizon
  ON prediction_accuracy_summary (facility_id, prediction_horizon_days);

-- =====================================================
-- REFRESH FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_prediction_accuracy()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY prediction_accuracy_summary;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SCHEDULED REFRESH (Daily at 2 AM)
-- =====================================================
-- Note: Requires pg_cron extension
-- Run: SELECT cron.schedule('refresh-prediction-accuracy', '0 2 * * *', 'SELECT refresh_prediction_accuracy()');

-- =====================================================
-- SAMPLE DATA (for testing)
-- =====================================================

-- Insert sample prediction (comment out in production)
/*
INSERT INTO bin_utilization_predictions (
  tenant_id,
  facility_id,
  prediction_horizon_days,
  predicted_avg_utilization,
  predicted_locations_optimal,
  confidence_level,
  trend,
  seasonality_detected,
  recommended_actions
) VALUES (
  (SELECT id FROM tenants LIMIT 1),
  (SELECT id FROM facilities LIMIT 1),
  7,
  72.50,
  150,
  92.00,
  'INCREASING',
  TRUE,
  '["Monitor capacity closely for next 30 days.", "Seasonal pattern detected. Pre-position high-velocity items for peak period."]'::JSONB
);
*/

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT, UPDATE ON bin_utilization_predictions TO warehouse_manager;
GRANT SELECT ON bin_utilization_predictions TO warehouse_picker;
GRANT SELECT ON prediction_accuracy_summary TO warehouse_manager;
GRANT SELECT ON prediction_accuracy_summary TO warehouse_picker;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE bin_utilization_predictions IS
'Stores time-series predictions of bin utilization using SMA/EMA models. Used for proactive capacity planning and pre-emptive re-slotting. Part of REQ-STRATEGIC-AUTO-1766600259419 OPP-1 implementation.';

COMMENT ON COLUMN bin_utilization_predictions.prediction_horizon_days IS
'Prediction horizon in days. Valid values: 7 (short-term), 14 (medium-term), 30 (long-term).';

COMMENT ON COLUMN bin_utilization_predictions.confidence_level IS
'Model confidence level (0-100%). Decreases with longer prediction horizons.';

COMMENT ON COLUMN bin_utilization_predictions.trend IS
'Detected utilization trend: INCREASING (capacity warning), DECREASING (consolidation opportunity), STABLE (no action).';

COMMENT ON COLUMN bin_utilization_predictions.seasonality_detected IS
'TRUE if weekly/monthly seasonal patterns detected in historical data. Triggers proactive ABC re-classification.';

COMMENT ON COLUMN bin_utilization_predictions.recommended_actions IS
'JSONB array of actionable recommendations based on prediction (e.g., "Initiate emergency re-slotting", "Consider capacity expansion").';

COMMENT ON MATERIALIZED VIEW prediction_accuracy_summary IS
'Tracks prediction model accuracy by comparing past predictions to actual utilization. MAE = Mean Absolute Error, RMSE = Root Mean Squared Error, MAPE = Mean Absolute Percentage Error.';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify table created
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bin_utilization_predictions') THEN
    RAISE EXCEPTION 'Migration failed: bin_utilization_predictions table not created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'prediction_accuracy_summary') THEN
    RAISE EXCEPTION 'Migration failed: prediction_accuracy_summary view not created';
  END IF;

  RAISE NOTICE 'Migration V0.0.35 completed successfully';
END $$;
