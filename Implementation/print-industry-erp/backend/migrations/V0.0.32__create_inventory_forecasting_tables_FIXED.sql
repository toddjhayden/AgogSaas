-- =====================================================
-- FLYWAY MIGRATION V0.0.32 - FIXED VERSION
-- =====================================================
-- Purpose: Create inventory forecasting and demand planning tables
-- Feature: REQ-STRATEGIC-AUTO-1735405200000 - Inventory Forecasting
-- Tables: 5 (demand_history, material_forecasts, forecast_models,
--            forecast_accuracy_metrics, replenishment_suggestions)
-- Dependencies: V0.0.6 (sales_materials_procurement)
-- Created: 2025-12-26
-- Fixed: 2025-12-28 (Billy QA - Fixed foreign key references to use id instead of tenant_id)
-- =====================================================

-- CRITICAL BUG FIX: Changed all REFERENCES tenants(tenant_id) to REFERENCES tenants(id)
-- CRITICAL BUG FIX: Changed all REFERENCES facilities(facility_id) to REFERENCES facilities(id)
-- The tenants and facilities tables use 'id' as their primary key, not 'tenant_id' or 'facility_id'

-- =====================================================
-- TABLE: demand_history
-- =====================================================
-- Purpose: Tracks historical demand (consumption) for each material to feed forecasting algorithms

CREATE TABLE IF NOT EXISTS demand_history (
  demand_history_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  material_id UUID NOT NULL REFERENCES materials(id),

  -- Time dimensions
  demand_date DATE NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  week_of_year INTEGER NOT NULL,
  day_of_week INTEGER NOT NULL,
  quarter INTEGER NOT NULL,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_promotional_period BOOLEAN DEFAULT FALSE,

  -- Demand quantities
  actual_demand_quantity DECIMAL(15, 4) NOT NULL,
  forecasted_demand_quantity DECIMAL(15, 4),
  demand_uom VARCHAR(10) NOT NULL,

  -- Demand sources (disaggregation)
  sales_order_demand DECIMAL(15, 4) DEFAULT 0,
  production_order_demand DECIMAL(15, 4) DEFAULT 0,
  transfer_order_demand DECIMAL(15, 4) DEFAULT 0,
  scrap_adjustment DECIMAL(15, 4) DEFAULT 0,

  -- External factors (exogenous variables)
  avg_unit_price DECIMAL(15, 4),
  promotional_discount_pct DECIMAL(5, 2),
  marketing_campaign_active BOOLEAN DEFAULT FALSE,

  -- Forecast accuracy metrics (calculated post-facto)
  forecast_error DECIMAL(15, 4),
  absolute_percentage_error DECIMAL(5, 2),

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100),

  CONSTRAINT uq_demand_history_material_date UNIQUE (tenant_id, facility_id, material_id, demand_date),
  CONSTRAINT chk_demand_positive CHECK (actual_demand_quantity >= 0)
);

