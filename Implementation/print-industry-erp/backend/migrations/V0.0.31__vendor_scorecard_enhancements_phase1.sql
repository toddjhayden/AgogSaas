/**
 * MIGRATION: V0.0.29 - Vendor Scorecard Enhancements (Phase 1)
 *
 * Purpose: Implement Phase 1 of vendor scorecard system enhancements
 * Feature: REQ-STRATEGIC-AUTO-1766657618088 - Vendor Scorecards
 * Author: Roy (Backend Developer) via Marcus
 * Date: 2025-12-25
 *
 * Phase 1 Scope (Foundation - Weeks 1-2):
 * 1. Manual score input mechanism (Gap 1)
 * 2. Vendor tier segmentation (Gap 3)
 * 3. Automated alert system (Gap 2)
 * 4. Batch calculation scheduling support (Gap 7)
 *
 * Changes:
 * 1. Add vendor_tier column to vendors table with CHECK constraint
 * 2. Add tier_calculation_basis JSONB column for tier assignment audit trail
 * 3. Create vendor_performance_alerts table with RLS and CHECK constraints
 * 4. Add performance indexes for alert queries
 *
 * Research Deliverable: CYNTHIA_RESEARCH_DELIVERABLE_REQ-STRATEGIC-AUTO-1766657618088_FINAL.md
 * Critique Deliverable: SYLVIA_CRITIQUE_DELIVERABLE_REQ-STRATEGIC-AUTO-1766657618088.md
 *
 * Related Files:
 * - backend/src/modules/procurement/services/vendor-performance.service.ts (extend)
 * - backend/src/modules/procurement/services/vendor-alert.service.ts (new)
 * - backend/src/graphql/schema/vendor-performance.graphql (extend)
 * - backend/src/graphql/schema/vendor-alerts.graphql (new)
 */

-- =====================================================
-- STEP 1: Add Vendor Tier Segmentation to vendors table
-- =====================================================

-- Add vendor_tier column with CHECK constraint
-- Tiers: STRATEGIC (high-spend, critical), PREFERRED (medium-spend, proven), TRANSACTIONAL (low-spend, commodity)
ALTER TABLE vendors
  ADD COLUMN vendor_tier VARCHAR(20) DEFAULT 'TRANSACTIONAL'
  CHECK (vendor_tier IN ('STRATEGIC', 'PREFERRED', 'TRANSACTIONAL'));

COMMENT ON COLUMN vendors.vendor_tier IS
'Vendor tier segmentation: STRATEGIC (high-spend, critical), PREFERRED (medium-spend, proven), TRANSACTIONAL (low-spend, commodity). Default: TRANSACTIONAL';

-- Add tier_calculation_basis column for audit trail
-- Stores JSON object with criteria used for tier assignment
-- Example: {"annual_spend": 250000, "material_types": ["SUBSTRATE", "INK"], "assigned_by_user_id": "...", "assigned_at": "2025-12-25T10:30:00Z"}
ALTER TABLE vendors
  ADD COLUMN tier_calculation_basis JSONB;

COMMENT ON COLUMN vendors.tier_calculation_basis IS
'Audit trail for vendor tier assignment. Stores criteria used: annual_spend, material_types, assigned_by_user_id, assigned_at, rationale';

-- Create index for tier queries
CREATE INDEX idx_vendors_tier ON vendors(vendor_tier);

COMMENT ON INDEX idx_vendors_tier IS
'Performance index for vendor tier filtering queries';

-- =====================================================
-- STEP 2: Create vendor_performance_alerts table
-- =====================================================

-- Automated alert system for vendor performance issues
-- Alert types: CRITICAL (immediate action), WARNING (review needed), TREND (declining performance)
-- Alert categories: OTD (on-time delivery), QUALITY (quality issues), RATING (overall rating), COMPLIANCE (certifications)
CREATE TABLE vendor_performance_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  vendor_id UUID NOT NULL,

  -- Alert classification
  alert_type VARCHAR(50) NOT NULL
    CHECK (alert_type IN ('CRITICAL', 'WARNING', 'TREND')),
  alert_category VARCHAR(50) NOT NULL
    CHECK (alert_category IN ('OTD', 'QUALITY', 'RATING', 'COMPLIANCE')),

  -- Alert details
  alert_message TEXT NOT NULL,
  metric_value DECIMAL(10,4),
  threshold_value DECIMAL(10,4),

  -- Alert status workflow
  alert_status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
    CHECK (alert_status IN ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),

  -- Status transitions
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by_user_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by_user_id UUID,
  dismissal_reason TEXT,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,

  -- Foreign keys
  CONSTRAINT fk_vendor_alert_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_vendor_alert_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
  CONSTRAINT fk_vendor_alert_acknowledged_by FOREIGN KEY (acknowledged_by_user_id) REFERENCES users(id),
  CONSTRAINT fk_vendor_alert_resolved_by FOREIGN KEY (resolved_by_user_id) REFERENCES users(id)
);

