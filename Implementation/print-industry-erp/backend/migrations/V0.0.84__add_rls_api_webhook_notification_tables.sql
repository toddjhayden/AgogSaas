/**
 * Add Row-Level Security to API, Webhook, and Notification Tables
 * Version: V0.0.84
 * REQ: REQ-1767508090235-mvcn3 - Multi-Tenant Row-Level Security Implementation
 *
 * This migration completes RLS implementation for tables created in V0.0.80-82:
 * - api_rate_limit_buckets (indirect tenant isolation via api_keys)
 * - notification_templates (nullable tenant_id for system/tenant templates)
 * - notification_events (direct tenant isolation)
 *
 * Design Decisions:
 * - api_rate_limit_buckets: Uses JOIN to api_keys for tenant isolation
 * - notification_templates: Allows NULL tenant_id for system-wide templates
 * - notification_events: Direct tenant_id isolation
 * - System-wide tables (notification_types, webhook_event_types) don't get RLS
 */

-- =====================================================
-- API RATE LIMIT BUCKETS - INDIRECT TENANT ISOLATION
-- =====================================================

ALTER TABLE api_rate_limit_buckets ENABLE ROW LEVEL SECURITY;

-- Policy: Access buckets only for API keys belonging to current tenant
CREATE POLICY api_rate_limit_buckets_tenant_isolation ON api_rate_limit_buckets
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM api_keys
      WHERE api_keys.id = api_rate_limit_buckets.api_key_id
        AND api_keys.tenant_id = current_setting('app.current_tenant_id', true)::UUID
    )
  );

COMMENT ON POLICY api_rate_limit_buckets_tenant_isolation ON api_rate_limit_buckets IS
  'RLS: Rate limit buckets isolated via api_keys.tenant_id join (REQ-1767508090235-mvcn3)';

-- =====================================================
-- NOTIFICATION TEMPLATES - HYBRID ISOLATION
-- =====================================================

ALTER TABLE notification_templates ENABLE ROW LEVEL SECURITY;

-- Policy: Access system templates (tenant_id IS NULL) OR own tenant templates
CREATE POLICY notification_templates_tenant_isolation ON notification_templates
  FOR ALL
  USING (
    tenant_id IS NULL  -- System-wide templates accessible to all
    OR tenant_id = current_setting('app.current_tenant_id', true)::UUID
  )
  WITH CHECK (
    -- Can only create/update templates for own tenant (not system templates)
    tenant_id = current_setting('app.current_tenant_id', true)::UUID
  );

COMMENT ON POLICY notification_templates_tenant_isolation ON notification_templates IS
  'RLS: Templates with NULL tenant_id are system-wide; others are tenant-isolated (REQ-1767508090235-mvcn3)';

-- =====================================================
-- NOTIFICATION EVENTS - DIRECT TENANT ISOLATION
-- =====================================================

ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;

-- Policy: Standard tenant isolation
CREATE POLICY notification_events_tenant_isolation ON notification_events
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

COMMENT ON POLICY notification_events_tenant_isolation ON notification_events IS
  'RLS: Notification events tenant isolation (REQ-1767508090235-mvcn3)';

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  tables_with_rls INTEGER;
  missing_rls_count INTEGER;
BEGIN
  -- Verify RLS is enabled on all 3 tables
  SELECT COUNT(*)
  INTO tables_with_rls
  FROM pg_tables t
  WHERE t.schemaname = 'public'
    AND t.tablename IN ('api_rate_limit_buckets', 'notification_templates', 'notification_events')
    AND t.rowsecurity = true;

  IF tables_with_rls != 3 THEN
    RAISE EXCEPTION 'Expected 3 tables with RLS enabled, found %', tables_with_rls;
  END IF;

  -- Verify policies exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'api_rate_limit_buckets'
      AND policyname = 'api_rate_limit_buckets_tenant_isolation'
  ) THEN
    RAISE EXCEPTION 'Missing RLS policy for api_rate_limit_buckets';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_templates'
      AND policyname = 'notification_templates_tenant_isolation'
  ) THEN
    RAISE EXCEPTION 'Missing RLS policy for notification_templates';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notification_events'
      AND policyname = 'notification_events_tenant_isolation'
  ) THEN
    RAISE EXCEPTION 'Missing RLS policy for notification_events';
  END IF;

  -- Check for any tenant-scoped tables without RLS (excluding system tables)
  SELECT COUNT(*)
  INTO missing_rls_count
  FROM information_schema.columns c
  JOIN pg_tables t ON t.schemaname = c.table_schema AND t.tablename = c.table_name
  WHERE c.table_schema = 'public'
    AND c.column_name = 'tenant_id'
    AND t.rowsecurity = false
    AND t.tablename NOT IN (
      -- Known system/reference tables without tenant_id or with nullable tenant_id for system records
      'notification_types',
      'webhook_event_types',
      'schema_migrations'
    );

  IF missing_rls_count > 0 THEN
    RAISE WARNING '⚠️  Found % tables with tenant_id but no RLS enabled - manual review recommended', missing_rls_count;

    -- List the tables for debugging
    FOR rec IN (
      SELECT DISTINCT t.tablename
      FROM information_schema.columns c
      JOIN pg_tables t ON t.schemaname = c.table_schema AND t.tablename = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'tenant_id'
        AND t.rowsecurity = false
        AND t.tablename NOT IN ('notification_types', 'webhook_event_types', 'schema_migrations')
      ORDER BY t.tablename
    ) LOOP
      RAISE WARNING '  - Table without RLS: %', rec.tablename;
    END LOOP;
  ELSE
    RAISE NOTICE '✅ All tenant-scoped tables have RLS enabled';
  END IF;

  RAISE NOTICE '✅ RLS policies successfully added to 3 tables (api_rate_limit_buckets, notification_templates, notification_events)';
END $$;
