-- =====================================================
-- FLYWAY MIGRATION V0.0.60
-- =====================================================
-- Purpose: Fix Finance Module Currency Column Naming
-- Description: Align invoice/payment currency columns with service layer expectations
-- Related: REQ-STRATEGIC-AUTO-1767103864615
-- Created: 2025-12-30
-- Author: Roy (Backend Developer)
-- =====================================================

-- =====================================================
-- FIX INVOICES TABLE - Currency Column Naming
-- =====================================================
-- The service layer expects `currency_code` but schema uses `invoice_currency_code`
-- Add currency_code as an alias/computed column for backwards compatibility

-- Rename invoice_currency_code to currency_code for service layer consistency
DO $$
BEGIN
  -- Check if invoice_currency_code exists and currency_code doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices'
    AND column_name = 'invoice_currency_code'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices'
    AND column_name = 'currency_code'
    AND table_schema = 'public'
  ) THEN
    -- Rename the column
    ALTER TABLE invoices RENAME COLUMN invoice_currency_code TO currency_code;
  END IF;
END $$;

-- Similarly for payments table
DO $$
BEGIN
  -- Check if payment_currency_code exists and currency_code doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments'
    AND column_name = 'payment_currency_code'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments'
    AND column_name = 'currency_code'
    AND table_schema = 'public'
  ) THEN
    -- Rename the column
    ALTER TABLE payments RENAME COLUMN payment_currency_code TO currency_code;
  END IF;
END $$;

-- =====================================================
-- FIX INVOICES TABLE - Amount Column Naming
-- =====================================================
-- Align subtotal_amount with service layer expectation of subtotal

DO $$
BEGIN
  -- Check if subtotal_amount exists and subtotal doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices'
    AND column_name = 'subtotal_amount'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices'
    AND column_name = 'subtotal'
    AND table_schema = 'public'
  ) THEN
    -- Rename the column
    ALTER TABLE invoices RENAME COLUMN subtotal_amount TO subtotal;
  END IF;
END $$;

-- =====================================================
-- FIX PAYMENTS TABLE - Amount Column Naming
-- =====================================================
-- Align payment_amount with service layer expectation of amount

DO $$
BEGIN
  -- Check if payment_amount exists and amount doesn't
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments'
    AND column_name = 'payment_amount'
    AND table_schema = 'public'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments'
    AND column_name = 'amount'
    AND table_schema = 'public'
  ) THEN
    -- Rename the column
    ALTER TABLE payments RENAME COLUMN payment_amount TO amount;
  END IF;
END $$;

-- =====================================================
-- ADD MISSING VENDOR_ID COLUMN TO INVOICES
-- =====================================================
-- The service supports both customer invoices and vendor bills

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vendor_id UUID;

-- Add foreign key constraint if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_invoice_vendor'
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices
      ADD CONSTRAINT fk_invoice_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id);
  END IF;
END $$;

-- Update check constraint to allow either customer_id or vendor_id
DO $$
BEGIN
  -- Drop old constraint if exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_invoice_customer_or_vendor'
    AND table_name = 'invoices'
  ) THEN
    ALTER TABLE invoices DROP CONSTRAINT chk_invoice_customer_or_vendor;
  END IF;

  -- Add new constraint
  ALTER TABLE invoices
    ADD CONSTRAINT chk_invoice_customer_or_vendor CHECK (
      (invoice_type IN ('CUSTOMER_INVOICE', 'CREDIT_MEMO') AND customer_id IS NOT NULL AND vendor_id IS NULL) OR
      (invoice_type IN ('VENDOR_BILL', 'DEBIT_MEMO') AND vendor_id IS NOT NULL AND customer_id IS NULL)
    );
END $$;

-- Make customer_id nullable since vendor bills don't have customers
ALTER TABLE invoices
  ALTER COLUMN customer_id DROP NOT NULL;

-- Add index for vendor invoices
CREATE INDEX IF NOT EXISTS idx_invoices_vendor
  ON invoices(vendor_id)
  WHERE vendor_id IS NOT NULL;

COMMENT ON COLUMN invoices.vendor_id IS 'Vendor ID for vendor bills (AP), NULL for customer invoices (AR)';
COMMENT ON COLUMN invoices.currency_code IS 'Transaction currency code (ISO 4217)';

-- =====================================================
-- UPDATE PAYMENTS TABLE COMMENTS
-- =====================================================

COMMENT ON COLUMN payments.currency_code IS 'Transaction currency code (ISO 4217)';
COMMENT ON COLUMN payments.amount IS 'Total payment amount in transaction currency';

-- =====================================================
-- VERIFY SCHEMA ALIGNMENT
-- =====================================================

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'V0.0.60: Finance currency column alignment complete';
  RAISE NOTICE 'invoices.invoice_currency_code -> invoices.currency_code';
  RAISE NOTICE 'payments.payment_currency_code -> payments.currency_code';
  RAISE NOTICE 'invoices.vendor_id added for AP support';
END $$;
