-- V1.2.21: Add Deployment Rollback Decision Tables
-- Description: Additional schema for rollback decision tracking and automated rollback criteria

-- ==============================================================================
-- DEPLOYMENT ROLLBACKS TABLE
-- ==============================================================================
CREATE TABLE deployment_rollbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  tenant_id VARCHAR(50) NOT NULL,

  -- Rollback Details
  rollback_number VARCHAR(50) NOT NULL,
  rollback_reason TEXT NOT NULL,
  rollback_type VARCHAR(50) NOT NULL CHECK (rollback_type IN ('MANUAL', 'AUTOMATIC', 'EMERGENCY')),

  -- Decision Criteria
  decision_criteria JSONB,  -- Stores health metrics, error rates, etc. that triggered rollback
  health_check_status VARCHAR(20),
  post_deployment_duration_minutes INT,

  -- Rollback Execution
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')
  ),
  rollback_started_at TIMESTAMP,
  rollback_completed_at TIMESTAMP,
  rollback_duration_seconds INT,

  -- Previous Deployment State
  previous_deployment_id UUID REFERENCES deployments(id),
  previous_version VARCHAR(100),
  previous_git_commit_hash VARCHAR(100),

  -- Rollback Impact
  affected_services JSONB,  -- List of services affected by rollback
  downtime_minutes INT,

  -- Approval (for manual rollbacks)
  requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
  approved_by_user_id VARCHAR(100),
  approved_at TIMESTAMP,

  -- Audit
  initiated_by_user_id VARCHAR(100),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  CONSTRAINT unique_rollback_number UNIQUE (tenant_id, rollback_number)
);

CREATE INDEX idx_rollbacks_deployment ON deployment_rollbacks(deployment_id);
CREATE INDEX idx_rollbacks_tenant ON deployment_rollbacks(tenant_id);
CREATE INDEX idx_rollbacks_status ON deployment_rollbacks(status);
CREATE INDEX idx_rollbacks_type ON deployment_rollbacks(rollback_type);
CREATE INDEX idx_rollbacks_created ON deployment_rollbacks(created_at DESC);

COMMENT ON TABLE deployment_rollbacks IS 'Tracks deployment rollback requests and execution';

-- ==============================================================================
-- ROLLBACK DECISION CRITERIA TABLE
-- ==============================================================================
CREATE TABLE rollback_decision_criteria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR(50) NOT NULL,

  -- Criteria Identity
  criteria_name VARCHAR(200) NOT NULL,
  description TEXT,
  environment VARCHAR(50) NOT NULL CHECK (environment IN ('STAGING', 'PRE_PRODUCTION', 'PRODUCTION', 'DISASTER_RECOVERY')),

  -- Automatic Rollback Configuration
  auto_rollback_enabled BOOLEAN NOT NULL DEFAULT FALSE,

  -- Health Check Thresholds
  max_error_rate_percent DECIMAL(5,2),  -- e.g., 5.00 = 5%
  max_response_time_ms INT,
  min_success_rate_percent DECIMAL(5,2),

  -- Time Windows
  monitoring_window_minutes INT NOT NULL DEFAULT 30,  -- How long to monitor after deployment
  decision_window_minutes INT NOT NULL DEFAULT 5,     -- Time to decide on rollback

  -- Service Health Requirements
  required_healthy_services JSONB,  -- List of critical services that must be healthy
  max_unhealthy_instances_percent DECIMAL(5,2),

  -- Custom Metrics
  custom_metric_thresholds JSONB,  -- Custom metric thresholds for rollback decision

  -- Notifications
  notify_on_auto_rollback BOOLEAN NOT NULL DEFAULT TRUE,
  notification_channels JSONB,  -- Channels to notify (email, slack, etc.)

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INT NOT NULL DEFAULT 0,

  -- Audit
  created_by VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  CONSTRAINT unique_criteria_name_per_env UNIQUE (tenant_id, environment, criteria_name)
);

