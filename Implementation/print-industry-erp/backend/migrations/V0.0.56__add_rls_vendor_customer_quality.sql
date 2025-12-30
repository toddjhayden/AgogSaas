/**
 * Migration: Add Row-Level Security (RLS) - Vendor, Customer & Quality Module
 * Version: V0.0.56
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P2 - MEDIUM (Vendor relationships, customer data, quality metrics)
 *
 * Tables covered (6 tables):
 * - materials_suppliers (Material-supplier relationships)
 * - vendor_contracts (Vendor contract terms)
 * - customer_products (Customer-specific products)
 * - customer_rejections (Quality rejection tracking)
 * - inspection_templates (QC inspection templates)
 * - chain_of_custody (Chain of custody tracking)
 *
 * Security Impact:
 * - Prevents cross-tenant vendor relationship exposure
 * - Protects contract terms and supplier pricing
 * - Protects customer-specific product configurations
 * - Protects quality metrics and rejection data
 * - Enforces tenant isolation via app.current_tenant_id
 *
 * Risk if not deployed:
 * - Supplier pricing agreements disclosure
 * - Contract terms exposure
 * - Customer product configurations leakage
 * - Quality metrics cross-tenant access
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY
-- =====================================================

ALTER TABLE materials_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_rejections ENABLE ROW LEVEL SECURITY;
ALTER TABLE inspection_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chain_of_custody ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES - VENDOR MANAGEMENT
-- =====================================================

-- Materials Suppliers
CREATE POLICY materials_suppliers_tenant_isolation ON materials_suppliers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY materials_suppliers_tenant_isolation ON materials_suppliers IS
  'RLS: Material-supplier relationship isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Vendor Contracts
CREATE POLICY vendor_contracts_tenant_isolation ON vendor_contracts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY vendor_contracts_tenant_isolation ON vendor_contracts IS
  'RLS: Vendor contract terms isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE RLS POLICIES - CUSTOMER MANAGEMENT
-- =====================================================

-- Customer Products
CREATE POLICY customer_products_tenant_isolation ON customer_products
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY customer_products_tenant_isolation ON customer_products IS
  'RLS: Customer-specific product configuration isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Customer Rejections
CREATE POLICY customer_rejections_tenant_isolation ON customer_rejections
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY customer_rejections_tenant_isolation ON customer_rejections IS
  'RLS: Customer quality rejection tracking isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE RLS POLICIES - QUALITY CONTROL
-- =====================================================

-- Inspection Templates
CREATE POLICY inspection_templates_tenant_isolation ON inspection_templates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY inspection_templates_tenant_isolation ON inspection_templates IS
  'RLS: QC inspection template isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Chain of Custody
CREATE POLICY chain_of_custody_tenant_isolation ON chain_of_custody
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY chain_of_custody_tenant_isolation ON chain_of_custody IS
  'RLS: Chain of custody tracking isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index tenant_id columns for optimal RLS performance
CREATE INDEX IF NOT EXISTS idx_materials_suppliers_tenant_id ON materials_suppliers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_vendor_contracts_tenant_id ON vendor_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_products_tenant_id ON customer_products(tenant_id);
CREATE INDEX IF NOT EXISTS idx_customer_rejections_tenant_id ON customer_rejections(tenant_id);
CREATE INDEX IF NOT EXISTS idx_inspection_templates_tenant_id ON inspection_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chain_of_custody_tenant_id ON chain_of_custody(tenant_id);

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  -- Verify all 6 tables have RLS enabled
  SELECT COUNT(*)
  INTO table_count
  FROM pg_tables
  WHERE schemaname = 'public'
    AND tablename IN (
      'materials_suppliers', 'vendor_contracts', 'customer_products',
      'customer_rejections', 'inspection_templates', 'chain_of_custody'
    )
    AND rowsecurity = true;

  IF table_count != 6 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 6 vendor/customer/quality tables with RLS enabled, got %', table_count;
  END IF;

  -- Verify all 6 policies exist
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'materials_suppliers', 'vendor_contracts', 'customer_products',
      'customer_rejections', 'inspection_templates', 'chain_of_custody'
    );

  IF policy_count < 6 THEN
    RAISE EXCEPTION 'Policy verification failed: Expected 6 vendor/customer/quality policies, got %', policy_count;
  END IF;

  RAISE NOTICE '✅ RLS verification passed: All 6 vendor/customer/quality tables have RLS enabled with proper policies';
  RAISE NOTICE '✅ Data Protection: Vendor relationships, customer data, and quality metrics are now protected at database layer';
END $$;
