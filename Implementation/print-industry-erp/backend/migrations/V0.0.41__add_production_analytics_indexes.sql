-- =====================================================
-- MIGRATION: V0.0.41 - Production Analytics Indexes
-- =====================================================
-- Purpose: Add covering indexes and performance optimizations for
--          Real-Time Production Analytics Dashboard queries
-- REQ: REQ-STRATEGIC-AUTO-1767048328660
-- Author: Roy (Backend Architect)
-- Date: 2025-12-29
-- =====================================================

-- =====================================================
-- PRODUCTION RUNS - Analytics Indexes
-- =====================================================

-- Covering index for active/scheduled production runs with all summary fields
-- Supports: productionRunSummaries query for active operations
CREATE INDEX IF NOT EXISTS idx_production_runs_active_summary
  ON production_runs(facility_id, work_center_id, status, scheduled_start)
  INCLUDE (
    production_run_number,
    production_order_id,
    operator_user_id,
    operator_name,
    scheduled_end,
    actual_start,
    actual_end,
    quantity_planned,
    quantity_good,
    quantity_scrap,
    quantity_rework,
    setup_time_minutes,
    run_time_minutes,
    downtime_minutes
  )
  WHERE status IN ('IN_PROGRESS', 'SCHEDULED', 'PAUSED')
    AND deleted_at IS NULL;

COMMENT ON INDEX idx_production_runs_active_summary IS
  'Covering index for active production runs dashboard queries (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for today's production aggregations
-- Supports: facility and work center summary queries
CREATE INDEX IF NOT EXISTS idx_production_runs_today_aggregation
  ON production_runs(tenant_id, facility_id, work_center_id, status)
  INCLUDE (quantity_good, quantity_scrap, quantity_rework, quantity_planned)
  WHERE actual_start >= CURRENT_DATE
    AND deleted_at IS NULL;

COMMENT ON INDEX idx_production_runs_today_aggregation IS
  'Index for today''s production aggregation queries (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for recently completed runs (last 24 hours)
-- Supports: production run summaries with recent completions
CREATE INDEX IF NOT EXISTS idx_production_runs_recent_completed
  ON production_runs(facility_id, status, actual_end DESC)
  WHERE status = 'COMPLETED'
    AND actual_end >= NOW() - INTERVAL '24 hours'
    AND deleted_at IS NULL;

COMMENT ON INDEX idx_production_runs_recent_completed IS
  'Index for recently completed production runs (REQ-STRATEGIC-AUTO-1767048328660)';

-- =====================================================
-- OEE CALCULATIONS - Trend Analysis Indexes
-- =====================================================

-- Index for current day OEE lookups by work center
-- Supports: current OEE in summary queries
CREATE INDEX IF NOT EXISTS idx_oee_current_day_work_center
  ON oee_calculations(work_center_id, calculation_date DESC, created_at DESC)
  WHERE calculation_date = CURRENT_DATE;

COMMENT ON INDEX idx_oee_current_day_work_center IS
  'Index for current day OEE lookups by work center (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for OEE trends over time ranges
-- Supports: oEETrends query with date filtering
CREATE INDEX IF NOT EXISTS idx_oee_trends_date_range
  ON oee_calculations(facility_id, work_center_id, calculation_date DESC)
  INCLUDE (
    shift,
    availability_percentage,
    performance_percentage,
    quality_percentage,
    oee_percentage,
    target_oee_percentage
  )
  WHERE calculation_date >= CURRENT_DATE - INTERVAL '30 days';

COMMENT ON INDEX idx_oee_trends_date_range IS
  'Index for OEE trend queries over date ranges (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for low OEE alerts
-- Supports: productionAlerts query for OEE warnings
CREATE INDEX IF NOT EXISTS idx_oee_low_performance_alerts
  ON oee_calculations(tenant_id, facility_id, oee_percentage)
  WHERE calculation_date = CURRENT_DATE
    AND oee_percentage < target_oee_percentage * 0.9;

COMMENT ON INDEX idx_oee_low_performance_alerts IS
  'Index for identifying low OEE performance for alerts (REQ-STRATEGIC-AUTO-1767048328660)';

-- =====================================================
-- EQUIPMENT STATUS LOG - Real-Time Status Indexes
-- =====================================================

-- Index for current equipment status (no end time = currently active)
-- Supports: workCenterUtilization query for current status
CREATE INDEX IF NOT EXISTS idx_equipment_status_current
  ON equipment_status_log(work_center_id, status_start DESC)
  WHERE status_end IS NULL;

COMMENT ON INDEX idx_equipment_status_current IS
  'Index for current equipment status (no end time) (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for equipment downtime alerts
