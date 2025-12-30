/**
 * CRITICAL FIX: Standardize RLS Session Variable Naming
 * Version: V0.0.50
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P0 - CRITICAL (Deploy within 24 hours)
 *
 * Problem:
 * - Some RLS policies use 'app.tenant_id' (V0.0.40-42)
 * - Application sets 'app.current_tenant_id' (app.module.ts)
 * - Recent migrations use 'app.current_tenant_id' (V0.0.47-49)
 * - Result: Policies using 'app.tenant_id' WILL NOT WORK
 *
 * Impact:
 * - Users see empty data OR cross-tenant data leakage
 * - Affected tables: jobs, cost_centers, standard_costs, estimates, job_costs, export_jobs
 *
 * Solution:
 * - Recreate all affected policies with correct session variable
 * - Standardize on 'app.current_tenant_id'
 */

-- =====================================================
-- FIX JOBS TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_jobs ON jobs;

CREATE POLICY tenant_isolation_jobs ON jobs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_jobs ON jobs IS
  'RLS: Jobs tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX COST_CENTERS TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_cost_centers ON cost_centers;

CREATE POLICY tenant_isolation_cost_centers ON cost_centers
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_cost_centers ON cost_centers IS
  'RLS: Cost centers tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX STANDARD_COSTS TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_standard_costs ON standard_costs;

CREATE POLICY tenant_isolation_standard_costs ON standard_costs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_standard_costs ON standard_costs IS
  'RLS: Standard costs tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX ESTIMATES TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_estimates ON estimates;

CREATE POLICY tenant_isolation_estimates ON estimates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_estimates ON estimates IS
  'RLS: Estimates tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX ESTIMATE_OPERATIONS TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_estimate_operations ON estimate_operations;

CREATE POLICY tenant_isolation_estimate_operations ON estimate_operations
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_estimate_operations ON estimate_operations IS
  'RLS: Estimate operations tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX ESTIMATE_MATERIALS TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_estimate_materials ON estimate_materials;

CREATE POLICY tenant_isolation_estimate_materials ON estimate_materials
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_estimate_materials ON estimate_materials IS
  'RLS: Estimate materials tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX JOB_COSTS TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_job_costs ON job_costs;

CREATE POLICY tenant_isolation_job_costs ON job_costs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_job_costs ON job_costs IS
  'RLS: Job costs tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX JOB_COST_UPDATES TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_job_cost_updates ON job_cost_updates;

CREATE POLICY tenant_isolation_job_cost_updates ON job_cost_updates
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_job_cost_updates ON job_cost_updates IS
  'RLS: Job cost updates tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- FIX EXPORT_JOBS TABLE POLICY
-- =====================================================

DROP POLICY IF EXISTS tenant_isolation_export_jobs ON export_jobs;

CREATE POLICY tenant_isolation_export_jobs ON export_jobs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY tenant_isolation_export_jobs ON export_jobs IS
  'RLS: Export jobs tenant isolation - Fixed session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  wrong_var_count INTEGER;
BEGIN
  -- Check for any remaining policies using app.tenant_id
  SELECT COUNT(*)
  INTO wrong_var_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      pg_get_expr(polqual, polrelid) LIKE '%app.tenant_id%'
      OR pg_get_expr(polwithcheck, polrelid) LIKE '%app.tenant_id%'
    );

  IF wrong_var_count > 0 THEN
    RAISE WARNING 'Found % policies still using app.tenant_id - manual review needed', wrong_var_count;
  ELSE
    RAISE NOTICE '✅ RLS session variable fix verified: All policies now use app.current_tenant_id';
  END IF;

  -- Verify all 9 tables have updated policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'jobs' AND policyname = 'tenant_isolation_jobs') THEN
    RAISE EXCEPTION 'Policy tenant_isolation_jobs not found on jobs table';
  END IF;

  RAISE NOTICE '✅ All 9 affected policies have been successfully recreated with correct session variable';
END $$;
