/**
 * Migration: Create GraphQL Query Complexity Tracking
 * REQ-1767925582666-3sc6l: Implement GraphQL Query Complexity Control & Security Hardening
 *
 * Creates infrastructure for tracking and analyzing GraphQL query complexity:
 * 1. Query complexity logging table
 * 2. Indexes for performance analysis
 * 3. Partitioning for efficient data management
 * 4. RLS policies for tenant isolation
 *
 * Features:
 * - Track query complexity and depth metrics
 * - Monitor execution performance
 * - Identify expensive queries for optimization
 * - Support analytics and reporting
 */

-- =====================================================
-- Table: graphql_query_complexity_log
-- Purpose: Track GraphQL query complexity metrics
-- =====================================================

CREATE TABLE IF NOT EXISTS graphql_query_complexity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Query Information
    operation_name VARCHAR(255) NOT NULL,
    operation_type VARCHAR(50), -- query, mutation, subscription

    -- Complexity Metrics
    complexity INTEGER NOT NULL,
    depth INTEGER NOT NULL,
    field_count INTEGER,
    alias_count INTEGER,

    -- Performance Metrics
    execution_time_ms INTEGER NOT NULL,

    -- User Context
    user_id UUID,
    tenant_id UUID,

    -- Network Context
    ip_address VARCHAR(45), -- IPv4 or IPv6
    user_agent TEXT,

    -- Security Flags
    was_blocked BOOLEAN DEFAULT false,
    block_reason VARCHAR(255),

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT positive_complexity CHECK (complexity >= 0),
    CONSTRAINT positive_depth CHECK (depth >= 0),
    CONSTRAINT positive_execution_time CHECK (execution_time_ms >= 0)
);

-- Add comment
COMMENT ON TABLE graphql_query_complexity_log IS 'REQ-1767925582666-3sc6l: GraphQL query complexity and performance tracking';

-- =====================================================
-- Indexes for Performance
-- =====================================================

-- Index for finding queries by user
CREATE INDEX idx_graphql_complexity_user_id
ON graphql_query_complexity_log(user_id, created_at DESC)
WHERE user_id IS NOT NULL;

-- Index for finding queries by tenant
CREATE INDEX idx_graphql_complexity_tenant_id
ON graphql_query_complexity_log(tenant_id, created_at DESC)
WHERE tenant_id IS NOT NULL;

-- Index for finding queries by operation name
CREATE INDEX idx_graphql_complexity_operation
ON graphql_query_complexity_log(operation_name, created_at DESC);

-- Index for finding expensive queries
CREATE INDEX idx_graphql_complexity_expensive
ON graphql_query_complexity_log(complexity DESC, execution_time_ms DESC, created_at DESC);

-- Index for finding blocked queries
CREATE INDEX idx_graphql_complexity_blocked
ON graphql_query_complexity_log(was_blocked, created_at DESC)
WHERE was_blocked = true;

-- Index for time-based queries (analytics)
CREATE INDEX idx_graphql_complexity_time
ON graphql_query_complexity_log(created_at DESC);

-- Composite index for tenant analytics
CREATE INDEX idx_graphql_complexity_tenant_analytics
ON graphql_query_complexity_log(tenant_id, operation_name, created_at DESC)
WHERE tenant_id IS NOT NULL;

-- =====================================================
-- Row-Level Security (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE graphql_query_complexity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own query logs
CREATE POLICY graphql_complexity_user_own
ON graphql_query_complexity_log
FOR SELECT
USING (
    user_id::TEXT = current_setting('app.current_user_id', true)
);

-- Policy: Admins can view all logs in their tenant
CREATE POLICY graphql_complexity_admin_tenant
ON graphql_query_complexity_log
FOR SELECT
USING (
    current_setting('app.current_user_role', true) IN ('admin', 'system_admin')
    AND tenant_id::TEXT = current_setting('app.current_tenant_id', true)
);

-- Policy: System admins can view all logs
CREATE POLICY graphql_complexity_system_admin
ON graphql_query_complexity_log
FOR ALL
USING (
    current_setting('app.current_user_role', true) = 'system_admin'
);

-- Policy: System can insert logs (no user context required)
CREATE POLICY graphql_complexity_system_insert
ON graphql_query_complexity_log
FOR INSERT
WITH CHECK (true);

-- =====================================================
-- Partitioning for Data Management (Optional)
-- =====================================================

-- Note: For high-volume systems, consider partitioning by created_at
-- This can be enabled later if needed:
--
-- CREATE TABLE graphql_query_complexity_log_2026_01
-- PARTITION OF graphql_query_complexity_log
-- FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- =====================================================
-- Analytics View: Query Complexity Summary
-- =====================================================

CREATE OR REPLACE VIEW graphql_query_complexity_summary AS
SELECT
    operation_name,
    operation_type,
    tenant_id,
    COUNT(*) as total_executions,
    AVG(complexity) as avg_complexity,
    MAX(complexity) as max_complexity,
    MIN(complexity) as min_complexity,
    AVG(depth) as avg_depth,
    MAX(depth) as max_depth,
    AVG(execution_time_ms) as avg_execution_time_ms,
    MAX(execution_time_ms) as max_execution_time_ms,
    COUNT(*) FILTER (WHERE was_blocked = true) as blocked_count,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY complexity) as median_complexity,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY complexity) as p95_complexity,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY complexity) as p99_complexity,
    MIN(created_at) as first_seen,
    MAX(created_at) as last_seen
FROM graphql_query_complexity_log
GROUP BY operation_name, operation_type, tenant_id;

COMMENT ON VIEW graphql_query_complexity_summary IS
'REQ-1767925582666-3sc6l: Aggregated query complexity metrics for analytics';

-- Grant select on view to authenticated users
GRANT SELECT ON graphql_query_complexity_summary TO authenticated;

-- =====================================================
-- Analytics View: Top Expensive Queries
-- =====================================================

CREATE OR REPLACE VIEW graphql_top_expensive_queries AS
SELECT
    operation_name,
    complexity,
    depth,
    execution_time_ms,
    field_count,
    alias_count,
    tenant_id,
    created_at
FROM graphql_query_complexity_log
WHERE NOT was_blocked
ORDER BY complexity DESC, execution_time_ms DESC
LIMIT 100;

COMMENT ON VIEW graphql_top_expensive_queries IS
'REQ-1767925582666-3sc6l: Top 100 most expensive GraphQL queries';

-- Grant select on view to admins
GRANT SELECT ON graphql_top_expensive_queries TO authenticated;

-- =====================================================
-- Function: Clean Old Complexity Logs
-- =====================================================

CREATE OR REPLACE FUNCTION clean_old_graphql_complexity_logs(
    retention_days INTEGER DEFAULT 90
) RETURNS TABLE(deleted_count BIGINT) AS $$
DECLARE
    v_deleted_count BIGINT;
BEGIN
    DELETE FROM graphql_query_complexity_log
    WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL;

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    RETURN QUERY SELECT v_deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION clean_old_graphql_complexity_logs IS
'REQ-1767925582666-3sc6l: Clean GraphQL complexity logs older than retention period (default 90 days)';

-- =====================================================
-- Grants
-- =====================================================

-- Grant insert to application
GRANT INSERT ON graphql_query_complexity_log TO authenticated;

-- Grant select to authenticated users (RLS will filter)
GRANT SELECT ON graphql_query_complexity_log TO authenticated;

-- Grant cleanup function to admin
GRANT EXECUTE ON FUNCTION clean_old_graphql_complexity_logs TO authenticated;
