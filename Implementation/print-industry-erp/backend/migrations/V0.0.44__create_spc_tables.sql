-- =====================================================
-- FLYWAY MIGRATION V0.0.44
-- =====================================================
-- Purpose: Create Statistical Process Control (SPC) Infrastructure
-- REQ: REQ-STRATEGIC-AUTO-1767048328664 - Quality Management & SPC
-- Tables: spc_control_chart_data, spc_control_limits, spc_process_capability, spc_out_of_control_alerts
-- Dependencies: V0.0.7 (quality tables), V0.0.3 (production_runs, work_centers)
-- Created: 2025-12-29
-- Research: CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328664.md
-- Critique: SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1767048328664.md
-- =====================================================

-- ============================================
-- TABLE: spc_control_chart_data (PARTITIONED)
-- ============================================
-- Purpose: Time-series SPC measurement data from sensors and inspections
-- Partitioning: Monthly range partitions for high-volume data
-- Performance: Supports 26M+ rows/year with efficient queries
-- Western Electric Rules: Provides data for out-of-control detection

CREATE TABLE spc_control_chart_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Production context
    production_run_id UUID,
    work_center_id UUID,
    product_id UUID,

    -- Parameter being measured
    parameter_code VARCHAR(50) NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    parameter_type VARCHAR(50),
    -- INK_DENSITY, COLOR_DELTA_E, REGISTER, DOT_GAIN, TEMPERATURE, HUMIDITY, etc.

    -- Chart type
    chart_type VARCHAR(20) NOT NULL,
    -- XBAR_R, XBAR_S, I_MR, P_CHART, NP_CHART, C_CHART, U_CHART

    -- Measurement data
    measurement_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    subgroup_number INTEGER,
    subgroup_size INTEGER,
    measured_value DECIMAL(18,6) NOT NULL,
    measurement_unit VARCHAR(20),

    -- Measurement context
    operator_user_id UUID,
    measurement_method VARCHAR(50),
    -- AUTO_SENSOR, MANUAL_SPECTRO, MANUAL_ENTRY, VISUAL

    measurement_device_id UUID,
    -- FK to iot_devices

    -- Quality context
    quality_inspection_id UUID,
    lot_number VARCHAR(100),

    -- Data source
    data_source VARCHAR(50) NOT NULL,
    -- IOT_SENSOR, QUALITY_INSPECTION, MANUAL_ENTRY

    sensor_reading_id UUID,
    -- FK to sensor_readings

    -- Data quality tracking (Sylvia's recommendation)
    measurement_quality VARCHAR(20) DEFAULT 'VERIFIED',
    -- VERIFIED, ESTIMATED, QUESTIONABLE, REJECTED

    confidence_score DECIMAL(3,2),
    -- 0.00 to 1.00

    calibration_status VARCHAR(20),
    -- IN_CALIBRATION, OUT_OF_CALIBRATION, UNKNOWN

    data_quality_flags JSONB,
    -- {outlier: false, sensor_error: false, manual_override: false}

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_spc_chart_data_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_spc_chart_data_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_spc_chart_data_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_spc_chart_data_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_spc_chart_data_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_spc_chart_data_operator FOREIGN KEY (operator_user_id) REFERENCES users(id),
    CONSTRAINT fk_spc_chart_data_device FOREIGN KEY (measurement_device_id) REFERENCES iot_devices(id),
    CONSTRAINT fk_spc_chart_data_inspection FOREIGN KEY (quality_inspection_id) REFERENCES quality_inspections(id),
    CONSTRAINT fk_spc_chart_data_sensor FOREIGN KEY (sensor_reading_id) REFERENCES sensor_readings(id),
    CONSTRAINT chk_spc_measurement_quality CHECK (measurement_quality IN ('VERIFIED', 'ESTIMATED', 'QUESTIONABLE', 'REJECTED')),
    CONSTRAINT chk_spc_chart_type CHECK (chart_type IN ('XBAR_R', 'XBAR_S', 'I_MR', 'P_CHART', 'NP_CHART', 'C_CHART', 'U_CHART'))
) PARTITION BY RANGE (measurement_timestamp);

