/**
 * MIGRATION: V0.0.25 - Add RLS Policies and CHECK Constraints to Vendor Performance
 *
 * Purpose: Enhance security and data integrity for vendor scorecard feature
 * Feature: REQ-STRATEGIC-AUTO-1766657618088 - Vendor Scorecards
 * Author: Roy (Backend specialist)
 * Date: 2025-12-25
 *
 * Changes:
 * 1. Enable Row-Level Security (RLS) on vendor_performance table
 * 2. Add RLS policy for tenant isolation (defense-in-depth)
 * 3. Add CHECK constraints for data integrity (ratings, percentages, dates)
 *
 * Security Pattern:
 * - RLS policies enforce tenant isolation at database level
 * - Application layer also validates tenant access (belt-and-suspenders)
 * - CHECK constraints prevent invalid data at write time
 *
 * Related Files:
 * - backend/src/common/security/tenant-validation.ts (application-level validation)
 * - backend/src/common/validation/procurement-dtos.ts (input validation)
 * - backend/src/graphql/resolvers/sales-materials.resolver.ts (GraphQL resolvers)
 */

-- =====================================================
-- STEP 1: Enable Row-Level Security
-- =====================================================

-- Enable RLS on vendor_performance table
ALTER TABLE vendor_performance ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE vendor_performance IS
'Vendor performance metrics with monthly tracking. RLS enabled for multi-tenant isolation.';

-- =====================================================
-- STEP 2: Create RLS Policies
-- =====================================================

-- Policy: Tenant isolation for vendor performance
-- Ensures users can only access vendor performance data from their own tenant
-- Uses current_setting to get tenant_id from application context
CREATE POLICY vendor_performance_tenant_isolation ON vendor_performance
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY vendor_performance_tenant_isolation ON vendor_performance IS
'Enforces multi-tenant isolation: users can only access vendor performance data from their own tenant';

-- =====================================================
-- STEP 3: Add CHECK Constraints for Data Integrity
-- =====================================================

-- Constraint: Overall rating must be between 0.0 and 5.0 (5-star scale)
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_overall_rating_range
  CHECK (overall_rating IS NULL OR (overall_rating >= 0 AND overall_rating <= 5));

COMMENT ON CONSTRAINT check_overall_rating_range ON vendor_performance IS
'Ensures overall_rating is within 0.0-5.0 range (5-star scale)';

-- Constraint: Price competitiveness score must be between 0.0 and 5.0
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_price_score_range
  CHECK (price_competitiveness_score IS NULL OR (price_competitiveness_score >= 0 AND price_competitiveness_score <= 5));

COMMENT ON CONSTRAINT check_price_score_range ON vendor_performance IS
'Ensures price_competitiveness_score is within 0.0-5.0 range (5-star scale)';

-- Constraint: Responsiveness score must be between 0.0 and 5.0
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_responsiveness_score_range
  CHECK (responsiveness_score IS NULL OR (responsiveness_score >= 0 AND responsiveness_score <= 5));

COMMENT ON CONSTRAINT check_responsiveness_score_range ON vendor_performance IS
'Ensures responsiveness_score is within 0.0-5.0 range (5-star scale)';

-- Constraint: On-time percentage must be between 0 and 100
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_on_time_percentage_range
  CHECK (on_time_percentage IS NULL OR (on_time_percentage >= 0 AND on_time_percentage <= 100));

COMMENT ON CONSTRAINT check_on_time_percentage_range ON vendor_performance IS
'Ensures on_time_percentage is within 0-100 range';

-- Constraint: Quality percentage must be between 0 and 100
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_quality_percentage_range
  CHECK (quality_percentage IS NULL OR (quality_percentage >= 0 AND quality_percentage <= 100));

COMMENT ON CONSTRAINT check_quality_percentage_range ON vendor_performance IS
'Ensures quality_percentage is within 0-100 range';

-- Constraint: Month must be between 1 and 12
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_evaluation_month_range
  CHECK (evaluation_period_month >= 1 AND evaluation_period_month <= 12);

COMMENT ON CONSTRAINT check_evaluation_month_range ON vendor_performance IS
'Ensures evaluation_period_month is a valid calendar month (1-12)';

-- Constraint: Year must be within reasonable business range (2020-2100)
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_evaluation_year_range
  CHECK (evaluation_period_year >= 2020 AND evaluation_period_year <= 2100);

