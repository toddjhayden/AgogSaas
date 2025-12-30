/**
 * Enhancement: Add WITH CHECK Clauses to Production Planning RLS Policies
 * Version: V0.0.51
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P1 - HIGH (Deploy within 1 week)
 *
 * Problem:
 * - V0.0.41 added RLS policies to 13 production planning tables
 * - Only USING clause present (read protection)
 * - Missing WITH CHECK clause (write protection)
 * - Violates principle of least privilege
 *
 * Impact:
 * - INSERT/UPDATE operations could bypass tenant isolation if application bug exists
 * - Write operations not fully protected
 *
 * Solution:
 * - Recreate all 13 production planning policies with WITH CHECK clauses
 * - Ensure both read and write operations enforce tenant isolation
 */

-- =====================================================
-- WORK_CENTERS
-- =====================================================

DROP POLICY IF EXISTS work_centers_tenant_isolation ON work_centers;

CREATE POLICY work_centers_tenant_isolation ON work_centers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY work_centers_tenant_isolation ON work_centers IS
  'RLS: Work centers tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- PRODUCTION_ORDERS
-- =====================================================

DROP POLICY IF EXISTS production_orders_tenant_isolation ON production_orders;

CREATE POLICY production_orders_tenant_isolation ON production_orders
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY production_orders_tenant_isolation ON production_orders IS
  'RLS: Production orders tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- PRODUCTION_RUNS
-- =====================================================

DROP POLICY IF EXISTS production_runs_tenant_isolation ON production_runs;

CREATE POLICY production_runs_tenant_isolation ON production_runs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY production_runs_tenant_isolation ON production_runs IS
  'RLS: Production runs tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- OPERATIONS (WITH GLOBAL REFERENCE DATA SUPPORT)
-- =====================================================

DROP POLICY IF EXISTS operations_tenant_isolation ON operations;

CREATE POLICY operations_tenant_isolation ON operations
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    OR tenant_id IS NULL  -- Global operations shared across tenants
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
    OR tenant_id IS NULL  -- Allow creation of global operations
  );

COMMENT ON POLICY operations_tenant_isolation ON operations IS
  'RLS: Operations tenant isolation with global reference data support (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CHANGEOVER_DETAILS
-- =====================================================

DROP POLICY IF EXISTS changeover_details_tenant_isolation ON changeover_details;

CREATE POLICY changeover_details_tenant_isolation ON changeover_details
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY changeover_details_tenant_isolation ON changeover_details IS
  'RLS: Changeover details tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- EQUIPMENT_STATUS_LOG
-- =====================================================

DROP POLICY IF EXISTS equipment_status_log_tenant_isolation ON equipment_status_log;

CREATE POLICY equipment_status_log_tenant_isolation ON equipment_status_log
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY equipment_status_log_tenant_isolation ON equipment_status_log IS
  'RLS: Equipment status log tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- MAINTENANCE_RECORDS
-- =====================================================

DROP POLICY IF EXISTS maintenance_records_tenant_isolation ON maintenance_records;

CREATE POLICY maintenance_records_tenant_isolation ON maintenance_records
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY maintenance_records_tenant_isolation ON maintenance_records IS
  'RLS: Maintenance records tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- ASSET_HIERARCHY
-- =====================================================

DROP POLICY IF EXISTS asset_hierarchy_tenant_isolation ON asset_hierarchy;

CREATE POLICY asset_hierarchy_tenant_isolation ON asset_hierarchy
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY asset_hierarchy_tenant_isolation ON asset_hierarchy IS
  'RLS: Asset hierarchy tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- OEE_CALCULATIONS
-- =====================================================

DROP POLICY IF EXISTS oee_calculations_tenant_isolation ON oee_calculations;

CREATE POLICY oee_calculations_tenant_isolation ON oee_calculations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY oee_calculations_tenant_isolation ON oee_calculations IS
  'RLS: OEE calculations tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- PRODUCTION_SCHEDULES
-- =====================================================

DROP POLICY IF EXISTS production_schedules_tenant_isolation ON production_schedules;

CREATE POLICY production_schedules_tenant_isolation ON production_schedules
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY production_schedules_tenant_isolation ON production_schedules IS
  'RLS: Production schedules tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CAPACITY_PLANNING
-- =====================================================

DROP POLICY IF EXISTS capacity_planning_tenant_isolation ON capacity_planning;

CREATE POLICY capacity_planning_tenant_isolation ON capacity_planning
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY capacity_planning_tenant_isolation ON capacity_planning IS
  'RLS: Capacity planning tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- ROUTING_TEMPLATES
-- =====================================================

DROP POLICY IF EXISTS routing_templates_tenant_isolation ON routing_templates;

CREATE POLICY routing_templates_tenant_isolation ON routing_templates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY routing_templates_tenant_isolation ON routing_templates IS
  'RLS: Routing templates tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- ROUTING_OPERATIONS
-- =====================================================

DROP POLICY IF EXISTS routing_operations_tenant_isolation ON routing_operations;

CREATE POLICY routing_operations_tenant_isolation ON routing_operations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY routing_operations_tenant_isolation ON routing_operations IS
  'RLS: Routing operations tenant isolation with write protection (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  missing_with_check INTEGER;
  table_count INTEGER;
BEGIN
  -- Count policies with USING but missing WITH CHECK
  SELECT COUNT(*)
  INTO missing_with_check
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'work_centers', 'production_orders', 'production_runs', 'operations',
      'changeover_details', 'equipment_status_log', 'maintenance_records',
      'asset_hierarchy', 'oee_calculations', 'production_schedules',
      'capacity_planning', 'routing_templates', 'routing_operations'
    )
    AND pg_get_expr(polqual, polrelid) IS NOT NULL
    AND pg_get_expr(polwithcheck, polrelid) IS NULL;

  IF missing_with_check > 0 THEN
    RAISE EXCEPTION 'Found % production planning policies still missing WITH CHECK clause', missing_with_check;
  END IF;

  -- Verify all 13 tables have both USING and WITH CHECK
  SELECT COUNT(DISTINCT tablename)
  INTO table_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN (
      'work_centers', 'production_orders', 'production_runs', 'operations',
      'changeover_details', 'equipment_status_log', 'maintenance_records',
      'asset_hierarchy', 'oee_calculations', 'production_schedules',
      'capacity_planning', 'routing_templates', 'routing_operations'
    )
    AND pg_get_expr(polqual, polrelid) IS NOT NULL
    AND pg_get_expr(polwithcheck, polrelid) IS NOT NULL;

  IF table_count != 13 THEN
    RAISE EXCEPTION 'Expected 13 tables with WITH CHECK, found %', table_count;
  END IF;

  RAISE NOTICE '✅ All 13 production planning tables now have WITH CHECK clauses for write protection';
END $$;
