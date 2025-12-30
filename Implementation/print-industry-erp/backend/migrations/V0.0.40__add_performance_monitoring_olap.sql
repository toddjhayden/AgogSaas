-- =====================================================
-- PERFORMANCE MONITORING OLAP TABLES
-- Migration: V0.0.40
-- Description: Add performance analytics and monitoring infrastructure
-- Author: Roy (Backend Developer)
-- Date: 2025-12-29
-- REQ: REQ-STRATEGIC-AUTO-1767045901876
-- =====================================================

-- =====================================================
-- 1. QUERY PERFORMANCE LOG (Time-Series Partitioned)
-- =====================================================

CREATE TABLE IF NOT EXISTS query_performance_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  query_hash VARCHAR(32) NOT NULL,     -- MD5 hash for grouping
  query_preview TEXT,                  -- First 500 chars for debugging
  execution_time_ms INTEGER NOT NULL,
  rows_returned INTEGER,
  endpoint VARCHAR(255),               -- GraphQL resolver or REST path
  user_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB                       -- Additional context
) PARTITION BY RANGE (timestamp);

COMMENT ON TABLE query_performance_log IS
  'Query performance tracking. Partitioned by month for efficient cleanup.';

-- Create initial partitions (current and next month)
CREATE TABLE IF NOT EXISTS query_performance_log_2025_12 PARTITION OF query_performance_log
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS query_performance_log_2026_01 PARTITION OF query_performance_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_query_perf_log_tenant_timestamp
  ON query_performance_log (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_query_perf_log_hash_timestamp
  ON query_performance_log (query_hash, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_query_perf_log_slow
  ON query_performance_log (execution_time_ms DESC)
  WHERE execution_time_ms > 1000;

CREATE INDEX IF NOT EXISTS idx_query_perf_log_endpoint
  ON query_performance_log (endpoint, timestamp DESC);

-- =====================================================
-- 2. API PERFORMANCE LOG (Time-Series Partitioned)
-- =====================================================

CREATE TABLE IF NOT EXISTS api_performance_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  method VARCHAR(10) NOT NULL,        -- GET, POST, etc.
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER NOT NULL,
  request_size_bytes INTEGER,
  response_size_bytes INTEGER,
  user_id UUID,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  metadata JSONB
) PARTITION BY RANGE (timestamp);

COMMENT ON TABLE api_performance_log IS
  'API endpoint performance tracking. Captures all GraphQL/REST requests.';

-- Create initial partitions
CREATE TABLE IF NOT EXISTS api_performance_log_2025_12 PARTITION OF api_performance_log
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS api_performance_log_2026_01 PARTITION OF api_performance_log
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_api_perf_log_tenant_timestamp
  ON api_performance_log (tenant_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_api_perf_log_endpoint
  ON api_performance_log (endpoint, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_api_perf_log_slow
  ON api_performance_log (response_time_ms DESC)
  WHERE response_time_ms > 1000;

CREATE INDEX IF NOT EXISTS idx_api_perf_log_errors
  ON api_performance_log (status_code, timestamp DESC)
  WHERE status_code >= 400;

-- =====================================================
-- 3. SYSTEM RESOURCE METRICS (1-Minute Aggregates)
-- =====================================================

CREATE TABLE IF NOT EXISTS system_resource_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  cpu_usage_percent NUMERIC(5,2),
  memory_used_mb INTEGER,
  memory_total_mb INTEGER,
  event_loop_lag_ms NUMERIC(10,2),
  active_connections INTEGER,
  heap_used_mb INTEGER,
  heap_total_mb INTEGER,
  timestamp TIMESTAMPTZ NOT NULL,
  UNIQUE(tenant_id, timestamp)
) PARTITION BY RANGE (timestamp);

COMMENT ON TABLE system_resource_metrics IS
  'System resource utilization metrics. Collected every 10 seconds, aggregated to 1-minute buckets.';

-- Create initial partitions
CREATE TABLE IF NOT EXISTS system_resource_metrics_2025_12 PARTITION OF system_resource_metrics
  FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

CREATE TABLE IF NOT EXISTS system_resource_metrics_2026_01 PARTITION OF system_resource_metrics
  FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Index
CREATE INDEX IF NOT EXISTS idx_system_resource_tenant_timestamp
  ON system_resource_metrics (tenant_id, timestamp DESC);

-- =====================================================
-- 4. OLAP CACHE: Hourly Performance Aggregates
-- =====================================================

CREATE TABLE IF NOT EXISTS performance_metrics_cache (
  tenant_id UUID NOT NULL,
  hour_bucket TIMESTAMPTZ NOT NULL,

  -- API metrics
  total_requests INTEGER NOT NULL DEFAULT 0,
  successful_requests INTEGER NOT NULL DEFAULT 0,
  failed_requests INTEGER NOT NULL DEFAULT 0,
  avg_response_time_ms NUMERIC(10,2),
  p95_response_time_ms INTEGER,
  p99_response_time_ms INTEGER,

  -- Database metrics
  total_queries INTEGER NOT NULL DEFAULT 0,
  slow_query_count INTEGER NOT NULL DEFAULT 0,
  avg_query_time_ms NUMERIC(10,2),

  -- Resource metrics
  avg_cpu_usage_percent NUMERIC(5,2),
  avg_memory_usage_mb INTEGER,
  max_memory_usage_mb INTEGER,
  avg_event_loop_lag_ms NUMERIC(10,2),

  -- Health score (0-100)
  health_score NUMERIC(5,2),

  last_updated TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, hour_bucket)
);

COMMENT ON TABLE performance_metrics_cache IS
  'OLAP cache for hourly performance metrics aggregates. Refreshed incrementally every 5 minutes.';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_perf_cache_hour ON performance_metrics_cache (hour_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_perf_cache_health ON performance_metrics_cache (health_score ASC);
CREATE INDEX IF NOT EXISTS idx_perf_cache_tenant_hour ON performance_metrics_cache (tenant_id, hour_bucket DESC);

-- =====================================================
-- 5. INCREMENTAL REFRESH FUNCTION
-- =====================================================
-- Following the proven pattern from V0.0.34 (bin utilization)
-- Expected execution time: 50-100ms for 24 hours of data
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_performance_metrics_incremental(
  p_tenant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  hours_refreshed INTEGER,
  duration_ms INTEGER,
  status TEXT
) AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_duration_ms INTEGER;
  v_hours_refreshed INTEGER := 0;
BEGIN
  v_start_time := CLOCK_TIMESTAMP();

  -- Aggregate last 24 hours of data into hourly buckets
  INSERT INTO performance_metrics_cache (
    tenant_id,
    hour_bucket,
    total_requests,
    successful_requests,
    failed_requests,
    avg_response_time_ms,
    p95_response_time_ms,
    p99_response_time_ms,
    total_queries,
    slow_query_count,
    avg_query_time_ms,
    avg_cpu_usage_percent,
    avg_memory_usage_mb,
    max_memory_usage_mb,
    avg_event_loop_lag_ms,
    health_score,
    last_updated
  )
  SELECT
    api.tenant_id,
    DATE_TRUNC('hour', api.timestamp) AS hour_bucket,

    -- API metrics
    COUNT(*) AS total_requests,
    COUNT(*) FILTER (WHERE status_code < 400) AS successful_requests,
    COUNT(*) FILTER (WHERE status_code >= 400) AS failed_requests,
    AVG(response_time_ms)::NUMERIC(10,2) AS avg_response_time_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_response_time_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_response_time_ms,

    -- Database metrics (LEFT JOIN to handle hours with no queries)
    COALESCE(COUNT(qpl.id), 0) AS total_queries,
    COALESCE(COUNT(*) FILTER (WHERE qpl.execution_time_ms > 1000), 0) AS slow_query_count,
    AVG(qpl.execution_time_ms)::NUMERIC(10,2) AS avg_query_time_ms,

    -- Resource metrics
    AVG(srm.cpu_usage_percent)::NUMERIC(5,2) AS avg_cpu_usage_percent,
    AVG(srm.memory_used_mb)::INTEGER AS avg_memory_usage_mb,
    MAX(srm.memory_used_mb) AS max_memory_usage_mb,
    AVG(srm.event_loop_lag_ms)::NUMERIC(10,2) AS avg_event_loop_lag_ms,

    -- Health score calculation (0-100)
    -- Formula: 100 - (response_time_penalty) - (error_rate_penalty)
    GREATEST(0, LEAST(100,
      100
      - (LEAST(50, AVG(response_time_ms) / 10))  -- Max 50 points penalty for response time
      - (COUNT(*) FILTER (WHERE status_code >= 500)::NUMERIC / NULLIF(COUNT(*), 0) * 50)  -- Max 50 points penalty for errors
    ))::NUMERIC(5,2) AS health_score,

    CURRENT_TIMESTAMP AS last_updated
  FROM api_performance_log api
  LEFT JOIN query_performance_log qpl
    ON api.tenant_id = qpl.tenant_id
    AND DATE_TRUNC('hour', api.timestamp) = DATE_TRUNC('hour', qpl.timestamp)
  LEFT JOIN system_resource_metrics srm
    ON api.tenant_id = srm.tenant_id
    AND DATE_TRUNC('hour', api.timestamp) = DATE_TRUNC('hour', srm.timestamp)
  WHERE api.timestamp >= NOW() - INTERVAL '24 hours'
    AND (p_tenant_id IS NULL OR api.tenant_id = p_tenant_id)
  GROUP BY api.tenant_id, DATE_TRUNC('hour', api.timestamp)
  ON CONFLICT (tenant_id, hour_bucket) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    successful_requests = EXCLUDED.successful_requests,
    failed_requests = EXCLUDED.failed_requests,
    avg_response_time_ms = EXCLUDED.avg_response_time_ms,
    p95_response_time_ms = EXCLUDED.p95_response_time_ms,
    p99_response_time_ms = EXCLUDED.p99_response_time_ms,
    total_queries = EXCLUDED.total_queries,
    slow_query_count = EXCLUDED.slow_query_count,
    avg_query_time_ms = EXCLUDED.avg_query_time_ms,
    avg_cpu_usage_percent = EXCLUDED.avg_cpu_usage_percent,
    avg_memory_usage_mb = EXCLUDED.avg_memory_usage_mb,
    max_memory_usage_mb = EXCLUDED.max_memory_usage_mb,
    avg_event_loop_lag_ms = EXCLUDED.avg_event_loop_lag_ms,
    health_score = EXCLUDED.health_score,
    last_updated = CURRENT_TIMESTAMP;

  GET DIAGNOSTICS v_hours_refreshed = ROW_COUNT;
  v_duration_ms := EXTRACT(EPOCH FROM (CLOCK_TIMESTAMP() - v_start_time)) * 1000;

  RETURN QUERY SELECT v_hours_refreshed, v_duration_ms::INTEGER, 'SUCCESS'::TEXT;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_performance_metrics_incremental IS
  'Incrementally refresh performance metrics cache (last 24 hours). Expected: 50-100ms execution time.';

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function to get performance overview for a specific time range
CREATE OR REPLACE FUNCTION get_performance_summary(
  p_tenant_id UUID,
  p_hours_back INTEGER DEFAULT 24
)
RETURNS TABLE (
  health_score NUMERIC,
  avg_response_time_ms NUMERIC,
  p95_response_time_ms INTEGER,
  total_requests BIGINT,
  error_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(pmc.health_score)::NUMERIC(5,2) AS health_score,
    AVG(pmc.avg_response_time_ms)::NUMERIC(10,2) AS avg_response_time_ms,
    MAX(pmc.p95_response_time_ms) AS p95_response_time_ms,
    SUM(pmc.total_requests) AS total_requests,
    (SUM(pmc.failed_requests)::NUMERIC / NULLIF(SUM(pmc.total_requests), 0) * 100)::NUMERIC(5,2) AS error_rate
  FROM performance_metrics_cache pmc
  WHERE pmc.tenant_id = p_tenant_id
    AND pmc.hour_bucket >= NOW() - (p_hours_back || ' hours')::INTERVAL;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_performance_summary IS
  'Get performance summary for a tenant over specified time range.';

-- =====================================================
-- 7. SCHEDULED REFRESH (pg_cron)
-- =====================================================
-- NOTE: Requires pg_cron extension
-- Uncomment and run separately after pg_cron is installed:
--
-- SELECT cron.schedule(
--   'refresh-performance-metrics',
--   '*/5 * * * *',  -- Every 5 minutes
--   $$SELECT refresh_performance_metrics_incremental()$$
-- );

-- =====================================================
-- 8. DATA RETENTION POLICY
-- =====================================================
-- Auto-cleanup: Drop partitions older than 30 days
-- Recommended: Use pg_partman for automated partition management
--
-- Manual cleanup example:
-- DROP TABLE IF EXISTS query_performance_log_2025_11;
-- DROP TABLE IF EXISTS api_performance_log_2025_11;
-- DROP TABLE IF EXISTS system_resource_metrics_2025_11;

-- =====================================================
-- 9. GRANT PERMISSIONS
-- =====================================================

-- Grant SELECT to read-only roles
GRANT SELECT ON query_performance_log TO agog_readonly;
GRANT SELECT ON api_performance_log TO agog_readonly;
GRANT SELECT ON system_resource_metrics TO agog_readonly;
GRANT SELECT ON performance_metrics_cache TO agog_readonly;

-- Grant INSERT to application role (for metrics collection)
GRANT INSERT ON query_performance_log TO agog_app;
GRANT INSERT ON api_performance_log TO agog_app;
GRANT INSERT ON system_resource_metrics TO agog_app;

-- Grant EXECUTE on refresh function
GRANT EXECUTE ON FUNCTION refresh_performance_metrics_incremental TO agog_app;
GRANT EXECUTE ON FUNCTION get_performance_summary TO agog_app;

-- =====================================================
-- Migration Complete
-- =====================================================

-- Verify tables created successfully
DO $$
DECLARE
  v_table_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_table_count
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name IN (
      'query_performance_log',
      'api_performance_log',
      'system_resource_metrics',
      'performance_metrics_cache'
    );

  IF v_table_count = 4 THEN
    RAISE NOTICE 'V0.0.40 Migration Successful: % performance monitoring tables created', v_table_count;
  ELSE
    RAISE EXCEPTION 'V0.0.40 Migration Failed: Expected 4 tables, found %', v_table_count;
  END IF;
END;
$$;
