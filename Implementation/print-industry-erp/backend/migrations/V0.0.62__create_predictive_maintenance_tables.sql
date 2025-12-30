-- =============================================
-- Migration: V0.0.62 - Create Predictive Maintenance AI Tables
-- REQ: REQ-STRATEGIC-AUTO-1767108044310
-- Description: Predictive Maintenance AI for Press Equipment
-- Author: Roy (Backend Specialist)
-- Date: 2025-12-30
-- =============================================

-- =============================================
-- TABLE 1: predictive_maintenance_models
-- Purpose: Store ML model configurations, parameters, and metadata
-- =============================================

CREATE TABLE IF NOT EXISTS predictive_maintenance_models (
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

    feature_set JSONB NOT NULL,
    -- Features used by model

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
    -- [{feature: 'bearing_temp', importance: 0.35}, ...]

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

-- =============================================
-- TABLE 2: equipment_health_scores
-- Purpose: Real-time equipment health tracking
-- =============================================

CREATE TABLE IF NOT EXISTS equipment_health_scores (
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
    -- [{factor: 'High bearing temperature', severity: 'HIGH', ...}]

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
CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_01 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_02 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_03 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_04 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_05 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_06 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_07 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_08 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_09 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_10 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_11 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2025_12 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2026_01 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2026_02 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2026_03 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2026_04 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2026_05 PARTITION OF equipment_health_scores
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS equipment_health_scores_2026_06 PARTITION OF equipment_health_scores
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

-- =============================================
-- TABLE 3: predictive_maintenance_alerts
-- Purpose: AI-generated predictive maintenance alerts
-- =============================================

CREATE TABLE IF NOT EXISTS predictive_maintenance_alerts (
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

    -- Contributing factors
    primary_indicators JSONB,
    -- Top factors contributing to prediction

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
    -- [{part_number: 'BRG-1234', description: 'Main bearing', ...}]

    required_skills JSONB,
    -- [{skill: 'Mechanical Technician Level 3', hours: 4}, ...]

    estimated_maintenance_duration_hours DECIMAL(6,2),

    recommended_maintenance_type VARCHAR(50),
    -- PREVENTIVE, PREDICTIVE, CONDITION_BASED

    detailed_recommendations TEXT,

    -- Alternative scenarios
    alternative_scenarios JSONB,
    -- [{scenario: 'Immediate maintenance', cost: 5000, downtime: 4}, ...]

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
    -- Difference between predicted and actual

    resolved_by_user_id UUID,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,

    -- Notifications
    notifications_sent JSONB,
    -- [{user_id: '...', method: 'EMAIL', timestamp: '...', ...}]

    escalation_level INTEGER DEFAULT 0,
    -- 0 = No escalation, 1 = First escalation, etc.

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

-- =============================================
-- TABLE 4: maintenance_recommendations
-- Purpose: AI-generated maintenance schedule optimization
-- =============================================

CREATE TABLE IF NOT EXISTS maintenance_recommendations (
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
    -- [{parameter: 'bearing_temp', threshold: 80, operator: '>'}, ...]

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
    -- [{factor: 'Equipment age exceeds 10 years', severity: 'MEDIUM'}, ...]

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
    -- [{resource: 'Technician training', hours: 8, cost: 1200}, ...]

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
    -- [{option: 'Increase interval to 180 days', cost_savings: 3000, ...}]

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

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE predictive_maintenance_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_health_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictive_maintenance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_recommendations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for predictive_maintenance_models
CREATE POLICY tenant_isolation_pm_models ON predictive_maintenance_models
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY tenant_isolation_pm_models_insert ON predictive_maintenance_models
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policies for equipment_health_scores
CREATE POLICY tenant_isolation_health_scores ON equipment_health_scores
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY tenant_isolation_health_scores_insert ON equipment_health_scores
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policies for predictive_maintenance_alerts
CREATE POLICY tenant_isolation_pm_alerts ON predictive_maintenance_alerts
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY tenant_isolation_pm_alerts_insert ON predictive_maintenance_alerts
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- RLS Policies for maintenance_recommendations
CREATE POLICY tenant_isolation_maint_rec ON maintenance_recommendations
    USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

CREATE POLICY tenant_isolation_maint_rec_insert ON maintenance_recommendations
    FOR INSERT
    WITH CHECK (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- =============================================
-- SAMPLE DATA (for development/testing)
-- =============================================

-- Note: Sample data insertion will be handled by a separate script
-- This migration focuses on schema creation only
