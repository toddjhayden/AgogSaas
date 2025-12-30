/**
 * Migration: Add Row Level Security (RLS) Policies for Sales Quote Automation
 * Version: V0.0.36
 * Feature: REQ-STRATEGIC-AUTO-1766627757384
 *
 * Critical security enhancement addressing Sylvia's critique:
 * Implements Row Level Security policies for multi-tenant isolation
 * on quotes, quote_lines, pricing_rules, and customer_pricing tables.
 *
 * Security Impact:
 * - Prevents cross-tenant data access at the database level
 * - Mitigates SQL injection vulnerabilities
 * - Protects against ORM bugs and direct database access
 */

-- =====================================================
-- QUOTES TABLE - RLS POLICIES
-- =====================================================

-- Enable Row Level Security on quotes table
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant isolation for quotes
-- Only allow access to quotes belonging to the current tenant
CREATE POLICY quotes_tenant_isolation ON quotes
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add comment for documentation
COMMENT ON POLICY quotes_tenant_isolation ON quotes IS
  'Enforces multi-tenant isolation - users can only access quotes from their tenant';

-- =====================================================
-- QUOTE_LINES TABLE - RLS POLICIES
-- =====================================================

-- Enable Row Level Security on quote_lines table
ALTER TABLE quote_lines ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant isolation for quote lines
-- Only allow access to quote lines belonging to the current tenant
CREATE POLICY quote_lines_tenant_isolation ON quote_lines
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add comment for documentation
COMMENT ON POLICY quote_lines_tenant_isolation ON quote_lines IS
  'Enforces multi-tenant isolation - users can only access quote lines from their tenant';

-- =====================================================
-- PRICING_RULES TABLE - RLS POLICIES
-- =====================================================

-- Enable Row Level Security on pricing_rules table
ALTER TABLE pricing_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant isolation for pricing rules
-- Only allow access to pricing rules belonging to the current tenant
CREATE POLICY pricing_rules_tenant_isolation ON pricing_rules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add comment for documentation
COMMENT ON POLICY pricing_rules_tenant_isolation ON pricing_rules IS
  'Enforces multi-tenant isolation - users can only access pricing rules from their tenant';

-- =====================================================
-- CUSTOMER_PRICING TABLE - RLS POLICIES
-- =====================================================

-- Enable Row Level Security on customer_pricing table
ALTER TABLE customer_pricing ENABLE ROW LEVEL SECURITY;

-- Policy: Tenant isolation for customer pricing
-- Only allow access to customer pricing belonging to the current tenant
CREATE POLICY customer_pricing_tenant_isolation ON customer_pricing
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add comment for documentation
COMMENT ON POLICY customer_pricing_tenant_isolation ON customer_pricing IS
  'Enforces multi-tenant isolation - users can only access customer pricing from their tenant';

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Verify RLS is enabled on all tables
DO $$
DECLARE
  v_table_name TEXT;
  v_rls_enabled BOOLEAN;
  v_policy_count INTEGER;
BEGIN
  FOR v_table_name IN SELECT unnest(ARRAY['quotes', 'quote_lines', 'pricing_rules', 'customer_pricing'])
  LOOP
    -- Check if RLS is enabled
    SELECT relrowsecurity INTO v_rls_enabled
    FROM pg_class
    WHERE relname = v_table_name;

    -- Count policies for this table
    SELECT COUNT(*) INTO v_policy_count
    FROM pg_policies
    WHERE tablename = v_table_name;

    RAISE NOTICE 'Table: % - RLS Enabled: % - Policies: %',
      v_table_name, v_rls_enabled, v_policy_count;

    -- Validation
    IF NOT v_rls_enabled THEN
      RAISE EXCEPTION 'RLS NOT ENABLED on table %', v_table_name;
    END IF;

    IF v_policy_count < 1 THEN
      RAISE EXCEPTION 'NO POLICIES FOUND on table %', v_table_name;
    END IF;
  END LOOP;

  RAISE NOTICE 'RLS POLICIES VERIFICATION COMPLETE - ALL TABLES SECURED';
END;
$$;

-- =====================================================
-- USAGE INSTRUCTIONS
-- =====================================================

/**
 * IMPORTANT: Application Configuration Required
 *
 * The application MUST set the current_tenant_id session variable
 * for RLS policies to work correctly.
 *
 * Example (in NestJS middleware or at connection level):
 *
 *   await client.query(
 *     "SET LOCAL app.current_tenant_id = $1",
 *     [tenantId]
 *   );
 *
 * This should be set:
 * 1. At the beginning of each GraphQL request
 * 2. After acquiring a connection from the pool
 * 3. Within the same transaction as the business queries
 *
 * Security Notes:
 * - Use `true` parameter in current_setting() to return NULL if not set
 *   instead of throwing an error
 * - This allows graceful handling when tenant_id is not yet configured
 * - Production systems should enforce tenant_id is always set
 */
