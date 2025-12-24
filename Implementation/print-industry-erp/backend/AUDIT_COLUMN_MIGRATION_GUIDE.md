# Audit Column Migration Guide - V1.0.11 → V1.0.12

## Overview

This guide documents the standardization of audit columns across all 86 tables in the AgogSaaS ERP system using a **blue-green dual-write pattern** for zero-downtime deployment.

## Problem Statement

**Current State (Violation):**
```sql
created_by UUID       -- ❌ Ambiguous: user_id or employee_id?
updated_by UUID       -- ❌ Ambiguous: user_id or employee_id?
deleted_by UUID       -- ❌ Ambiguous: user_id or employee_id?
```

**Target State (OLAP Compliant):**
```sql
created_by_user_id UUID   -- ✅ Explicit: always references users.id
updated_by_user_id UUID   -- ✅ Explicit: always references users.id
deleted_by_user_id UUID   -- ✅ Explicit: always references users.id
```

## Why This Matters

### Semantic Consistency for OLAP
In OLAP dimensional modeling, column names must be semantically unambiguous:
- `employee_id` = references `employees.id` (HR context, hourly workers)
- `inspector_user_id` = references `users.id` (business role: inspector)
- `created_by_user_id` = references `users.id` (audit trail: who created)

Without the `_user_id` suffix, ETL processes cannot distinguish between different ID types in the dimensional model.

### Reference
- `docs/COLUMN_NAME_AUDIT.md` - Critical Violation #5
- `docs/DIMENSIONAL_MODEL_BUS_MATRIX.md` - Audit column standards

## Migration Strategy: Blue-Green Dual-Write Pattern

### Why Dual-Write?

**Column rename is normally UNSAFE** because:
1. Old code expects `created_by`
2. New code expects `created_by_user_id`
3. During deployment, BOTH versions run simultaneously (Blue + Green)
4. If we just rename, rollback breaks

**Dual-write pattern allows:**
- Zero downtime deployment
- Safe rollback for 24-48 hours
- Gradual migration

### Migration Phases

#### Phase 1: V1.0.11 (THIS MIGRATION - SAFE)
**Deployment:** Green environment gets this migration
**Duration:** Apply immediately
**Rollback:** Safe (old columns still exist)

**What it does:**
1. Add new columns: `created_by_user_id`, `updated_by_user_id`, `deleted_by_user_id`
2. Backfill data from old columns
3. Create triggers for dual-write (write to BOTH old and new columns)
4. GraphQL schemas expose BOTH fields (old fields deprecated)
5. Resolvers write to BOTH columns

**SQL:**
```sql
-- Add new column (nullable initially)
ALTER TABLE customers ADD COLUMN created_by_user_id UUID;

-- Backfill from old column
UPDATE customers SET created_by_user_id = created_by WHERE created_by IS NOT NULL;

-- Create dual-write trigger
CREATE TRIGGER trg_customers_sync_audit
    BEFORE INSERT OR UPDATE ON customers
    FOR EACH ROW
    EXECUTE FUNCTION sync_audit_columns();
```

**Trigger logic:**
```sql
CREATE OR REPLACE FUNCTION sync_audit_columns()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT, sync created_by
    IF TG_OP = 'INSERT' THEN
        NEW.created_by := NEW.created_by_user_id;
        NEW.created_by_user_id := COALESCE(NEW.created_by_user_id, NEW.created_by);
    END IF;

    -- On UPDATE, sync updated_by
    IF TG_OP = 'UPDATE' THEN
        NEW.updated_by := NEW.updated_by_user_id;
        NEW.updated_by_user_id := COALESCE(NEW.updated_by_user_id, NEW.updated_by);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

#### Phase 2: V1.0.12 (FUTURE - AFTER 24-48 HOUR SOAK)
**Deployment:** After monitoring confirms stable
**Duration:** 24-48 hours after V1.0.11
**Rollback:** NOT SAFE (old columns dropped)

**What it does:**
1. Drop triggers
2. Drop old columns: `created_by`, `updated_by`, `deleted_by`
3. Add NOT NULL constraints to new columns (where appropriate)
4. Remove deprecated GraphQL fields
5. Remove dual-write logic from resolvers

**SQL:**
```sql
-- Drop triggers
DROP TRIGGER IF EXISTS trg_customers_sync_audit ON customers;

