-- =====================================================
-- MIGRATION: V0.0.41 - Row-Level Security Policies
-- =====================================================
-- Purpose: Add RLS policies for multi-tenant data isolation
-- Critical for: SOC 2, GDPR compliance, tenant data segregation
-- Author: Roy (Backend Architect)
-- Date: 2025-12-29
-- REQ: REQ-STRATEGIC-AUTO-1767048328658
-- Sylvia Critique: HIGH PRIORITY - SECURITY
-- =====================================================

-- =====================================================
-- ENABLE RLS ON ALL PRODUCTION PLANNING TABLES
-- =====================================================

ALTER TABLE work_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE changeover_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE asset_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE oee_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE capacity_planning ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_operations ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES - TENANT ISOLATION
-- =====================================================
-- All policies use current_setting('app.current_tenant_id')
-- which must be set by the application layer before queries

-- Work Centers
CREATE POLICY work_centers_tenant_isolation ON work_centers
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Production Orders
CREATE POLICY production_orders_tenant_isolation ON production_orders
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Production Runs
CREATE POLICY production_runs_tenant_isolation ON production_runs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Operations (supports both tenant-specific and global operations)
CREATE POLICY operations_tenant_isolation ON operations
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        OR tenant_id IS NULL -- Global operations catalog shared across tenants
    );

-- Changeover Details
CREATE POLICY changeover_details_tenant_isolation ON changeover_details
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Equipment Status Log
CREATE POLICY equipment_status_log_tenant_isolation ON equipment_status_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Maintenance Records
CREATE POLICY maintenance_records_tenant_isolation ON maintenance_records
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Asset Hierarchy
CREATE POLICY asset_hierarchy_tenant_isolation ON asset_hierarchy
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- OEE Calculations
CREATE POLICY oee_calculations_tenant_isolation ON oee_calculations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Production Schedules
CREATE POLICY production_schedules_tenant_isolation ON production_schedules
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Capacity Planning
CREATE POLICY capacity_planning_tenant_isolation ON capacity_planning
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Routing Templates
CREATE POLICY routing_templates_tenant_isolation ON routing_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Routing Operations
CREATE POLICY routing_operations_tenant_isolation ON routing_operations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- =====================================================
-- VERIFICATION COMMENTS
-- =====================================================

COMMENT ON POLICY work_centers_tenant_isolation ON work_centers IS 'RLS: Enforce tenant isolation for work centers';
COMMENT ON POLICY production_orders_tenant_isolation ON production_orders IS 'RLS: Enforce tenant isolation for production orders';
COMMENT ON POLICY production_runs_tenant_isolation ON production_runs IS 'RLS: Enforce tenant isolation for production runs';
COMMENT ON POLICY operations_tenant_isolation ON operations IS 'RLS: Enforce tenant isolation for operations (supports global operations)';
COMMENT ON POLICY changeover_details_tenant_isolation ON changeover_details IS 'RLS: Enforce tenant isolation for changeover details';
COMMENT ON POLICY equipment_status_log_tenant_isolation ON equipment_status_log IS 'RLS: Enforce tenant isolation for equipment status log';
COMMENT ON POLICY maintenance_records_tenant_isolation ON maintenance_records IS 'RLS: Enforce tenant isolation for maintenance records';
COMMENT ON POLICY asset_hierarchy_tenant_isolation ON asset_hierarchy IS 'RLS: Enforce tenant isolation for asset hierarchy';
COMMENT ON POLICY oee_calculations_tenant_isolation ON oee_calculations IS 'RLS: Enforce tenant isolation for OEE calculations';
COMMENT ON POLICY production_schedules_tenant_isolation ON production_schedules IS 'RLS: Enforce tenant isolation for production schedules';
COMMENT ON POLICY capacity_planning_tenant_isolation ON capacity_planning IS 'RLS: Enforce tenant isolation for capacity planning';
COMMENT ON POLICY routing_templates_tenant_isolation ON routing_templates IS 'RLS: Enforce tenant isolation for routing templates';
COMMENT ON POLICY routing_operations_tenant_isolation ON routing_operations IS 'RLS: Enforce tenant isolation for routing operations';

-- =====================================================
-- APPLICATION LAYER INTEGRATION NOTES
-- =====================================================
/*
NestJS GraphQL resolvers MUST set the tenant context before queries:

GraphQLModule.forRoot<ApolloDriverConfig>({
  context: async ({ req }) => {
    const tenantId = req.headers['x-tenant-id'] || extractFromJWT(req);

    // Set PostgreSQL session variable for RLS
    await pool.query(`SET app.current_tenant_id = '${tenantId}'`);

    return { req, tenantId };
  }
})

OR in each resolver/service:

async executeQuery(query: string, params: any[], tenantId: string) {
  const client = await this.pool.connect();
  try {
    await client.query(`SET LOCAL app.current_tenant_id = '${tenantId}'`);
    return await client.query(query, params);
  } finally {
    client.release();
  }
}
*/

-- =====================================================
-- TESTING RLS POLICIES
-- =====================================================
/*
-- Test 1: Set tenant context and verify isolation
SET app.current_tenant_id = '01234567-89ab-cdef-0123-456789abcdef';
SELECT COUNT(*) FROM work_centers; -- Should return only tenant's work centers

-- Test 2: Attempt cross-tenant query (should return 0 rows)
SET app.current_tenant_id = 'different-tenant-id';
SELECT * FROM production_orders WHERE id = 'order-from-other-tenant'; -- Should return 0 rows

-- Test 3: Verify global operations are visible
SET app.current_tenant_id = 'any-tenant-id';
SELECT * FROM operations WHERE tenant_id IS NULL; -- Should return global operations catalog
*/
