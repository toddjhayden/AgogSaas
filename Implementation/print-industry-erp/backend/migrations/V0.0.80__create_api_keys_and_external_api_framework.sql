/**
 * API Keys and External API Framework
 * REQ-1767925582664-oqb5y - Implement REST API Framework for External Integrations
 *
 * Features:
 * - API key management with scopes and rate limiting
 * - API access logging and audit trail
 * - Rate limit tracking per API key
 * - Webhook configuration and delivery tracking
 */

-- ============================================================================
-- API Keys Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Key Information
  key_hash VARCHAR(128) NOT NULL UNIQUE, -- SHA-256 hash of the API key
  key_prefix VARCHAR(12) NOT NULL, -- First 8 chars for identification (e.g., "ak_live_12345678")
  name VARCHAR(255) NOT NULL, -- Human-readable name
  description TEXT,

  -- Permissions
  scopes TEXT[] NOT NULL DEFAULT '{}', -- Array of permission scopes (e.g., ['read:orders', 'write:products'])
  allowed_ips INET[] DEFAULT NULL, -- Whitelist of allowed IP addresses (NULL = allow all)
  allowed_origins TEXT[] DEFAULT NULL, -- CORS origins allowed to use this key

  -- Rate Limiting
  rate_limit_per_minute INTEGER DEFAULT 60,
  rate_limit_per_hour INTEGER DEFAULT 3600,
  rate_limit_per_day INTEGER DEFAULT 100000,

  -- Lifecycle
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  last_used_ip INET,

  -- Metadata
  created_by UUID, -- User who created the key
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  revoke_reason TEXT,

  -- Audit
  metadata JSONB DEFAULT '{}',

  CONSTRAINT fk_api_keys_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_api_keys_tenant ON api_keys(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_key_hash ON api_keys(key_hash) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON api_keys(tenant_id, is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL AND is_active = true;

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY api_keys_tenant_isolation ON api_keys
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- API Access Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_access_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  api_key_id UUID NOT NULL,

  -- Request Information
  request_method VARCHAR(10) NOT NULL, -- GET, POST, PUT, DELETE, etc.
  request_path VARCHAR(1024) NOT NULL,
  request_query TEXT, -- Query string parameters
  request_headers JSONB, -- Selected headers (filtered for security)
  request_body_size INTEGER, -- Size in bytes
  request_ip INET NOT NULL,
  request_user_agent TEXT,

  -- Response Information
  response_status INTEGER NOT NULL,
  response_body_size INTEGER,
  response_time_ms INTEGER NOT NULL, -- Response time in milliseconds

  -- Security
  rate_limit_hit BOOLEAN DEFAULT false,
  scope_required VARCHAR(255), -- Scope that was required for this endpoint
  scope_granted BOOLEAN NOT NULL DEFAULT true, -- Whether the key had the required scope

  -- Errors
  error_code VARCHAR(50),
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB DEFAULT '{}',

  CONSTRAINT fk_api_access_log_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_api_access_log_key FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Partition by month for better performance
CREATE INDEX idx_api_access_log_tenant_created ON api_access_log(tenant_id, created_at DESC);
CREATE INDEX idx_api_access_log_key_created ON api_access_log(api_key_id, created_at DESC);
CREATE INDEX idx_api_access_log_status ON api_access_log(response_status, created_at DESC) WHERE response_status >= 400;
CREATE INDEX idx_api_access_log_rate_limit ON api_access_log(api_key_id, created_at) WHERE rate_limit_hit = true;

-- Enable RLS
ALTER TABLE api_access_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY api_access_log_tenant_isolation ON api_access_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- API Rate Limit Tracking Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_rate_limit_buckets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  api_key_id UUID NOT NULL,

  -- Bucket Information
  bucket_type VARCHAR(20) NOT NULL, -- 'minute', 'hour', 'day'
  bucket_timestamp TIMESTAMPTZ NOT NULL, -- Start of the time bucket

  -- Counters
  request_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  rate_limit_exceeded_count INTEGER NOT NULL DEFAULT 0,

  -- Performance Metrics
  total_response_time_ms BIGINT NOT NULL DEFAULT 0,
  avg_response_time_ms INTEGER,
  max_response_time_ms INTEGER,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_rate_limit_buckets_key FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  CONSTRAINT uq_rate_limit_bucket UNIQUE (api_key_id, bucket_type, bucket_timestamp)
);

-- Indexes
CREATE INDEX idx_rate_limit_buckets_key_type_ts ON api_rate_limit_buckets(api_key_id, bucket_type, bucket_timestamp DESC);
CREATE INDEX idx_rate_limit_buckets_cleanup ON api_rate_limit_buckets(bucket_timestamp) WHERE bucket_timestamp < CURRENT_TIMESTAMP - INTERVAL '30 days';

-- ============================================================================
-- Webhook Configurations Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_configurations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Webhook Information
  name VARCHAR(255) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  secret_hash VARCHAR(128), -- HMAC secret for signature verification

  -- Events
  enabled_events TEXT[] NOT NULL DEFAULT '{}', -- Array of event types to send

  -- Headers
  custom_headers JSONB DEFAULT '{}', -- Additional headers to send with webhook

  -- Retry Configuration
  retry_enabled BOOLEAN NOT NULL DEFAULT true,
  max_retries INTEGER NOT NULL DEFAULT 3,
  retry_delay_seconds INTEGER NOT NULL DEFAULT 60,

  -- Security
  verify_ssl BOOLEAN NOT NULL DEFAULT true,
  timeout_seconds INTEGER NOT NULL DEFAULT 30,

  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',

  CONSTRAINT fk_webhook_configs_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_webhook_configs_tenant ON webhook_configurations(tenant_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_webhook_configs_active ON webhook_configurations(is_active) WHERE deleted_at IS NULL;
CREATE INDEX idx_webhook_configs_events ON webhook_configurations USING GIN (enabled_events);

-- Enable RLS
ALTER TABLE webhook_configurations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY webhook_configurations_tenant_isolation ON webhook_configurations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Webhook Delivery Log Table
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  webhook_config_id UUID NOT NULL,

  -- Event Information
  event_type VARCHAR(100) NOT NULL,
  event_id UUID NOT NULL, -- ID of the event/entity that triggered this
  payload JSONB NOT NULL,

  -- Delivery Information
  attempt_number INTEGER NOT NULL DEFAULT 1,
  request_url VARCHAR(2048) NOT NULL,
  request_headers JSONB,
  request_body_size INTEGER,

  -- Response Information
  response_status INTEGER,
  response_headers JSONB,
  response_body TEXT,
  response_time_ms INTEGER,

  -- Status
  status VARCHAR(20) NOT NULL, -- 'pending', 'success', 'failed', 'retrying'
  error_message TEXT,

  -- Retry Information
  next_retry_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',

  CONSTRAINT fk_webhook_deliveries_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_webhook_deliveries_config FOREIGN KEY (webhook_config_id) REFERENCES webhook_configurations(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX idx_webhook_deliveries_tenant_created ON webhook_deliveries(tenant_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_config_created ON webhook_deliveries(webhook_config_id, created_at DESC);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status) WHERE status IN ('pending', 'retrying');
CREATE INDEX idx_webhook_deliveries_retry ON webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL;
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event_type, event_id);

-- Enable RLS
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY webhook_deliveries_tenant_isolation ON webhook_deliveries
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Functions and Triggers
-- ============================================================================

-- Update api_keys.last_used_at when access is logged
CREATE OR REPLACE FUNCTION update_api_key_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE api_keys
  SET last_used_at = NEW.created_at,
      last_used_ip = NEW.request_ip
  WHERE id = NEW.api_key_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_key_last_used
  AFTER INSERT ON api_access_log
  FOR EACH ROW
  EXECUTE FUNCTION update_api_key_last_used();

-- Update rate limit buckets
CREATE OR REPLACE FUNCTION update_rate_limit_bucket()
RETURNS TRIGGER AS $$
DECLARE
  v_minute_bucket TIMESTAMPTZ;
  v_hour_bucket TIMESTAMPTZ;
  v_day_bucket TIMESTAMPTZ;
BEGIN
  -- Calculate bucket timestamps
  v_minute_bucket := date_trunc('minute', NEW.created_at);
  v_hour_bucket := date_trunc('hour', NEW.created_at);
  v_day_bucket := date_trunc('day', NEW.created_at);

  -- Update minute bucket
  INSERT INTO api_rate_limit_buckets (
    api_key_id, bucket_type, bucket_timestamp,
    request_count, error_count, rate_limit_exceeded_count,
    total_response_time_ms, max_response_time_ms, avg_response_time_ms
  ) VALUES (
    NEW.api_key_id, 'minute', v_minute_bucket,
    1,
    CASE WHEN NEW.response_status >= 400 THEN 1 ELSE 0 END,
    CASE WHEN NEW.rate_limit_hit THEN 1 ELSE 0 END,
    NEW.response_time_ms,
    NEW.response_time_ms,
    NEW.response_time_ms
  )
  ON CONFLICT (api_key_id, bucket_type, bucket_timestamp)
  DO UPDATE SET
    request_count = api_rate_limit_buckets.request_count + 1,
    error_count = api_rate_limit_buckets.error_count + CASE WHEN NEW.response_status >= 400 THEN 1 ELSE 0 END,
    rate_limit_exceeded_count = api_rate_limit_buckets.rate_limit_exceeded_count + CASE WHEN NEW.rate_limit_hit THEN 1 ELSE 0 END,
    total_response_time_ms = api_rate_limit_buckets.total_response_time_ms + NEW.response_time_ms,
    max_response_time_ms = GREATEST(api_rate_limit_buckets.max_response_time_ms, NEW.response_time_ms),
    avg_response_time_ms = (api_rate_limit_buckets.total_response_time_ms + NEW.response_time_ms) / (api_rate_limit_buckets.request_count + 1),
    updated_at = CURRENT_TIMESTAMP;

  -- Update hour bucket
  INSERT INTO api_rate_limit_buckets (
    api_key_id, bucket_type, bucket_timestamp,
    request_count, error_count, rate_limit_exceeded_count,
    total_response_time_ms, max_response_time_ms, avg_response_time_ms
  ) VALUES (
    NEW.api_key_id, 'hour', v_hour_bucket,
    1,
    CASE WHEN NEW.response_status >= 400 THEN 1 ELSE 0 END,
    CASE WHEN NEW.rate_limit_hit THEN 1 ELSE 0 END,
    NEW.response_time_ms,
    NEW.response_time_ms,
    NEW.response_time_ms
  )
  ON CONFLICT (api_key_id, bucket_type, bucket_timestamp)
  DO UPDATE SET
    request_count = api_rate_limit_buckets.request_count + 1,
    error_count = api_rate_limit_buckets.error_count + CASE WHEN NEW.response_status >= 400 THEN 1 ELSE 0 END,
    rate_limit_exceeded_count = api_rate_limit_buckets.rate_limit_exceeded_count + CASE WHEN NEW.rate_limit_hit THEN 1 ELSE 0 END,
    total_response_time_ms = api_rate_limit_buckets.total_response_time_ms + NEW.response_time_ms,
    max_response_time_ms = GREATEST(api_rate_limit_buckets.max_response_time_ms, NEW.response_time_ms),
    avg_response_time_ms = (api_rate_limit_buckets.total_response_time_ms + NEW.response_time_ms) / (api_rate_limit_buckets.request_count + 1),
    updated_at = CURRENT_TIMESTAMP;

  -- Update day bucket
  INSERT INTO api_rate_limit_buckets (
    api_key_id, bucket_type, bucket_timestamp,
    request_count, error_count, rate_limit_exceeded_count,
    total_response_time_ms, max_response_time_ms, avg_response_time_ms
  ) VALUES (
    NEW.api_key_id, 'day', v_day_bucket,
    1,
    CASE WHEN NEW.response_status >= 400 THEN 1 ELSE 0 END,
    CASE WHEN NEW.rate_limit_hit THEN 1 ELSE 0 END,
    NEW.response_time_ms,
    NEW.response_time_ms,
    NEW.response_time_ms
  )
  ON CONFLICT (api_key_id, bucket_type, bucket_timestamp)
  DO UPDATE SET
    request_count = api_rate_limit_buckets.request_count + 1,
    error_count = api_rate_limit_buckets.error_count + CASE WHEN NEW.response_status >= 400 THEN 1 ELSE 0 END,
    rate_limit_exceeded_count = api_rate_limit_buckets.rate_limit_exceeded_count + CASE WHEN NEW.rate_limit_hit THEN 1 ELSE 0 END,
    total_response_time_ms = api_rate_limit_buckets.total_response_time_ms + NEW.response_time_ms,
    max_response_time_ms = GREATEST(api_rate_limit_buckets.max_response_time_ms, NEW.response_time_ms),
    avg_response_time_ms = (api_rate_limit_buckets.total_response_time_ms + NEW.response_time_ms) / (api_rate_limit_buckets.request_count + 1),
    updated_at = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rate_limit_bucket
  AFTER INSERT ON api_access_log
  FOR EACH ROW
  EXECUTE FUNCTION update_rate_limit_bucket();

-- Update webhook configuration status
CREATE OR REPLACE FUNCTION update_webhook_config_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE webhook_configurations
  SET last_triggered_at = NEW.created_at,
      last_success_at = CASE WHEN NEW.status = 'success' THEN NEW.completed_at ELSE last_success_at END,
      last_failure_at = CASE WHEN NEW.status = 'failed' THEN NEW.completed_at ELSE last_failure_at END,
      consecutive_failures = CASE
        WHEN NEW.status = 'success' THEN 0
        WHEN NEW.status = 'failed' THEN consecutive_failures + 1
        ELSE consecutive_failures
      END,
      updated_at = CURRENT_TIMESTAMP
  WHERE id = NEW.webhook_config_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_webhook_config_status
  AFTER INSERT OR UPDATE ON webhook_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION update_webhook_config_status();

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Check if API key has required scope
CREATE OR REPLACE FUNCTION api_key_has_scope(
  p_api_key_id UUID,
  p_required_scope VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
  v_scopes TEXT[];
BEGIN
  SELECT scopes INTO v_scopes
  FROM api_keys
  WHERE id = p_api_key_id AND is_active = true;

  IF v_scopes IS NULL THEN
    RETURN false;
  END IF;

  -- Check for wildcard scope '*' or specific scope
  RETURN '*' = ANY(v_scopes) OR p_required_scope = ANY(v_scopes);
END;
$$ LANGUAGE plpgsql;

-- Get current rate limit usage
CREATE OR REPLACE FUNCTION get_rate_limit_usage(
  p_api_key_id UUID,
  p_bucket_type VARCHAR
) RETURNS TABLE (
  current_count INTEGER,
  limit_value INTEGER,
  usage_percentage NUMERIC
) AS $$
DECLARE
  v_bucket_timestamp TIMESTAMPTZ;
  v_limit INTEGER;
BEGIN
  -- Calculate bucket timestamp
  v_bucket_timestamp := CASE p_bucket_type
    WHEN 'minute' THEN date_trunc('minute', CURRENT_TIMESTAMP)
    WHEN 'hour' THEN date_trunc('hour', CURRENT_TIMESTAMP)
    WHEN 'day' THEN date_trunc('day', CURRENT_TIMESTAMP)
  END;

  -- Get limit
  SELECT CASE p_bucket_type
    WHEN 'minute' THEN rate_limit_per_minute
    WHEN 'hour' THEN rate_limit_per_hour
    WHEN 'day' THEN rate_limit_per_day
  END INTO v_limit
  FROM api_keys
  WHERE id = p_api_key_id;

  -- Get current usage
  RETURN QUERY
  SELECT
    COALESCE(rlb.request_count, 0) as current_count,
    v_limit as limit_value,
    CASE
      WHEN v_limit > 0 THEN ROUND((COALESCE(rlb.request_count, 0)::NUMERIC / v_limit::NUMERIC) * 100, 2)
      ELSE 0
    END as usage_percentage
  FROM api_rate_limit_buckets rlb
  WHERE rlb.api_key_id = p_api_key_id
    AND rlb.bucket_type = p_bucket_type
    AND rlb.bucket_timestamp = v_bucket_timestamp;

  IF NOT FOUND THEN
    RETURN QUERY SELECT 0::INTEGER, v_limit, 0::NUMERIC;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================
COMMENT ON TABLE api_keys IS 'API keys for external integrations with scoped permissions and rate limiting';
COMMENT ON TABLE api_access_log IS 'Audit log of all API requests for security and analytics';
COMMENT ON TABLE api_rate_limit_buckets IS 'Rate limit tracking buckets for API key usage monitoring';
COMMENT ON TABLE webhook_configurations IS 'Webhook configurations for event-driven integrations';
COMMENT ON TABLE webhook_deliveries IS 'Delivery tracking for outbound webhooks';
