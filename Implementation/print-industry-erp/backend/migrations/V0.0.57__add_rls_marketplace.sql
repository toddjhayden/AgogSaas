/**
 * Migration: Add Row-Level Security (RLS) - Marketplace Module
 * Version: V0.0.57
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P2 - LOW (B2B marketplace data protection)
 *
 * Tables covered (5 tables):
 * - marketplace_job_postings (Job postings)
 * - marketplace_bids (Bid submissions)
 * - partner_network_profiles (Partner profiles)
 * - marketplace_partner_orders (Partner orders)
 * - external_company_orders (External company orders)
 *
 * Security Impact:
 * - Prevents cross-tenant marketplace activity exposure
 * - Protects bid submissions and pricing
 * - Protects partner relationships
 * - Enforces tenant isolation via app.current_tenant_id
 *
 * Risk if not deployed:
 * - B2B marketplace activity leakage (limited exposure)
 * - Bid pricing disclosure
 * - Partner relationship visibility
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY
-- =====================================================

ALTER TABLE marketplace_job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_network_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_partner_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_company_orders ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Marketplace Job Postings
CREATE POLICY marketplace_job_postings_tenant_isolation ON marketplace_job_postings
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY marketplace_job_postings_tenant_isolation ON marketplace_job_postings IS
  'RLS: Marketplace job posting isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Marketplace Bids
CREATE POLICY marketplace_bids_tenant_isolation ON marketplace_bids
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY marketplace_bids_tenant_isolation ON marketplace_bids IS
  'RLS: Marketplace bid submission isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Partner Network Profiles
CREATE POLICY partner_network_profiles_tenant_isolation ON partner_network_profiles
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY partner_network_profiles_tenant_isolation ON partner_network_profiles IS
  'RLS: Partner network profile isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Marketplace Partner Orders
CREATE POLICY marketplace_partner_orders_tenant_isolation ON marketplace_partner_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY marketplace_partner_orders_tenant_isolation ON marketplace_partner_orders IS
  'RLS: Marketplace partner order isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- External Company Orders
CREATE POLICY external_company_orders_tenant_isolation ON external_company_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY external_company_orders_tenant_isolation ON external_company_orders IS
  'RLS: External company order isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index tenant_id columns for optimal RLS performance
CREATE INDEX IF NOT EXISTS idx_marketplace_job_postings_tenant_id ON marketplace_job_postings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_bids_tenant_id ON marketplace_bids(tenant_id);
CREATE INDEX IF NOT EXISTS idx_partner_network_profiles_tenant_id ON partner_network_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_partner_orders_tenant_id ON marketplace_partner_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_external_company_orders_tenant_id ON external_company_orders(tenant_id);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Verify all 5 tables have RLS enabled
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'marketplace_job_postings', 'marketplace_bids', 'partner_network_profiles',
      'marketplace_partner_orders', 'external_company_orders'
    )
    AND rowsecurity = true;

  IF table_count != 5 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 5 marketplace tables with RLS enabled, got %', table_count;
  END IF;

  -- Verify all 5 policies exist
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'marketplace_job_postings', 'marketplace_bids', 'partner_network_profiles',
      'marketplace_partner_orders', 'external_company_orders'
    );

  IF policy_count < 5 THEN
    RAISE EXCEPTION 'Policy verification failed: Expected 5 marketplace policies, got %', policy_count;
  END IF;

  RAISE NOTICE '✅ RLS verification passed: All 5 marketplace tables have RLS enabled with proper policies';
  RAISE NOTICE '✅ Marketplace Protection: B2B marketplace activities and partner relationships are now protected at database layer';
END $$;