-- Additional CHECK constraints for data integrity

-- Constraint: Metric value must be non-negative
ALTER TABLE vendor_performance_alerts
  ADD CONSTRAINT check_metric_value_non_negative
  CHECK (metric_value IS NULL OR metric_value >= 0);

COMMENT ON CONSTRAINT check_metric_value_non_negative ON vendor_performance_alerts IS
'Ensures metric_value is non-negative (percentages, ratings, counts)';

-- Constraint: Threshold value must be non-negative
ALTER TABLE vendor_performance_alerts
  ADD CONSTRAINT check_threshold_value_non_negative
  CHECK (threshold_value IS NULL OR threshold_value >= 0);

COMMENT ON CONSTRAINT check_threshold_value_non_negative ON vendor_performance_alerts IS
'Ensures threshold_value is non-negative (percentages, ratings, counts)';

-- Constraint: Acknowledged timestamp implies acknowledged_by_user_id
ALTER TABLE vendor_performance_alerts
  ADD CONSTRAINT check_acknowledged_complete
  CHECK (
    (acknowledged_at IS NULL AND acknowledged_by_user_id IS NULL) OR
    (acknowledged_at IS NOT NULL AND acknowledged_by_user_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT check_acknowledged_complete ON vendor_performance_alerts IS
'Ensures acknowledged_at and acknowledged_by_user_id are both present or both absent';

-- Constraint: Resolved timestamp implies resolved_by_user_id
ALTER TABLE vendor_performance_alerts
  ADD CONSTRAINT check_resolved_complete
  CHECK (
    (resolved_at IS NULL AND resolved_by_user_id IS NULL) OR
    (resolved_at IS NOT NULL AND resolved_by_user_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT check_resolved_complete ON vendor_performance_alerts IS
'Ensures resolved_at and resolved_by_user_id are both present or both absent';

-- Constraint: Dismissal reason required if status is DISMISSED
ALTER TABLE vendor_performance_alerts
  ADD CONSTRAINT check_dismissal_reason_required
  CHECK (
    (alert_status != 'DISMISSED') OR
    (alert_status = 'DISMISSED' AND dismissal_reason IS NOT NULL)
  );

COMMENT ON CONSTRAINT check_dismissal_reason_required ON vendor_performance_alerts IS
'Ensures dismissal_reason is provided when alert_status is DISMISSED';

-- Constraint: Status workflow logic
-- ACTIVE can transition to ACKNOWLEDGED, RESOLVED, or DISMISSED
-- ACKNOWLEDGED can transition to RESOLVED or DISMISSED
-- RESOLVED and DISMISSED are terminal states
ALTER TABLE vendor_performance_alerts
  ADD CONSTRAINT check_status_workflow
  CHECK (
    (alert_status = 'ACTIVE' AND acknowledged_at IS NULL AND resolved_at IS NULL) OR
    (alert_status = 'ACKNOWLEDGED' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL) OR
    (alert_status = 'RESOLVED' AND resolved_at IS NOT NULL) OR
    (alert_status = 'DISMISSED')
  );

COMMENT ON CONSTRAINT check_status_workflow ON vendor_performance_alerts IS
'Enforces alert status workflow: ACTIVE → ACKNOWLEDGED → RESOLVED, or direct to DISMISSED';

COMMENT ON TABLE vendor_performance_alerts IS
'Automated vendor performance alerts with workflow tracking. Alert types: CRITICAL (OTD <80%, Quality <85%, Rating <2.0), WARNING (OTD 80-90%, Quality 85-95%, Rating 2.0-3.0), TREND (DECLINING for 3+ months)';

-- =====================================================
-- STEP 3: Create Performance Indexes
-- =====================================================

-- Indexes for vendor_performance_alerts table

-- Index: Tenant isolation (required for RLS performance)
CREATE INDEX idx_vendor_alerts_tenant ON vendor_performance_alerts(tenant_id);

COMMENT ON INDEX idx_vendor_alerts_tenant IS
'Performance index for tenant isolation queries';

-- Index: Vendor lookup (most common query pattern)
CREATE INDEX idx_vendor_alerts_vendor ON vendor_performance_alerts(vendor_id);

COMMENT ON INDEX idx_vendor_alerts_vendor IS
'Performance index for vendor alert lookup queries';

-- Index: Alert status filtering (dashboard displays)
CREATE INDEX idx_vendor_alerts_status ON vendor_performance_alerts(alert_status);

COMMENT ON INDEX idx_vendor_alerts_status IS
'Performance index for alert status filtering (ACTIVE, ACKNOWLEDGED, etc.)';

-- Index: Alert type and category filtering
CREATE INDEX idx_vendor_alerts_type_category ON vendor_performance_alerts(alert_type, alert_category);

COMMENT ON INDEX idx_vendor_alerts_type_category IS
'Performance index for alert type and category filtering (CRITICAL/OTD, WARNING/QUALITY, etc.)';

-- Index: Creation date DESC (recent alerts first)
CREATE INDEX idx_vendor_alerts_created ON vendor_performance_alerts(created_at DESC);

COMMENT ON INDEX idx_vendor_alerts_created IS
'Performance index for recent alerts sorting (DESC order for dashboards)';

-- Composite index: Active alerts by vendor (most common dashboard query)
CREATE INDEX idx_vendor_alerts_active_vendor ON vendor_performance_alerts(vendor_id, alert_status) WHERE alert_status = 'ACTIVE';

COMMENT ON INDEX idx_vendor_alerts_active_vendor IS
'Partial index for active alerts by vendor (optimizes dashboard queries)';

-- =====================================================
-- STEP 4: Enable Row-Level Security (RLS)
-- =====================================================

-- Enable RLS on vendor_performance_alerts table
ALTER TABLE vendor_performance_alerts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE vendor_performance_alerts IS
'Automated vendor performance alerts with workflow tracking. RLS enabled for multi-tenant isolation.';

-- Create RLS policy for tenant isolation
CREATE POLICY vendor_performance_alerts_tenant_isolation ON vendor_performance_alerts
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY vendor_performance_alerts_tenant_isolation ON vendor_performance_alerts IS
'Enforces multi-tenant isolation: users can only access alerts from their own tenant';

-- =====================================================
-- STEP 5: Alert Threshold Configuration (Seed Data)
-- =====================================================

-- Create alert_thresholds configuration table (optional - can be hardcoded in service layer)
-- This table allows per-tenant customization of alert thresholds
CREATE TABLE vendor_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,

  -- Threshold configuration
  threshold_name VARCHAR(100) NOT NULL,
  threshold_type VARCHAR(50) NOT NULL
    CHECK (threshold_type IN ('OTD_CRITICAL', 'OTD_WARNING', 'QUALITY_CRITICAL', 'QUALITY_WARNING', 'RATING_CRITICAL', 'RATING_WARNING', 'TREND_DECLINING')),

  -- Threshold value
  threshold_value DECIMAL(10,4) NOT NULL,
  threshold_operator VARCHAR(10) NOT NULL
    CHECK (threshold_operator IN ('<', '<=', '>', '>=', '=')),

  -- Configuration
  is_active BOOLEAN DEFAULT TRUE,
  description TEXT,

  -- Audit trail
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  created_by UUID,
  updated_by UUID,

  -- Foreign keys
  CONSTRAINT fk_alert_threshold_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_alert_threshold_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_alert_threshold_updated_by FOREIGN KEY (updated_by) REFERENCES users(id),

  -- Unique constraint
  CONSTRAINT uq_alert_threshold UNIQUE (tenant_id, threshold_type)
);

COMMENT ON TABLE vendor_alert_thresholds IS
'Configurable alert thresholds per tenant. Allows customization of alert rules (e.g., OTD_CRITICAL <80%, QUALITY_WARNING 85-95%)';

-- Indexes for vendor_alert_thresholds
CREATE INDEX idx_alert_thresholds_tenant ON vendor_alert_thresholds(tenant_id);
CREATE INDEX idx_alert_thresholds_type ON vendor_alert_thresholds(threshold_type);
CREATE INDEX idx_alert_thresholds_active ON vendor_alert_thresholds(is_active);

-- Enable RLS on vendor_alert_thresholds
ALTER TABLE vendor_alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY vendor_alert_thresholds_tenant_isolation ON vendor_alert_thresholds
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY vendor_alert_thresholds_tenant_isolation ON vendor_alert_thresholds IS
'Enforces multi-tenant isolation for alert threshold configuration';

-- Insert default thresholds (can be overridden per tenant)
-- NOTE: These are examples and may be adjusted based on business requirements

-- OTD (On-Time Delivery) Thresholds
INSERT INTO vendor_alert_thresholds (tenant_id, threshold_name, threshold_type, threshold_value, threshold_operator, description)
SELECT
  t.id AS tenant_id,
  'OTD Critical Threshold',
  'OTD_CRITICAL',
  80.0,
  '<',
  'Generate CRITICAL alert when on-time delivery percentage falls below 80%'
FROM tenants t
ON CONFLICT (tenant_id, threshold_type) DO NOTHING;

INSERT INTO vendor_alert_thresholds (tenant_id, threshold_name, threshold_type, threshold_value, threshold_operator, description)
SELECT
  t.id AS tenant_id,
  'OTD Warning Threshold',
  'OTD_WARNING',
  90.0,
  '<',
  'Generate WARNING alert when on-time delivery percentage falls below 90%'
FROM tenants t
ON CONFLICT (tenant_id, threshold_type) DO NOTHING;

-- Quality Thresholds
INSERT INTO vendor_alert_thresholds (tenant_id, threshold_name, threshold_type, threshold_value, threshold_operator, description)
SELECT
  t.id AS tenant_id,
  'Quality Critical Threshold',
  'QUALITY_CRITICAL',
  85.0,
  '<',
  'Generate CRITICAL alert when quality acceptance percentage falls below 85%'
FROM tenants t
ON CONFLICT (tenant_id, threshold_type) DO NOTHING;

INSERT INTO vendor_alert_thresholds (tenant_id, threshold_name, threshold_type, threshold_value, threshold_operator, description)
SELECT
  t.id AS tenant_id,
  'Quality Warning Threshold',
  'QUALITY_WARNING',
  95.0,
  '<',
  'Generate WARNING alert when quality acceptance percentage falls below 95%'
FROM tenants t
ON CONFLICT (tenant_id, threshold_type) DO NOTHING;

-- Rating Thresholds
INSERT INTO vendor_alert_thresholds (tenant_id, threshold_name, threshold_type, threshold_value, threshold_operator, description)
SELECT
  t.id AS tenant_id,
  'Rating Critical Threshold',
  'RATING_CRITICAL',
  2.0,
  '<',
  'Generate CRITICAL alert when overall rating falls below 2.0 stars'
FROM tenants t
ON CONFLICT (tenant_id, threshold_type) DO NOTHING;

INSERT INTO vendor_alert_thresholds (tenant_id, threshold_name, threshold_type, threshold_value, threshold_operator, description)
SELECT
  t.id AS tenant_id,
  'Rating Warning Threshold',
  'RATING_WARNING',
  3.0,
  '<',
  'Generate WARNING alert when overall rating falls below 3.0 stars'
FROM tenants t
ON CONFLICT (tenant_id, threshold_type) DO NOTHING;

-- Trend Thresholds
INSERT INTO vendor_alert_thresholds (tenant_id, threshold_name, threshold_type, threshold_value, threshold_operator, description)
SELECT
  t.id AS tenant_id,
  'Declining Trend Threshold',
  'TREND_DECLINING',
  3.0,
  '>=',
  'Generate TREND alert when performance declines for 3 or more consecutive months'
FROM tenants t
ON CONFLICT (tenant_id, threshold_type) DO NOTHING;

-- =====================================================
-- STEP 6: Verification and Documentation
-- =====================================================

-- Verify vendor_tier column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors'
    AND column_name = 'vendor_tier'
  ) THEN
    RAISE EXCEPTION 'vendor_tier column not created on vendors table';
  END IF;

  RAISE NOTICE 'vendor_tier column successfully added to vendors table';
END $$;

-- Verify tier_calculation_basis column exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'vendors'
    AND column_name = 'tier_calculation_basis'
  ) THEN
    RAISE EXCEPTION 'tier_calculation_basis column not created on vendors table';
  END IF;

  RAISE NOTICE 'tier_calculation_basis column successfully added to vendors table';
END $$;

-- Verify vendor_performance_alerts table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'vendor_performance_alerts'
  ) THEN
    RAISE EXCEPTION 'vendor_performance_alerts table not created';
  END IF;

  RAISE NOTICE 'vendor_performance_alerts table successfully created';
