# 🔬 RESEARCH DELIVERABLE: Predictive Maintenance AI for Press Equipment
**REQ-STRATEGIC-AUTO-1767108044310**

## 📋 Executive Summary

**Researcher**: Cynthia (Research & Planning Specialist)
**Date**: 2025-12-30
**Assignment**: REQ-STRATEGIC-AUTO-1767108044310 - Predictive Maintenance AI for Press Equipment
**Status**: ✅ COMPLETE - Research Phase

### Research Objective
Design and specify a comprehensive Predictive Maintenance AI system for print manufacturing press equipment leveraging existing IoT infrastructure, SPC monitoring, and performance analytics to predict equipment failures before they occur and optimize maintenance schedules.

### Key Findings Summary
1. **Strong Foundation Exists**: Comprehensive infrastructure already in place including:
   - 30+ equipment/asset management tables with IoT sensor integration
   - Real-time SPC monitoring with Western Electric rule detection
   - Performance analytics with health scoring
   - Existing maintenance tracking and OEE calculations

2. **Gaps Identified**: Need to implement:
   - ML-based predictive models (failure prediction, RUL estimation)
   - Maintenance schedule optimization engine
   - Anomaly detection beyond SPC rules
   - Historical pattern recognition and trending
   - AI-driven recommendations

3. **Implementation Approach**: Build on existing infrastructure with:
   - New predictive_maintenance_models table for ML model configurations
   - New equipment_health_scores table for real-time health tracking
   - New predictive_maintenance_alerts table for AI-generated alerts
   - New maintenance_recommendations table for optimization suggestions
   - Integration with existing sensor_readings, equipment_events, and maintenance_records

---

## 🏗️ Current Infrastructure Analysis

### 1. Equipment & Asset Management (EXISTING ✅)

**Source**: `V0.0.3__create_operations_module.sql`

#### work_centers Table
Core equipment master table with comprehensive tracking:
- **Equipment Identification**: work_center_code, work_center_name, manufacturer, model, serial_number, asset_tag
- **Press Specifications**: sheet dimensions, gripper margin, max_colors
- **Capacity Metrics**: production_rate_per_hour, hourly_rate
- **Maintenance Fields**:
  - `last_maintenance_date` - Last completed maintenance
  - `next_maintenance_date` - Next scheduled maintenance
  - `maintenance_interval_days` - Fixed interval scheduling
- **Status Tracking**: AVAILABLE, IN_USE, DOWN, MAINTENANCE, OFFLINE
- **SCD Type 2 Support**: Audit trail for configuration changes

**Key Insight**: Equipment master data is comprehensive but maintenance scheduling is currently CALENDAR-BASED (fixed intervals) rather than CONDITION-BASED (predictive).

#### asset_hierarchy Table
Parent-child equipment relationships:
- Supports complex equipment assemblies
- Enables failure cascade analysis (if sub-component fails, parent impacted)
- Relationship types: COMPONENT, ASSEMBLY, ATTACHMENT

**Predictive Maintenance Use**: Track failure propagation patterns across equipment assemblies.

---

### 2. Maintenance Tracking (EXISTING ✅)

**Source**: `V0.0.3__create_operations_module.sql` (lines 400-500)

#### maintenance_records Table
Full maintenance lifecycle tracking:
- **Types**: PREVENTIVE, CORRECTIVE, BREAKDOWN, CALIBRATION, INSPECTION
- **Scheduling**: scheduled_date, actual_start, actual_end, duration_hours
- **Work Details**:
  - `work_description` - What was done
  - `parts_replaced` - Components serviced
  - `parts_cost`, `labor_cost`, `total_cost`
- **Quality**: equipment_operational, calibration_performed
- **Next Maintenance**: next_maintenance_due (date)
- **Status**: SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED

**Key Limitation**:
- Reactive maintenance tracking (records what happened)
- No predictive failure indicators
- No correlation with sensor data patterns
- Fixed interval scheduling (not condition-based)

**Predictive Maintenance Opportunity**:
- Analyze historical maintenance records to identify failure patterns
- Correlate parts_replaced with sensor anomalies prior to failure
- Build failure mode catalogs from work_description text
- Predict optimal maintenance timing based on equipment condition

---

### 3. IoT Sensors & Real-Time Monitoring (EXISTING ✅)

**Source**: `V0.0.7__create_quality_hr_iot_security_marketplace_imposition.sql`

#### iot_devices Table
Comprehensive IoT sensor registry:
- **Device Types**: SENSOR, PRESS_COUNTER, TEMPERATURE_MONITOR, SCALE
- **Work Center Linkage**: `work_center_id` - Equipment assignment
- **Connection Types**: MQTT, REST_API, OPC_UA, MODBUS
- **Health Tracking**:
  - `is_active` - Device operational status
  - `last_heartbeat` - Connectivity monitoring
- **Configuration**: connection_config (JSONB) - Device-specific settings

**Sensor Coverage**: Temperature, vibration, pressure, RPM, ink density, register accuracy

#### sensor_readings Table (PARTITIONED)
Time-series sensor data:
- **High Volume**: Designed for millions of readings per day
- **Fields**:
  - `reading_timestamp` - When measurement taken
  - `sensor_type` - What parameter measured
  - `reading_value` - Numeric measurement
  - `unit_of_measure` - Standardized units
- **Context**:
  - `production_run_id` - Link to active production
  - `metadata` (JSONB) - Additional sensor context
- **Partitioning**: Monthly partitions for query performance

**Predictive Maintenance Use**:
- Historical sensor trends (temperature rise, vibration increase)
- Baseline deviation detection
- Multi-sensor correlation (e.g., temp + vibration = bearing failure)

#### equipment_events Table
Equipment alerts and status changes:
- **Event Types**: STARTUP, SHUTDOWN, ERROR, WARNING, MAINTENANCE_REQUIRED
- **Severity**: INFO, WARNING, ERROR, CRITICAL
- **Tracking**: event_timestamp, event_code, event_description
- **Acknowledgment**: acknowledged_by, acknowledged_at
- **Context**: work_center_id, iot_device_id, production_run_id, metadata (JSONB)

**Key Insight**: Current system is REACTIVE (alerts on threshold violations). Need PREDICTIVE layer to forecast events before they occur.

---

### 4. Statistical Process Control (EXISTING ✅)

**Source**: `V0.0.44__create_spc_tables.sql`

#### spc_control_chart_data Table (PARTITIONED)
Time-series SPC measurements from sensors and inspections:
- **Production Context**: production_run_id, work_center_id, product_id
- **Parameters**: INK_DENSITY, COLOR_DELTA_E, REGISTER, DOT_GAIN, TEMPERATURE, HUMIDITY
- **Chart Types**: XBAR_R, XBAR_S, I_MR, P_CHART, NP_CHART, C_CHART, U_CHART
- **Measurement**: measured_value, measurement_unit, measurement_timestamp
- **Data Source**: IOT_SENSOR, QUALITY_INSPECTION, MANUAL_ENTRY
- **Quality Tracking**: measurement_quality (VERIFIED, ESTIMATED, QUESTIONABLE, REJECTED)
- **Partitioning**: 18 monthly partitions (2025-2026) for performance

**Data Volume**: Supports 26M+ rows/year with efficient queries

#### spc_out_of_control_alerts Table
Western Electric rule violations (8 rules):
- **Rules Detected**:
  1. Point beyond 3σ
  2. Two of three beyond 2σ
  3. Four of five beyond 1σ
  4. Eight consecutive same side
  5. Six points trending
  6. Fourteen alternating
  7. Fifteen within 1σ
  8. Eight beyond 1σ
- **Alert Details**:
  - `measured_value`, `control_limit_violated`, `deviation_from_center`, `sigma_level`
  - `chart_data_ids` - Array of data points involved
- **Severity**: LOW, MEDIUM, HIGH, CRITICAL
- **Status**: OPEN, ACKNOWLEDGED, INVESTIGATING, RESOLVED, FALSE_ALARM
- **Resolution Tracking**: root_cause, corrective_action, quality_defect_id

**Predictive Maintenance Integration**:
- SPC alerts indicate process instability (often precursor to equipment failure)
- Example: Increasing register variation → Press misalignment → Bearing wear
- Example: Ink density drift → Anilox roller wear → Impending failure

#### spc_process_capability Table
Capability analysis (Cp, Cpk, Pp, Ppk):
- **Indices**:
  - Cp = (USL - LSL) / (6σ_within) - Short-term capability
  - Cpk = min[(USL - μ)/(3σ), (μ - LSL)/(3σ)] - Process centering
  - Pp/Ppk - Long-term performance
- **Assessment**: EXCELLENT (≥2.0), ADEQUATE (1.33-2.0), MARGINAL (1.0-1.33), POOR (<1.0)
- **Defect Rates**: expected_ppm_total, sigma_level

**Predictive Maintenance Use**: Declining Cpk over time indicates equipment degradation requiring maintenance.

---

### 5. Performance Monitoring & Analytics (EXISTING ✅)

**Source**: `V0.0.40__add_performance_monitoring_olap.sql`

#### performance_metrics_cache Table
Hourly aggregates with health scoring:
- **API Metrics**: total_requests, successful_requests, failed_requests, p95/p99 response times
- **Database Metrics**: total_queries, slow_query_count, avg_query_time_ms
- **Resource Metrics**: avg_cpu_usage_percent, avg/max_memory_usage_mb
- **Health Score**: 0-100 calculated as `100 - response_time_penalty - error_rate_penalty`

**Function**: `refresh_performance_metrics_incremental`
- Executes in 50-100ms for 24 hours of data
- Calculates percentiles and health scores
- Supports real-time dashboard monitoring

**Predictive Maintenance Application**: System health monitoring can detect degradation in database/API performance that may indicate infrastructure issues requiring maintenance.

---

### 6. OEE (Overall Equipment Effectiveness) (EXISTING ✅)

**Source**: `V0.0.3__create_operations_module.sql` (lines 800-900)

