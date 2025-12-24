-- =====================================================
-- Migration: V0.0.18 - Add Bin Optimization Triggers
-- =====================================================
-- Description: Implements automated materialized view refresh
-- Date: 2025-12-23
-- Requirement: REQ-STRATEGIC-AUTO-1766516942302
-- Addresses: CRITICAL GAP #1 from Sylvia's review
-- =====================================================

-- =====================================================
-- CRITICAL FIX #1: Automated Materialized View Refresh
-- =====================================================
-- Adds trigger-based refresh for bin_utilization_cache
-- after inventory changes
-- =====================================================

-- Trigger function for lots table
CREATE OR REPLACE FUNCTION trigger_refresh_bin_utilization_lots()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh for affected location
  PERFORM refresh_bin_utilization_for_location(
    COALESCE(NEW.location_id, OLD.location_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to lots table
DROP TRIGGER IF EXISTS after_lot_change_refresh_bin_util ON lots;
CREATE TRIGGER after_lot_change_refresh_bin_util
  AFTER INSERT OR UPDATE OR DELETE ON lots
  FOR EACH ROW
  WHEN (
    (TG_OP = 'INSERT' AND NEW.location_id IS NOT NULL) OR
    (TG_OP = 'UPDATE' AND (OLD.location_id IS DISTINCT FROM NEW.location_id OR
                           OLD.quantity_on_hand IS DISTINCT FROM NEW.quantity_on_hand)) OR
    (TG_OP = 'DELETE' AND OLD.location_id IS NOT NULL)
  )
  EXECUTE FUNCTION trigger_refresh_bin_utilization_lots();

COMMENT ON TRIGGER after_lot_change_refresh_bin_util ON lots IS
  'Auto-refresh bin_utilization_cache when lot quantities or locations change';

-- Trigger function for inventory_transactions table
CREATE OR REPLACE FUNCTION trigger_refresh_bin_utilization_transactions()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh for affected locations
  IF NEW.from_location_id IS NOT NULL THEN
    PERFORM refresh_bin_utilization_for_location(NEW.from_location_id);
  END IF;

  IF NEW.to_location_id IS NOT NULL THEN
    PERFORM refresh_bin_utilization_for_location(NEW.to_location_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to inventory_transactions
DROP TRIGGER IF EXISTS after_transaction_refresh_bin_util ON inventory_transactions;
CREATE TRIGGER after_transaction_refresh_bin_util
  AFTER INSERT ON inventory_transactions
  FOR EACH ROW
  WHEN (NEW.transaction_type IN ('RECEIVE', 'ISSUE', 'TRANSFER', 'ADJUSTMENT'))
  EXECUTE FUNCTION trigger_refresh_bin_utilization_transactions();

COMMENT ON TRIGGER after_transaction_refresh_bin_util ON inventory_transactions IS
  'Auto-refresh bin_utilization_cache when inventory moves between locations';

-- =====================================================
-- Scheduled Refresh Function (for cron jobs)
-- =====================================================
-- Recommended: Run every 10 minutes as backup
-- =====================================================

CREATE OR REPLACE FUNCTION scheduled_refresh_bin_utilization()
RETURNS void AS $$
BEGIN
  RAISE NOTICE 'Starting scheduled refresh of bin_utilization_cache at %', NOW();

  -- Refresh materialized view
  REFRESH MATERIALIZED VIEW CONCURRENTLY bin_utilization_cache;

  RAISE NOTICE 'Completed scheduled refresh of bin_utilization_cache at %', NOW();
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh bin_utilization_cache: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION scheduled_refresh_bin_utilization IS
  'Scheduled refresh for bin_utilization_cache (run every 10 minutes via cron)';

-- =====================================================
-- Cache Freshness Tracking
-- =====================================================
-- Adds tracking table for cache refresh status
-- =====================================================

CREATE TABLE IF NOT EXISTS cache_refresh_status (
  cache_name VARCHAR(100) PRIMARY KEY,
  last_refresh_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_refresh_duration_ms INTEGER,
  refresh_count INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE cache_refresh_status IS 'Tracks materialized view refresh status for monitoring';

-- Initialize status for bin_utilization_cache
INSERT INTO cache_refresh_status (cache_name, last_refresh_at)
VALUES ('bin_utilization_cache', CURRENT_TIMESTAMP)
ON CONFLICT (cache_name) DO NOTHING;

-- Update refresh function to track status
CREATE OR REPLACE FUNCTION refresh_bin_utilization_for_location(p_location_id UUID)
RETURNS void AS $$
DECLARE
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_duration_ms INTEGER;
BEGIN
  v_start_time := clock_timestamp();

  -- Refresh entire materialized view
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

-- Grant permissions
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'agogsaas_user') THEN
    GRANT SELECT ON cache_refresh_status TO agogsaas_user;
    GRANT EXECUTE ON FUNCTION scheduled_refresh_bin_utilization TO agogsaas_user;
  END IF;
END $$;

-- =====================================================
-- Migration Complete
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE 'Migration V0.0.18 completed: Bin optimization triggers added';
  RAISE NOTICE '  - Trigger on lots table for automatic refresh';
  RAISE NOTICE '  - Trigger on inventory_transactions for automatic refresh';
  RAISE NOTICE '  - Scheduled refresh function for cron jobs (every 10 min)';
  RAISE NOTICE '  - Cache freshness tracking table added';
  RAISE NOTICE '';
  RAISE NOTICE 'DEPLOYMENT NOTES:';
  RAISE NOTICE '  1. Add cron job: */10 * * * * SELECT scheduled_refresh_bin_utilization();';
  RAISE NOTICE '  2. Monitor cache age via cache_refresh_status table';
  RAISE NOTICE '  3. Alert if last_refresh_at > 15 minutes old';
END $$;