END $$;

-- Verify RLS is enabled on vendor_performance_alerts
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'vendor_performance_alerts') THEN
    RAISE EXCEPTION 'RLS not enabled on vendor_performance_alerts table';
  END IF;

  RAISE NOTICE 'RLS successfully enabled on vendor_performance_alerts table';
END $$;

-- Verify RLS policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vendor_performance_alerts'
    AND policyname = 'vendor_performance_alerts_tenant_isolation'
  ) THEN
    RAISE EXCEPTION 'RLS policy vendor_performance_alerts_tenant_isolation not created';
  END IF;

  RAISE NOTICE 'RLS policy vendor_performance_alerts_tenant_isolation successfully created';
END $$;

-- Count CHECK constraints on vendor_performance_alerts
DO $$
DECLARE
  constraint_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO constraint_count
  FROM information_schema.check_constraints cc
  JOIN information_schema.constraint_column_usage ccu
    ON cc.constraint_name = ccu.constraint_name
  WHERE ccu.table_name = 'vendor_performance_alerts'
  AND cc.constraint_schema = 'public';

  RAISE NOTICE 'Total CHECK constraints on vendor_performance_alerts: %', constraint_count;

  IF constraint_count < 9 THEN
    RAISE WARNING 'Expected at least 9 CHECK constraints, found %', constraint_count;
  END IF;