-- Create initial 12 monthly partitions for 2025
CREATE TABLE spc_control_chart_data_2025_01 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE spc_control_chart_data_2025_02 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE spc_control_chart_data_2025_03 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE spc_control_chart_data_2025_04 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE spc_control_chart_data_2025_05 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE spc_control_chart_data_2025_06 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE spc_control_chart_data_2025_07 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE spc_control_chart_data_2025_08 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE spc_control_chart_data_2025_09 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE spc_control_chart_data_2025_10 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE spc_control_chart_data_2025_11 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE spc_control_chart_data_2025_12 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Create 2026 partitions
CREATE TABLE spc_control_chart_data_2026_01 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE spc_control_chart_data_2026_02 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE spc_control_chart_data_2026_03 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE spc_control_chart_data_2026_04 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE spc_control_chart_data_2026_05 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE spc_control_chart_data_2026_06 PARTITION OF spc_control_chart_data
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Indexes on partitioned table (applied to all partitions)
CREATE INDEX idx_spc_chart_data_tenant_facility ON spc_control_chart_data(tenant_id, facility_id);
CREATE INDEX idx_spc_chart_data_parameter ON spc_control_chart_data(parameter_code, measurement_timestamp DESC);
CREATE INDEX idx_spc_chart_data_production_run ON spc_control_chart_data(production_run_id, parameter_code);
CREATE INDEX idx_spc_chart_data_timestamp ON spc_control_chart_data(measurement_timestamp DESC);
CREATE INDEX idx_spc_chart_data_work_center ON spc_control_chart_data(work_center_id, parameter_code);
CREATE INDEX idx_spc_chart_data_quality ON spc_control_chart_data(measurement_quality) WHERE measurement_quality != 'VERIFIED';

-- ============================================
-- TABLE: spc_control_limits
-- ============================================
-- Purpose: Control limit configurations for each parameter
-- UCL/LCL/CL calculations for control charts
-- Effective dating for control limit changes

CREATE TABLE spc_control_limits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Parameter configuration
    parameter_code VARCHAR(50) NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    chart_type VARCHAR(20) NOT NULL,

    -- Product/process scope
    product_id UUID,
    work_center_id UUID,
    material_id UUID,

    -- Specification limits (from customer/standard)
    upper_spec_limit DECIMAL(18,6),
    lower_spec_limit DECIMAL(18,6),
    target_value DECIMAL(18,6),

    -- Control limits (calculated from process data)
    upper_control_limit DECIMAL(18,6) NOT NULL,
    center_line DECIMAL(18,6) NOT NULL,
    lower_control_limit DECIMAL(18,6),

    -- Process statistics (for calculation)
    process_mean DECIMAL(18,6),
    process_std_dev DECIMAL(18,6),
    process_range DECIMAL(18,6),

    -- Calculation metadata
    calculation_method VARCHAR(50),
    -- STANDARD_3SIGMA, A2_R_BAR, A3_S_BAR, etc.

    sample_size_used INTEGER,
    data_period_start TIMESTAMPTZ,
    data_period_end TIMESTAMPTZ,

    -- Validity
    effective_from DATE NOT NULL,
    effective_to DATE,
    is_active BOOLEAN DEFAULT TRUE,

    -- Recalculation trigger
    recalculation_frequency VARCHAR(20),
    -- DAILY, WEEKLY, MONTHLY, ON_DEMAND

    last_recalculated_at TIMESTAMPTZ,
    next_recalculation_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_spc_limits_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_spc_limits_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_spc_limits_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_spc_limits_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_spc_limits_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT uq_spc_limits UNIQUE (tenant_id, parameter_code, product_id, work_center_id, effective_from),
    CONSTRAINT chk_spc_limits_chart_type CHECK (chart_type IN ('XBAR_R', 'XBAR_S', 'I_MR', 'P_CHART', 'NP_CHART', 'C_CHART', 'U_CHART'))
);

CREATE INDEX idx_spc_limits_tenant_facility ON spc_control_limits(tenant_id, facility_id);
CREATE INDEX idx_spc_limits_parameter ON spc_control_limits(parameter_code, effective_from DESC);
CREATE INDEX idx_spc_limits_active ON spc_control_limits(is_active, effective_from, effective_to);
CREATE INDEX idx_spc_limits_work_center ON spc_control_limits(work_center_id, parameter_code);
CREATE INDEX idx_spc_limits_recalc ON spc_control_limits(next_recalculation_at) WHERE is_active = TRUE;

-- ============================================
-- TABLE: spc_process_capability
-- ============================================
-- Purpose: Process capability analysis results (Cp, Cpk, Pp, Ppk)
-- Historical capability tracking
-- Defect rate (PPM) calculations

