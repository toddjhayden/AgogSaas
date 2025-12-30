/**
 * Migration: Add Row-Level Security (RLS) - Finance Module Complete
 * Version: V0.0.52
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P0 - CRITICAL (SOC 2, GDPR compliance)
 *
 * Tables covered:
 * - chart_of_accounts (GL accounts)
 * - financial_periods (period close)
 * - exchange_rates (multi-currency)
 * - gl_balances (GL balances)
 * - invoice_lines (invoice line items)
 * - journal_entry_lines (JE line items)
 * - cost_allocations (cost allocation)
 *
 * Security Impact:
 * - Prevents cross-tenant financial data access
 * - Enforces tenant isolation via app.current_tenant_id
 * - Complies with SOC 2, GDPR requirements
 *
 * Risk if not deployed:
 * - Financial data cross-tenant leakage
 * - SOC 2/GDPR compliance violation
 * - Competitor GL account exposure
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY
-- =====================================================

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_allocations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES - DIRECT TENANT_ID TABLES
-- =====================================================

-- Chart of Accounts
CREATE POLICY chart_of_accounts_tenant_isolation ON chart_of_accounts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY chart_of_accounts_tenant_isolation ON chart_of_accounts IS
  'RLS: Chart of accounts isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Financial Periods
CREATE POLICY financial_periods_tenant_isolation ON financial_periods
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY financial_periods_tenant_isolation ON financial_periods IS
  'RLS: Financial period isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Exchange Rates
CREATE POLICY exchange_rates_tenant_isolation ON exchange_rates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY exchange_rates_tenant_isolation ON exchange_rates IS
  'RLS: Exchange rate isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- GL Balances
CREATE POLICY gl_balances_tenant_isolation ON gl_balances
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY gl_balances_tenant_isolation ON gl_balances IS
  'RLS: GL balance isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Cost Allocations
CREATE POLICY cost_allocations_tenant_isolation ON cost_allocations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY cost_allocations_tenant_isolation ON cost_allocations IS
  'RLS: Cost allocation isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE RLS POLICIES - PARENT-CHILD RELATIONSHIPS
-- =====================================================

-- Invoice Lines: Inherit from parent invoice
CREATE POLICY invoice_lines_tenant_isolation ON invoice_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_lines.invoice_id
        AND i.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_lines.invoice_id
        AND i.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

COMMENT ON POLICY invoice_lines_tenant_isolation ON invoice_lines IS
  'RLS: Invoice line isolation via parent invoice (REQ-STRATEGIC-AUTO-1767084329260)';

-- Journal Entry Lines: Inherit from parent journal entry
CREATE POLICY journal_entry_lines_tenant_isolation ON journal_entry_lines
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_lines.journal_entry_id
        AND je.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_lines.journal_entry_id
        AND je.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

COMMENT ON POLICY journal_entry_lines_tenant_isolation ON journal_entry_lines IS
  'RLS: Journal entry line isolation via parent JE (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index foreign keys used in RLS policies
CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_entry_id ON journal_entry_lines(journal_entry_id);

-- Index tenant_id columns for optimal RLS performance
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_tenant_id ON chart_of_accounts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_financial_periods_tenant_id ON financial_periods(tenant_id);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_tenant_id ON exchange_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gl_balances_tenant_id ON gl_balances(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cost_allocations_tenant_id ON cost_allocations(tenant_id);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Verify all 7 tables have RLS enabled
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'chart_of_accounts', 'financial_periods', 'exchange_rates', 'gl_balances',
      'invoice_lines', 'journal_entry_lines', 'cost_allocations'
    )
    AND rowsecurity = true;

  IF table_count != 7 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 7 tables with RLS enabled, got %', table_count;
  END IF;

  -- Verify all 7 policies exist
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'chart_of_accounts', 'financial_periods', 'exchange_rates', 'gl_balances',
      'invoice_lines', 'journal_entry_lines', 'cost_allocations'
    );

  IF policy_count < 7 THEN
    RAISE EXCEPTION 'Policy verification failed: Expected 7 policies, got %', policy_count;
  END IF;

  RAISE NOTICE '✅ RLS verification passed: All 7 finance tables have RLS enabled with proper policies';
  RAISE NOTICE '✅ SOC 2 / GDPR compliance: Financial data is now protected at database layer';
END $$;