CREATE INDEX idx_rollback_criteria_tenant ON rollback_decision_criteria(tenant_id);
CREATE INDEX idx_rollback_criteria_environment ON rollback_decision_criteria(environment);
CREATE INDEX idx_rollback_criteria_active ON rollback_decision_criteria(is_active);

COMMENT ON TABLE rollback_decision_criteria IS 'Configurable criteria for automatic rollback decisions';

-- ==============================================================================
-- ROLLBACK HEALTH METRICS TABLE
-- ==============================================================================
CREATE TABLE rollback_health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deployment_id UUID NOT NULL REFERENCES deployments(id) ON DELETE CASCADE,
  tenant_id VARCHAR(50) NOT NULL,

  -- Metric Details
  metric_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  minutes_since_deployment INT NOT NULL,

  -- Health Metrics
  error_rate_percent DECIMAL(5,2),
  success_rate_percent DECIMAL(5,2),
  avg_response_time_ms INT,
  request_count BIGINT,
  error_count BIGINT,

  -- Service Health
  healthy_services_count INT,
  unhealthy_services_count INT,
  total_services_count INT,

  -- Resource Metrics
  cpu_usage_percent DECIMAL(5,2),
  memory_usage_percent DECIMAL(5,2),
  disk_usage_percent DECIMAL(5,2),

  -- Custom Metrics
  custom_metrics JSONB,

  -- Rollback Decision
  triggers_rollback_criteria BOOLEAN NOT NULL DEFAULT FALSE,
  violated_thresholds JSONB,  -- Which thresholds were violated

  -- Immutable record
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rollback_metrics_deployment ON rollback_health_metrics(deployment_id, metric_timestamp DESC);
CREATE INDEX idx_rollback_metrics_tenant ON rollback_health_metrics(tenant_id);
CREATE INDEX idx_rollback_metrics_triggers ON rollback_health_metrics(triggers_rollback_criteria) WHERE triggers_rollback_criteria = TRUE;

COMMENT ON TABLE rollback_health_metrics IS 'Time-series health metrics for post-deployment monitoring and rollback decisions';

-- ==============================================================================
-- ROLLBACK ELIGIBLE DEPLOYMENTS VIEW
-- ==============================================================================
CREATE OR REPLACE VIEW v_rollback_eligible_deployments AS
SELECT
  d.id AS deployment_id,
  d.deployment_number,
  d.tenant_id,
  d.title,
  d.environment,
  d.version,
  d.deployed_by,
  d.deployed_at,
  d.git_commit_hash,
  d.git_branch,

  -- Time since deployment
  EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - d.deployed_at)) / 60 AS minutes_since_deployment,

  -- Rollback eligibility
  d.rollback_available,
  d.auto_rollback_enabled,
  d.post_deployment_health_check,

  -- Previous deployment (for rollback target)
  (SELECT id FROM deployments prev
   WHERE prev.tenant_id = d.tenant_id
     AND prev.environment = d.environment
     AND prev.status = 'DEPLOYED'
     AND prev.deployed_at < d.deployed_at
   ORDER BY prev.deployed_at DESC
   LIMIT 1) AS previous_deployment_id,

  (SELECT version FROM deployments prev
   WHERE prev.tenant_id = d.tenant_id
     AND prev.environment = d.environment
     AND prev.status = 'DEPLOYED'
     AND prev.deployed_at < d.deployed_at
   ORDER BY prev.deployed_at DESC
   LIMIT 1) AS previous_version,

  -- Recent health metrics
  (SELECT error_rate_percent FROM rollback_health_metrics
   WHERE deployment_id = d.id
   ORDER BY metric_timestamp DESC
   LIMIT 1) AS current_error_rate_percent,

  (SELECT success_rate_percent FROM rollback_health_metrics
   WHERE deployment_id = d.id
   ORDER BY metric_timestamp DESC
   LIMIT 1) AS current_success_rate_percent,

  (SELECT avg_response_time_ms FROM rollback_health_metrics
   WHERE deployment_id = d.id
   ORDER BY metric_timestamp DESC
   LIMIT 1) AS current_avg_response_time_ms,

  -- Active rollback criteria
  (SELECT COUNT(*) FROM rollback_decision_criteria rdc
   WHERE rdc.tenant_id = d.tenant_id
     AND rdc.environment = d.environment
     AND rdc.is_active = TRUE
     AND rdc.auto_rollback_enabled = TRUE) AS active_auto_rollback_rules,

  -- Existing rollbacks
  (SELECT COUNT(*) FROM deployment_rollbacks
   WHERE deployment_id = d.id) AS rollback_count