CREATE INDEX IF NOT EXISTS idx_demand_history_tenant_facility ON demand_history(tenant_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_demand_history_material ON demand_history(material_id);
CREATE INDEX IF NOT EXISTS idx_demand_history_date ON demand_history(demand_date DESC);
CREATE INDEX IF NOT EXISTS idx_demand_history_material_date_range ON demand_history(material_id, demand_date);

-- Row Level Security
ALTER TABLE demand_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_demand_history ON demand_history;
CREATE POLICY tenant_isolation_demand_history ON demand_history
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- TABLE: forecast_models
-- =====================================================
-- Purpose: Tracks metadata about trained forecasting models for versioning and auditability

CREATE TABLE IF NOT EXISTS forecast_models (
  forecast_model_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  material_id UUID REFERENCES materials(id),

  -- Model identification
  model_name VARCHAR(100) NOT NULL,
  model_algorithm VARCHAR(50) NOT NULL, -- 'SARIMA', 'LIGHTGBM', 'MOVING_AVERAGE', 'EXP_SMOOTHING', 'HOLT_WINTERS'
  model_version VARCHAR(20) NOT NULL,

  -- Training metadata
  training_start_date DATE NOT NULL,
  training_end_date DATE NOT NULL,
  training_sample_size INTEGER NOT NULL,
  training_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Model parameters (JSON for flexibility)
  model_hyperparameters JSONB, -- SARIMA: {p, d, q, P, D, Q, s}, LightGBM: {n_estimators, max_depth, ...}
  feature_list JSONB, -- List of features used (for ML models)

  -- Model performance metrics (on hold-out test set)
  test_mape DECIMAL(10, 4), -- Mean Absolute Percentage Error
  test_rmse DECIMAL(10, 4), -- Root Mean Squared Error
  test_mae DECIMAL(10, 4), -- Mean Absolute Error
  test_bias DECIMAL(10, 4), -- Forecast bias (over/under forecasting)
  test_r_squared DECIMAL(10, 4), -- Coefficient of determination

  -- Model artifact storage
  model_artifact_path TEXT, -- Path to serialized model file (for LightGBM, SARIMA models)

  -- Status tracking
  model_status VARCHAR(20) DEFAULT 'ACTIVE', -- 'TRAINING', 'ACTIVE', 'RETIRED', 'FAILED'
  retirement_timestamp TIMESTAMP WITH TIME ZONE,
  retirement_reason TEXT,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),

  CONSTRAINT uq_forecast_model_name_version UNIQUE (tenant_id, model_name, model_version)
);

CREATE INDEX IF NOT EXISTS idx_forecast_models_tenant_facility ON forecast_models(tenant_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_forecast_models_material ON forecast_models(material_id);
CREATE INDEX IF NOT EXISTS idx_forecast_models_algorithm ON forecast_models(model_algorithm);
CREATE INDEX IF NOT EXISTS idx_forecast_models_status ON forecast_models(model_status);

-- Row Level Security
ALTER TABLE forecast_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_forecast_models ON forecast_models;
CREATE POLICY tenant_isolation_forecast_models ON forecast_models
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- TABLE: material_forecasts
-- =====================================================
-- Purpose: Stores generated forecasts for future demand

CREATE TABLE IF NOT EXISTS material_forecasts (
  material_forecast_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  forecast_model_id UUID REFERENCES forecast_models(forecast_model_id),

  -- Forecast identification
  forecast_date DATE NOT NULL,
  forecast_horizon VARCHAR(20) NOT NULL, -- 'SHORT_TERM', 'MEDIUM_TERM', 'LONG_TERM'
  forecast_algorithm VARCHAR(50) NOT NULL, -- Algorithm used (may differ from model if manual override)
  forecast_version INTEGER DEFAULT 1, -- Incrementing version for same date (allows reforecasting)
  forecast_generation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,

  -- Forecasted values
  forecasted_demand_quantity DECIMAL(15, 4) NOT NULL,
  forecast_uom VARCHAR(10) NOT NULL,

  -- Confidence intervals
  lower_bound_80_pct DECIMAL(15, 4), -- 80% confidence interval lower bound
  upper_bound_80_pct DECIMAL(15, 4), -- 80% confidence interval upper bound
  lower_bound_95_pct DECIMAL(15, 4), -- 95% confidence interval lower bound
  upper_bound_95_pct DECIMAL(15, 4), -- 95% confidence interval upper bound

  -- Model confidence score (0-1, where 1 = highest confidence)
  model_confidence_score DECIMAL(5, 4),

  -- Forecast status
  forecast_status VARCHAR(20) DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUPERSEDED', 'REJECTED'
  superseded_by_forecast_id UUID,
  superseded_timestamp TIMESTAMP WITH TIME ZONE,

  -- Manual overrides
  is_manually_overridden BOOLEAN DEFAULT FALSE,
  manual_override_quantity DECIMAL(15, 4),
  manual_override_reason TEXT,
  manual_override_by VARCHAR(100),
  manual_override_timestamp TIMESTAMP WITH TIME ZONE,

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),

  CONSTRAINT uq_material_forecast_date_version UNIQUE (tenant_id, facility_id, material_id, forecast_date, forecast_version)
);