#### oee_calculations Table (PARTITIONED BY DAY)
Daily OEE snapshots:
- **Components**:
  - **Availability** = (Runtime / Planned Time) × 100
  - **Performance** = (Ideal Cycle × Total Pieces / Runtime) × 100
  - **Quality** = (Good Pieces / Total Pieces) × 100
  - **OEE** = Availability × Performance × Quality
- **Loss Breakdown**:
  - `setup_changeover_minutes`
  - `breakdown_minutes` ⚠️ **KEY PREDICTIVE MAINTENANCE METRIC**
  - `no_operator_minutes`, `no_material_minutes`
  - `speed_loss_minutes` ⚠️ **Equipment degradation indicator**
  - `quality_loss_pieces` ⚠️ **Equipment quality decline**
- **Target**: target_oee_percentage (default 85% world-class)

**Predictive Maintenance Insights**:
- **Declining OEE Trend**: Early warning of equipment degradation
- **Increasing Breakdown Minutes**: Reactive maintenance indicator → Need predictive intervention
- **Speed Loss Increase**: Equipment running slower → Bearing wear, motor issues
- **Quality Loss Increase**: Equipment producing more defects → Calibration drift, component wear

#### equipment_status_log Table
Real-time equipment status for OEE calculations:
- **Status Types**:
  - PRODUCTIVE
  - NON_PRODUCTIVE_SETUP
  - NON_PRODUCTIVE_BREAKDOWN ⚠️ **Failure event**
  - NON_PRODUCTIVE_NO_OPERATOR
  - NON_PRODUCTIVE_NO_MATERIAL
  - NON_PRODUCTIVE_PLANNED_DOWNTIME
- **Tracking**: status_start, status_end, duration_minutes, reason_code, reason_description
- **Context**: production_run_id, logged_by_user_id, logged_by_system

**Predictive Maintenance Use**: Historical breakdown patterns can train ML models to predict future failures.

---

### 7. Production Context (EXISTING ✅)

#### production_runs Table
Actual production execution:
- **Quantities**: quantity_planned, quantity_good, quantity_scrap, quantity_rework
- **Time**: setup_time_minutes, run_time_minutes, downtime_minutes, downtime_reason
- **Quality**: first_piece_approved, operator_notes, quality_notes
- **Status**: SCHEDULED, IN_PROGRESS, PAUSED, COMPLETED, CANCELLED

**Predictive Maintenance Integration**:
- Correlate equipment failures with production context (product type, run duration, setup frequency)
- Example: Bearing failures more frequent on long runs of heavy substrates

#### changeover_details Table
Setup/changeover tracking:
- **Types**: COLOR_CHANGE, SUBSTRATE_CHANGE, SIZE_CHANGE, COMPLETE_SETUP
- **Time Breakdown**: washup, plate_change, material_loading, calibration, first_piece_approval
- **Waste**: setup_waste_sheets, setup_waste_weight
- **Improvement**: improvement_opportunities (text)

**Predictive Maintenance Use**: Increasing setup times may indicate equipment wear (alignment issues, worn tooling).

---

## 🧠 Predictive Maintenance AI Architecture

### System Design Philosophy

**Build on Existing Infrastructure**: Leverage current sensor network, SPC monitoring, and maintenance tracking rather than replacing it.

**Multi-Layer Approach**:
1. **Anomaly Detection Layer** - Detect unusual sensor patterns
2. **Failure Prediction Layer** - Predict specific failure modes
3. **RUL Estimation Layer** - Remaining Useful Life calculation
4. **Optimization Layer** - Optimal maintenance scheduling

**Data-Driven**: Use historical data to train models, validate on recent data, deploy to production with continuous learning.

---

## 🗄️ NEW DATABASE SCHEMA REQUIREMENTS

### Table 1: predictive_maintenance_models

**Purpose**: Store ML model configurations, parameters, and metadata for predictive maintenance algorithms.

```sql
CREATE TABLE predictive_maintenance_models (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Model identification
    model_code VARCHAR(50) NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    model_type VARCHAR(50) NOT NULL,
    -- ANOMALY_DETECTION, FAILURE_PREDICTION, RUL_ESTIMATION,
    -- OPTIMIZATION, PATTERN_RECOGNITION

    -- Model algorithm
    algorithm VARCHAR(50) NOT NULL,
    -- ISOLATION_FOREST, LSTM, RANDOM_FOREST, GRADIENT_BOOSTING,
    -- PROPHET, ARIMA, SVM, NEURAL_NETWORK

    -- Equipment scope
    work_center_id UUID,
    -- NULL = applies to all equipment of work_center_type

    work_center_type VARCHAR(50),
    -- OFFSET_PRESS, DIGITAL_PRESS, etc.

    equipment_manufacturer VARCHAR(100),
    equipment_model VARCHAR(100),
    -- Scope to specific equipment models

    -- Target predictions
    failure_mode VARCHAR(100),
    -- BEARING_FAILURE, MOTOR_FAILURE, BELT_WEAR, CALIBRATION_DRIFT,
    -- HYDRAULIC_LEAK, ELECTRICAL_FAULT, PNEUMATIC_FAILURE, etc.

    prediction_horizon_hours INTEGER,
    -- How far ahead model predicts (e.g., 168 = 1 week)

    -- Model parameters
    model_parameters JSONB NOT NULL,
    -- Algorithm-specific parameters
    -- Example for Isolation Forest: {contamination: 0.05, n_estimators: 100}
    -- Example for LSTM: {sequence_length: 24, hidden_units: 64, dropout: 0.2}

    feature_set JSONB NOT NULL,
    -- Features used by model
    -- [{name: 'bearing_temp', source: 'sensor', sensor_type: 'TEMPERATURE'},
    --  {name: 'vibration_rms', source: 'sensor', sensor_type: 'VIBRATION'},
    --  {name: 'oee_7day_avg', source: 'calculated'},
    --  {name: 'breakdown_count_30d', source: 'equipment_status'}]

    -- Training metadata
    training_data_start TIMESTAMPTZ,
    training_data_end TIMESTAMPTZ,
    training_sample_count INTEGER,

    -- Model performance metrics
    accuracy_score DECIMAL(5,4),
    -- 0.0000 to 1.0000

    precision_score DECIMAL(5,4),
    recall_score DECIMAL(5,4),
    f1_score DECIMAL(5,4),

    auc_roc DECIMAL(5,4),
    -- Area Under ROC Curve

    mean_absolute_error DECIMAL(18,6),
    -- For regression models (RUL estimation)

    false_positive_rate DECIMAL(5,4),
    false_negative_rate DECIMAL(5,4),

    -- Model validation
    validation_method VARCHAR(50),
    -- TRAIN_TEST_SPLIT, K_FOLD_CROSS_VALIDATION, TIME_SERIES_SPLIT

    validation_metrics JSONB,
    -- Detailed validation results

    -- Model versioning
    model_version VARCHAR(20) NOT NULL,
    -- Semantic versioning: 1.0.0, 1.1.0, 2.0.0

    parent_model_id UUID,
    -- Previous version (for tracking model evolution)

    -- Model artifacts
    model_artifact_location TEXT,
    -- S3 path, Azure Blob, or file path to serialized model
    -- e.g., s3://agog-ml-models/predictive-maintenance/bearing-failure-v1.pkl

    model_size_bytes BIGINT,

    -- Deployment status
    deployment_status VARCHAR(20) DEFAULT 'DEVELOPMENT',
    -- DEVELOPMENT, TESTING, STAGING, PRODUCTION, DEPRECATED

    deployed_at TIMESTAMPTZ,
    deployed_by UUID,

    -- Performance in production
    production_accuracy DECIMAL(5,4),
    -- Actual accuracy from production predictions

    last_prediction_at TIMESTAMPTZ,
    prediction_count_total INTEGER DEFAULT 0,

    -- Retraining schedule
    retraining_frequency VARCHAR(20),
    -- WEEKLY, MONTHLY, QUARTERLY, ON_DEMAND

    last_retrained_at TIMESTAMPTZ,
    next_retraining_at TIMESTAMPTZ,

    -- Drift detection
    data_drift_detected BOOLEAN DEFAULT FALSE,
    concept_drift_detected BOOLEAN DEFAULT FALSE,
    drift_detection_timestamp TIMESTAMPTZ,

    -- Model description
    description TEXT,
    methodology TEXT,
    -- Explanation of model approach

    -- Feature importance
    feature_importance JSONB,
    -- [{feature: 'bearing_temp', importance: 0.35},
    --  {feature: 'vibration_rms', importance: 0.28}, ...]

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_pm_model_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_pm_model_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_pm_model_parent FOREIGN KEY (parent_model_id) REFERENCES predictive_maintenance_models(id),
    CONSTRAINT fk_pm_model_deployed_by FOREIGN KEY (deployed_by) REFERENCES users(id),
    CONSTRAINT uq_pm_model_code UNIQUE (tenant_id, model_code, model_version),
    CONSTRAINT chk_pm_model_type CHECK (model_type IN (
        'ANOMALY_DETECTION', 'FAILURE_PREDICTION', 'RUL_ESTIMATION',
        'OPTIMIZATION', 'PATTERN_RECOGNITION'
    )),
    CONSTRAINT chk_pm_deployment_status CHECK (deployment_status IN (
        'DEVELOPMENT', 'TESTING', 'STAGING', 'PRODUCTION', 'DEPRECATED'
    ))
);

CREATE INDEX idx_pm_models_tenant ON predictive_maintenance_models(tenant_id);
CREATE INDEX idx_pm_models_work_center ON predictive_maintenance_models(work_center_id);
CREATE INDEX idx_pm_models_type ON predictive_maintenance_models(model_type);
CREATE INDEX idx_pm_models_failure_mode ON predictive_maintenance_models(failure_mode);
CREATE INDEX idx_pm_models_deployment ON predictive_maintenance_models(deployment_status, is_active);
CREATE INDEX idx_pm_models_retraining ON predictive_maintenance_models(next_retraining_at)
    WHERE is_active = TRUE AND deployment_status = 'PRODUCTION';

COMMENT ON TABLE predictive_maintenance_models IS 'ML model configurations for predictive maintenance algorithms';
```

---

### Table 2: equipment_health_scores

**Purpose**: Real-time equipment health tracking with multi-dimensional health indicators.