CREATE TABLE spc_process_capability (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Process identification
    parameter_code VARCHAR(50) NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    product_id UUID,
    work_center_id UUID,

    -- Analysis period
    analysis_date DATE NOT NULL,
    analysis_period_start TIMESTAMPTZ NOT NULL,
    analysis_period_end TIMESTAMPTZ NOT NULL,

    -- Specification limits
    upper_spec_limit DECIMAL(18,6) NOT NULL,
    lower_spec_limit DECIMAL(18,6) NOT NULL,
    target_value DECIMAL(18,6),

    -- Process statistics
    process_mean DECIMAL(18,6) NOT NULL,
    process_std_dev DECIMAL(18,6) NOT NULL,
    process_std_dev_within DECIMAL(18,6),
    -- Within-subgroup std dev for Cp/Cpk
    process_std_dev_overall DECIMAL(18,6),
    -- Overall std dev for Pp/Ppk
    sample_size INTEGER NOT NULL,
    subgroup_count INTEGER,

    -- Short-term capability (within-subgroup variation)
    cp DECIMAL(6,4),
    -- (USL - LSL) / (6σ_within)
    cpk DECIMAL(6,4),
    -- min[(USL - μ)/(3σ), (μ - LSL)/(3σ)]
    cpu DECIMAL(6,4),
    -- (USL - μ) / (3σ) - Upper capability
    cpl DECIMAL(6,4),
    -- (μ - LSL) / (3σ) - Lower capability

    -- Long-term performance (overall variation)
    pp DECIMAL(6,4),
    -- (USL - LSL) / (6σ_overall)
    ppk DECIMAL(6,4),
    -- Long-term performance index

    -- Process centering
    k DECIMAL(6,4),
    -- Centering index: |μ - Target| / [(USL - LSL) / 2]

    -- Defect rates (parts per million)
    expected_ppm_total DECIMAL(10,2),
    expected_ppm_upper DECIMAL(10,2),
    expected_ppm_lower DECIMAL(10,2),

    -- Sigma level
    sigma_level DECIMAL(4,2),

    -- Capability assessment
    capability_status VARCHAR(20) NOT NULL,
    -- EXCELLENT (Cpk >= 2.0), ADEQUATE (1.33-2.0), MARGINAL (1.0-1.33), POOR (< 1.0)
    is_centered BOOLEAN,
    is_capable BOOLEAN,

    -- Recommendations
    recommendations TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_spc_capability_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_spc_capability_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_spc_capability_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_spc_capability_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT chk_spc_capability_status CHECK (capability_status IN ('EXCELLENT', 'ADEQUATE', 'MARGINAL', 'POOR'))
);

CREATE INDEX idx_spc_capability_tenant_facility ON spc_process_capability(tenant_id, facility_id);
CREATE INDEX idx_spc_capability_parameter ON spc_process_capability(parameter_code, analysis_date DESC);
CREATE INDEX idx_spc_capability_product ON spc_process_capability(product_id, analysis_date DESC);
CREATE INDEX idx_spc_capability_work_center ON spc_process_capability(work_center_id, parameter_code);
CREATE INDEX idx_spc_capability_status ON spc_process_capability(capability_status, analysis_date);

-- ============================================
-- TABLE: spc_out_of_control_alerts
-- ============================================
-- Purpose: Out-of-control alerts from Western Electric rules
-- Real-time alerting for process deviations
-- Root cause tracking and resolution

CREATE TABLE spc_out_of_control_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Production context
    production_run_id UUID,
    work_center_id UUID NOT NULL,
    product_id UUID,

    -- Alert details
    alert_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    parameter_code VARCHAR(50) NOT NULL,
    parameter_name VARCHAR(255) NOT NULL,
    chart_type VARCHAR(20),

    -- Rule violated (Western Electric Rules)
    rule_type VARCHAR(50) NOT NULL,
    -- POINT_BEYOND_3SIGMA, TWO_OF_THREE_BEYOND_2SIGMA, FOUR_OF_FIVE_BEYOND_1SIGMA,
    -- EIGHT_CONSECUTIVE_SAME_SIDE, SIX_TRENDING, FOURTEEN_ALTERNATING,
    -- FIFTEEN_WITHIN_1SIGMA, EIGHT_BEYOND_1SIGMA

    rule_description TEXT,

    -- Measurement details
    measured_value DECIMAL(18,6),
    control_limit_violated DECIMAL(18,6),
    deviation_from_center DECIMAL(18,6),
    sigma_level DECIMAL(4,2),
    -- How many sigmas from center

    -- Control chart data points involved
    chart_data_ids UUID[],
    -- Array of spc_control_chart_data IDs

    -- Severity
    severity VARCHAR(20) DEFAULT 'MEDIUM',
    -- LOW, MEDIUM, HIGH, CRITICAL

    -- Response tracking
    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, FALSE_ALARM

    acknowledged_by_user_id UUID,
    acknowledged_at TIMESTAMPTZ,

    -- Resolution
    root_cause TEXT,
    corrective_action TEXT,
    resolved_by_user_id UUID,
    resolved_at TIMESTAMPTZ,

    -- Quality defect linkage
    quality_defect_id UUID,
    -- Auto-created defect record

    -- Notifications sent
    notifications_sent JSONB,
    -- [{user_id, method: 'EMAIL', timestamp}]

    -- Alert aggregation (Sylvia's recommendation)
    is_suppressed BOOLEAN DEFAULT FALSE,
    suppressed_reason TEXT,
    alert_count INTEGER DEFAULT 1,
    -- Incremented when duplicate alerts occur

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_spc_alert_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_spc_alert_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_spc_alert_production_run FOREIGN KEY (production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_spc_alert_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_spc_alert_product FOREIGN KEY (product_id) REFERENCES products(id),
    CONSTRAINT fk_spc_alert_acknowledged FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_spc_alert_resolved FOREIGN KEY (resolved_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_spc_alert_defect FOREIGN KEY (quality_defect_id) REFERENCES quality_defects(id),
    CONSTRAINT chk_spc_alert_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_spc_alert_status CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'INVESTIGATING', 'RESOLVED', 'FALSE_ALARM'))
);