COMMENT ON CONSTRAINT check_evaluation_year_range ON vendor_performance IS
'Ensures evaluation_period_year is within reasonable business range (2020-2100)';

-- Constraint: Total deliveries must be non-negative
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_total_deliveries_non_negative
  CHECK (total_deliveries >= 0);

COMMENT ON CONSTRAINT check_total_deliveries_non_negative ON vendor_performance IS
'Ensures total_deliveries is non-negative';

-- Constraint: On-time deliveries cannot exceed total deliveries
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_on_time_deliveries_valid
  CHECK (on_time_deliveries >= 0 AND on_time_deliveries <= total_deliveries);

COMMENT ON CONSTRAINT check_on_time_deliveries_valid ON vendor_performance IS
'Ensures on_time_deliveries is non-negative and does not exceed total_deliveries';

-- Constraint: Quality acceptances must be non-negative
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_quality_acceptances_non_negative
  CHECK (quality_acceptances >= 0);

COMMENT ON CONSTRAINT check_quality_acceptances_non_negative ON vendor_performance IS
'Ensures quality_acceptances is non-negative';

-- Constraint: Quality rejections must be non-negative
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_quality_rejections_non_negative
  CHECK (quality_rejections >= 0);

COMMENT ON CONSTRAINT check_quality_rejections_non_negative ON vendor_performance IS
'Ensures quality_rejections is non-negative';

-- Constraint: Total POs issued must be non-negative
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_total_pos_issued_non_negative
  CHECK (total_pos_issued >= 0);

COMMENT ON CONSTRAINT check_total_pos_issued_non_negative ON vendor_performance IS
'Ensures total_pos_issued is non-negative';

-- Constraint: Total POs value must be non-negative
ALTER TABLE vendor_performance
  ADD CONSTRAINT check_total_pos_value_non_negative
  CHECK (total_pos_value >= 0);

COMMENT ON CONSTRAINT check_total_pos_value_non_negative ON vendor_performance IS
'Ensures total_pos_value is non-negative';

-- =====================================================
-- STEP 4: Verification and Documentation
-- =====================================================

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'vendor_performance') THEN
    RAISE EXCEPTION 'RLS not enabled on vendor_performance table';
  END IF;

  RAISE NOTICE 'RLS successfully enabled on vendor_performance table';
END $$;

-- Verify policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vendor_performance'
    AND policyname = 'vendor_performance_tenant_isolation'
  ) THEN
    RAISE EXCEPTION 'RLS policy vendor_performance_tenant_isolation not created';
  END IF;

  RAISE NOTICE 'RLS policy vendor_performance_tenant_isolation successfully created';
END $$;

-- Count CHECK constraints added
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.check_constraints
  WHERE constraint_schema = 'public'
  AND constraint_name LIKE 'check_%'
  AND table_name = 'vendor_performance';

  RAISE NOTICE 'Total CHECK constraints on vendor_performance: %', constraint_count;

  IF constraint_count < 14 THEN
    RAISE WARNING 'Expected at least 14 CHECK constraints, found %', constraint_count;
  END IF;
END $$;

/**
 * TESTING NOTES:
 *
 * To test RLS policy:
 * 1. Set current tenant context:
 *    SET app.current_tenant_id = 'your-tenant-uuid';
 *
 * 2. Query should only return data for that tenant:
 *    SELECT * FROM vendor_performance;
 *
 * 3. Attempting to query different tenant should return empty:
 *    SELECT * FROM vendor_performance WHERE tenant_id != current_setting('app.current_tenant_id')::UUID;
 *
 * To test CHECK constraints:
 * 1. Attempt invalid rating (should fail):
 *    INSERT INTO vendor_performance (..., overall_rating) VALUES (..., 6.0);
 *    -- Expected: ERROR: new row violates check constraint "check_overall_rating_range"
 *
 * 2. Attempt invalid month (should fail):
 *    INSERT INTO vendor_performance (..., evaluation_period_month) VALUES (..., 13);
 *    -- Expected: ERROR: new row violates check constraint "check_evaluation_month_range"
 *
 * 3. Attempt on_time_deliveries > total_deliveries (should fail):
 *    INSERT INTO vendor_performance (..., total_deliveries, on_time_deliveries) VALUES (..., 10, 15);
 *    -- Expected: ERROR: new row violates check constraint "check_on_time_deliveries_valid"
 */

-- Migration completed successfully
SELECT 'Migration V0.0.25 completed: RLS policies and CHECK constraints added to vendor_performance table' AS status;