-- Drop old columns
ALTER TABLE customers DROP COLUMN created_by;
ALTER TABLE customers DROP COLUMN updated_by;
ALTER TABLE customers DROP COLUMN deleted_by;
```

## GraphQL Schema Changes

### Phase 1: Dual Fields (Deprecation)

**Old schema (V1.0.10 and before):**
```graphql
type Customer {
  id: ID!
  # ... fields ...

  # Audit
  createdAt: DateTime!
  createdBy: ID         # ❌ Old field, ambiguous
  updatedAt: DateTime
  updatedBy: ID         # ❌ Old field, ambiguous
}
```

**New schema (V1.0.11):**
```graphql
type Customer {
  id: ID!
  # ... fields ...

  # Audit
  createdAt: DateTime!
  createdBy: ID @deprecated(reason: "Use createdByUserId instead. Old column for backward compatibility during migration.")
  createdByUserId: ID   # ✅ New field, explicit
  updatedAt: DateTime
  updatedBy: ID @deprecated(reason: "Use updatedByUserId instead. Old column for backward compatibility during migration.")
  updatedByUserId: ID   # ✅ New field, explicit
}
```

**Client Impact:**
- Existing clients continue to use `createdBy` (works, but shows deprecation warning)
- New clients should use `createdByUserId`
- Both fields return the same value (synced by trigger)

### Phase 2: Remove Old Fields (V1.0.12)

**Final schema (V1.0.12):**
```graphql
type Customer {
  id: ID!
  # ... fields ...

  # Audit
  createdAt: DateTime!
  createdByUserId: ID   # ✅ Only new field remains
  updatedAt: DateTime
  updatedByUserId: ID   # ✅ Only new field remains
}
```

## Resolver Changes

### Phase 1: Dual-Write Resolvers

**Example: Create Customer Mutation**

**Old resolver (V1.0.10 and before):**
```typescript
async createCustomer(parent, { input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    INSERT INTO customers (
      tenant_id, customer_code, customer_name, created_by
    ) VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [tenant_id, input.customerCode, input.customerName, user_id]);

  return result.rows[0];
}
```

**New resolver (V1.0.11 - DUAL WRITE):**
```typescript
async createCustomer(parent, { input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    INSERT INTO customers (
      tenant_id, customer_code, customer_name,
      created_by,           -- Old column (for backward compat)
      created_by_user_id    -- New column (trigger will sync)
    ) VALUES ($1, $2, $3, $4, $4)  -- user_id written to BOTH
    RETURNING *
  `, [tenant_id, input.customerCode, input.customerName, user_id]);

  return result.rows[0];
}
```

**GraphQL response (V1.0.11):**
```json
{
  "data": {
    "createCustomer": {
      "id": "01928374-abcd-7890-1234-56789abcdef0",
      "customerCode": "CUST001",
      "customerName": "Acme Corp",
      "createdBy": "01928374-user-7890-1234-56789abcdef0",       // Old field (works)
      "createdByUserId": "01928374-user-7890-1234-56789abcdef0", // New field (same value)
      "createdAt": "2025-12-17T14:30:00Z"
    }
  }
}
```

### Phase 2: Single-Write Resolvers (V1.0.12)

**Final resolver (V1.0.12):**
```typescript
async createCustomer(parent, { input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    INSERT INTO customers (
      tenant_id, customer_code, customer_name,
      created_by_user_id    -- Only new column
    ) VALUES ($1, $2, $3, $4)
    RETURNING *
  `, [tenant_id, input.customerCode, input.customerName, user_id]);

  return result.rows[0];
}
```

## Deployment Process

### Step 1: Deploy V1.0.11 to Green Environment

**Pre-deployment checklist:**
- [ ] Code review migration SQL
- [ ] Test migration on staging database
- [ ] Verify backfill counts match
- [ ] Update GraphQL schemas (add new fields, deprecate old)
- [ ] Update resolvers (dual-write pattern)
- [ ] Run unit tests
- [ ] Run integration tests

**Deployment:**
```bash
# Run Flyway migration
cd Implementation/print-industry-erp/backend
flyway migrate -configFiles=flyway.conf

# Verify migration
psql -d erp_db -c "SELECT COUNT(*) FROM customers WHERE created_by IS NOT NULL AND created_by != created_by_user_id;"
# Expected: 0 (all synced)

# Deploy Green application
docker-compose up -d backend-green