```sql
CREATE TABLE equipment_health_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Equipment identification
    work_center_id UUID NOT NULL,

    -- Health score calculation
    score_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Overall health score
    overall_health_score DECIMAL(5,2) NOT NULL,
    -- 0.00 to 100.00 (100 = perfect health)

    health_status VARCHAR(20) NOT NULL,
    -- EXCELLENT (90-100), GOOD (70-89), FAIR (50-69), POOR (30-49), CRITICAL (<30)

    -- Health score components (weighted contributors)
    sensor_health_score DECIMAL(5,2),
    -- Based on sensor readings (temperature, vibration, etc.)

    oee_health_score DECIMAL(5,2),
    -- Based on OEE trend analysis

    quality_health_score DECIMAL(5,2),
    -- Based on SPC control and defect rates

    reliability_health_score DECIMAL(5,2),
    -- Based on breakdown frequency and duration

    performance_health_score DECIMAL(5,2),
    -- Based on cycle time degradation

    -- Component weights
    sensor_weight DECIMAL(3,2) DEFAULT 0.30,
    oee_weight DECIMAL(3,2) DEFAULT 0.25,
    quality_weight DECIMAL(3,2) DEFAULT 0.20,
    reliability_weight DECIMAL(3,2) DEFAULT 0.15,
    performance_weight DECIMAL(3,2) DEFAULT 0.10,
    -- Weights must sum to 1.00

    -- Anomaly indicators
    anomaly_detected BOOLEAN DEFAULT FALSE,
    anomaly_severity VARCHAR(20),
    -- LOW, MEDIUM, HIGH, CRITICAL

    anomaly_type VARCHAR(50),
    -- SENSOR_ANOMALY, PERFORMANCE_DEGRADATION, QUALITY_DECLINE,
    -- PATTERN_DEVIATION, UNEXPECTED_BEHAVIOR

    anomaly_description TEXT,

    -- Degradation trend
    health_score_7d_avg DECIMAL(5,2),
    health_score_30d_avg DECIMAL(5,2),
    health_score_change_7d DECIMAL(6,2),
    -- Negative = degrading, positive = improving

    trend_direction VARCHAR(20),
    -- IMPROVING, STABLE, DEGRADING, RAPIDLY_DEGRADING

    -- Contributing factors
    risk_factors JSONB,
    -- [{factor: 'High bearing temperature', severity: 'HIGH', measured_value: 85.5, threshold: 75.0},
    --  {factor: 'Increasing vibration', severity: 'MEDIUM', trend: 'UPWARD'}]

    -- Recommendations
    recommended_action VARCHAR(50),
    -- IMMEDIATE_SHUTDOWN, SCHEDULE_MAINTENANCE, MONITOR_CLOSELY,
    -- CALIBRATION_REQUIRED, NO_ACTION_REQUIRED

    recommended_action_priority VARCHAR(20),
    -- URGENT, HIGH, MEDIUM, LOW

    recommended_action_description TEXT,

    -- Calculation metadata
    calculation_method VARCHAR(50) DEFAULT 'ML_BASED',
    -- ML_BASED, RULE_BASED, HYBRID

    model_id UUID,
    -- FK to predictive_maintenance_models if ML-based

    data_quality_score DECIMAL(3,2),
    -- 0.00 to 1.00 (confidence in health score based on data quality)

    missing_sensor_count INTEGER,
    stale_sensor_count INTEGER,
    -- Sensors with no recent readings

    -- Production context
    current_production_run_id UUID,
    hours_since_last_maintenance DECIMAL(10,2),
    total_runtime_hours DECIMAL(12,2),
    -- Cumulative runtime since equipment installation

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_health_score_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_health_score_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_health_score_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_health_score_model FOREIGN KEY (model_id) REFERENCES predictive_maintenance_models(id),
    CONSTRAINT fk_health_score_production_run FOREIGN KEY (current_production_run_id) REFERENCES production_runs(id),
    CONSTRAINT chk_health_status CHECK (health_status IN (
        'EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'CRITICAL'
    )),
    CONSTRAINT chk_trend_direction CHECK (trend_direction IN (
        'IMPROVING', 'STABLE', 'DEGRADING', 'RAPIDLY_DEGRADING'
    )),
    CONSTRAINT chk_overall_health_range CHECK (overall_health_score BETWEEN 0 AND 100),
    CONSTRAINT chk_weights_sum CHECK (
        sensor_weight + oee_weight + quality_weight +
        reliability_weight + performance_weight = 1.00
    )
) PARTITION BY RANGE (score_timestamp);

-- Create partitions for 2025-2026 (monthly)
CREATE TABLE equipment_health_scores_2025_01 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE equipment_health_scores_2025_02 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE equipment_health_scores_2025_03 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE equipment_health_scores_2025_04 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE equipment_health_scores_2025_05 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE equipment_health_scores_2025_06 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE equipment_health_scores_2025_07 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE equipment_health_scores_2025_08 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE equipment_health_scores_2025_09 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE equipment_health_scores_2025_10 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE equipment_health_scores_2025_11 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE equipment_health_scores_2025_12 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE equipment_health_scores_2026_01 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE equipment_health_scores_2026_02 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE equipment_health_scores_2026_03 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE equipment_health_scores_2026_04 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE equipment_health_scores_2026_05 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE equipment_health_scores_2026_06 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

-- Indexes on partitioned table
CREATE INDEX idx_health_scores_tenant_facility ON equipment_health_scores(tenant_id, facility_id);
CREATE INDEX idx_health_scores_work_center ON equipment_health_scores(work_center_id, score_timestamp DESC);
CREATE INDEX idx_health_scores_timestamp ON equipment_health_scores(score_timestamp DESC);
CREATE INDEX idx_health_scores_status ON equipment_health_scores(health_status, score_timestamp DESC);
CREATE INDEX idx_health_scores_anomaly ON equipment_health_scores(anomaly_detected) WHERE anomaly_detected = TRUE;
CREATE INDEX idx_health_scores_degrading ON equipment_health_scores(trend_direction, overall_health_score)
    WHERE trend_direction IN ('DEGRADING', 'RAPIDLY_DEGRADING');

COMMENT ON TABLE equipment_health_scores IS 'Real-time equipment health tracking with multi-dimensional health indicators (partitioned by month)';
```

---

### Table 3: predictive_maintenance_alerts

**Purpose**: AI-generated predictive maintenance alerts based on ML model predictions.

