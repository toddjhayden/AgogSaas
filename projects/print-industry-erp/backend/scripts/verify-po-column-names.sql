-- =====================================================
-- VERIFICATION SCRIPT: Purchase Order Column Names
-- =====================================================
-- REQ: REQ-PO-COLUMN-1766892755201
-- Purpose: Verify that migration V0.0.8 successfully renamed po_date to purchase_order_date
-- Expected Result: Only purchase_order_date should exist, not po_date
-- =====================================================

-- Check 1: Verify purchase_orders table has the correct column names
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'purchase_orders'
  AND column_name IN ('po_date', 'purchase_order_date')
ORDER BY column_name;

-- Expected Output:
-- column_name          | data_type | is_nullable | column_default
-- ---------------------|-----------|-------------|---------------
-- purchase_order_date  | date      | NO          | (null or default)
--
-- If 'po_date' appears in the results, the migration was NOT applied
-- If only 'purchase_order_date' appears, the migration WAS applied successfully

-- Check 2: List all date/time columns in purchase_orders table
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'purchase_orders'
  AND data_type IN ('date', 'timestamp with time zone', 'timestamp without time zone')
ORDER BY ordinal_position;

-- Check 3: Verify the index exists with correct column name
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'purchase_orders'
  AND indexname = 'idx_purchase_orders_date';

-- Expected Output should include: CREATE INDEX idx_purchase_orders_date ON public.purchase_orders USING btree (purchase_order_date)

-- Check 4: Sample data query (will fail if column doesn't exist)
-- This query should succeed if migration was applied
SELECT
    po_number,
    purchase_order_date,
    po_currency_code,
    total_amount,
    status
FROM purchase_orders
ORDER BY purchase_order_date DESC
LIMIT 5;

-- Check 5: Attempt to query old column name (should fail)
-- Uncomment to test - this SHOULD produce an error if migration was applied
-- SELECT po_date FROM purchase_orders LIMIT 1;
-- Expected Error: column "po_date" does not exist

-- =====================================================
-- SUMMARY
-- =====================================================
-- If all checks pass:
-- ✓ purchase_order_date column exists
-- ✓ po_date column does NOT exist
-- ✓ Index references purchase_order_date
-- ✓ Sample data query succeeds
-- Then migration V0.0.8 was successfully applied
-- =====================================================
