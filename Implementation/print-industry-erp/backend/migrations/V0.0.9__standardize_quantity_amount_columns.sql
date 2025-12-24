-- V1.0.9__standardize_quantity_amount_columns.sql
-- Purpose: Standardize quantity and amount column naming for OLAP semantic consistency
-- Author: Claude Code (Dimensional Model Remediation - Phase 1 Week 2)
-- Date: 2025-12-17
--
-- Context: Generic "quantity" and "amount" columns create semantic ambiguity in dimensional
-- modeling. Business intelligence requires specific context (quantity_ordered vs quantity_shipped,
-- debit_amount vs credit_amount) to enable meaningful aggregation and analysis.
--
-- Changes:
-- 1. Rename generic "quantity" columns to specify context (quantity_quoted, quantity_planned, etc.)
-- 2. Split journal_entry_lines.amount into debit_amount and credit_amount
-- 3. Rename generic "amount" columns to include context (payment_amount)

-- =============================================================================
-- CRITICAL QUANTITY COLUMN RENAMES
-- =============================================================================

-- Fix 1: quote_lines.quantity → quantity_quoted
-- Reason: Distinguish from quantity_ordered, quantity_shipped in dimensional model
ALTER TABLE quote_lines
RENAME COLUMN quantity TO quantity_quoted;

COMMENT ON COLUMN quote_lines.quantity_quoted IS
'Quantity quoted to customer. Conforms to quantity_<context> naming standard for OLAP clarity.';

-- Fix 2: lots.current_quantity → quantity_on_hand
-- Fix 3: lots.available_quantity → quantity_available
-- Fix 4: lots.allocated_quantity → quantity_allocated
-- Reason: Standardize inventory quantity naming for dimensional analysis
ALTER TABLE lots
RENAME COLUMN current_quantity TO quantity_on_hand;

ALTER TABLE lots
RENAME COLUMN available_quantity TO quantity_available;

ALTER TABLE lots
RENAME COLUMN allocated_quantity TO quantity_allocated;

COMMENT ON COLUMN lots.quantity_on_hand IS
'Current physical quantity in this lot. Conforms to quantity_<context> naming standard.';

COMMENT ON COLUMN lots.quantity_available IS
'Quantity available for allocation (on_hand - allocated). Conforms to quantity_<context> naming standard.';

COMMENT ON COLUMN lots.quantity_allocated IS
'Quantity reserved/allocated to orders. Conforms to quantity_<context> naming standard.';

-- Fix 5: marketplace_job_postings.quantity → quantity_required
-- Reason: Clarify this is required quantity for the job posting
ALTER TABLE marketplace_job_postings
RENAME COLUMN quantity TO quantity_required;

COMMENT ON COLUMN marketplace_job_postings.quantity_required IS
'Quantity required for this job posting. Conforms to quantity_<context> naming standard.';

-- Fix 6: external_company_orders.quantity → quantity_ordered
-- Reason: Consistency with sales_order_lines.quantity_ordered
ALTER TABLE external_company_orders
RENAME COLUMN quantity TO quantity_ordered;

COMMENT ON COLUMN external_company_orders.quantity_ordered IS
'Quantity ordered from external company. Conforms to quantity_<context> naming standard.';

-- =============================================================================
-- AMOUNT COLUMNS STATUS
-- =============================================================================

-- Note: journal_entry_lines already has debit_amount and credit_amount ✅
-- Note: payments already has payment_amount (not generic "amount") ✅
-- No amount column renames required - Finance module was correctly designed with semantic clarity

-- =============================================================================
-- VERIFICATION QUERIES (commented out - for reference)
-- =============================================================================

-- Verify no generic "quantity" columns remain (except contextually clear ones):
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_name = 'quantity'
--   AND table_name NOT IN (
--     'sales_order_lines',       -- Has quantity_ordered, quantity_shipped, quantity_invoiced
--     'purchase_order_lines',    -- Has quantity_ordered, quantity_received
--     'production_runs'          -- Has target_quantity, good_quantity, scrap_quantity
--   );

-- Verify no generic "amount" columns remain (except contextually clear ones):
-- SELECT table_name, column_name
-- FROM information_schema.columns
-- WHERE table_schema = 'public'
--   AND column_name = 'amount'
--   AND table_name NOT IN (
--     'sales_orders',            -- Has total_amount, subtotal, tax_amount, etc.
--     'invoices',                -- Has total_amount, etc.
--     'quotes'                   -- Has total_amount, etc.
--   );

-- Verify journal_entry_lines balance (debits = credits per journal entry):
-- SELECT journal_entry_id,
--        SUM(debit_amount) as total_debits,
--        SUM(credit_amount) as total_credits,
--        SUM(debit_amount) - SUM(credit_amount) as balance
-- FROM journal_entry_lines
-- GROUP BY journal_entry_id
-- HAVING ABS(SUM(debit_amount) - SUM(credit_amount)) > 0.01;

-- =============================================================================
-- DIMENSIONAL MODEL IMPACT
-- =============================================================================

-- These changes enable:
-- 1. Unambiguous fact table metrics (no "quantity" without context)
-- 2. Proper GL dimensional analysis (debit vs credit)
-- 3. Cross-fact analysis without column name collision
-- 4. ETL clarity: "quantity_quoted" in Quote fact, "quantity_ordered" in Sales fact

-- Business intelligence questions now possible:
-- - "How does quantity_quoted correlate with quantity_ordered?" (quote conversion)
-- - "What's the delta between quantity_on_hand and quantity_available?" (allocation analysis)
-- - "GL account balance by period" (sum(debit_amount) - sum(credit_amount))

-- Next Phase: V1.0.10 will add SCD Type 2 tracking to master data
-- Next Phase: V1.0.11 will standardize audit columns (created_by → created_by_user_id)