```sql
CREATE TABLE predictive_maintenance_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Equipment identification
    work_center_id UUID NOT NULL,

    -- Alert details
    alert_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    alert_type VARCHAR(50) NOT NULL,
    -- FAILURE_PREDICTION, ANOMALY_DETECTED, RUL_THRESHOLD,
    -- DEGRADATION_TREND, CALIBRATION_REQUIRED, PERFORMANCE_DECLINE

    -- Predicted failure
    predicted_failure_mode VARCHAR(100),
    -- BEARING_FAILURE, MOTOR_FAILURE, BELT_WEAR, etc.

    failure_probability DECIMAL(5,4),
    -- 0.0000 to 1.0000 (e.g., 0.8500 = 85% probability)

    confidence_interval_lower DECIMAL(5,4),
    confidence_interval_upper DECIMAL(5,4),
    -- 95% confidence interval

    -- Timing prediction
    predicted_failure_date DATE,
    predicted_failure_timestamp TIMESTAMPTZ,

    time_to_failure_hours DECIMAL(10,2),
    -- Hours until predicted failure

    time_to_failure_uncertainty_hours DECIMAL(10,2),
    -- Uncertainty range (±)

    -- Remaining Useful Life (RUL)
    rul_hours DECIMAL(12,2),
    -- Estimated hours until maintenance required

    rul_confidence DECIMAL(3,2),
    -- 0.00 to 1.00

    -- Severity assessment
    severity VARCHAR(20) NOT NULL,
    -- LOW, MEDIUM, HIGH, CRITICAL

    urgency VARCHAR(20) NOT NULL,
    -- ROUTINE, SOON, URGENT, IMMEDIATE

    business_impact VARCHAR(20),
    -- MINIMAL, MODERATE, SIGNIFICANT, SEVERE

    estimated_downtime_hours DECIMAL(10,2),
    -- Expected downtime if failure occurs

    estimated_repair_cost DECIMAL(18,4),
    -- Estimated cost if failure occurs (vs. planned maintenance)

    -- Model information
    model_id UUID NOT NULL,
    -- FK to predictive_maintenance_models

    model_version VARCHAR(20),
    algorithm_used VARCHAR(50),

    -- Feature values at prediction time
    feature_values JSONB,
    -- Snapshot of feature values that triggered prediction
    -- [{feature: 'bearing_temp', value: 82.5, normal_range: [60, 75]},
    --  {feature: 'vibration_rms', value: 3.8, normal_range: [1.0, 2.5]}]

    -- Contributing factors
    primary_indicators JSONB,
    -- Top factors contributing to prediction
    -- [{indicator: 'Elevated bearing temperature', contribution: 0.45},
    --  {indicator: 'Increasing vibration pattern', contribution: 0.32}]

    -- Equipment context
    equipment_age_days INTEGER,
    hours_since_last_maintenance DECIMAL(10,2),
    total_runtime_hours DECIMAL(12,2),
    maintenance_history_count INTEGER,
    -- Number of historical maintenance events

    current_production_run_id UUID,
    current_oee_percentage DECIMAL(5,2),
    current_health_score DECIMAL(5,2),

    -- Recommendations
    recommended_action VARCHAR(100) NOT NULL,
    -- e.g., 'Schedule bearing replacement within 72 hours'

    recommended_maintenance_window TSTZRANGE,
    -- Optimal time window for maintenance

    required_parts JSONB,
    -- [{part_number: 'BRG-1234', description: 'Main bearing', quantity: 2, lead_time_days: 5}]

    required_skills JSONB,
    -- [{skill: 'Mechanical Technician Level 3', hours: 4},
    --  {skill: 'Electrician', hours: 2}]

    estimated_maintenance_duration_hours DECIMAL(6,2),

    recommended_maintenance_type VARCHAR(50),
    -- PREVENTIVE, PREDICTIVE, CONDITION_BASED

    detailed_recommendations TEXT,

    -- Alternative scenarios
    alternative_scenarios JSONB,
    -- [{scenario: 'Immediate maintenance', cost: 5000, downtime: 4},
    --  {scenario: 'Wait 1 week', cost: 12000, downtime: 12, failure_risk: 0.65}]

    -- Alert handling
    status VARCHAR(20) DEFAULT 'OPEN',
    -- OPEN, ACKNOWLEDGED, SCHEDULED, IN_PROGRESS, RESOLVED,
    -- FALSE_ALARM, IGNORED

    acknowledged_by_user_id UUID,
    acknowledged_at TIMESTAMPTZ,

    -- Maintenance scheduling
    maintenance_scheduled BOOLEAN DEFAULT FALSE,
    scheduled_maintenance_id UUID,
    -- FK to maintenance_records when scheduled

    -- Resolution tracking
    resolution_type VARCHAR(50),
    -- MAINTENANCE_COMPLETED, FALSE_ALARM, PREDICTION_INCORRECT,
    -- DEFERRED_TO_NEXT_SHUTDOWN, OVERRIDDEN_BY_HUMAN

    actual_failure_occurred BOOLEAN,
    actual_failure_date TIMESTAMPTZ,

    prediction_accuracy VARCHAR(20),
    -- ACCURATE, EARLY, LATE, INCORRECT

    prediction_error_hours DECIMAL(10,2),
    -- Difference between predicted and actual (negative = early, positive = late)

    resolved_by_user_id UUID,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Notifications
    notifications_sent JSONB,
    -- [{user_id: '...', method: 'EMAIL', timestamp: '...', status: 'SENT'},
    --  {user_id: '...', method: 'SMS', timestamp: '...', status: 'DELIVERED'}]

    escalation_level INTEGER DEFAULT 0,
    -- 0 = No escalation, 1 = First escalation, 2 = Second escalation, etc.

    last_escalated_at TIMESTAMPTZ,

    -- Alert suppression
    is_suppressed BOOLEAN DEFAULT FALSE,
    suppressed_reason TEXT,
    suppressed_until TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,

    CONSTRAINT fk_pm_alert_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_pm_alert_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_pm_alert_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_pm_alert_model FOREIGN KEY (model_id) REFERENCES predictive_maintenance_models(id),
    CONSTRAINT fk_pm_alert_acknowledged FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_pm_alert_resolved FOREIGN KEY (resolved_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_pm_alert_production_run FOREIGN KEY (current_production_run_id) REFERENCES production_runs(id),
    CONSTRAINT fk_pm_alert_maintenance FOREIGN KEY (scheduled_maintenance_id) REFERENCES maintenance_records(id),
    CONSTRAINT chk_pm_alert_type CHECK (alert_type IN (
        'FAILURE_PREDICTION', 'ANOMALY_DETECTED', 'RUL_THRESHOLD',
        'DEGRADATION_TREND', 'CALIBRATION_REQUIRED', 'PERFORMANCE_DECLINE'
    )),
    CONSTRAINT chk_pm_alert_severity CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    CONSTRAINT chk_pm_alert_urgency CHECK (urgency IN ('ROUTINE', 'SOON', 'URGENT', 'IMMEDIATE')),
    CONSTRAINT chk_pm_alert_status CHECK (status IN (
        'OPEN', 'ACKNOWLEDGED', 'SCHEDULED', 'IN_PROGRESS',
        'RESOLVED', 'FALSE_ALARM', 'IGNORED'
    ))
);

CREATE INDEX idx_pm_alerts_tenant_facility ON predictive_maintenance_alerts(tenant_id, facility_id);
CREATE INDEX idx_pm_alerts_work_center ON predictive_maintenance_alerts(work_center_id, alert_timestamp DESC);
CREATE INDEX idx_pm_alerts_timestamp ON predictive_maintenance_alerts(alert_timestamp DESC);
CREATE INDEX idx_pm_alerts_status ON predictive_maintenance_alerts(status, severity);
CREATE INDEX idx_pm_alerts_failure_mode ON predictive_maintenance_alerts(predicted_failure_mode, alert_timestamp);
CREATE INDEX idx_pm_alerts_open ON predictive_maintenance_alerts(status, severity, alert_timestamp)
    WHERE status IN ('OPEN', 'ACKNOWLEDGED');
CREATE INDEX idx_pm_alerts_urgency ON predictive_maintenance_alerts(urgency, predicted_failure_date)
    WHERE urgency IN ('URGENT', 'IMMEDIATE');
CREATE INDEX idx_pm_alerts_model ON predictive_maintenance_alerts(model_id, actual_failure_occurred);

COMMENT ON TABLE predictive_maintenance_alerts IS 'AI-generated predictive maintenance alerts based on ML model predictions';
```

---

### Table 4: maintenance_recommendations

**Purpose**: AI-generated maintenance schedule optimization recommendations.

```sql
CREATE TABLE maintenance_recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Recommendation identification
    recommendation_number VARCHAR(50) UNIQUE NOT NULL,
    recommendation_date DATE NOT NULL,

    -- Equipment scope
    work_center_id UUID NOT NULL,

    -- Recommendation type
    recommendation_type VARCHAR(50) NOT NULL,
    -- SCHEDULE_OPTIMIZATION, INTERVAL_ADJUSTMENT, PROACTIVE_REPLACEMENT,
    -- CONDITION_BASED_TRIGGER, RESOURCE_ALLOCATION, PARTS_INVENTORY

    -- Current vs. recommended
    current_maintenance_strategy VARCHAR(50),
    -- CALENDAR_BASED, TIME_BASED, USAGE_BASED, REACTIVE

    recommended_maintenance_strategy VARCHAR(50),
    -- PREDICTIVE, CONDITION_BASED, PROACTIVE, OPTIMIZED_INTERVAL

    current_interval_days INTEGER,
    recommended_interval_days INTEGER,

    current_interval_hours DECIMAL(10,2),
    -- Based on runtime hours

    recommended_interval_hours DECIMAL(10,2),

    -- Trigger conditions (for condition-based)
    trigger_conditions JSONB,
    -- [{parameter: 'bearing_temp', threshold: 80, operator: '>'},
    --  {parameter: 'vibration_rms', threshold: 3.0, operator: '>'},
    --  {parameter: 'health_score', threshold: 60, operator: '<'}]

    -- Cost-benefit analysis
    current_annual_maintenance_cost DECIMAL(18,4),
    recommended_annual_maintenance_cost DECIMAL(18,4),

    projected_cost_savings DECIMAL(18,4),
    -- Annual savings from optimized maintenance

    projected_downtime_reduction_hours DECIMAL(10,2),
    -- Annual downtime reduction

    projected_failure_reduction_percent DECIMAL(5,2),
    -- Reduction in unexpected failures

    roi_percentage DECIMAL(8,2),
    -- Return on investment

    payback_period_months DECIMAL(6,2),

    -- Risk assessment
    risk_level VARCHAR(20),
    -- LOW, MEDIUM, HIGH

    risk_factors JSONB,
    -- [{factor: 'Equipment age exceeds 10 years', severity: 'MEDIUM'},
    --  {factor: 'Critical production line', severity: 'HIGH'}]

    -- Supporting data
    analysis_period_start DATE NOT NULL,
    analysis_period_end DATE NOT NULL,

    data_points_analyzed INTEGER,
    -- Number of sensor readings, maintenance records analyzed

    historical_failure_count INTEGER,
    historical_maintenance_count INTEGER,

    average_time_between_failures_hours DECIMAL(10,2),
    average_time_to_repair_hours DECIMAL(6,2),

    -- Model information
    model_id UUID,
    -- FK to predictive_maintenance_models (if ML-based)

    optimization_algorithm VARCHAR(50),
    -- GENETIC_ALGORITHM, PARTICLE_SWARM, LINEAR_PROGRAMMING,
    -- MONTE_CARLO, MARKOV_DECISION_PROCESS

    -- Implementation plan
    implementation_priority VARCHAR(20),
    -- URGENT, HIGH, MEDIUM, LOW

    implementation_effort VARCHAR(20),
    -- MINIMAL, MODERATE, SIGNIFICANT, EXTENSIVE

    required_resources JSONB,
    -- [{resource: 'Technician training', hours: 8, cost: 1200},
    --  {resource: 'Sensor installation', hours: 4, cost: 3000}]

    implementation_timeline_days INTEGER,
    estimated_start_date DATE,

    -- Approval workflow
    approval_required BOOLEAN DEFAULT TRUE,
    approval_status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, APPROVED, REJECTED, ON_HOLD

    approved_by_user_id UUID,
    approved_at TIMESTAMPTZ,
    rejection_reason TEXT,

    -- Implementation tracking
    implementation_status VARCHAR(20) DEFAULT 'NOT_STARTED',
    -- NOT_STARTED, IN_PROGRESS, COMPLETED, CANCELLED

    implementation_started_at TIMESTAMPTZ,
    implementation_completed_at TIMESTAMPTZ,
    implemented_by_user_id UUID,

    -- Results tracking
    actual_cost_savings DECIMAL(18,4),
    actual_downtime_reduction_hours DECIMAL(10,2),
    actual_failure_reduction_percent DECIMAL(5,2),

    results_validated BOOLEAN DEFAULT FALSE,
    validation_date DATE,
    validation_notes TEXT,

    -- Recommendation details
    detailed_analysis TEXT,
    justification TEXT,
    benefits TEXT,
    risks TEXT,

    -- Alternative options
    alternative_recommendations JSONB,
    -- [{option: 'Increase interval to 180 days', cost_savings: 3000, risk: 'MEDIUM'},
    --  {option: 'Replace with condition-based', cost_savings: 8000, risk: 'LOW'}]

    -- Status
    is_active BOOLEAN DEFAULT TRUE,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_maint_rec_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_maint_rec_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_maint_rec_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_maint_rec_model FOREIGN KEY (model_id) REFERENCES predictive_maintenance_models(id),
    CONSTRAINT fk_maint_rec_approved FOREIGN KEY (approved_by_user_id) REFERENCES users(id),
    CONSTRAINT fk_maint_rec_implemented FOREIGN KEY (implemented_by_user_id) REFERENCES users(id),
    CONSTRAINT chk_maint_rec_type CHECK (recommendation_type IN (
        'SCHEDULE_OPTIMIZATION', 'INTERVAL_ADJUSTMENT', 'PROACTIVE_REPLACEMENT',
        'CONDITION_BASED_TRIGGER', 'RESOURCE_ALLOCATION', 'PARTS_INVENTORY'
    )),
    CONSTRAINT chk_maint_rec_approval CHECK (approval_status IN (
        'PENDING', 'APPROVED', 'REJECTED', 'ON_HOLD'
    )),
    CONSTRAINT chk_maint_rec_implementation CHECK (implementation_status IN (
        'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'
    ))
);

CREATE INDEX idx_maint_rec_tenant ON maintenance_recommendations(tenant_id);
CREATE INDEX idx_maint_rec_work_center ON maintenance_recommendations(work_center_id, recommendation_date DESC);
CREATE INDEX idx_maint_rec_date ON maintenance_recommendations(recommendation_date DESC);
CREATE INDEX idx_maint_rec_approval ON maintenance_recommendations(approval_status, implementation_priority);
CREATE INDEX idx_maint_rec_implementation ON maintenance_recommendations(implementation_status);
CREATE INDEX idx_maint_rec_type ON maintenance_recommendations(recommendation_type, is_active);

COMMENT ON TABLE maintenance_recommendations IS 'AI-generated maintenance schedule optimization recommendations';
```

