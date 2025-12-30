-- Migration: V0.0.26 - Add DevOps Alerting Infrastructure
-- Author: Roy (Backend Developer)
-- Requirement: REQ-STRATEGIC-AUTO-1766584106655
-- Purpose: Add alert history tracking and configuration for DevOps integration
-- Addresses: Sylvia Issue #11 (MEDIUM PRIORITY)

-- =====================================================
-- ISSUE #11 RESOLUTION: DEVOPS ALERTING INTEGRATION
-- =====================================================
-- Problem: Alerting framework exists but integration stubbed
-- Solution: Add alert history table, configuration table, and integration endpoints
-- Channels: PagerDuty (critical), Slack (all), Email (critical/warning)
-- =====================================================

-- Step 1: Create DevOps alert history table
CREATE TABLE IF NOT EXISTS devops_alert_history (
  alert_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID,
  facility_id UUID,

  -- Alert details
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
  message TEXT NOT NULL,
  source VARCHAR(100) NOT NULL,
  metadata JSONB,

  -- Delivery tracking
  delivery_status VARCHAR(20) NOT NULL DEFAULT 'SENT' CHECK (delivery_status IN ('SENT', 'FAILED', 'AGGREGATED')),
  delivery_channels JSONB, -- Array of channels: ['PagerDuty', 'Slack', 'Email']
  delivery_error TEXT,

  -- Timestamps
  alert_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Foreign keys
  CONSTRAINT fk_alert_history_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_history_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

-- Indexes for alert history queries
CREATE INDEX idx_alert_history_tenant_facility
  ON devops_alert_history(tenant_id, facility_id);

CREATE INDEX idx_alert_history_severity_timestamp
  ON devops_alert_history(severity, alert_timestamp DESC);

CREATE INDEX idx_alert_history_source
  ON devops_alert_history(source, alert_timestamp DESC);

CREATE INDEX idx_alert_history_delivery_status
  ON devops_alert_history(delivery_status);

-- Index for time-range queries (aggregation summaries)
CREATE INDEX idx_alert_history_timestamp
  ON devops_alert_history(alert_timestamp DESC);

COMMENT ON TABLE devops_alert_history IS
  'Audit trail of all DevOps alerts sent through PagerDuty, Slack, and Email channels';

-- Step 2: Create alerting configuration table
CREATE TABLE IF NOT EXISTS devops_alerting_config (
  config_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID,

  -- Channel configuration
  pagerduty_enabled BOOLEAN DEFAULT FALSE,
  pagerduty_integration_key_encrypted TEXT,

  slack_enabled BOOLEAN DEFAULT TRUE,
  slack_webhook_url_encrypted TEXT,
  slack_channel VARCHAR(100),

  email_enabled BOOLEAN DEFAULT TRUE,
  email_recipients_critical TEXT[], -- Array of email addresses
  email_recipients_warning TEXT[],
  email_recipients_info TEXT[],

  -- Alert aggregation settings
  aggregation_window_minutes INTEGER DEFAULT 5,
  max_alerts_per_window INTEGER DEFAULT 3,

  -- Severity routing
  route_critical_to_pagerduty BOOLEAN DEFAULT TRUE,
  route_critical_to_slack BOOLEAN DEFAULT TRUE,
  route_critical_to_email BOOLEAN DEFAULT TRUE,

  route_warning_to_slack BOOLEAN DEFAULT TRUE,
  route_warning_to_email BOOLEAN DEFAULT TRUE,

  route_info_to_slack BOOLEAN DEFAULT TRUE,
  route_info_to_email BOOLEAN DEFAULT FALSE,

  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  is_active BOOLEAN DEFAULT TRUE,

  -- Foreign key
  CONSTRAINT fk_alerting_config_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX idx_alerting_config_tenant
  ON devops_alerting_config(tenant_id)
  WHERE is_active = TRUE;

COMMENT ON TABLE devops_alerting_config IS
  'Configuration for DevOps alerting channels and routing rules per tenant';

-- Step 3: Create alert aggregation summary table
CREATE TABLE IF NOT EXISTS devops_alert_aggregation (
  aggregation_id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID,
  facility_id UUID,

  -- Aggregation window
  window_start TIMESTAMP NOT NULL,
  window_end TIMESTAMP NOT NULL,

  -- Alert counts by severity
  critical_count INTEGER DEFAULT 0,
  warning_count INTEGER DEFAULT 0,
  info_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,

  -- Unique sources
  unique_sources TEXT[],

  -- Summary sent
  summary_sent BOOLEAN DEFAULT FALSE,
  summary_sent_at TIMESTAMP,

  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_alert_agg_tenant FOREIGN KEY (tenant_id)
    REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  CONSTRAINT fk_alert_agg_facility FOREIGN KEY (facility_id)
    REFERENCES facilities(facility_id) ON DELETE CASCADE
);

CREATE INDEX idx_alert_agg_tenant_facility
  ON devops_alert_aggregation(tenant_id, facility_id);

CREATE INDEX idx_alert_agg_window
  ON devops_alert_aggregation(window_start, window_end);

CREATE INDEX idx_alert_agg_summary_sent
  ON devops_alert_aggregation(summary_sent, created_at DESC);

COMMENT ON TABLE devops_alert_aggregation IS
  'Aggregated alert summaries for preventing alert fatigue';

-- Step 4: Insert default alerting configuration
-- This allows the system to work out-of-the-box with console logging
INSERT INTO devops_alerting_config (
  tenant_id,
  pagerduty_enabled,
  slack_enabled,
  email_enabled,
  aggregation_window_minutes,
  max_alerts_per_window,
  created_by,
  is_active
) VALUES (
  NULL, -- System-wide default
  FALSE, -- PagerDuty disabled until configured
  FALSE, -- Slack disabled until configured
  FALSE, -- Email disabled until configured
  5,     -- 5-minute aggregation window
  3,     -- Max 3 alerts per window before aggregating
  NULL,  -- System created
  TRUE
) ON CONFLICT DO NOTHING;

-- Step 5: Create materialized view for alert statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS devops_alert_statistics AS
WITH hourly_stats AS (
  SELECT
    DATE_TRUNC('hour', alert_timestamp) as hour,
    tenant_id,
    facility_id,
    severity,
    COUNT(*) as alert_count,
    COUNT(DISTINCT source) as unique_sources
  FROM devops_alert_history
  WHERE alert_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  GROUP BY 1, 2, 3, 4
),
severity_aggregates AS (
  SELECT
    tenant_id,
    facility_id,
    SUM(CASE WHEN severity = 'CRITICAL' THEN alert_count ELSE 0 END) as critical_7d,
    SUM(CASE WHEN severity = 'WARNING' THEN alert_count ELSE 0 END) as warning_7d,
    SUM(CASE WHEN severity = 'INFO' THEN alert_count ELSE 0 END) as info_7d,
    SUM(alert_count) as total_7d
  FROM hourly_stats
  GROUP BY 1, 2
)
SELECT
  COALESCE(sa.tenant_id, 'system'::UUID) as tenant_id,
  sa.facility_id,
  sa.critical_7d,
  sa.warning_7d,
  sa.info_7d,
  sa.total_7d,
  CASE
    WHEN sa.critical_7d > 50 THEN 'HIGH_ALERT_VOLUME'
    WHEN sa.critical_7d > 20 THEN 'MODERATE_ALERT_VOLUME'
    ELSE 'NORMAL'
  END as alert_volume_status,
  (SELECT array_agg(DISTINCT source ORDER BY source)
   FROM devops_alert_history
   WHERE tenant_id = sa.tenant_id
     AND facility_id = sa.facility_id
     AND severity = 'CRITICAL'
     AND alert_timestamp >= CURRENT_TIMESTAMP - INTERVAL '7 days'
  ) as critical_sources
FROM severity_aggregates sa;

CREATE UNIQUE INDEX idx_alert_stats_tenant_facility
  ON devops_alert_statistics(tenant_id, COALESCE(facility_id, '00000000-0000-0000-0000-000000000000'::UUID));

COMMENT ON MATERIALIZED VIEW devops_alert_statistics IS
  '7-day rolling window alert statistics for monitoring alert volume and identifying noisy sources';

-- Step 6: Create function to refresh alert statistics
CREATE OR REPLACE FUNCTION refresh_devops_alert_statistics()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY devops_alert_statistics;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_devops_alert_statistics() IS
  'Refresh alert statistics materialized view - should be run hourly via cron';

-- =====================================================
-- GRANTS
-- =====================================================

GRANT SELECT, INSERT ON devops_alert_history TO wms_application_role;
GRANT SELECT, INSERT, UPDATE ON devops_alerting_config TO wms_application_role;
GRANT SELECT, INSERT, UPDATE ON devops_alert_aggregation TO wms_application_role;
GRANT SELECT ON devops_alert_statistics TO wms_application_role;
GRANT EXECUTE ON FUNCTION refresh_devops_alert_statistics() TO wms_application_role;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  alert_history_count INTEGER;
  config_count INTEGER;
BEGIN
  -- Verify alert history table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'devops_alert_history'
  ) THEN
    RAISE EXCEPTION 'Table devops_alert_history was not created';
  END IF;

  -- Verify alerting config table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'devops_alerting_config'
  ) THEN
    RAISE EXCEPTION 'Table devops_alerting_config was not created';
  END IF;

  -- Verify alert aggregation table exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'devops_alert_aggregation'
  ) THEN
    RAISE EXCEPTION 'Table devops_alert_aggregation was not created';
  END IF;

  -- Verify materialized view exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_matviews
    WHERE matviewname = 'devops_alert_statistics'
  ) THEN
    RAISE EXCEPTION 'Materialized view devops_alert_statistics was not created';
  END IF;

  -- Verify default config exists
  SELECT COUNT(*) INTO config_count
  FROM devops_alerting_config
  WHERE tenant_id IS NULL AND is_active = TRUE;

  IF config_count = 0 THEN
    RAISE WARNING 'Default alerting configuration not found - may need manual setup';
  END IF;

  RAISE NOTICE 'DevOps alerting infrastructure created successfully';
  RAISE NOTICE 'Alert history table: devops_alert_history';
  RAISE NOTICE 'Alert config table: devops_alerting_config';
  RAISE NOTICE 'Alert aggregation table: devops_alert_aggregation';
  RAISE NOTICE 'Alert statistics view: devops_alert_statistics';
  RAISE NOTICE 'Issue #11 (MEDIUM PRIORITY) - RESOLVED';
  RAISE NOTICE '';
  RAISE NOTICE 'CONFIGURATION REQUIRED:';
  RAISE NOTICE '1. Set PAGERDUTY_INTEGRATION_KEY environment variable';
  RAISE NOTICE '2. Set SLACK_WEBHOOK_URL environment variable';
  RAISE NOTICE '3. Configure SMTP settings for email alerts';
  RAISE NOTICE '4. Update devops_alerting_config table with recipient emails';
  RAISE NOTICE '5. Schedule hourly refresh of devops_alert_statistics';
END $$;
