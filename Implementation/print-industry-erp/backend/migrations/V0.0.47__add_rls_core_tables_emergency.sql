/**
 * Emergency RLS Deployment - Core Tables
 * REQ-STRATEGIC-AUTO-1767066329944: GraphQL Authorization & Tenant Isolation
 *
 * Critical Priority (P0): Enable Row-Level Security on foundational tables
 *
 * Tables covered:
 * - tenants (ironically missing RLS!)
 * - users (employee/user data)
 * - facilities (locations/warehouses)
 * - billing_entities (financial entities)
 *
 * Security Impact:
 * - Prevents cross-tenant data access at database layer
 * - Enforces tenant isolation via app.current_tenant_id session variable
 * - Complements application-layer guards (JwtAuthGuard, RolesGuard)
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY
-- =====================================================

-- Core Multi-Tenant Tables
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_entities ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Tenants: Users can only access their own tenant record
CREATE POLICY tenants_tenant_isolation ON tenants
  FOR ALL
  USING (id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenants_tenant_isolation ON tenants IS
  'RLS: Enforce tenant isolation - users can only access their own tenant record (REQ-STRATEGIC-AUTO-1767066329944)';

-- Users: Users can only access users from their tenant
CREATE POLICY users_tenant_isolation ON users
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY users_tenant_isolation ON users IS
  'RLS: Enforce tenant isolation - users can only access users from their tenant (REQ-STRATEGIC-AUTO-1767066329944)';

-- Facilities: Users can only access facilities from their tenant
CREATE POLICY facilities_tenant_isolation ON facilities
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY facilities_tenant_isolation ON facilities IS
  'RLS: Enforce tenant isolation - users can only access facilities from their tenant (REQ-STRATEGIC-AUTO-1767066329944)';

-- Billing Entities: Users can only access billing entities from their tenant
CREATE POLICY billing_entities_tenant_isolation ON billing_entities
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY billing_entities_tenant_isolation ON billing_entities IS
  'RLS: Enforce tenant isolation - users can only access billing entities from their tenant (REQ-STRATEGIC-AUTO-1767066329944)';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify RLS is enabled on all core tables
DO $$
DECLARE
  table_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN ('tenants', 'users', 'facilities', 'billing_entities')
    AND rowsecurity = true;

  IF table_count != 4 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 4 tables with RLS enabled, got %', table_count;
  END IF;

  RAISE NOTICE 'RLS verification passed: All 4 core tables have RLS enabled';
END $$;