---

## 📊 GRAPHQL SCHEMA REQUIREMENTS

### Types

```graphql
# ============================================
# PREDICTIVE MAINTENANCE TYPES
# ============================================

# ML Model Configuration
type PredictiveMaintenanceModel {
  id: ID!
  tenantId: ID!
  modelCode: String!
  modelName: String!
  modelType: ModelType!
  algorithm: MLAlgorithm!

  workCenterId: ID
  workCenterType: WorkCenterType
  equipmentManufacturer: String
  equipmentModel: String

  failureMode: String
  predictionHorizonHours: Int!

  modelParameters: JSON!
  featureSet: [ModelFeature!]!

  trainingDataStart: DateTime
  trainingDataEnd: DateTime
  trainingSampleCount: Int

  # Performance metrics
  accuracyScore: Float
  precisionScore: Float
  recallScore: Float
  f1Score: Float
  aucRoc: Float
  meanAbsoluteError: Float
  falsePositiveRate: Float
  falseNegativeRate: Float

  modelVersion: String!
  parentModelId: ID

  deploymentStatus: DeploymentStatus!
  deployedAt: DateTime
  deployedBy: User

  productionAccuracy: Float
  lastPredictionAt: DateTime
  predictionCountTotal: Int

  retrainingFrequency: RetrainingFrequency
  lastRetrainedAt: DateTime
  nextRetrainingAt: DateTime

  dataDriftDetected: Boolean
  conceptDriftDetected: Boolean

  description: String
  methodology: String
  featureImportance: [FeatureImportance!]

  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime
}

type ModelFeature {
  name: String!
  source: String!
  sensorType: String
  calculationType: String
  importance: Float
}

type FeatureImportance {
  feature: String!
  importance: Float!
  rank: Int!
}

# Equipment Health Score
type EquipmentHealthScore {
  id: ID!
  tenantId: ID!
  facilityId: ID!
  workCenterId: ID!
  workCenter: WorkCenter!

  scoreTimestamp: DateTime!

  overallHealthScore: Float!
  healthStatus: HealthStatus!

  # Component scores
  sensorHealthScore: Float
  oeeHealthScore: Float
  qualityHealthScore: Float
  reliabilityHealthScore: Float
  performanceHealthScore: Float

  # Anomaly detection
  anomalyDetected: Boolean
  anomalySeverity: Severity
  anomalyType: String
  anomalyDescription: String

  # Trend analysis
  healthScore7dAvg: Float
  healthScore30dAvg: Float
  healthScoreChange7d: Float
  trendDirection: TrendDirection

  # Risk factors
  riskFactors: [RiskFactor!]

  # Recommendations
  recommendedAction: String
  recommendedActionPriority: Priority
  recommendedActionDescription: String

  # Metadata
  calculationMethod: String
  modelId: ID
  model: PredictiveMaintenanceModel
  dataQualityScore: Float

  createdAt: DateTime!
}

type RiskFactor {
  factor: String!
  severity: Severity!
  measuredValue: Float
  threshold: Float
  trend: String
}

# Predictive Maintenance Alert
type PredictiveMaintenanceAlert {
  id: ID!
  tenantId: ID!
  facilityId: ID!
  workCenterId: ID!
  workCenter: WorkCenter!

  alertTimestamp: DateTime!
  alertType: AlertType!

  # Failure prediction
  predictedFailureMode: String
  failureProbability: Float
  confidenceIntervalLower: Float
  confidenceIntervalUpper: Float

  # Timing
  predictedFailureDate: Date
  predictedFailureTimestamp: DateTime
  timeToFailureHours: Float
  timeToFailureUncertaintyHours: Float

  # RUL
  rulHours: Float
  rulConfidence: Float

  # Severity
  severity: Severity!
  urgency: Urgency!
  businessImpact: BusinessImpact
  estimatedDowntimeHours: Float
  estimatedRepairCost: Float

  # Model info
  modelId: ID!
  model: PredictiveMaintenanceModel!
  modelVersion: String
  algorithmUsed: String

  # Contributing factors
  featureValues: [FeatureValue!]
  primaryIndicators: [Indicator!]

  # Equipment context
  equipmentAgeDays: Int
  hoursSinceLastMaintenance: Float
  totalRuntimeHours: Float
  currentHealthScore: Float

  # Recommendations
  recommendedAction: String!
  recommendedMaintenanceWindow: DateTimeRange
  requiredParts: [RequiredPart!]
  requiredSkills: [RequiredSkill!]
  estimatedMaintenanceDurationHours: Float
  recommendedMaintenanceType: String
  detailedRecommendations: String

  # Alternative scenarios
  alternativeScenarios: [MaintenanceScenario!]

  # Status
  status: AlertStatus!
  acknowledgedBy: User
  acknowledgedAt: DateTime

  # Resolution
  maintenanceScheduled: Boolean
  scheduledMaintenanceId: ID
  scheduledMaintenance: MaintenanceRecord

  resolutionType: String
  actualFailureOccurred: Boolean
  actualFailureDate: DateTime
  predictionAccuracy: String
  predictionErrorHours: Float

  resolvedBy: User
  resolvedAt: DateTime
  resolutionNotes: String

  # Notifications
  notificationsSent: [Notification!]
  escalationLevel: Int

  createdAt: DateTime!
  updatedAt: DateTime
}

type FeatureValue {
  feature: String!
  value: Float!
  normalRange: [Float!]
  deviation: Float
  unit: String
}

type Indicator {
  indicator: String!
  contribution: Float!
  severity: Severity
}

type RequiredPart {
  partNumber: String!
  description: String!
  quantity: Int!
  leadTimeDays: Int
  inStock: Boolean
  cost: Float
}

type RequiredSkill {
  skill: String!
  hours: Float!
  certificationRequired: Boolean
}

type MaintenanceScenario {
  scenario: String!
  cost: Float!
  downtime: Float!
  failureRisk: Float
  benefits: [String!]
  risks: [String!]
}

type Notification {
  userId: ID!
  method: String!
  timestamp: DateTime!
  status: String!
}

# Maintenance Recommendation
type MaintenanceRecommendation {
  id: ID!
  tenantId: ID!
  facilityId: ID!
  recommendationNumber: String!
  recommendationDate: Date!

  workCenterId: ID!
  workCenter: WorkCenter!

  recommendationType: RecommendationType!

  # Current vs. recommended
  currentMaintenanceStrategy: String
  recommendedMaintenanceStrategy: String
  currentIntervalDays: Int
  recommendedIntervalDays: Int
  currentIntervalHours: Float
  recommendedIntervalHours: Float

  # Trigger conditions
  triggerConditions: [TriggerCondition!]

  # Cost-benefit
  currentAnnualMaintenanceCost: Float
  recommendedAnnualMaintenanceCost: Float
  projectedCostSavings: Float
  projectedDowntimeReductionHours: Float
  projectedFailureReductionPercent: Float
  roiPercentage: Float
  paybackPeriodMonths: Float

  # Risk
  riskLevel: RiskLevel
  riskFactors: [RiskFactor!]

  # Analysis
  analysisPeriodStart: Date!
  analysisPeriodEnd: Date!
  dataPointsAnalyzed: Int
  historicalFailureCount: Int
  historicalMaintenanceCount: Int
  averageTimeBetweenFailuresHours: Float
  averageTimeToRepairHours: Float

  # Model
  modelId: ID
  model: PredictiveMaintenanceModel
  optimizationAlgorithm: String

  # Implementation
  implementationPriority: Priority
  implementationEffort: Effort
  requiredResources: [Resource!]
  implementationTimelineDays: Int
  estimatedStartDate: Date

  # Approval
  approvalRequired: Boolean
  approvalStatus: ApprovalStatus!
  approvedBy: User
  approvedAt: DateTime
  rejectionReason: String

  # Status
  implementationStatus: ImplementationStatus!
  implementationStartedAt: DateTime
  implementationCompletedAt: DateTime
  implementedBy: User

  # Results
  actualCostSavings: Float
  actualDowntimeReductionHours: Float
  actualFailureReductionPercent: Float
  resultsValidated: Boolean
  validationDate: Date
  validationNotes: String

  # Details
  detailedAnalysis: String
  justification: String
  benefits: String
  risks: String
  alternativeRecommendations: [AlternativeRecommendation!]

  isActive: Boolean!
  createdAt: DateTime!
  updatedAt: DateTime
}

type TriggerCondition {
  parameter: String!
  threshold: Float!
  operator: String!
  unit: String
}

type Resource {
  resource: String!
  hours: Float
  cost: Float
  available: Boolean
}

type AlternativeRecommendation {
  option: String!
  costSavings: Float
  risk: RiskLevel
  benefits: [String!]
  drawbacks: [String!]
}

# Dashboard Summary
type PredictiveMaintenanceDashboard {
  tenantId: ID!
  facilityId: ID

  # Equipment health overview
  totalEquipment: Int!
  equipmentByHealthStatus: [HealthStatusCount!]!
  averageHealthScore: Float!

  # Alerts summary
  totalActiveAlerts: Int!
  alertsBySeverity: [SeverityCount!]!
  alertsByUrgency: [UrgencyCount!]!

  # Predictions
  predictedFailuresNext7Days: Int!
  predictedFailuresNext30Days: Int!
  predictedFailuresNext90Days: Int!

  # Maintenance optimization
  activeRecommendations: Int!
  potentialAnnualSavings: Float!
  averageRoi: Float!

  # Model performance
  totalModelsDeployed: Int!
  averageModelAccuracy: Float!

  # Recent activity
  recentAlerts: [PredictiveMaintenanceAlert!]!
  recentHealthScores: [EquipmentHealthScore!]!
  upcomingMaintenance: [MaintenanceRecord!]!

  asOfTimestamp: DateTime!
}

type HealthStatusCount {
  status: HealthStatus!
  count: Int!
  percentage: Float!
}

type SeverityCount {
  severity: Severity!
  count: Int!
}

type UrgencyCount {
  urgency: Urgency!
  count: Int!
}

# ============================================
# ENUMS
# ============================================

enum ModelType {
  ANOMALY_DETECTION
  FAILURE_PREDICTION
  RUL_ESTIMATION
  OPTIMIZATION
  PATTERN_RECOGNITION
}

enum MLAlgorithm {
  ISOLATION_FOREST
  LSTM
  RANDOM_FOREST
  GRADIENT_BOOSTING
  PROPHET
  ARIMA
  SVM
  NEURAL_NETWORK
  ENSEMBLE
}

enum DeploymentStatus {
  DEVELOPMENT
  TESTING
  STAGING
  PRODUCTION
  DEPRECATED
}

enum RetrainingFrequency {
  WEEKLY
  MONTHLY
  QUARTERLY
  ON_DEMAND
}

enum HealthStatus {
  EXCELLENT
  GOOD
  FAIR
  POOR
  CRITICAL
}

enum TrendDirection {
  IMPROVING
  STABLE
  DEGRADING
  RAPIDLY_DEGRADING
}

enum AlertType {
  FAILURE_PREDICTION
  ANOMALY_DETECTED
  RUL_THRESHOLD
  DEGRADATION_TREND
  CALIBRATION_REQUIRED
  PERFORMANCE_DECLINE
}

enum Urgency {
  ROUTINE
  SOON
  URGENT
  IMMEDIATE
}

enum BusinessImpact {
  MINIMAL
  MODERATE
  SIGNIFICANT
  SEVERE
}

enum AlertStatus {
  OPEN
  ACKNOWLEDGED
  SCHEDULED
  IN_PROGRESS
  RESOLVED
  FALSE_ALARM
  IGNORED
}

enum RecommendationType {
  SCHEDULE_OPTIMIZATION
  INTERVAL_ADJUSTMENT
  PROACTIVE_REPLACEMENT
  CONDITION_BASED_TRIGGER
  RESOURCE_ALLOCATION
  PARTS_INVENTORY
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}

enum Priority {
  URGENT
  HIGH
  MEDIUM
  LOW
}

enum Effort {
  MINIMAL
  MODERATE
  SIGNIFICANT
  EXTENSIVE
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
  ON_HOLD
}

enum ImplementationStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

# ============================================
# QUERIES
# ============================================

type Query {
  # Equipment health
  equipmentHealthScores(
    workCenterId: ID
    facilityId: ID
    healthStatus: HealthStatus
    trendDirection: TrendDirection
    startDate: DateTime
    endDate: DateTime
    limit: Int
  ): [EquipmentHealthScore!]!

  equipmentHealthScore(id: ID!): EquipmentHealthScore

  latestEquipmentHealthScore(workCenterId: ID!): EquipmentHealthScore

  # Alerts
  predictiveMaintenanceAlerts(
    workCenterId: ID
    facilityId: ID
    status: AlertStatus
    severity: Severity
    urgency: Urgency
    alertType: AlertType
    startDate: DateTime
    endDate: DateTime
    limit: Int
  ): [PredictiveMaintenanceAlert!]!

  predictiveMaintenanceAlert(id: ID!): PredictiveMaintenanceAlert

  # Models
  predictiveMaintenanceModels(
    modelType: ModelType
    deploymentStatus: DeploymentStatus
    isActive: Boolean
  ): [PredictiveMaintenanceModel!]!

  predictiveMaintenanceModel(id: ID!): PredictiveMaintenanceModel

  # Recommendations
  maintenanceRecommendations(
    workCenterId: ID
    facilityId: ID
    recommendationType: RecommendationType
    approvalStatus: ApprovalStatus
    implementationStatus: ImplementationStatus
    limit: Int
  ): [MaintenanceRecommendation!]!

  maintenanceRecommendation(id: ID!): MaintenanceRecommendation

  # Dashboard
  predictiveMaintenanceDashboard(
    facilityId: ID
    timeRange: TimeRange
  ): PredictiveMaintenanceDashboard!

  # Analytics
  equipmentHealthTrends(
    workCenterId: ID!
    startDate: DateTime!
    endDate: DateTime!
    aggregation: Aggregation
  ): [HealthTrendDataPoint!]!

  failurePredictionAccuracy(
    modelId: ID
    startDate: DateTime!
    endDate: DateTime!
  ): ModelAccuracyMetrics!
}

# ============================================
# MUTATIONS
# ============================================

type Mutation {
  # Equipment health
  calculateEquipmentHealthScore(
    workCenterId: ID!
  ): EquipmentHealthScore!

  # Alerts
  acknowledgePredictiveMaintenanceAlert(
    alertId: ID!
    notes: String
  ): PredictiveMaintenanceAlert!

  schedulePredictiveMaintenanceAlert(
    alertId: ID!
    maintenanceRecordInput: CreateMaintenanceRecordInput!
  ): PredictiveMaintenanceAlert!

  resolvePredictiveMaintenanceAlert(
    alertId: ID!
    resolutionType: String!
    actualFailureOccurred: Boolean!
    actualFailureDate: DateTime
    notes: String
  ): PredictiveMaintenanceAlert!

  # Models
  createPredictiveMaintenanceModel(
    input: CreatePredictiveMaintenanceModelInput!
  ): PredictiveMaintenanceModel!

  updatePredictiveMaintenanceModel(
    id: ID!
    input: UpdatePredictiveMaintenanceModelInput!
  ): PredictiveMaintenanceModel!

  deployPredictiveMaintenanceModel(
    id: ID!
    environment: DeploymentStatus!
  ): PredictiveMaintenanceModel!

  retrainPredictiveMaintenanceModel(
    id: ID!
    trainingDataStart: DateTime!
    trainingDataEnd: DateTime!
  ): PredictiveMaintenanceModel!

  # Recommendations
  createMaintenanceRecommendation(
    input: CreateMaintenanceRecommendationInput!
  ): MaintenanceRecommendation!

  approveMaintenanceRecommendation(
    id: ID!
    notes: String
  ): MaintenanceRecommendation!

  rejectMaintenanceRecommendation(
    id: ID!
    reason: String!
  ): MaintenanceRecommendation!

  implementMaintenanceRecommendation(
    id: ID!
    startDate: DateTime
  ): MaintenanceRecommendation!

  validateMaintenanceRecommendation(
    id: ID!
    actualCostSavings: Float
    actualDowntimeReductionHours: Float
    actualFailureReductionPercent: Float
    notes: String
  ): MaintenanceRecommendation!
}

# ============================================
# INPUTS
# ============================================

input CreatePredictiveMaintenanceModelInput {
  modelCode: String!
  modelName: String!
  modelType: ModelType!
  algorithm: MLAlgorithm!
  workCenterId: ID
  workCenterType: WorkCenterType
  failureMode: String
  predictionHorizonHours: Int!
  modelParameters: JSON!
  featureSet: [ModelFeatureInput!]!
  description: String
  methodology: String
}

input ModelFeatureInput {
  name: String!
  source: String!
  sensorType: String
  calculationType: String
}

input UpdatePredictiveMaintenanceModelInput {
  modelName: String
  modelParameters: JSON
  featureSet: [ModelFeatureInput!]
  description: String
  methodology: String
  isActive: Boolean
}

input CreateMaintenanceRecommendationInput {
  workCenterId: ID!
  recommendationType: RecommendationType!
  recommendedMaintenanceStrategy: String!
  recommendedIntervalDays: Int
  recommendedIntervalHours: Float
  triggerConditions: [TriggerConditionInput!]
  projectedCostSavings: Float!
  detailedAnalysis: String!
  justification: String!
  benefits: String
  risks: String
}

input TriggerConditionInput {
  parameter: String!
  threshold: Float!
  operator: String!
  unit: String
}
```

