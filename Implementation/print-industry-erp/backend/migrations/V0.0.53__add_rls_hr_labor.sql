/**
 * Migration: Add Row-Level Security (RLS) - HR & Labor Module
 * Version: V0.0.53
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P0 - CRITICAL (GDPR, CCPA compliance - PII protection)
 *
 * Tables covered:
 * - employees (Employee master data - SSN, salary, PII)
 * - labor_rates (Labor rates by role/department)
 * - labor_tracking (Time tracking records)
 * - timecards (Timecard entries)
 *
 * Security Impact:
 * - Prevents cross-tenant employee PII exposure
 * - Protects wage data and compensation information
 * - Enforces tenant isolation via app.current_tenant_id
 * - Complies with GDPR, CCPA, SOC 2 requirements
 *
 * Risk if not deployed:
 * - Employee PII cross-tenant leakage (CRITICAL)
 * - Wage rate disclosure
 * - GDPR/CCPA compliance violation
 * - Time tracking data exposure
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY
-- =====================================================

ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE labor_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE timecards ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Employees Table (CRITICAL - PII)
CREATE POLICY employees_tenant_isolation ON employees
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY employees_tenant_isolation ON employees IS
  'RLS: Employee PII protection - GDPR/CCPA compliance (REQ-STRATEGIC-AUTO-1767084329260)';

-- Labor Rates Table
CREATE POLICY labor_rates_tenant_isolation ON labor_rates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY labor_rates_tenant_isolation ON labor_rates IS
  'RLS: Labor rate isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Labor Tracking Table
CREATE POLICY labor_tracking_tenant_isolation ON labor_tracking
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY labor_tracking_tenant_isolation ON labor_tracking IS
  'RLS: Labor tracking isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Timecards Table
CREATE POLICY timecards_tenant_isolation ON timecards
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY timecards_tenant_isolation ON timecards IS
  'RLS: Timecard isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index tenant_id columns for optimal RLS performance
CREATE INDEX IF NOT EXISTS idx_employees_tenant_id ON employees(tenant_id);
CREATE INDEX IF NOT EXISTS idx_labor_rates_tenant_id ON labor_rates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_labor_tracking_tenant_id ON labor_tracking(tenant_id);
CREATE INDEX IF NOT EXISTS idx_timecards_tenant_id ON timecards(tenant_id);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Verify all 4 tables have RLS enabled
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('employees', 'labor_rates', 'labor_tracking', 'timecards')
    AND rowsecurity = true;

  IF table_count != 4 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 4 HR/Labor tables with RLS enabled, got %', table_count;
  END IF;

  -- Verify all 4 policies exist
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('employees', 'labor_rates', 'labor_tracking', 'timecards');

  IF policy_count < 4 THEN
    RAISE EXCEPTION 'Policy verification failed: Expected 4 HR/Labor policies, got %', policy_count;
  END IF;

  RAISE NOTICE '✅ RLS verification passed: All 4 HR/Labor tables have RLS enabled with proper policies';
  RAISE NOTICE '✅ GDPR / CCPA compliance: Employee PII is now protected at database layer';
  RAISE NOTICE '✅ SOC 2 compliance: Wage and time tracking data is now isolated by tenant';
END $$;
