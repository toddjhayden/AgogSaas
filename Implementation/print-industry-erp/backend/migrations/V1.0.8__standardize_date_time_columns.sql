-- V1.0.8__standardize_date_time_columns.sql
-- Purpose: Standardize date and timestamp column naming for OLAP semantic consistency
-- Author: Claude Code (Dimensional Model Remediation - Phase 1 Week 1)
-- Date: 2025-12-17
--
-- Context: OLAP requirements drive OLTP schema design. Column names must have
-- ONE meaning across the enterprise to enable dimensional modeling.
--
-- Changes:
-- 1. Rename date columns to use <event>_date pattern for semantic clarity
-- 2. Rename timestamp columns to use <event>_timestamp pattern (not _time)
-- 3. Maintain audit trail with created_at/updated_at (keep _at suffix)

-- =============================================================================
-- CRITICAL DATE COLUMN RENAMES
-- =============================================================================

-- Fix 1: purchase_orders.po_date → purchase_order_date
-- Reason: Consistency with sales_orders.order_date, semantic clarity in OLAP
ALTER TABLE purchase_orders
RENAME COLUMN po_date TO purchase_order_date;

COMMENT ON COLUMN purchase_orders.purchase_order_date IS
'Date the purchase order was placed with the vendor. Conforms to <event>_date naming standard.';

-- Fix 2: shipments.ship_date → shipment_date
-- Reason: Consistent with invoice_date, production_date, etc.
ALTER TABLE shipments
RENAME COLUMN ship_date TO shipment_date;

COMMENT ON COLUMN shipments.shipment_date IS
'Date the shipment was sent to the customer. Conforms to <event>_date naming standard.';

-- Fix 3: production_orders.order_date → production_order_date
-- Reason: Disambiguate from sales_orders.order_date in dimensional model
ALTER TABLE production_orders
RENAME COLUMN order_date TO production_order_date;

COMMENT ON COLUMN production_orders.production_order_date IS
'Date the production order was created. Distinct from sales_orders.order_date for OLAP clarity.';

-- =============================================================================
-- TIMESTAMP COLUMN RENAMES (TIMESTAMPTZ should use _timestamp, not _time)
-- =============================================================================

-- Fix 4: production_runs.run_start_time → start_timestamp
-- Fix 5: production_runs.run_end_time → end_timestamp
-- Reason: TIMESTAMPTZ columns should use _timestamp suffix, not _time
-- Note: _time suffix is reserved for TIME type (time-of-day without date)
ALTER TABLE production_runs
RENAME COLUMN run_start_time TO start_timestamp;

ALTER TABLE production_runs
RENAME COLUMN run_end_time TO end_timestamp;

COMMENT ON COLUMN production_runs.start_timestamp IS
'Precise timestamp when production run started (TIMESTAMPTZ). Uses _timestamp suffix per naming standard.';

COMMENT ON COLUMN production_runs.end_timestamp IS
'Precise timestamp when production run completed (TIMESTAMPTZ). Uses _timestamp suffix per naming standard.';

-- Fix 6: labor_tracking.start_time → start_timestamp
-- Fix 7: labor_tracking.end_time → end_timestamp
ALTER TABLE labor_tracking
RENAME COLUMN start_time TO start_timestamp;

ALTER TABLE labor_tracking
RENAME COLUMN end_time TO end_timestamp;

COMMENT ON COLUMN labor_tracking.start_timestamp IS
'Precise timestamp when labor activity started (TIMESTAMPTZ). Uses _timestamp suffix per naming standard.';

COMMENT ON COLUMN labor_tracking.end_timestamp IS
'Precise timestamp when labor activity ended (TIMESTAMPTZ). Uses _timestamp suffix per naming standard.';

-- Fix 8: timecards.clock_in → clock_in_timestamp
-- Fix 9: timecards.clock_out → clock_out_timestamp
ALTER TABLE timecards
RENAME COLUMN clock_in TO clock_in_timestamp;

ALTER TABLE timecards
RENAME COLUMN clock_out TO clock_out_timestamp;

COMMENT ON COLUMN timecards.clock_in_timestamp IS
'Precise timestamp when employee clocked in (TIMESTAMPTZ). Uses _timestamp suffix per naming standard.';

COMMENT ON COLUMN timecards.clock_out_timestamp IS
'Precise timestamp when employee clocked out (TIMESTAMPTZ). Uses _timestamp suffix per naming standard.';

-- =============================================================================
-- VERIFICATION QUERIES (commented out - for reference)
-- =============================================================================

-- Verify date columns follow <event>_date pattern:
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND data_type = 'date'
--   AND column_name NOT LIKE '%_date'
--   AND column_name NOT IN ('created_at', 'updated_at', 'deleted_at');

-- Verify TIMESTAMPTZ columns use _timestamp or _at (not _time):
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND data_type = 'timestamp with time zone'
--   AND column_name NOT LIKE '%_timestamp'
--   AND column_name NOT LIKE '%_at';

-- =============================================================================
-- DIMENSIONAL MODEL IMPACT
-- =============================================================================

-- These changes enable:
-- 1. Semantic consistency across OLTP → OLAP ETL
-- 2. Unambiguous column names in dimensional model (Bus Matrix)
-- 3. Query clarity: "purchase_order_date" vs "sales_order.order_date"
-- 4. Proper type-based naming: _date (DATE), _timestamp (TIMESTAMPTZ), _time (TIME)

-- Next Phase: V2.0.1 will standardize quantity/amount columns
-- Next Phase: V2.0.2 will add SCD Type 2 tracking (effective_from_date, effective_to_date, is_current_version)
