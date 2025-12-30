/**
 * Migration: Add Row-Level Security (RLS) - Manufacturing Module
 * Version: V0.0.55
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P2 - MEDIUM (Proprietary manufacturing data protection)
 *
 * Tables covered (6 tables):
 * - bill_of_materials (Product BOM structures - trade secrets)
 * - press_specifications (Press equipment specs)
 * - substrate_specifications (Substrate specifications)
 * - imposition_templates (Imposition layouts)
 * - imposition_marks (Imposition marks)
 * - equipment_events (Equipment event logs)
 *
 * Security Impact:
 * - Prevents cross-tenant manufacturing IP exposure
 * - Protects proprietary BOM structures
 * - Protects equipment configurations
 * - Enforces tenant isolation via app.current_tenant_id
 *
 * Risk if not deployed:
 * - Proprietary BOM structures disclosure to competitors
 * - Manufacturing methodologies exposure
 * - Equipment configuration leakage
 */

-- =====================================================
-- ENABLE ROW-LEVEL SECURITY
-- =====================================================

ALTER TABLE bill_of_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE press_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE substrate_specifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE imposition_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE imposition_marks ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- CREATE RLS POLICIES
-- =====================================================

-- Bill of Materials (TRADE SECRETS)
CREATE POLICY bill_of_materials_tenant_isolation ON bill_of_materials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY bill_of_materials_tenant_isolation ON bill_of_materials IS
  'RLS: BOM trade secret protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- Press Specifications
CREATE POLICY press_specifications_tenant_isolation ON press_specifications
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY press_specifications_tenant_isolation ON press_specifications IS
  'RLS: Press specifications isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Substrate Specifications
CREATE POLICY substrate_specifications_tenant_isolation ON substrate_specifications
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY substrate_specifications_tenant_isolation ON substrate_specifications IS
  'RLS: Substrate specifications isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Imposition Templates
CREATE POLICY imposition_templates_tenant_isolation ON imposition_templates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY imposition_templates_tenant_isolation ON imposition_templates IS
  'RLS: Imposition template isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Imposition Marks
CREATE POLICY imposition_marks_tenant_isolation ON imposition_marks
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY imposition_marks_tenant_isolation ON imposition_marks IS
  'RLS: Imposition marks isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- Equipment Events
CREATE POLICY equipment_events_tenant_isolation ON equipment_events
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY equipment_events_tenant_isolation ON equipment_events IS
  'RLS: Equipment event log isolation (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE INDEXES FOR PERFORMANCE
-- =====================================================

-- Index tenant_id columns for optimal RLS performance
CREATE INDEX IF NOT EXISTS idx_bill_of_materials_tenant_id ON bill_of_materials(tenant_id);
CREATE INDEX IF NOT EXISTS idx_press_specifications_tenant_id ON press_specifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_substrate_specifications_tenant_id ON substrate_specifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_imposition_templates_tenant_id ON imposition_templates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_imposition_marks_tenant_id ON imposition_marks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_equipment_events_tenant_id ON equipment_events(tenant_id);

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
      'bill_of_materials', 'press_specifications', 'substrate_specifications',
      'imposition_templates', 'imposition_marks', 'equipment_events'
    )
    AND rowsecurity = true;

  IF table_count != 6 THEN
    RAISE EXCEPTION 'RLS verification failed: Expected 6 manufacturing tables with RLS enabled, got %', table_count;
  END IF;

  -- Verify all 6 policies exist
  SELECT COUNT(*)
  INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'bill_of_materials', 'press_specifications', 'substrate_specifications',
      'imposition_templates', 'imposition_marks', 'equipment_events'
    );

  IF policy_count < 6 THEN
    RAISE EXCEPTION 'Policy verification failed: Expected 6 manufacturing policies, got %', policy_count;
  END IF;

  RAISE NOTICE '✅ RLS verification passed: All 6 manufacturing tables have RLS enabled with proper policies';
  RAISE NOTICE '✅ Trade Secret Protection: Proprietary BOM and manufacturing data are now protected at database layer';
END $$;
