/**
 * RLS Deployment - Finance & Sales Tables
 * REQ-STRATEGIC-AUTO-1767066329944: GraphQL Authorization & Tenant Isolation
 *
 * High Priority (P0): Enable Row-Level Security on financial and sales data
 *
 * Finance Tables:
 * - accounts (chart of accounts)
 * - journal_entries (financial transactions)
 * - invoices (customer invoices)
 * - payments (payment records)
 *
 * Sales Tables:
 * - sales_orders (customer orders)
 * - sales_order_lines (order line items)
 * - customers (customer master data)
 * - materials (material master data)
 * - products (product catalog)
 *
 * Security Impact:
 * - Prevents cross-tenant access to financial data (GDPR, SOC 2 compliance)
 * - Prevents cross-tenant access to customer PII
 * - Enforces tenant isolation via app.current_tenant_id session variable
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY - FINANCE
-- =====================================================

ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY - SALES
-- =====================================================

ALTER TABLE sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_order_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES - FINANCE
-- =====================================================

-- Accounts
CREATE POLICY accounts_tenant_isolation ON accounts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY accounts_tenant_isolation ON accounts IS
  'RLS: Chart of accounts isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- Journal Entries
CREATE POLICY journal_entries_tenant_isolation ON journal_entries
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY journal_entries_tenant_isolation ON journal_entries IS
  'RLS: Financial transactions isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- Invoices
CREATE POLICY invoices_tenant_isolation ON invoices
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY invoices_tenant_isolation ON invoices IS
  'RLS: Invoice data isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- Payments
CREATE POLICY payments_tenant_isolation ON payments
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY payments_tenant_isolation ON payments IS
  'RLS: Payment records isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- =====================================================
-- CREATE RLS POLICIES - SALES
-- =====================================================

-- Sales Orders
CREATE POLICY sales_orders_tenant_isolation ON sales_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY sales_orders_tenant_isolation ON sales_orders IS
  'RLS: Sales order isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- Sales Order Lines
CREATE POLICY sales_order_lines_tenant_isolation ON sales_order_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_lines.sales_order_id
        AND so.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sales_orders so
      WHERE so.id = sales_order_lines.sales_order_id
        AND so.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

COMMENT ON POLICY sales_order_lines_tenant_isolation ON sales_order_lines IS
  'RLS: Sales order line items isolation via parent order (REQ-STRATEGIC-AUTO-1767066329944)';

-- Customers
CREATE POLICY customers_tenant_isolation ON customers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY customers_tenant_isolation ON customers IS
  'RLS: Customer PII/data isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- Materials
CREATE POLICY materials_tenant_isolation ON materials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY materials_tenant_isolation ON materials IS
  'RLS: Material master data isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- Products
CREATE POLICY products_tenant_isolation ON products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY products_tenant_isolation ON products IS
  'RLS: Product catalog isolation (REQ-STRATEGIC-AUTO-1767066329944)';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'accounts', 'journal_entries', 'invoices', 'payments',
      'sales_orders', 'sales_order_lines', 'customers', 'materials', 'products'
    )
    AND rowsecurity = true;

  IF table_count != 9 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 9 tables with RLS enabled, got %', table_count;
  END IF;

  RAISE NOTICE 'RLS verification passed: All 9 finance/sales tables have RLS enabled';
END $$;