FROM deployments d

WHERE d.status = 'DEPLOYED'
  AND d.rollback_available = TRUE
  AND d.deployed_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';  -- Only recent deployments

COMMENT ON VIEW v_rollback_eligible_deployments IS 'Deployments eligible for rollback with health metrics';

-- ==============================================================================
-- ROLLBACK NUMBER SEQUENCE FUNCTION
-- ==============================================================================
CREATE OR REPLACE FUNCTION generate_rollback_number(p_tenant_id VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
  v_next_num INT;
  v_rollback_number VARCHAR;
BEGIN
  -- Get the next rollback number for this tenant
  SELECT COALESCE(MAX(CAST(SUBSTRING(rollback_number FROM 'ROLLBACK-(\d+)') AS INT)), 0) + 1
  INTO v_next_num
  FROM deployment_rollbacks
  WHERE tenant_id = p_tenant_id;

  -- Format as ROLLBACK-XXXXXX
  v_rollback_number := 'ROLLBACK-' || LPAD(v_next_num::TEXT, 6, '0');

  RETURN v_rollback_number;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_rollback_number IS 'Generate sequential rollback numbers per tenant';

-- ==============================================================================
-- SAMPLE DATA: DEFAULT ROLLBACK CRITERIA
-- ==============================================================================

-- Production Auto-Rollback Criteria
INSERT INTO rollback_decision_criteria (
  tenant_id, criteria_name, description, environment,
  auto_rollback_enabled, max_error_rate_percent, max_response_time_ms,
  min_success_rate_percent, monitoring_window_minutes, decision_window_minutes,
  notify_on_auto_rollback, is_active, created_by
) VALUES (
  'default', 'Production Auto-Rollback - High Error Rate',
  'Automatically rollback production deployments if error rate exceeds 5% within 30 minutes',
  'PRODUCTION', TRUE, 5.00, 2000, 95.00, 30, 5, TRUE, TRUE, 'system'
);

-- Production Manual Review Criteria
INSERT INTO rollback_decision_criteria (
  tenant_id, criteria_name, description, environment,
  auto_rollback_enabled, max_error_rate_percent, max_response_time_ms,
  min_success_rate_percent, monitoring_window_minutes, decision_window_minutes,
  notify_on_auto_rollback, is_active, created_by
) VALUES (
  'default', 'Production Manual Review - Moderate Issues',
  'Alert for manual review if error rate between 2-5% or response time > 1s',
  'PRODUCTION', FALSE, 2.00, 1000, 98.00, 30, 5, TRUE, TRUE, 'system'
);

-- Staging Criteria (More lenient)
INSERT INTO rollback_decision_criteria (
  tenant_id, criteria_name, description, environment,
  auto_rollback_enabled, max_error_rate_percent, max_response_time_ms,
  min_success_rate_percent, monitoring_window_minutes, decision_window_minutes,
  is_active, created_by
) VALUES (
  'default', 'Staging Auto-Rollback',
  'Auto-rollback staging if error rate > 10%',
  'STAGING', TRUE, 10.00, 3000, 90.00, 15, 3, TRUE, 'system'
);

-- ==============================================================================
-- GRANTS
-- ==============================================================================
GRANT SELECT, INSERT, UPDATE ON deployment_rollbacks TO app_user;
GRANT SELECT, INSERT, UPDATE ON rollback_decision_criteria TO app_user;
GRANT SELECT, INSERT ON rollback_health_metrics TO app_user;
GRANT SELECT ON v_rollback_eligible_deployments TO app_user;
GRANT EXECUTE ON FUNCTION generate_rollback_number TO app_user;