---

## 🔄 INTEGRATION POINTS

### 1. Data Pipeline Architecture

```
Sensor Readings (sensor_readings)
    ↓
Feature Engineering Pipeline
    ↓
Equipment Health Scoring
    ↓
ML Prediction Models
    ↓
Predictive Maintenance Alerts
    ↓
Maintenance Scheduling Optimization
```

### 2. Real-Time Processing Flow

**Every 5 Minutes**:
1. Collect sensor readings from `iot_devices`
2. Calculate rolling statistics (mean, std dev, trend)
3. Update `equipment_health_scores` table
4. Check for anomalies using Isolation Forest model
5. Generate alerts if health score drops or anomaly detected

**Hourly**:
1. Run LSTM failure prediction models
2. Calculate RUL (Remaining Useful Life)
3. Update `predictive_maintenance_alerts` if failure probability exceeds threshold
4. Send notifications to maintenance team

**Daily**:
1. Aggregate OEE calculations
2. Analyze SPC control chart trends
3. Generate maintenance optimization recommendations
4. Update model performance metrics

**Weekly**:
1. Retrain models with latest data
2. Validate prediction accuracy
3. Generate management reports

### 3. Existing Table Integration

**FROM sensor_readings**:
- Extract: `reading_value`, `reading_timestamp`, `sensor_type`, `iot_device_id`
- Purpose: Real-time anomaly detection, feature engineering for ML models