-- Supports: productionAlerts query for equipment down alerts
CREATE INDEX IF NOT EXISTS idx_equipment_status_breakdown_active
  ON equipment_status_log(tenant_id, facility_id, status_start DESC)
  WHERE status LIKE 'NON_PRODUCTIVE_BREAKDOWN%'
    AND status_end IS NULL;

COMMENT ON INDEX idx_equipment_status_breakdown_active IS
  'Index for active equipment breakdown alerts (REQ-STRATEGIC-AUTO-1767048328660)';

-- =====================================================
-- WORK CENTERS - Dashboard Status Indexes
-- =====================================================

-- Index for active work centers by facility
-- Supports: workCenterUtilization query
CREATE INDEX IF NOT EXISTS idx_work_centers_active_facility
  ON work_centers(tenant_id, facility_id, work_center_code)
  INCLUDE (
    work_center_name,
    work_center_type,
    status
  )
  WHERE is_active = true
    AND deleted_at IS NULL;

COMMENT ON INDEX idx_work_centers_active_facility IS
  'Index for active work centers dashboard queries (REQ-STRATEGIC-AUTO-1767048328660)';

-- =====================================================
-- COMPOSITE QUERY PERFORMANCE STATISTICS
-- =====================================================

-- Create statistics for better query planning on composite columns
ANALYZE production_runs;
ANALYZE oee_calculations;
ANALYZE equipment_status_log;
ANALYZE work_centers;

-- =====================================================
-- PERFORMANCE VALIDATION
-- =====================================================

-- The following queries should now use the new indexes efficiently:
--
-- 1. Facility Summary (productionSummary):
--    Uses: idx_production_runs_today_aggregation
--    Expected: <10ms for facilities with <1000 runs/day
--
-- 2. Work Center Summaries (workCenterSummaries):
--    Uses: idx_production_runs_today_aggregation, idx_oee_current_day_work_center
--    Expected: <20ms for facilities with <50 work centers
--
-- 3. Production Run Summaries (productionRunSummaries):
--    Uses: idx_production_runs_active_summary, idx_production_runs_recent_completed
--    Expected: <15ms for <500 active+recent runs
--
-- 4. OEE Trends (oEETrends):
--    Uses: idx_oee_trends_date_range
--    Expected: <25ms for 30 days of data across <50 work centers
--
-- 5. Work Center Utilization (workCenterUtilization):
--    Uses: idx_work_centers_active_facility, idx_production_runs_today_aggregation,
--          idx_equipment_status_current, idx_oee_current_day_work_center
--    Expected: <30ms for <50 work centers
--
-- 6. Production Alerts (productionAlerts):
--    Uses: idx_oee_low_performance_alerts, idx_equipment_status_breakdown_active
--    Expected: <20ms for typical alert volumes

-- =====================================================
-- MIGRATION VALIDATION
-- =====================================================

-- Verify all indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%analytics%'
   OR indexname LIKE 'idx_production_runs_active_summary'
   OR indexname LIKE 'idx_production_runs_today_aggregation'
   OR indexname LIKE 'idx_oee_%'
   OR indexname LIKE 'idx_equipment_status_%'
   OR indexname LIKE 'idx_work_centers_active_facility'
ORDER BY tablename, indexname;

-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'idx_%analytics%'
   OR indexrelname LIKE 'idx_production_runs_active_summary'
   OR indexrelname LIKE 'idx_production_runs_today_aggregation'
   OR indexrelname LIKE 'idx_oee_%'
   OR indexrelname LIKE 'idx_equipment_status_%'
   OR indexrelname LIKE 'idx_work_centers_active_facility'
ORDER BY pg_relation_size(indexrelid) DESC;

-- =====================================================
-- NOTES FOR FUTURE OPTIMIZATION
-- =====================================================

-- If query performance degrades at scale, consider:
--
-- 1. MATERIALIZED VIEW for facility summaries (refresh every 1 minute):
--    - Reduces real-time query load
--    - Trade-off: 60-second data latency acceptable per Sylvia's critique
--
-- 2. PARTITIONING production_runs by month:
--    - Improves query performance for historical data
--    - Simplifies data archival
--
-- 3. READ REPLICAS for analytics queries:
--    - Offload dashboard queries from primary database
--    - Requires connection pooling and routing strategy
--
-- 4. REDIS CACHING for facility-level summaries:
--    - Cache invalidation on production run updates
--    - Requires NATS event integration
--
-- All optimizations should be data-driven based on actual production metrics.

-- =====================================================
-- END OF MIGRATION
-- =====================================================
