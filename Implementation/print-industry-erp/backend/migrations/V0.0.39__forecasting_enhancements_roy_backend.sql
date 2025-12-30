-- =====================================================
-- Migration: V0.0.39 - Forecasting Enhancements
-- REQ: REQ-STRATEGIC-AUTO-1766893112869
-- Author: Roy (Backend Developer)
-- Date: 2025-12-27
-- Purpose: Address critical forecasting issues identified in Sylvia's critique
--
-- Changes:
-- 1. Add urgency_level column to replenishment_suggestions
-- 2. Add ordering_cost and holding_cost_pct to materials table
-- 3. Add days_until_stockout computed column
-- 4. Improve replenishment_suggestions indexes
-- =====================================================

-- =====================================================
-- PART 1: Add urgency_level to replenishment_suggestions
-- =====================================================

-- Add urgency_level column with automatic calculation
-- Based on stockout urgency and inventory levels
ALTER TABLE replenishment_suggestions
  ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20);

-- Add days_until_stockout for easier urgency calculation
ALTER TABLE replenishment_suggestions
  ADD COLUMN IF NOT EXISTS days_until_stockout INTEGER;

-- Create function to calculate urgency level
CREATE OR REPLACE FUNCTION calculate_replenishment_urgency(
  p_current_available_quantity DECIMAL,
  p_safety_stock_quantity DECIMAL,
  p_reorder_point_quantity DECIMAL,
  p_days_until_stockout INTEGER,
  p_vendor_lead_time_days INTEGER
) RETURNS VARCHAR(20)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  -- CRITICAL: Already at or below zero inventory
  IF p_current_available_quantity <= 0 THEN
    RETURN 'CRITICAL';
  END IF;

  -- HIGH: Stockout expected before vendor can deliver
  IF p_days_until_stockout IS NOT NULL
     AND p_vendor_lead_time_days IS NOT NULL
     AND p_days_until_stockout <= p_vendor_lead_time_days THEN
    RETURN 'HIGH';
  END IF;

  -- MEDIUM: Below safety stock level
  IF p_safety_stock_quantity IS NOT NULL
     AND p_current_available_quantity < p_safety_stock_quantity THEN
    RETURN 'MEDIUM';
  END IF;

  -- LOW: Below reorder point but above safety stock
  IF p_reorder_point_quantity IS NOT NULL
     AND p_current_available_quantity < p_reorder_point_quantity THEN
    RETURN 'LOW';
  END IF;

  -- If none of the above, return LOW as default for active suggestions
  RETURN 'LOW';
END;
$$;

-- Update existing records to calculate urgency level
UPDATE replenishment_suggestions
SET
  days_until_stockout = CASE
    WHEN projected_stockout_date IS NOT NULL
    THEN EXTRACT(DAYS FROM (projected_stockout_date - CURRENT_DATE))::INTEGER
    ELSE NULL
  END,
  urgency_level = calculate_replenishment_urgency(
    current_available_quantity,
    safety_stock_quantity,
    reorder_point_quantity,
    CASE
      WHEN projected_stockout_date IS NOT NULL
      THEN EXTRACT(DAYS FROM (projected_stockout_date - CURRENT_DATE))::INTEGER
      ELSE NULL
    END,
    vendor_lead_time_days
  )
WHERE urgency_level IS NULL;

-- Create index on urgency_level for filtering
CREATE INDEX IF NOT EXISTS idx_replenishment_urgency_level
  ON replenishment_suggestions(urgency_level)
  WHERE suggestion_status = 'PENDING';

-- Create composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_replenishment_status_urgency_stockout
  ON replenishment_suggestions(suggestion_status, urgency_level, projected_stockout_date)
  WHERE suggestion_status = 'PENDING';

-- Add check constraint for valid urgency levels
ALTER TABLE replenishment_suggestions
  ADD CONSTRAINT chk_urgency_level
  CHECK (urgency_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));

-- =====================================================
-- PART 2: Add cost configuration to materials table
-- =====================================================

-- Add ordering cost and holding cost percentage to materials
-- These are used for Economic Order Quantity (EOQ) calculation
ALTER TABLE materials
  ADD COLUMN IF NOT EXISTS ordering_cost DECIMAL(10,2) DEFAULT 50.00,
  ADD COLUMN IF NOT EXISTS holding_cost_pct DECIMAL(5,4) DEFAULT 0.2500;

-- Add comments for clarity
COMMENT ON COLUMN materials.ordering_cost IS 'Cost to place a purchase order for this material (default: $50)';
COMMENT ON COLUMN materials.holding_cost_pct IS 'Annual holding cost as percentage of unit cost (default: 25% or 0.25)';

-- Add check constraints
ALTER TABLE materials
  ADD CONSTRAINT chk_ordering_cost_positive
  CHECK (ordering_cost >= 0);

ALTER TABLE materials
  ADD CONSTRAINT chk_holding_cost_pct_valid
  CHECK (holding_cost_pct >= 0 AND holding_cost_pct <= 1);

-- =====================================================
-- PART 3: Add forecast model reference constraint fix
-- =====================================================

-- Fix cascade delete issue identified in critique
-- Change forecast_model_id foreign key to SET NULL on delete
ALTER TABLE material_forecasts
  DROP CONSTRAINT IF EXISTS material_forecasts_forecast_model_id_fkey;

ALTER TABLE material_forecasts
  ADD CONSTRAINT material_forecasts_forecast_model_id_fkey
  FOREIGN KEY (forecast_model_id)
  REFERENCES forecast_models(forecast_model_id)
  ON DELETE SET NULL;