**FROM spc_control_chart_data**:
- Extract: `measured_value`, `parameter_code`, `measurement_quality`
- Purpose: Quality trend analysis, process stability indicators

**FROM equipment_status_log**:
- Extract: `status`, `duration_minutes`, `reason_code`
- Purpose: Breakdown pattern analysis, downtime prediction

**FROM maintenance_records**:
- Extract: `maintenance_type`, `parts_replaced`, `duration_hours`, `total_cost`
- Purpose: Failure mode cataloging, cost modeling, historical pattern training

**FROM oee_calculations**:
- Extract: `availability_percentage`, `performance_percentage`, `quality_percentage`
- Purpose: Equipment degradation indicators, health score components

**FROM production_runs**:
- Extract: `quantity_scrap`, `downtime_minutes`, `run_time_minutes`
- Purpose: Production context for failure correlation

---

## 🧮 FEATURE ENGINEERING REQUIREMENTS

### Sensor-Based Features

1. **Temperature Features**:
   - Current temperature
   - Rolling 1-hour average
   - Rolling 24-hour average
   - Temperature change rate (°F/hour)
   - Temperature deviation from baseline
   - Maximum temperature in last 7 days
   - Temperature volatility (std dev)

2. **Vibration Features**:
   - RMS (Root Mean Square) vibration
   - Peak vibration
   - Vibration frequency spectrum (FFT analysis)
   - Bearing defect frequencies
   - Vibration trend (increasing/decreasing)
   - Vibration-to-temperature ratio

3. **Performance Features**:
   - Cycle time (actual vs. ideal)
   - Speed degradation percentage
   - Setup time trend
   - First-piece approval rate
   - Scrap rate trend

4. **OEE-Based Features**:
   - 7-day OEE average
   - 30-day OEE trend slope
   - Availability percentage decline
   - Breakdown minutes per week
   - Breakdown frequency (count per month)

5. **Quality Features**:
   - SPC Cpk trend
   - Out-of-control alert frequency
   - Defect rate per 1000 units
   - Quality loss pieces trend

6. **Maintenance History Features**:
   - Days since last preventive maintenance
   - Days since last corrective maintenance
   - Days since last breakdown
   - Maintenance frequency (count per 90 days)
   - Average time between failures (MTBF)
   - Average time to repair (MTTR)
   - Total runtime hours since installation
   - Total runtime hours since last major overhaul

### Calculated Features

1. **Health Index Components**:
   - Bearing health index (temp + vibration composite)
   - Motor health index (current draw + vibration)
   - Hydraulic system health (pressure + leak detection)
   - Pneumatic system health (pressure stability)

2. **Degradation Indicators**:
   - Performance degradation slope (linear regression)
   - Quality degradation slope
   - Energy consumption increase rate
   - Cycle time increase rate

3. **Environmental Features**:
   - Ambient temperature
   - Humidity
   - Production volume stress (heavy substrate runs)
   - Changeover frequency (wear from setups)

---

## 📈 ML MODEL RECOMMENDATIONS

### Model 1: Anomaly Detection (Isolation Forest)

**Purpose**: Detect unusual sensor patterns that deviate from normal operation

**Algorithm**: Isolation Forest (scikit-learn)

**Features**:
- Bearing temperature (current, 1h avg, 24h avg)
- Vibration RMS
- Motor current draw
- Cycle time
- OEE percentage

**Parameters**:
```json
{
  "contamination": 0.05,
  "n_estimators": 100,
  "max_samples": "auto",
  "random_state": 42
}
```

**Output**: Anomaly score (0-1), threshold = 0.3

**Deployment**: Real-time (every 5 minutes)

---

### Model 2: Bearing Failure Prediction (LSTM)

**Purpose**: Predict bearing failures 7 days in advance

**Algorithm**: LSTM (Long Short-Term Memory) neural network

**Features (time series sequences)**:
- Bearing temperature (24-hour sequence)
- Vibration RMS (24-hour sequence)
- Vibration frequency components
- Runtime hours
- Days since last maintenance

**Architecture**:
```json
{
  "sequence_length": 24,
  "hidden_units": [64, 32],
  "dropout": 0.2,
  "learning_rate": 0.001,
  "epochs": 50,
  "batch_size": 32
}
```

**Output**: Failure probability (0-1), threshold = 0.70

**Deployment**: Hourly

---

### Model 3: RUL Estimation (Random Forest Regressor)

**Purpose**: Estimate Remaining Useful Life in hours

**Algorithm**: Random Forest Regressor

**Features**:
- Total runtime hours
- Hours since last maintenance
- Average bearing temperature (7-day)
- Average vibration RMS (7-day)
- OEE 30-day average
- Breakdown count (30 days)
- Quality loss trend

**Parameters**:
```json
{
  "n_estimators": 200,
  "max_depth": 15,
  "min_samples_split": 10,
  "min_samples_leaf": 5,
  "random_state": 42
}
```

**Output**: RUL in hours (e.g., 672 hours = 28 days)

**Deployment**: Daily

---

### Model 4: Maintenance Schedule Optimization (Genetic Algorithm)

**Purpose**: Optimize maintenance intervals to minimize total cost

**Algorithm**: Genetic Algorithm (custom implementation or DEAP library)

**Objective Function**:
```
Minimize: (Preventive Maintenance Cost + Downtime Cost + Failure Risk Cost)
```

**Constraints**:
- Minimum interval: 30 days
- Maximum interval: 365 days
- Technician availability
- Production schedule (avoid peak seasons)

**Parameters**:
```json
{
  "population_size": 100,
  "generations": 500,
  "crossover_rate": 0.8,
  "mutation_rate": 0.1,
  "elitism_count": 5
}
```

**Output**: Optimal maintenance interval (days) and cost savings

**Deployment**: Monthly

---

## 🚨 ALERTING & NOTIFICATION STRATEGY

### Alert Severity Levels

1. **CRITICAL** (Immediate Action Required):
   - Failure probability > 90% within 24 hours
   - Health score < 30
   - Urgent shutdown recommended
   - **Notification**: SMS + Email + Dashboard Alert + Mobile Push
   - **Escalation**: Immediate to Maintenance Manager + Production Manager

2. **HIGH** (Action Required Soon):
   - Failure probability > 70% within 7 days
   - Health score 30-49
   - Schedule maintenance within 3 days
   - **Notification**: Email + Dashboard Alert
   - **Escalation**: 4 hours to Maintenance Supervisor

3. **MEDIUM** (Plan Maintenance):
   - Failure probability > 50% within 30 days
   - Health score 50-69
   - Schedule maintenance within 2 weeks
   - **Notification**: Dashboard Alert + Weekly Summary Email
   - **Escalation**: None

4. **LOW** (Monitor):
   - Anomaly detected but low failure risk
   - Health score 70-89
   - No immediate action required
   - **Notification**: Dashboard Alert Only
   - **Escalation**: None

### Alert Suppression Rules

1. **Duplicate Alert Suppression**:
   - Same failure mode + same equipment + within 24 hours → Increment alert_count

2. **Scheduled Maintenance Suppression**:
   - If maintenance already scheduled for equipment → Suppress new alerts

3. **Equipment Offline Suppression**:
   - If equipment status = OFFLINE or MAINTENANCE → Suppress alerts

4. **False Alarm Learning**:
   - Track false_alarm rate per model
   - If false_alarm_rate > 20% → Auto-adjust threshold upward
   - Retrain model with labeled false alarms

---

## 📊 DASHBOARD REQUIREMENTS

### Equipment Health Dashboard

**Components**:
1. Equipment health status gauge (0-100 score)
2. Health trend chart (last 30 days)
3. Component health breakdown (sensor, OEE, quality, reliability, performance)
4. Risk factor list
5. Anomaly detection timeline
6. Recommended actions

### Predictive Maintenance Alerts Dashboard

**Components**:
1. Alert severity distribution (pie chart)
2. Alerts by urgency (bar chart)
3. Alert timeline (last 7 days)
4. Top 10 equipment at risk
5. Upcoming predicted failures (calendar view)
6. Alert resolution metrics (response time, false alarm rate)

### Maintenance Optimization Dashboard

**Components**:
1. Cost savings summary (YTD)
2. Downtime reduction (hours)
3. Failure reduction percentage
4. ROI by recommendation type
5. Implementation status tracker
6. Pending approvals queue

### Model Performance Dashboard

**Components**:
1. Model accuracy over time (line chart)
2. Prediction accuracy by failure mode (table)
3. False positive/negative rates
4. Model drift detection status
5. Retraining schedule
6. Feature importance rankings

---

## 🔐 SECURITY & COMPLIANCE

### Data Privacy

1. **PII Protection**: No personally identifiable information in sensor data
2. **Audit Logging**: All model predictions, alerts, and user actions logged
3. **Access Control**: Role-based permissions (Maintenance Manager, Technician, Viewer)

### Model Governance

1. **Model Versioning**: Semantic versioning (1.0.0 → 1.1.0 → 2.0.0)
2. **Model Approval Workflow**: Development → Testing → Staging → Production
3. **Model Rollback**: Ability to revert to previous model version
4. **Model Explainability**: Store feature importance, SHAP values

### Regulatory Compliance

1. **ISO 9001 Quality Management**: Audit trail for maintenance decisions
2. **FDA 21 CFR Part 11** (if applicable for medical printing): Electronic signatures, audit trails
3. **GDPR** (if EU operations): Right to explanation for AI decisions

---

## 🎯 SUCCESS METRICS

### Technical Metrics

1. **Prediction Accuracy**: > 85% for failure predictions
2. **False Positive Rate**: < 15%
3. **False Negative Rate**: < 5% (critical)
4. **Mean Absolute Error (RUL)**: < 48 hours
5. **Model Latency**: < 100ms for real-time predictions

### Business Metrics

