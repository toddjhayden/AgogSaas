/**
 * Migration: RLS Verification Tests & Automated Checks
 * Version: V0.0.58
 * REQ: REQ-STRATEGIC-AUTO-1767084329260
 * Priority: P1 - HIGH (CI/CD verification)
 *
 * Purpose:
 * - Automated verification that all tables with tenant_id have RLS enabled
 * - Session variable consistency checks
 * - Policy completeness verification
 * - Performance index checks
 *
 * This migration creates verification functions that can be:
 * 1. Run manually for audits
 * 2. Integrated into CI/CD pipelines
 * 3. Scheduled for periodic compliance checks
 */

-- =====================================================
-- CREATE VERIFICATION FUNCTION: Tables Missing RLS
-- =====================================================

CREATE OR REPLACE FUNCTION verify_rls_coverage()
RETURNS TABLE (
  table_name TEXT,
  has_tenant_id BOOLEAN,
  rls_enabled BOOLEAN,
  policy_count INTEGER,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT AS table_name,
    (c.column_name IS NOT NULL) AS has_tenant_id,
    t.rowsecurity AS rls_enabled,
    COUNT(p.policyname)::INTEGER AS policy_count,
    CASE
      WHEN c.column_name IS NOT NULL AND NOT t.rowsecurity THEN '❌ MISSING RLS'
      WHEN c.column_name IS NOT NULL AND t.rowsecurity AND COUNT(p.policyname) = 0 THEN '⚠️ RLS ENABLED BUT NO POLICIES'
      WHEN c.column_name IS NOT NULL AND t.rowsecurity AND COUNT(p.policyname) > 0 THEN '✅ PROTECTED'
      ELSE '✅ NO TENANT_ID (OK)'
    END AS status
  FROM pg_tables t
  LEFT JOIN information_schema.columns c
    ON c.table_name = t.tablename
    AND c.table_schema = t.schemaname
    AND c.column_name = 'tenant_id'
  LEFT JOIN pg_policies p
    ON p.tablename = t.tablename
    AND p.schemaname = t.schemaname
  WHERE t.schemaname = 'public'
    AND t.tablename NOT LIKE 'pg_%'
    AND t.tablename NOT LIKE 'sql_%'
  GROUP BY t.tablename, t.schemaname, c.column_name, t.rowsecurity
  ORDER BY
    CASE
      WHEN c.column_name IS NOT NULL AND NOT t.rowsecurity THEN 1
      WHEN c.column_name IS NOT NULL AND t.rowsecurity AND COUNT(p.policyname) = 0 THEN 2
      WHEN c.column_name IS NOT NULL AND t.rowsecurity THEN 3
      ELSE 4
    END,
    t.tablename;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_rls_coverage() IS
  'Verification function: Lists all tables and their RLS status (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE VERIFICATION FUNCTION: Session Variable Check
-- =====================================================

CREATE OR REPLACE FUNCTION verify_rls_session_variables()
RETURNS TABLE (
  table_name TEXT,
  policy_name TEXT,
  using_clause TEXT,
  with_check_clause TEXT,
  has_wrong_variable BOOLEAN,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.tablename::TEXT AS table_name,
    p.policyname::TEXT AS policy_name,
    pg_get_expr(p.polqual, p.polrelid)::TEXT AS using_clause,
    pg_get_expr(p.polwithcheck, p.polrelid)::TEXT AS with_check_clause,
    (
      pg_get_expr(p.polqual, p.polrelid) LIKE '%app.tenant_id%'
      OR pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%app.tenant_id%'
    ) AS has_wrong_variable,
    CASE
      WHEN pg_get_expr(p.polqual, p.polrelid) LIKE '%app.tenant_id%' THEN '❌ WRONG VARIABLE (app.tenant_id)'
      WHEN pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%app.tenant_id%' THEN '❌ WRONG VARIABLE IN WITH CHECK'
      WHEN pg_get_expr(p.polqual, p.polrelid) LIKE '%app.current_tenant_id%' THEN '✅ CORRECT VARIABLE'
      ELSE '⚠️ UNKNOWN PATTERN'
    END AS status
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  ORDER BY
    CASE
      WHEN pg_get_expr(p.polqual, p.polrelid) LIKE '%app.tenant_id%' THEN 1
      WHEN pg_get_expr(p.polwithcheck, p.polrelid) LIKE '%app.tenant_id%' THEN 1
      WHEN pg_get_expr(p.polqual, p.polrelid) LIKE '%app.current_tenant_id%' THEN 2
      ELSE 3
    END,
    p.tablename;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_rls_session_variables() IS
  'Verification function: Checks for policies using wrong session variable (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE VERIFICATION FUNCTION: WITH CHECK Completeness
-- =====================================================

CREATE OR REPLACE FUNCTION verify_rls_with_check()
RETURNS TABLE (
  table_name TEXT,
  policy_name TEXT,
  has_using BOOLEAN,
  has_with_check BOOLEAN,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.tablename::TEXT AS table_name,
    p.policyname::TEXT AS policy_name,
    (pg_get_expr(p.polqual, p.polrelid) IS NOT NULL) AS has_using,
    (pg_get_expr(p.polwithcheck, p.polrelid) IS NOT NULL) AS has_with_check,
    CASE
      WHEN pg_get_expr(p.polqual, p.polrelid) IS NOT NULL
        AND pg_get_expr(p.polwithcheck, p.polrelid) IS NULL THEN '⚠️ MISSING WITH CHECK'
      WHEN pg_get_expr(p.polqual, p.polrelid) IS NOT NULL
        AND pg_get_expr(p.polwithcheck, p.polrelid) IS NOT NULL THEN '✅ COMPLETE'
      ELSE '⚠️ UNUSUAL PATTERN'
    END AS status
  FROM pg_policies p
  WHERE p.schemaname = 'public'
  ORDER BY
    CASE
      WHEN pg_get_expr(p.polqual, p.polrelid) IS NOT NULL
        AND pg_get_expr(p.polwithcheck, p.polrelid) IS NULL THEN 1
      WHEN pg_get_expr(p.polqual, p.polrelid) IS NOT NULL
        AND pg_get_expr(p.polwithcheck, p.polrelid) IS NOT NULL THEN 2
      ELSE 3
    END,
    p.tablename;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_rls_with_check() IS
  'Verification function: Checks for policies missing WITH CHECK clause (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE VERIFICATION FUNCTION: Performance Indexes
-- =====================================================

CREATE OR REPLACE FUNCTION verify_rls_performance_indexes()
RETURNS TABLE (
  table_name TEXT,
  has_tenant_id_index BOOLEAN,
  index_name TEXT,
  status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.tablename::TEXT AS table_name,
    (i.indexname IS NOT NULL) AS has_tenant_id_index,
    COALESCE(i.indexname, 'NONE')::TEXT AS index_name,
    CASE
      WHEN c.column_name = 'tenant_id' AND i.indexname IS NULL THEN '⚠️ MISSING INDEX ON tenant_id'
      WHEN c.column_name = 'tenant_id' AND i.indexname IS NOT NULL THEN '✅ INDEXED'
      ELSE 'N/A'
    END AS status
  FROM pg_tables t
  LEFT JOIN information_schema.columns c
    ON c.table_name = t.tablename
    AND c.table_schema = t.schemaname
    AND c.column_name = 'tenant_id'
  LEFT JOIN pg_indexes i
    ON i.tablename = t.tablename
    AND i.schemaname = t.schemaname
    AND i.indexdef LIKE '%tenant_id%'
  WHERE t.schemaname = 'public'
    AND t.rowsecurity = true
    AND c.column_name = 'tenant_id'
  ORDER BY
    CASE
      WHEN c.column_name = 'tenant_id' AND i.indexname IS NULL THEN 1
      WHEN c.column_name = 'tenant_id' AND i.indexname IS NOT NULL THEN 2
      ELSE 3
    END,
    t.tablename;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION verify_rls_performance_indexes() IS
  'Verification function: Checks for missing tenant_id indexes (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- CREATE COMPREHENSIVE VERIFICATION REPORT
-- =====================================================

CREATE OR REPLACE FUNCTION generate_rls_verification_report()
RETURNS TEXT AS $$
DECLARE
  report TEXT := '';
  missing_rls_count INTEGER;
  wrong_variable_count INTEGER;
  missing_with_check_count INTEGER;
  missing_index_count INTEGER;
BEGIN
  -- Count issues
  SELECT COUNT(*) INTO missing_rls_count
  FROM verify_rls_coverage()
  WHERE status = '❌ MISSING RLS';

  SELECT COUNT(*) INTO wrong_variable_count
  FROM verify_rls_session_variables()
  WHERE has_wrong_variable = true;

  SELECT COUNT(*) INTO missing_with_check_count
  FROM verify_rls_with_check()
  WHERE status = '⚠️ MISSING WITH CHECK';

  SELECT COUNT(*) INTO missing_index_count
  FROM verify_rls_performance_indexes()
  WHERE status = '⚠️ MISSING INDEX ON tenant_id';

  -- Build report
  report := report || E'\n========================================\n';
  report := report || 'RLS VERIFICATION REPORT\n';
  report := report || 'REQ: REQ-STRATEGIC-AUTO-1767084329260\n';
  report := report || 'Generated: ' || NOW()::TEXT || E'\n';
  report := report || E'========================================\n\n';

  -- Summary
  report := report || E'SUMMARY:\n';
  report := report || '  ❌ Tables missing RLS: ' || missing_rls_count::TEXT || E'\n';
  report := report || '  ❌ Policies with wrong session variable: ' || wrong_variable_count::TEXT || E'\n';
  report := report || '  ⚠️  Policies missing WITH CHECK: ' || missing_with_check_count::TEXT || E'\n';
  report := report || '  ⚠️  Tables missing tenant_id index: ' || missing_index_count::TEXT || E'\n\n';

  -- Overall status
  IF missing_rls_count = 0 AND wrong_variable_count = 0 THEN
    report := report || E'✅ OVERALL STATUS: PASS\n';
    report := report || E'All critical RLS requirements are met.\n\n';
  ELSE
    report := report || E'❌ OVERALL STATUS: FAIL\n';
    report := report || E'Critical RLS issues detected. Review and fix immediately.\n\n';
  END IF;

  -- Details
  IF missing_rls_count > 0 THEN
    report := report || E'\nTABLES MISSING RLS:\n';
    report := report || E'------------------\n';
    report := report || (
      SELECT STRING_AGG('  - ' || table_name, E'\n' ORDER BY table_name)
      FROM verify_rls_coverage()
      WHERE status = '❌ MISSING RLS'
    );
    report := report || E'\n\n';
  END IF;

  IF wrong_variable_count > 0 THEN
    report := report || E'\nPOLICIES WITH WRONG SESSION VARIABLE:\n';
    report := report || E'-------------------------------------\n';
    report := report || (
      SELECT STRING_AGG('  - ' || table_name || '.' || policy_name, E'\n' ORDER BY table_name)
      FROM verify_rls_session_variables()
      WHERE has_wrong_variable = true
    );
    report := report || E'\n\n';
  END IF;

  report := report || E'========================================\n';
  report := report || E'For detailed results, run:\n';
  report := report || E'  SELECT * FROM verify_rls_coverage();\n';
  report := report || E'  SELECT * FROM verify_rls_session_variables();\n';
  report := report || E'  SELECT * FROM verify_rls_with_check();\n';
  report := report || E'  SELECT * FROM verify_rls_performance_indexes();\n';
  report := report || E'========================================\n';

  RETURN report;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_rls_verification_report() IS
  'Generates comprehensive RLS verification report (REQ-STRATEGIC-AUTO-1767084329260)';

-- =====================================================
-- RUN INITIAL VERIFICATION
-- =====================================================

DO $$
DECLARE
  report TEXT;
BEGIN
  -- Generate and display report
  SELECT generate_rls_verification_report() INTO report;
  RAISE NOTICE '%', report;

  -- Also log summary to table (if verification_logs table exists)
  -- CREATE TABLE IF NOT EXISTS verification_logs (
  --   id SERIAL PRIMARY KEY,
  --   check_type TEXT,
  --   status TEXT,
  --   report TEXT,
  --   created_at TIMESTAMPTZ DEFAULT NOW()
  -- );
  -- INSERT INTO verification_logs (check_type, status, report)
  -- VALUES ('RLS_VERIFICATION', 'COMPLETE', report);
END $$;

-- =====================================================
-- USAGE EXAMPLES
-- =====================================================

COMMENT ON FUNCTION verify_rls_coverage() IS
  'Usage: SELECT * FROM verify_rls_coverage() WHERE status LIKE ''❌%'';';

COMMENT ON FUNCTION verify_rls_session_variables() IS
  'Usage: SELECT * FROM verify_rls_session_variables() WHERE has_wrong_variable = true;';

COMMENT ON FUNCTION verify_rls_with_check() IS
  'Usage: SELECT * FROM verify_rls_with_check() WHERE status = ''⚠️ MISSING WITH CHECK'';';

COMMENT ON FUNCTION verify_rls_performance_indexes() IS
  'Usage: SELECT * FROM verify_rls_performance_indexes() WHERE status LIKE ''⚠️%'';';

COMMENT ON FUNCTION generate_rls_verification_report() IS
  'Usage: SELECT generate_rls_verification_report();';
