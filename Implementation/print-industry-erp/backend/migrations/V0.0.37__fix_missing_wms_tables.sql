-- =====================================================
-- Migration: V0.0.37 - Fix Missing WMS Tables
-- =====================================================
-- Description: Creates all missing WMS tables that failed in previous migrations
-- Date: 2025-12-27
-- Requirement: REQ-DATABASE-WMS-1766892755200
-- =====================================================

-- =====================================================
-- Material Velocity Metrics Table (from V0.0.15)
-- =====================================================

CREATE TABLE IF NOT EXISTS material_velocity_metrics (
  metric_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  material_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_picks INTEGER DEFAULT 0,
  total_quantity_picked DECIMAL(15,4) DEFAULT 0,
  total_value_picked DECIMAL(15,2) DEFAULT 0,
  abc_classification CHAR(1) CHECK (abc_classification IN ('A', 'B', 'C')),
  velocity_rank INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  CONSTRAINT fk_material_velocity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_material_velocity_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  CONSTRAINT unique_material_period UNIQUE (material_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_material_velocity_material ON material_velocity_metrics(material_id);
CREATE INDEX IF NOT EXISTS idx_material_velocity_period ON material_velocity_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_material_velocity_abc ON material_velocity_metrics(abc_classification);

COMMENT ON TABLE material_velocity_metrics IS 'Tracks material velocity and ABC classification over time for warehouse slotting optimization';

-- =====================================================
-- Putaway Recommendations Table (from V0.0.15)
-- =====================================================

CREATE TABLE IF NOT EXISTS putaway_recommendations (
  recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  lot_number VARCHAR(100) NOT NULL,
  material_id UUID NOT NULL,
  quantity DECIMAL(15,4),
  recommended_location_id UUID NOT NULL,
  algorithm_used VARCHAR(50),
  confidence_score DECIMAL(3,2),
  reason TEXT,
  accepted BOOLEAN,
  actual_location_id UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  decided_at TIMESTAMP,
  decided_by UUID,
  CONSTRAINT fk_putaway_rec_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_recommended_location FOREIGN KEY (recommended_location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE,
  CONSTRAINT fk_putaway_rec_actual_location FOREIGN KEY (actual_location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_putaway_rec_material ON putaway_recommendations(material_id);
CREATE INDEX IF NOT EXISTS idx_putaway_rec_created ON putaway_recommendations(created_at);
CREATE INDEX IF NOT EXISTS idx_putaway_rec_accepted ON putaway_recommendations(accepted) WHERE accepted IS NOT NULL;

COMMENT ON TABLE putaway_recommendations IS 'Tracks putaway location recommendations and actual decisions for machine learning feedback';

-- =====================================================
-- Reslotting History Table (from V0.0.15)
-- =====================================================

CREATE TABLE IF NOT EXISTS reslotting_history (
  reslot_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  material_id UUID NOT NULL,
  lot_number VARCHAR(100),
  quantity DECIMAL(15,4),
  from_location_id UUID NOT NULL,
  to_location_id UUID NOT NULL,
  reslot_type VARCHAR(50),
  reason TEXT,
  velocity_change DECIMAL(5,2),
  estimated_efficiency_gain DECIMAL(5,2),
  actual_efficiency_gain DECIMAL(5,2),
  status VARCHAR(20) DEFAULT 'PENDING',
  executed_at TIMESTAMP,
  executed_by UUID,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  CONSTRAINT fk_reslot_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_from_location FOREIGN KEY (from_location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE,
  CONSTRAINT fk_reslot_to_location FOREIGN KEY (to_location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reslot_material ON reslotting_history(material_id);
CREATE INDEX IF NOT EXISTS idx_reslot_facility ON reslotting_history(facility_id);
CREATE INDEX IF NOT EXISTS idx_reslot_status ON reslotting_history(status);
CREATE INDEX IF NOT EXISTS idx_reslot_created ON reslotting_history(created_at);

COMMENT ON TABLE reslotting_history IS 'Tracks dynamic re-slotting operations for continuous warehouse optimization';

-- =====================================================
-- Warehouse Optimization Settings Table (from V0.0.15)
-- =====================================================

CREATE TABLE IF NOT EXISTS warehouse_optimization_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID,
  setting_key VARCHAR(100) NOT NULL,
  setting_value DECIMAL(10,2),
  setting_description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  CONSTRAINT fk_optimization_settings_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_optimization_settings_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT unique_setting_per_facility UNIQUE (tenant_id, facility_id, setting_key)
);

COMMENT ON TABLE warehouse_optimization_settings IS 'Configurable thresholds and settings for bin utilization optimization algorithms';

-- =====================================================
-- Data Quality Tables (from V0.0.20)
-- =====================================================

CREATE TABLE IF NOT EXISTS wms_data_quality_checks (
  check_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID,
  check_type VARCHAR(50) NOT NULL,
  check_description TEXT,
  severity VARCHAR(20),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  CONSTRAINT fk_data_quality_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_data_quality_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wms_data_quality_tenant ON wms_data_quality_checks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wms_data_quality_type ON wms_data_quality_checks(check_type);

COMMENT ON TABLE wms_data_quality_checks IS 'Configuration for WMS data quality validation rules';

-- =====================================================

CREATE TABLE IF NOT EXISTS wms_dimension_validations (
  validation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  material_id UUID NOT NULL,
  location_id UUID,
  validation_type VARCHAR(50),
  expected_value DECIMAL(10,2),
  actual_value DECIMAL(10,2),
  variance_percentage DECIMAL(5,2),
  status VARCHAR(20),
  validated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  validated_by UUID,
  CONSTRAINT fk_dimension_validation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_dimension_validation_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  CONSTRAINT fk_dimension_validation_location FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wms_dimension_tenant ON wms_dimension_validations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wms_dimension_material ON wms_dimension_validations(material_id);

COMMENT ON TABLE wms_dimension_validations IS 'Tracks material dimension validation results';

-- =====================================================
-- Statistical Analysis Tables (from V0.0.22)
-- =====================================================

CREATE TABLE IF NOT EXISTS statistical_outlier_detections (
  outlier_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  analysis_type VARCHAR(50),
  entity_type VARCHAR(50),
  entity_id UUID,
  metric_name VARCHAR(100),
  metric_value DECIMAL(15,4),
  z_score DECIMAL(10,4),
  is_outlier BOOLEAN,
  detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_outlier_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_outlier_tenant ON statistical_outlier_detections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_outlier_type ON statistical_outlier_detections(analysis_type);

COMMENT ON TABLE statistical_outlier_detections IS 'Statistical outlier detection for warehouse metrics';

-- =====================================================

CREATE TABLE IF NOT EXISTS statistical_baseline_metrics (
  baseline_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  metric_name VARCHAR(100),
  facility_id UUID,
  period_start DATE,
  period_end DATE,
  mean_value DECIMAL(15,4),
  median_value DECIMAL(15,4),
  std_deviation DECIMAL(15,4),
  min_value DECIMAL(15,4),
  max_value DECIMAL(15,4),
  sample_count INTEGER,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_baseline_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_baseline_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_baseline_tenant ON statistical_baseline_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_baseline_metric ON statistical_baseline_metrics(metric_name);

COMMENT ON TABLE statistical_baseline_metrics IS 'Statistical baselines for warehouse performance metrics';

-- =====================================================
-- Bin Optimization Health Table (from V0.0.18)
-- =====================================================

CREATE TABLE IF NOT EXISTS bin_optimization_health (
  health_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID,
  check_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  overall_status VARCHAR(20),
  cache_freshness_minutes INTEGER,
  data_quality_score DECIMAL(5,2),
  algorithm_performance_score DECIMAL(5,2),
  issues_detected INTEGER,
  warnings_detected INTEGER,
  details JSONB,
  CONSTRAINT fk_bin_health_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_bin_health_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_bin_health_tenant ON bin_optimization_health(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bin_health_timestamp ON bin_optimization_health(check_timestamp);

COMMENT ON TABLE bin_optimization_health IS 'Health monitoring for bin optimization system';

-- =====================================================
-- Bin Fragmentation Monitoring (from V0.0.28)
-- =====================================================

CREATE TABLE IF NOT EXISTS bin_fragmentation_metrics (
  fragmentation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  location_id UUID,
  zone_code VARCHAR(50),
  fragmentation_index DECIMAL(5,2),
  lot_count INTEGER,
  material_count INTEGER,
  consolidation_potential_pct DECIMAL(5,2),
  measured_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fragmentation_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_fragmentation_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT fk_fragmentation_location FOREIGN KEY (location_id) REFERENCES inventory_locations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_fragmentation_tenant ON bin_fragmentation_metrics(tenant_id);
CREATE INDEX IF NOT EXISTS idx_fragmentation_facility ON bin_fragmentation_metrics(facility_id);
CREATE INDEX IF NOT EXISTS idx_fragmentation_location ON bin_fragmentation_metrics(location_id);

COMMENT ON TABLE bin_fragmentation_metrics IS 'Tracks bin fragmentation for consolidation opportunities';

-- =====================================================
-- Vertical Proximity Settings (from V0.0.29)
-- =====================================================

CREATE TABLE IF NOT EXISTS vertical_proximity_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  setting_key VARCHAR(100),
  setting_value DECIMAL(10,2),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  CONSTRAINT fk_vertical_proximity_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_vertical_proximity_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT unique_vertical_setting UNIQUE (tenant_id, facility_id, setting_key)
);

CREATE INDEX IF NOT EXISTS idx_vertical_proximity_tenant ON vertical_proximity_settings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vertical_proximity_facility ON vertical_proximity_settings(facility_id);

COMMENT ON TABLE vertical_proximity_settings IS '3D vertical proximity optimization configuration';

-- =====================================================
-- DevOps Alerting Infrastructure (from V0.0.27)
-- =====================================================

CREATE TABLE IF NOT EXISTS devops_alert_configs (
  config_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  alert_type VARCHAR(50),
  alert_name VARCHAR(100),
  severity VARCHAR(20),
  threshold_value DECIMAL(10,2),
  evaluation_window_minutes INTEGER,
  is_enabled BOOLEAN DEFAULT TRUE,
  notification_channels JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  CONSTRAINT fk_alert_config_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_config_tenant ON devops_alert_configs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_config_type ON devops_alert_configs(alert_type);

COMMENT ON TABLE devops_alert_configs IS 'Configuration for DevOps alerting system';

-- =====================================================

CREATE TABLE IF NOT EXISTS devops_alert_history (
  alert_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  config_id UUID,
  alert_type VARCHAR(50),
  severity VARCHAR(20),
  message TEXT,
  details JSONB,
  status VARCHAR(20),
  triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP,
  acknowledged_by UUID,
  CONSTRAINT fk_alert_history_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_history_config FOREIGN KEY (config_id) REFERENCES devops_alert_configs(config_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_history_tenant ON devops_alert_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alert_history_triggered ON devops_alert_history(triggered_at);
CREATE INDEX IF NOT EXISTS idx_alert_history_status ON devops_alert_history(status);

COMMENT ON TABLE devops_alert_history IS 'History of DevOps alerts triggered';

-- =====================================================
-- Inventory Forecasting Tables (from V0.0.32)
-- =====================================================

CREATE TABLE IF NOT EXISTS inventory_forecasting_predictions (
  prediction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  material_id UUID NOT NULL,
  prediction_date DATE NOT NULL,
  forecast_horizon_days INTEGER,
  predicted_demand DECIMAL(15,4),
  confidence_interval_lower DECIMAL(15,4),
  confidence_interval_upper DECIMAL(15,4),
  model_used VARCHAR(50),
  accuracy_score DECIMAL(5,2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_forecasting_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_forecasting_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT fk_forecasting_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  CONSTRAINT unique_forecast UNIQUE (facility_id, material_id, prediction_date, forecast_horizon_days)
);

CREATE INDEX IF NOT EXISTS idx_forecasting_tenant ON inventory_forecasting_predictions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_forecasting_material ON inventory_forecasting_predictions(material_id);
CREATE INDEX IF NOT EXISTS idx_forecasting_date ON inventory_forecasting_predictions(prediction_date);

COMMENT ON TABLE inventory_forecasting_predictions IS 'Demand forecasting predictions for inventory planning';

-- =====================================================

CREATE TABLE IF NOT EXISTS safety_stock_calculations (
  calculation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  facility_id UUID NOT NULL,
  material_id UUID NOT NULL,
  calculation_date DATE NOT NULL,
  lead_time_days INTEGER,
  demand_variability DECIMAL(10,2),
  service_level_target DECIMAL(5,2),
  recommended_safety_stock DECIMAL(15,4),
  current_safety_stock DECIMAL(15,4),
  variance_reason TEXT,
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_safety_stock_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_safety_stock_facility FOREIGN KEY (facility_id) REFERENCES facilities(id) ON DELETE CASCADE,
  CONSTRAINT fk_safety_stock_material FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_safety_stock_tenant ON safety_stock_calculations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_safety_stock_material ON safety_stock_calculations(material_id);
CREATE INDEX IF NOT EXISTS idx_safety_stock_date ON safety_stock_calculations(calculation_date);

COMMENT ON TABLE safety_stock_calculations IS 'Safety stock calculations based on demand variability';

-- =====================================================
-- Grant Permissions
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE material_velocity_metrics TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE putaway_recommendations TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE reslotting_history TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE warehouse_optimization_settings TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wms_data_quality_checks TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE wms_dimension_validations TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE statistical_outlier_detections TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE statistical_baseline_metrics TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bin_optimization_health TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE bin_fragmentation_metrics TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE vertical_proximity_settings TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE devops_alert_configs TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE devops_alert_history TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE inventory_forecasting_predictions TO agogsaas_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE safety_stock_calculations TO agogsaas_user;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.37 completed: All missing WMS tables created successfully';
  RAISE NOTICE '  - material_velocity_metrics';
  RAISE NOTICE '  - putaway_recommendations';
  RAISE NOTICE '  - reslotting_history';
  RAISE NOTICE '  - warehouse_optimization_settings';
  RAISE NOTICE '  - wms_data_quality_checks';
  RAISE NOTICE '  - wms_dimension_validations';
  RAISE NOTICE '  - statistical_outlier_detections';
  RAISE NOTICE '  - statistical_baseline_metrics';
  RAISE NOTICE '  - bin_optimization_health';
  RAISE NOTICE '  - bin_fragmentation_metrics';
  RAISE NOTICE '  - vertical_proximity_settings';
  RAISE NOTICE '  - devops_alert_configs';
  RAISE NOTICE '  - devops_alert_history';
  RAISE NOTICE '  - inventory_forecasting_predictions';
  RAISE NOTICE '  - safety_stock_calculations';
END $$;
