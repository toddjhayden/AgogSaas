-- =====================================================
-- MIGRATION: V0.0.41 - Production Analytics Indexes (FIXED)
-- =====================================================
-- Purpose: Add covering indexes and performance optimizations for
--          Real-Time Production Analytics Dashboard queries
-- REQ: REQ-STRATEGIC-AUTO-1767048328660
-- Author: Berry (DevOps Engineer)
-- Date: 2025-12-29
-- Note: Fixed for actual schema (no deleted_at columns, adjusted WHERE clauses)
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
  WHERE status IN ('IN_PROGRESS', 'SCHEDULED', 'PAUSED');

COMMENT ON INDEX idx_production_runs_active_summary IS
  'Covering index for active production runs dashboard queries (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for today's production aggregations
-- Supports: facility and work center summary queries
CREATE INDEX IF NOT EXISTS idx_production_runs_today_aggregation
  ON production_runs(tenant_id, facility_id, work_center_id, status)
  INCLUDE (quantity_good, quantity_scrap, quantity_rework, quantity_planned)
  WHERE actual_start >= CURRENT_DATE::timestamp with time zone;

COMMENT ON INDEX idx_production_runs_today_aggregation IS
  'Index for today''s production aggregation queries (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for recently completed runs (last 24 hours)
-- Supports: production run summaries with recent completions
CREATE INDEX IF NOT EXISTS idx_production_runs_recent_completed
  ON production_runs(facility_id, status, actual_end DESC)
  WHERE status = 'COMPLETED'
    AND actual_end >= (NOW() - INTERVAL '24 hours');

COMMENT ON INDEX idx_production_runs_recent_completed IS
  'Index for recently completed production runs (REQ-STRATEGIC-AUTO-1767048328660)';

-- =====================================================
-- OEE CALCULATIONS - Trend Analysis Indexes
-- =====================================================

-- Index for current day OEE lookups by work center
-- Supports: current OEE in summary queries
-- Using expression index to avoid IMMUTABLE function issue
CREATE INDEX IF NOT EXISTS idx_oee_current_day_work_center
  ON oee_calculations(work_center_id, calculation_date DESC, created_at DESC);

COMMENT ON INDEX idx_oee_current_day_work_center IS
  'Index for current day OEE lookups by work center (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for OEE trends over time ranges (last 30 days)
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
  );

COMMENT ON INDEX idx_oee_trends_date_range IS
  'Index for OEE trend queries over date ranges (REQ-STRATEGIC-AUTO-1767048328660)';

-- Index for low OEE alerts
-- Supports: productionAlerts query for OEE warnings
-- Simplified without dynamic WHERE clause
CREATE INDEX IF NOT EXISTS idx_oee_low_performance_alerts
  ON oee_calculations(tenant_id, facility_id, calculation_date DESC, oee_percentage);

COMMENT ON INDEX idx_oee_low_performance_alerts IS
  'Index for identifying low OEE performance for alerts (REQ-STRATEGIC-AUTO-1767048328660)';

-- =====================================================
-- EQUIPMENT STATUS LOG - Real-Time Status Indexes
-- =====================================================

-- Note: idx_equipment_status_current and idx_equipment_status_breakdown_active
-- were already created in the previous execution

-- =====================================================
-- WORK CENTERS - Dashboard Status Indexes
-- =====================================================

-- Note: idx_work_centers_active_facility was already created

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

-- Verify all indexes were created
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND (
    indexname LIKE 'idx_production_runs_active_summary'
    OR indexname LIKE 'idx_production_runs_today_aggregation'
    OR indexname LIKE 'idx_production_runs_recent_completed'
    OR indexname LIKE 'idx_oee_%'
    OR indexname LIKE 'idx_equipment_status_%'
    OR indexname LIKE 'idx_work_centers_active_facility'
  )
ORDER BY tablename, indexname;

-- Check index sizes
SELECT
  schemaname,
  tablename,
  indexrelname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND (
    indexrelname LIKE 'idx_production_runs_active_summary'
    OR indexrelname LIKE 'idx_production_runs_today_aggregation'
    OR indexrelname LIKE 'idx_production_runs_recent_completed'
    OR indexrelname LIKE 'idx_oee_%'
    OR indexrelname LIKE 'idx_equipment_status_%'
    OR indexrelname LIKE 'idx_work_centers_active_facility'
  )
ORDER BY pg_relation_size(indexrelid) DESC;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