END $$;

-- Count indexes on vendor_performance_alerts
DO $$
DECLARE
  index_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes
  WHERE tablename = 'vendor_performance_alerts';

  RAISE NOTICE 'Total indexes on vendor_performance_alerts: %', index_count;

  IF index_count < 6 THEN
    RAISE WARNING 'Expected at least 6 indexes, found %', index_count;
  END IF;
END $$;

-- Verify vendor_alert_thresholds table exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'vendor_alert_thresholds'
  ) THEN
    RAISE EXCEPTION 'vendor_alert_thresholds table not created';
  END IF;

  RAISE NOTICE 'vendor_alert_thresholds table successfully created';
END $$;

-- Count default thresholds seeded
DO $$
DECLARE
  threshold_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO threshold_count
  FROM vendor_alert_thresholds;

  RAISE NOTICE 'Default alert thresholds seeded: % (expected 7 per tenant)', threshold_count;
END $$;

/**
 * TESTING NOTES:
 *
 * 1. Test vendor_tier CHECK constraint:
 *    UPDATE vendors SET vendor_tier = 'INVALID' WHERE id = '...';
 *    -- Expected: ERROR: new row violates check constraint
 *
 * 2. Test vendor tier assignment:
 *    UPDATE vendors SET vendor_tier = 'STRATEGIC',
 *      tier_calculation_basis = '{"annual_spend": 500000, "assigned_at": "2025-12-25T10:00:00Z"}'
 *    WHERE vendor_code = 'VENDOR-001';
 *
 * 3. Test alert creation:
 *    INSERT INTO vendor_performance_alerts (tenant_id, vendor_id, alert_type, alert_category, alert_message, metric_value, threshold_value)
 *    VALUES ('...', '...', 'CRITICAL', 'OTD', 'On-time delivery dropped to 75%', 75.0, 80.0);
 *
 * 4. Test alert status workflow:
 *    -- Acknowledge alert
 *    UPDATE vendor_performance_alerts
 *    SET alert_status = 'ACKNOWLEDGED',
 *        acknowledged_at = NOW(),
 *        acknowledged_by_user_id = '...'
 *    WHERE id = '...';
 *
 *    -- Resolve alert
 *    UPDATE vendor_performance_alerts
 *    SET alert_status = 'RESOLVED',
 *        resolved_at = NOW(),
 *        resolved_by_user_id = '...'
 *    WHERE id = '...';
 *
 * 5. Test RLS policy:
 *    SET app.current_tenant_id = 'your-tenant-uuid';
 *    SELECT * FROM vendor_performance_alerts;
 *    -- Should only return alerts for current tenant
 *
 * 6. Query active alerts for a vendor:
 *    SELECT * FROM vendor_performance_alerts
 *    WHERE vendor_id = '...'
 *    AND alert_status = 'ACTIVE'
 *    ORDER BY created_at DESC;
 *
 * 7. Test alert threshold configuration:
 *    SELECT * FROM vendor_alert_thresholds WHERE tenant_id = '...';
 *
 *    -- Update threshold
 *    UPDATE vendor_alert_thresholds
 *    SET threshold_value = 85.0
 *    WHERE threshold_type = 'OTD_CRITICAL';
 */

-- Migration completed successfully
SELECT 'Migration V0.0.29 completed: Phase 1 vendor scorecard enhancements applied (vendor tiers, alerts, thresholds)' AS status;