CREATE INDEX IF NOT EXISTS idx_material_forecasts_tenant_facility ON material_forecasts(tenant_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_material_forecasts_material ON material_forecasts(material_id);
CREATE INDEX IF NOT EXISTS idx_material_forecasts_date ON material_forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_material_forecasts_material_date_range ON material_forecasts(material_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_material_forecasts_status ON material_forecasts(forecast_status);

-- Row Level Security
ALTER TABLE material_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_material_forecasts ON material_forecasts;
CREATE POLICY tenant_isolation_material_forecasts ON material_forecasts
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- TABLE: forecast_accuracy_metrics
-- =====================================================
-- Purpose: Tracks forecast accuracy over time to monitor model performance

CREATE TABLE IF NOT EXISTS forecast_accuracy_metrics (
  metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  material_id UUID NOT NULL REFERENCES materials(id),

  -- Measurement period
  measurement_period_start DATE NOT NULL,
  measurement_period_end DATE NOT NULL,
  aggregation_level VARCHAR(20) NOT NULL, -- 'DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'

  -- Accuracy metrics
  mape DECIMAL(10, 4), -- Mean Absolute Percentage Error (industry standard)
  rmse DECIMAL(10, 4), -- Root Mean Squared Error
  mae DECIMAL(10, 4), -- Mean Absolute Error
  bias DECIMAL(10, 4), -- Forecast bias (+ = under-forecasting, - = over-forecasting)
  tracking_signal DECIMAL(10, 4), -- Cumulative error / MAD (detects systematic bias)

  -- Sample metadata
  sample_size INTEGER NOT NULL, -- Number of data points in this period
  total_actual_demand DECIMAL(15, 2),
  total_forecasted_demand DECIMAL(15, 2),

  -- Thresholds and flags
  is_within_tolerance BOOLEAN DEFAULT FALSE, -- Is MAPE within target threshold?
  target_mape_threshold DECIMAL(10, 4), -- Material's target MAPE (from materials table)

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT chk_measurement_period_order CHECK (measurement_period_end >= measurement_period_start),
  CONSTRAINT uq_forecast_accuracy_period UNIQUE (tenant_id, facility_id, material_id, measurement_period_start, measurement_period_end, aggregation_level)
);

CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_tenant_facility ON forecast_accuracy_metrics(tenant_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_material ON forecast_accuracy_metrics(material_id);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_period ON forecast_accuracy_metrics(measurement_period_start, measurement_period_end);
CREATE INDEX IF NOT EXISTS idx_forecast_accuracy_material_period ON forecast_accuracy_metrics(material_id, measurement_period_end DESC);

-- Row Level Security
ALTER TABLE forecast_accuracy_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_forecast_accuracy_metrics ON forecast_accuracy_metrics;
CREATE POLICY tenant_isolation_forecast_accuracy_metrics ON forecast_accuracy_metrics
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- TABLE: replenishment_suggestions
-- =====================================================
-- Purpose: System-generated purchase order suggestions based on forecasts and inventory levels

CREATE TABLE IF NOT EXISTS replenishment_suggestions (
  suggestion_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  facility_id UUID NOT NULL REFERENCES facilities(id),
  material_id UUID NOT NULL REFERENCES materials(id),
  preferred_vendor_id UUID REFERENCES vendors(id),

  -- Suggestion metadata
  suggestion_generation_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  suggestion_status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'CONVERTED_TO_PO', 'EXPIRED'

  -- Inventory levels (snapshot at suggestion time)
  current_on_hand_quantity DECIMAL(15, 4) NOT NULL,
  current_allocated_quantity DECIMAL(15, 4) NOT NULL,
  current_available_quantity DECIMAL(15, 4) NOT NULL,
  current_on_order_quantity DECIMAL(15, 4) NOT NULL,

  -- Planning parameters
  safety_stock_quantity DECIMAL(15, 4) NOT NULL,
  reorder_point_quantity DECIMAL(15, 4) NOT NULL,
  economic_order_quantity DECIMAL(15, 4),

  -- Forecast-driven calculations
  forecasted_demand_30_days DECIMAL(15, 4) NOT NULL,
  forecasted_demand_60_days DECIMAL(15, 4),
  forecasted_demand_90_days DECIMAL(15, 4),
  projected_stockout_date DATE,

  -- Replenishment recommendation
  recommended_order_quantity DECIMAL(15, 4) NOT NULL,
  recommended_order_uom VARCHAR(10) NOT NULL,
  recommended_order_date DATE NOT NULL,
  recommended_delivery_date DATE,

  -- Cost estimation
  estimated_unit_cost DECIMAL(15, 4),
  estimated_total_cost DECIMAL(15, 2),

  -- Vendor information
  vendor_lead_time_days INTEGER,

  -- Suggestion reasoning
  suggestion_reason TEXT, -- Explanation for the recommendation
  calculation_method VARCHAR(50), -- 'EOQ', 'MIN_MAX', 'FORECAST_BASED', 'SAFETY_STOCK_REPLENISHMENT'

  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(100),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted_by VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_tenant_facility ON replenishment_suggestions(tenant_id, facility_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_material ON replenishment_suggestions(material_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_status ON replenishment_suggestions(suggestion_status);
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_vendor ON replenishment_suggestions(preferred_vendor_id);
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_order_date ON replenishment_suggestions(recommended_order_date);
CREATE INDEX IF NOT EXISTS idx_replenishment_suggestions_stockout_date ON replenishment_suggestions(projected_stockout_date ASC)
  WHERE suggestion_status = 'PENDING';

-- Row Level Security
ALTER TABLE replenishment_suggestions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_replenishment_suggestions ON replenishment_suggestions;
CREATE POLICY tenant_isolation_replenishment_suggestions ON replenishment_suggestions
  USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =====================================================
-- EXTEND materials TABLE with forecasting configuration
-- =====================================================

ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecasting_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_algorithm VARCHAR(50) DEFAULT 'AUTO'; -- 'AUTO', 'SARIMA', 'LIGHTGBM', 'MOVING_AVERAGE', 'EXP_SMOOTHING', 'HOLT_WINTERS'
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_horizon_days INTEGER DEFAULT 90;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS forecast_update_frequency VARCHAR(20) DEFAULT 'WEEKLY'; -- 'DAILY', 'WEEKLY', 'MONTHLY'
ALTER TABLE materials ADD COLUMN IF NOT EXISTS minimum_forecast_history_days INTEGER DEFAULT 90;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS target_forecast_accuracy_pct DECIMAL(5, 2) DEFAULT 20.00; -- Target MAPE
ALTER TABLE materials ADD COLUMN IF NOT EXISTS demand_pattern VARCHAR(20); -- 'STABLE', 'SEASONAL', 'INTERMITTENT', 'LUMPY', 'ERRATIC'

-- =====================================================
-- Comments for documentation
-- =====================================================

COMMENT ON TABLE demand_history IS 'Historical demand tracking for forecasting algorithms - REQ-STRATEGIC-AUTO-1735405200000';
COMMENT ON TABLE material_forecasts IS 'Generated demand forecasts with confidence intervals - REQ-STRATEGIC-AUTO-1735405200000';
COMMENT ON TABLE forecast_models IS 'Forecasting model metadata and performance tracking - REQ-STRATEGIC-AUTO-1735405200000';
COMMENT ON TABLE forecast_accuracy_metrics IS 'Forecast accuracy metrics (MAPE, bias, etc.) - REQ-STRATEGIC-AUTO-1735405200000';
COMMENT ON TABLE replenishment_suggestions IS 'Automated purchase order suggestions based on forecasts - REQ-STRATEGIC-AUTO-1735405200000';

-- =====================================================
-- Migration Complete
-- =====================================================