# Smoke test
curl -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ me { id createdBy createdByUserId } }"}'
```

### Step 2: Monitor Green Environment (24-48 hours)

**What to monitor:**
- [ ] GraphQL query performance (check for slow queries)
- [ ] Trigger overhead (INSERT/UPDATE performance)
- [ ] Data consistency (old vs new columns match)
- [ ] Error logs (check for trigger failures)
- [ ] Client warnings (deprecated field usage)

**Verification queries:**
```sql
-- Check for mismatches (should be 0)
SELECT table_name, COUNT(*) AS mismatch_count
FROM (
    SELECT 'customers' AS table_name, COUNT(*) AS cnt
    FROM customers WHERE created_by IS NOT NULL AND created_by != created_by_user_id
    UNION ALL
    SELECT 'sales_orders', COUNT(*)
    FROM sales_orders WHERE created_by IS NOT NULL AND created_by != created_by_user_id
    -- ... repeat for all 86 tables ...
) sub
WHERE cnt > 0;

-- Check trigger performance (compare before/after)
EXPLAIN ANALYZE INSERT INTO customers (tenant_id, customer_code, customer_name, created_by_user_id)
VALUES ('01928374-...', 'TEST001', 'Test Customer', '01928374-...');
```

### Step 3: Switch Traffic to Green (Blue-Green Cutover)

**Cutover checklist:**
- [ ] Green environment stable for 24-48 hours
- [ ] No data mismatches detected
- [ ] All clients updated to use new fields (or accept deprecation warnings)
- [ ] Rollback plan ready (switch back to Blue)

**Cutover:**
```bash
# Switch load balancer to Green
# (Exact command depends on your infrastructure: HAProxy, Nginx, AWS ALB, etc.)

# Example with Docker Compose labels:
docker-compose stop backend-blue
docker-compose up -d backend-green
```

### Step 4: Decommission Blue (After Soak Period)

**Decommission checklist:**
- [ ] Green stable for 48+ hours after cutover
- [ ] No rollback needed
- [ ] Monitoring shows no issues
- [ ] Ready to proceed to V1.0.12 (drop old columns)

**Decommission:**
```bash
# Stop Blue environment
docker-compose rm -f backend-blue
```

### Step 5: Deploy V1.0.12 (Drop Old Columns)

**WARNING: This step is NOT reversible without restoring from backup**

**Pre-deployment checklist:**
- [ ] Full database backup taken
- [ ] All clients migrated to new fields (no deprecated field usage)
- [ ] V1.0.11 stable for 48+ hours
- [ ] Approval from stakeholders

**Deployment:**
```bash
# Backup database
pg_dump -d erp_db -F c -f backup_before_v1.0.12.dump

# Run V1.0.12 migration
flyway migrate -configFiles=flyway.conf

# Verify old columns dropped
psql -d erp_db -c "\d customers"
# Should NOT show: created_by, updated_by, deleted_by

# Update GraphQL schemas (remove deprecated fields)
# Update resolvers (remove dual-write logic)

# Deploy updated application
docker-compose restart backend-green
```

## Rollback Procedures

### Rollback from V1.0.11 (SAFE - within 48 hours)

**If issues detected during Green soak:**
```bash
# Switch traffic back to Blue
docker-compose stop backend-green
docker-compose up -d backend-blue

# Analyze issue in Green environment
# No data loss - old columns still exist
# Triggers still syncing data
```

### Rollback from V1.0.12 (REQUIRES RESTORE)

**If issues detected after V1.0.12 deployment:**
```bash
# Stop application
docker-compose stop backend-green

# Restore database from backup
pg_restore -d erp_db -c backup_before_v1.0.12.dump

# Revert code to V1.0.11
git checkout v1.0.11

# Deploy old version
docker-compose up -d backend-green

# Investigate issue before attempting V1.0.12 again
```

## Testing

### Unit Tests

**Test dual-write trigger:**
```sql
-- Test INSERT
INSERT INTO customers (tenant_id, customer_code, customer_name, created_by_user_id)
VALUES ('...', 'TEST001', 'Test', '01928374-...');

-- Verify both columns populated
SELECT created_by, created_by_user_id FROM customers WHERE customer_code = 'TEST001';
-- Expected: Both columns have same UUID

-- Test UPDATE
UPDATE customers SET customer_name = 'Updated', updated_by_user_id = '01928374-...'
WHERE customer_code = 'TEST001';

