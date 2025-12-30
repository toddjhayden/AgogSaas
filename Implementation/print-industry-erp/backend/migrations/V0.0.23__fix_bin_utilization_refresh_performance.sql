-- =====================================================
-- FLYWAY MIGRATION V0.0.23
-- =====================================================
-- Purpose: Fix materialized view refresh performance issue
-- REQ-STRATEGIC-AUTO-1766527796497: Production Blocker #2
--
-- PROBLEM: refresh_bin_utilization_for_location() ignores location_id parameter
--          and always performs full REFRESH MATERIALIZED VIEW CONCURRENTLY
--          This causes performance cliff at scale (50-minute refresh at 10K bins)
--
-- SOLUTION: Implement rate-limited refresh (Option B from Sylvia's critique)
--          Only refresh if last refresh was > 5 minutes ago
--          Prevents excessive full refreshes on high-volume receiving
--
-- Created: 2025-12-24
-- =====================================================

-- =====================================================
-- Drop old refresh function
-- =====================================================

DROP FUNCTION IF EXISTS refresh_bin_utilization_for_location(UUID);

-- =====================================================
-- Create new rate-limited refresh function
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_bin_utilization_for_location(p_location_id UUID)
RETURNS void AS $$
DECLARE
  v_last_refresh TIMESTAMP;
  v_min_interval INTERVAL := '5 minutes';
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_duration_ms INTEGER;
BEGIN
  -- Check last refresh time
  SELECT last_refresh_at INTO v_last_refresh
  FROM cache_refresh_status
  WHERE cache_name = 'bin_utilization_cache';

  -- Only refresh if stale or never refreshed
  IF v_last_refresh IS NULL OR (CURRENT_TIMESTAMP - v_last_refresh) > v_min_interval THEN
    v_start_time := clock_timestamp();

    -- Perform full refresh
    REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;

    v_end_time := clock_timestamp();
    v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

    -- Update tracking
    UPDATE cache_refresh_status
    SET
      last_refresh_at = v_end_time,
      last_refresh_duration_ms = v_duration_ms,
      refresh_count = refresh_count + 1,
      updated_at = v_end_time
    WHERE cache_name = 'bin_utilization_cache';

    RAISE NOTICE 'Refreshed bin_utilization_cache in % ms (triggered by location %)',
      v_duration_ms, p_location_id;
  ELSE
    -- Skip refresh - too recent
    RAISE NOTICE 'Skipping bin_utilization_cache refresh (last refresh % ago, min interval %)',
      CURRENT_TIMESTAMP - v_last_refresh, v_min_interval;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    UPDATE cache_refresh_status
    SET
      last_error = SQLERRM,
      last_error_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE cache_name = 'bin_utilization_cache';

    RAISE WARNING 'Failed to refresh bin_utilization_cache for location %: %', p_location_id, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Create manual full refresh function (for admin use)
-- =====================================================

CREATE OR REPLACE FUNCTION force_refresh_bin_utilization_cache()
RETURNS TABLE (
  duration_ms INTEGER,
  row_count BIGINT,
  status TEXT
) AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_duration_ms INTEGER;
  v_row_count BIGINT;
BEGIN
  v_start_time := clock_timestamp();

  -- Force full refresh
  REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;

  v_end_time := clock_timestamp();
  v_duration_ms := EXTRACT(EPOCH FROM (v_end_time - v_start_time)) * 1000;

  -- Count rows
  SELECT COUNT(*) INTO v_row_count FROM bin_utilization_cache;

  -- Update tracking
  UPDATE cache_refresh_status
  SET
    last_refresh_at = v_end_time,
    last_refresh_duration_ms = v_duration_ms,
    refresh_count = refresh_count + 1,
    updated_at = v_end_time
  WHERE cache_name = 'bin_utilization_cache';

  RETURN QUERY SELECT v_duration_ms, v_row_count, 'SUCCESS'::TEXT;

EXCEPTION
  WHEN OTHERS THEN
    -- Log error
    UPDATE cache_refresh_status
    SET
      last_error = SQLERRM,
      last_error_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE cache_name = 'bin_utilization_cache';

    RETURN QUERY SELECT 0, 0::BIGINT, ('ERROR: ' || SQLERRM)::TEXT;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- Grant permissions
-- =====================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    GRANT EXECUTE ON FUNCTION refresh_bin_utilization_for_location TO agogsaas_user;
    GRANT EXECUTE ON FUNCTION force_refresh_bin_utilization_cache TO agogsaas_user;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.23 completed: Bin utilization refresh performance fixed';
  RAISE NOTICE '  - Rate-limited refresh: 5-minute minimum interval';
  RAISE NOTICE '  - Prevents performance cliff on high-volume receiving';
  RAISE NOTICE '  - Admin function: SELECT * FROM force_refresh_bin_utilization_cache()';
  RAISE NOTICE '  - Expected impact: 10-20× reduction in refresh operations';
END $$;