-- =====================================================
-- PART 4: Add helper views for monitoring
-- =====================================================

-- View: Critical replenishment recommendations
CREATE OR REPLACE VIEW vw_critical_replenishment_recommendations AS
SELECT
  rs.suggestion_id,
  rs.tenant_id,
  rs.facility_id,
  rs.material_id,
  m.material_name,
  m.material_description,
  rs.current_available_quantity,
  rs.safety_stock_quantity,
  rs.reorder_point_quantity,
  rs.days_until_stockout,
  rs.projected_stockout_date,
  rs.urgency_level,
  rs.recommended_order_quantity,
  rs.recommended_order_uom,
  rs.preferred_vendor_id,
  v.vendor_name,
  rs.estimated_total_cost,
  rs.vendor_lead_time_days,
  rs.suggestion_reason,
  rs.created_at
FROM replenishment_suggestions rs
JOIN materials m ON rs.material_id = m.material_id
LEFT JOIN vendors v ON rs.preferred_vendor_id = v.vendor_id
WHERE rs.suggestion_status = 'PENDING'
  AND rs.urgency_level IN ('HIGH', 'CRITICAL')
ORDER BY
  CASE rs.urgency_level
    WHEN 'CRITICAL' THEN 1
    WHEN 'HIGH' THEN 2
  END,
  rs.projected_stockout_date NULLS LAST;

COMMENT ON VIEW vw_critical_replenishment_recommendations IS
'Critical and high-urgency replenishment recommendations requiring immediate attention';

-- View: Forecast accuracy summary by material
CREATE OR REPLACE VIEW vw_forecast_accuracy_summary AS
SELECT
  m.material_id,
  m.material_name,
  m.abc_class,
  -- Last 30 days accuracy
  (
    SELECT AVG(mape)
    FROM forecast_accuracy_metrics fam
    WHERE fam.material_id = m.material_id
      AND fam.measurement_period_end >= CURRENT_DATE - INTERVAL '30 days'
  ) AS last_30_days_mape,
  -- Last 60 days accuracy
  (
    SELECT AVG(mape)
    FROM forecast_accuracy_metrics fam
    WHERE fam.material_id = m.material_id
      AND fam.measurement_period_end >= CURRENT_DATE - INTERVAL '60 days'
  ) AS last_60_days_mape,
  -- Last 90 days accuracy
  (
    SELECT AVG(mape)
    FROM forecast_accuracy_metrics fam
    WHERE fam.material_id = m.material_id
      AND fam.measurement_period_end >= CURRENT_DATE - INTERVAL '90 days'
  ) AS last_90_days_mape,
  -- Bias (over/under forecasting)
  (
    SELECT AVG(bias)
    FROM forecast_accuracy_metrics fam
    WHERE fam.material_id = m.material_id
      AND fam.measurement_period_end >= CURRENT_DATE - INTERVAL '30 days'
  ) AS last_30_days_bias,
  -- Current algorithm
  m.forecast_algorithm,
  -- Last forecast generation
  (
    SELECT MAX(forecast_generation_timestamp)
    FROM material_forecasts mf
    WHERE mf.material_id = m.material_id
      AND mf.forecast_status = 'ACTIVE'
  ) AS last_forecast_generation_date
FROM materials m
WHERE m.forecasting_enabled = TRUE
ORDER BY
  CASE m.abc_class
    WHEN 'A' THEN 1
    WHEN 'B' THEN 2
    WHEN 'C' THEN 3
  END,
  last_30_days_mape DESC NULLS LAST;

COMMENT ON VIEW vw_forecast_accuracy_summary IS
'Summary of forecast accuracy metrics by material for monitoring dashboard';

-- =====================================================
-- PART 5: Add indexes for performance optimization
-- =====================================================

-- Index for forecast accuracy queries by date range
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_date_range
  ON forecast_accuracy_metrics(material_id, measurement_period_start, measurement_period_end);

-- Index for active forecasts by material and date
CREATE INDEX IF NOT EXISTS idx_material_forecasts_active_material_date
  ON material_forecasts(material_id, forecast_date)
  WHERE forecast_status = 'ACTIVE';

-- =====================================================
-- PART 6: Update RLS policies (if needed)
-- =====================================================

-- Ensure RLS is enabled on replenishment_suggestions
ALTER TABLE replenishment_suggestions ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if exists
DROP POLICY IF EXISTS tenant_isolation_replenishment_suggestions ON replenishment_suggestions;

-- Create tenant isolation policy
CREATE POLICY tenant_isolation_replenishment_suggestions ON replenishment_suggestions
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- PART 7: Grant permissions
-- =====================================================

-- Grant SELECT on views to application role
GRANT SELECT ON vw_critical_replenishment_recommendations TO agog_app_user;
GRANT SELECT ON vw_forecast_accuracy_summary TO agog_app_user;

-- Grant EXECUTE on function
GRANT EXECUTE ON FUNCTION calculate_replenishment_urgency TO agog_app_user;

-- =====================================================
-- Migration Complete
-- =====================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.39 completed successfully';
  RAISE NOTICE '- Added urgency_level and days_until_stockout to replenishment_suggestions';
  RAISE NOTICE '- Added ordering_cost and holding_cost_pct to materials';
  RAISE NOTICE '- Fixed forecast_model_id cascade delete';
  RAISE NOTICE '- Created helper views for monitoring';
  RAISE NOTICE '- Added performance indexes';
END $$;