-- Verify both columns synced
SELECT updated_by, updated_by_user_id FROM customers WHERE customer_code = 'TEST001';
-- Expected: Both columns have same UUID
```

### Integration Tests

**Test GraphQL resolver:**
```typescript
describe('Customer Mutations - Dual Write', () => {
  it('should write to both created_by and created_by_user_id', async () => {
    const mutation = `
      mutation CreateCustomer($input: CreateCustomerInput!) {
        createCustomer(input: $input) {
          id
          customerCode
          createdBy
          createdByUserId
        }
      }
    `;

    const result = await graphqlClient.mutate({
      mutation,
      variables: {
        input: {
          customerCode: 'TEST001',
          customerName: 'Test Customer'
        }
      }
    });

    // Both fields should have same value
    expect(result.data.createCustomer.createdBy).toBe(result.data.createCustomer.createdByUserId);
  });
});
```

## Impact Summary

### Tables Affected: 86

**Core Multi-Tenant (4):**
- tenants
- billing_entities
- facilities
- users

**Operations (13):**
- work_centers
- production_orders
- production_runs
- production_schedules
- operations
- bill_of_materials
- kit_definitions
- kit_components
- maintenance_records
- equipment_status_log
- oee_calculations
- capacity_planning
- changeover_details

**WMS (11):**
- inventory_locations
- lots
- inventory_transactions
- inventory_reservations
- wave_processing
- wave_lines
- pick_lists
- shipments
- shipment_lines
- carrier_integrations
- tracking_events

**Finance (10):**
- chart_of_accounts
- financial_periods
- journal_entries
- journal_entry_lines
- gl_balances
- invoices
- invoice_lines
- payments
- cost_allocations
- exchange_rates

**Sales (9):**
- customers
- customer_products
- customer_pricing
- sales_orders
- sales_order_lines
- quotes
- quote_lines
- customer_rejections
- pricing_rules

**Materials (2):**
- products
- materials

**Procurement (6):**
- vendors
- vendor_contracts
- materials_suppliers
- purchase_orders
- purchase_order_lines
- vendor_performance

**Quality (4):**
- quality_standards
- inspection_templates
- quality_inspections
- quality_defects

**HR (4):**
- employees
- labor_rates
- labor_tracking
- timecards

**IoT (4):**
- iot_devices
- sensor_readings
- equipment_events
- asset_hierarchy

**Security (3):**
- security_zones
- security_access_log
- chain_of_custody

**Marketplace (4):**
- partner_network_profiles
- marketplace_job_postings
- marketplace_bids
- external_company_orders

**Imposition (5):**
- press_specifications
- substrate_specifications
- imposition_templates
- imposition_marks
- layout_calculations

### GraphQL Schemas Affected: 6

1. `tenant.graphql` - Updated
2. `operations.graphql` - Needs update
3. `wms.graphql` - Needs update
4. `finance.graphql` - Needs update
5. `sales-materials.graphql` - Needs update
6. `quality-hr-iot-security-marketplace-imposition.graphql` - Needs update

### Resolvers Affected: ~50+

All create/update mutations that set audit columns must be updated for dual-write.

## Business Value

**Before (Violation):**
- ❌ Ambiguous audit columns break OLAP dimensional model
- ❌ ETL processes cannot distinguish ID types
- ❌ Semantic inconsistency across 86 tables

**After (Compliant):**
- ✅ Explicit `_user_id` suffix on all audit columns
- ✅ OLAP dimensional model semantically correct
- ✅ ETL processes can distinguish roles (employee_id vs user_id)
- ✅ Consistent naming across entire schema

## References

- **Migration SQL:** `migrations/V1.0.11__standardize_audit_columns.sql`
- **Drop Old Columns:** `migrations/V1.0.12__drop_old_audit_columns.sql` (future)
- **Documentation:** `docs/COLUMN_NAME_AUDIT.md`
- **Dimensional Model:** `docs/DIMENSIONAL_MODEL_BUS_MATRIX.md`
- **Blue-Green Guide:** `README_BLUE_GREEN_DEPLOYMENT.md`

## Support

**Questions?** Contact:
- Backend Team: Review migration SQL and triggers
- Frontend Team: Update GraphQL queries to use new fields
- QA Team: Test dual-write functionality
- DevOps Team: Execute deployment and monitor

---

**Last Updated:** 2025-12-17
**Status:** Phase 1 Complete (V1.0.11), Phase 2 Pending (V1.0.12)