1. **Unplanned Downtime Reduction**: 30% reduction in first year
2. **Maintenance Cost Savings**: 20% reduction in total maintenance spend
3. **Equipment Availability**: 95%+ uptime
4. **Mean Time Between Failures (MTBF)**: 25% increase
5. **Mean Time To Repair (MTTR)**: 15% reduction

### ROI Calculation

**Example Press Equipment**:
- Equipment cost: $500,000
- Annual maintenance cost (reactive): $75,000
- Average downtime cost per hour: $2,500
- Unplanned downtime hours per year: 120

**Current Annual Cost**:
- Maintenance: $75,000
- Downtime: 120 hours × $2,500 = $300,000
- **Total: $375,000**

**With Predictive Maintenance**:
- Maintenance: $60,000 (20% reduction from optimized scheduling)
- Downtime: 84 hours × $2,500 = $210,000 (30% reduction)
- **Total: $270,000**

**Annual Savings**: $375,000 - $270,000 = **$105,000**

**Predictive Maintenance System Cost**:
- Initial implementation: $50,000 (sensors, software, training)
- Annual operating cost: $15,000 (cloud, licenses, support)

**ROI**: ($105,000 - $15,000) / $50,000 = **180% first year**

---

## 🚀 IMPLEMENTATION ROADMAP

### Phase 1: Foundation (Weeks 1-4)

**Goal**: Set up data infrastructure and baseline models

**Tasks**:
1. Create database tables (predictive_maintenance_models, equipment_health_scores, predictive_maintenance_alerts, maintenance_recommendations)
2. Implement GraphQL schema and resolvers
3. Set up sensor data aggregation pipeline
4. Develop feature engineering functions
5. Train initial Isolation Forest anomaly detection model
6. Deploy health score calculation service

**Deliverables**:
- Database migration V0.0.XX
- GraphQL schema file
- Feature engineering module
- Anomaly detection model (v1.0.0)
- Health score calculator service

---

### Phase 2: Failure Prediction Models (Weeks 5-8)

**Goal**: Build and deploy failure prediction models

**Tasks**:
1. Collect historical failure data (maintenance_records where maintenance_type = 'BREAKDOWN')
2. Label failure events with 7-day lookback window
3. Train LSTM bearing failure prediction model
4. Train Random Forest RUL estimation model
5. Implement model deployment pipeline
6. Create model versioning system
7. Build alert generation service

**Deliverables**:
- LSTM bearing failure model (v1.0.0)
- Random Forest RUL model (v1.0.0)
- Model deployment service
- Alert generation service
- Model performance dashboard

---

### Phase 3: Maintenance Optimization (Weeks 9-12)

**Goal**: Implement maintenance schedule optimization

**Tasks**:
1. Develop maintenance cost modeling functions
2. Implement Genetic Algorithm optimization
3. Build recommendation generation service
4. Create approval workflow
5. Integrate with existing maintenance_records table
6. Build maintenance optimization dashboard

**Deliverables**:
- Maintenance optimization engine
- Recommendation service
- Approval workflow system
- Optimization dashboard
- Cost-benefit calculator

---

### Phase 4: Integration & Testing (Weeks 13-16)

**Goal**: End-to-end integration and validation

**Tasks**:
1. Integrate all services into production environment
2. Set up real-time data pipeline (sensor → prediction → alert)
3. Configure notification system (email, SMS, dashboard)
4. Train maintenance team on new system
5. Run parallel operations (old system + new system)
6. Validate prediction accuracy
7. Tune alert thresholds based on false alarm feedback

**Deliverables**:
- Production deployment
- Notification system
- User training materials
- Validation report
- Tuned model parameters

---

### Phase 5: Continuous Improvement (Ongoing)

**Goal**: Monitor, retrain, and optimize models

**Tasks**:
1. Monitor model performance metrics
2. Collect feedback on false alarms
3. Retrain models monthly with new data
4. Implement model drift detection
5. A/B test new model versions
6. Expand to additional equipment types
7. Add new failure modes to prediction catalog

**Deliverables**:
- Monthly model performance reports
- Retrained model versions
- Expanded failure mode library
- Continuous improvement plan

---

## 📚 REFERENCES & BEST PRACTICES

### Industry Standards

1. **ISO 13374** - Condition monitoring and diagnostics of machines
2. **ISO 14224** - Collection and exchange of reliability and maintenance data
3. **MIMOSA** - Machinery Information Management Open Systems Alliance
4. **IEC 61508** - Functional safety of electrical/electronic systems

### ML Best Practices

1. **Feature Scaling**: Standardize sensor readings (mean=0, std=1)
2. **Cross-Validation**: Time-series split (not random split)
3. **Class Imbalance**: Use SMOTE or weighted loss for rare failures
4. **Model Interpretability**: SHAP values for feature importance
5. **Hyperparameter Tuning**: Grid search or Bayesian optimization
6. **Model Monitoring**: Track data drift, concept drift, performance degradation

### Data Quality

1. **Sensor Calibration**: Flag out-of-calibration sensors in predictions
2. **Missing Data Handling**: Interpolation (max 1 hour gap), otherwise exclude
3. **Outlier Detection**: IQR method to filter sensor anomalies
4. **Data Freshness**: Alert if sensor last_heartbeat > 1 hour

---

## ✅ COMPLETION CHECKLIST

### Research Phase (Cynthia) - ✅ COMPLETE

- [x] Analyze existing infrastructure (work_centers, maintenance_records, iot_devices, sensor_readings)
- [x] Identify gaps (no ML models, no predictive alerts, no optimization)
- [x] Design new database schema (4 tables: predictive_maintenance_models, equipment_health_scores, predictive_maintenance_alerts, maintenance_recommendations)
- [x] Define GraphQL schema (types, queries, mutations, enums)
- [x] Specify ML model requirements (Isolation Forest, LSTM, Random Forest, Genetic Algorithm)
- [x] Document integration points with existing tables
- [x] Define feature engineering requirements (60+ features)
- [x] Create implementation roadmap (5 phases, 16 weeks)
- [x] Specify success metrics and ROI calculations
- [x] Document security, compliance, and best practices

### Next Steps (Backend Implementation - Roy)

- [ ] Create database migration V0.0.XX with 4 tables
- [ ] Implement GraphQL schema and resolvers
- [ ] Build feature engineering pipeline
- [ ] Train initial ML models
- [ ] Deploy health score calculation service
- [ ] Implement alert generation service
- [ ] Create maintenance optimization engine

### Next Steps (Frontend - Jen)

- [ ] Build equipment health dashboard
- [ ] Create predictive alerts dashboard
- [ ] Implement maintenance optimization dashboard
- [ ] Add model performance monitoring UI
- [ ] Build notification management interface

### Next Steps (QA - Billy)

- [ ] Test sensor data pipeline
- [ ] Validate ML model predictions
- [ ] Test alert generation logic
- [ ] Verify notification delivery
- [ ] Load test real-time processing (10k sensors)

---

## 🎓 KNOWLEDGE TRANSFER

### For Marcus (Product Owner)

**Business Value**:
- Reduce unplanned downtime by 30% (saving $90,000/year per press)
- Optimize maintenance schedules (saving 20% on maintenance costs)
- Extend equipment life by predicting failures early
- Improve OEE from 75% to 85%+

**Key Differentiators**:
- AI-driven predictions (not just threshold alerts)
- Multi-dimensional health scoring
- Cost-optimized maintenance scheduling
- Integration with existing SPC and OEE systems

### For Facility Manager

**Operational Benefits**:
- Proactive maintenance reduces emergency repairs
- Better resource planning (parts, technicians, downtime windows)
- Data-driven decision making (replace rules of thumb)
- Reduced scrap and quality issues from equipment degradation

**Change Management**:
- Training required for maintenance team (2-day workshop)
- Gradual rollout (start with 3 high-value presses)
- Parallel operation for 3 months (validate predictions)
- Monthly review meetings to tune thresholds

---

## 📞 STAKEHOLDER COMMUNICATIONS

### Executive Summary (1-page)

**Problem**: Unplanned equipment failures cost $300k/year per press in downtime and emergency repairs.

**Solution**: AI-powered Predictive Maintenance system that predicts failures 7 days in advance with 85% accuracy.

**Investment**: $50k initial + $15k/year operating cost

**Return**: $105k/year savings per press = 180% ROI first year

**Timeline**: 16 weeks to full production deployment

### Technical Summary (for IT/DevOps)

**Infrastructure Requirements**:
- PostgreSQL 14+ with TimescaleDB extension (for time-series partitioning)
- Python 3.9+ (ML model training and inference)
- Redis (real-time feature caching)
- NATS JetStream (event streaming for alerts)
- Grafana + Prometheus (monitoring)

**Data Volume**:
- Sensor readings: 10k/hour per press (240k/day, 87M/year)
- Health scores: 1 per 5 minutes per press (105k/year)
- Alerts: 10-20 per press per year
- Storage: ~5 GB/year per press (with partitioning and retention)

**Performance**:
- Real-time anomaly detection: < 100ms latency
- Health score calculation: < 500ms
- Hourly batch predictions: < 5 minutes total runtime
- Dashboard queries: < 200ms p95

---

## 🏁 CONCLUSION

This research deliverable provides a comprehensive blueprint for implementing Predictive Maintenance AI for press equipment. The system builds on existing robust infrastructure (IoT sensors, SPC monitoring, OEE tracking) and adds intelligent prediction, optimization, and decision support capabilities.

**Key Strengths**:
1. Leverages existing data (30+ tables, millions of sensor readings)
2. Modular design (4 new tables, minimal disruption)
3. Multiple ML models (anomaly detection, failure prediction, RUL estimation, optimization)
4. Clear ROI ($105k/year savings per press)
5. Phased implementation (16 weeks, low risk)

**Ready for Handoff**: This document contains all information needed for backend implementation (Roy), frontend development (Jen), QA testing (Billy), and statistical validation (Priya).

**Next Steps**: Await approval, then proceed to implementation Phase 1 (database schema and foundation services).

---

**Research Completed By**: Cynthia (Research & Planning Specialist)
**Date**: 2025-12-30
**Status**: ✅ COMPLETE - Ready for Implementation
**NATS Subject**: `agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767108044310`