CREATE INDEX idx_spc_alerts_tenant_facility ON spc_out_of_control_alerts(tenant_id, facility_id);
CREATE INDEX idx_spc_alerts_timestamp ON spc_out_of_control_alerts(alert_timestamp DESC);
CREATE INDEX idx_spc_alerts_status ON spc_out_of_control_alerts(status, severity);
CREATE INDEX idx_spc_alerts_production_run ON spc_out_of_control_alerts(production_run_id, parameter_code);
CREATE INDEX idx_spc_alerts_parameter ON spc_out_of_control_alerts(parameter_code, alert_timestamp DESC);
CREATE INDEX idx_spc_alerts_work_center ON spc_out_of_control_alerts(work_center_id, status);
CREATE INDEX idx_spc_alerts_open ON spc_out_of_control_alerts(status, severity, alert_timestamp) WHERE status IN ('OPEN', 'ACKNOWLEDGED');

-- ============================================
-- TABLE: spc_data_retention_policies (Sylvia's recommendation)
-- ============================================
-- Purpose: Define data retention and archival policies
-- Configurable per tenant and parameter

CREATE TABLE spc_data_retention_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    parameter_code VARCHAR(50),
    -- NULL = default policy for tenant

    -- Retention periods
    raw_data_retention_days INTEGER DEFAULT 90,
    aggregated_data_retention_days INTEGER DEFAULT 365,
    alert_retention_days INTEGER DEFAULT 730,

    -- Archive configuration
    archive_to_cold_storage BOOLEAN DEFAULT FALSE,
    archive_threshold_days INTEGER DEFAULT 365,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_spc_retention_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_spc_retention UNIQUE (tenant_id, parameter_code)
);

CREATE INDEX idx_spc_retention_tenant ON spc_data_retention_policies(tenant_id);

-- ============================================
-- Row-Level Security (RLS) Policies
-- ============================================

-- Enable RLS on all SPC tables
ALTER TABLE spc_control_chart_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_control_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_process_capability ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_out_of_control_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE spc_data_retention_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Tenant isolation for control chart data
CREATE POLICY spc_chart_data_tenant_isolation ON spc_control_chart_data
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- RLS Policy: Tenant isolation for control limits
CREATE POLICY spc_limits_tenant_isolation ON spc_control_limits
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- RLS Policy: Tenant isolation for process capability
CREATE POLICY spc_capability_tenant_isolation ON spc_process_capability
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- RLS Policy: Tenant isolation for alerts
CREATE POLICY spc_alerts_tenant_isolation ON spc_out_of_control_alerts
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- RLS Policy: Tenant isolation for retention policies
CREATE POLICY spc_retention_tenant_isolation ON spc_data_retention_policies
    FOR ALL
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ============================================
-- Comments
-- ============================================

COMMENT ON TABLE spc_control_chart_data IS 'Statistical Process Control measurement data from sensors and inspections - partitioned by month for performance';
COMMENT ON TABLE spc_control_limits IS 'Control limit configurations (UCL/LCL/CL) for SPC parameters';
COMMENT ON TABLE spc_process_capability IS 'Process capability analysis results (Cp, Cpk, Pp, Ppk) with defect rate calculations';
COMMENT ON TABLE spc_out_of_control_alerts IS 'Western Electric rule violations and out-of-control alerts';
COMMENT ON TABLE spc_data_retention_policies IS 'Data retention and archival policies for SPC data';

-- ============================================
-- Success Message
-- ============================================

DO $$
BEGIN
    RAISE NOTICE '✅ SPC tables created successfully';
    RAISE NOTICE '   - spc_control_chart_data (partitioned by month)';
    RAISE NOTICE '   - spc_control_limits';
    RAISE NOTICE '   - spc_process_capability';
    RAISE NOTICE '   - spc_out_of_control_alerts';
    RAISE NOTICE '   - spc_data_retention_policies';
    RAISE NOTICE '   - RLS policies enabled for multi-tenant isolation';
    RAISE NOTICE '   - 18 monthly partitions created (2025-2026)';
END $$;
