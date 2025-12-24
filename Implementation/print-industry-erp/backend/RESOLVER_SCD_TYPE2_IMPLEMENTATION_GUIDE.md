# SCD Type 2 Resolver Implementation Guide

**Purpose**: Implementation guide for adding SCD Type 2 query support to remaining GraphQL resolvers
**Status**: Partial implementation complete - tenant.resolver.ts done, others pending
**Created**: 2025-12-17
**Author**: Claude Code

---

## Overview

Migration V1.0.10 added SCD Type 2 tracking columns to all master data tables:
- `effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE`
- `effective_to_date DATE DEFAULT '9999-12-31'`
- `is_current_version BOOLEAN DEFAULT TRUE`

GraphQL schemas have been updated with these fields and new historical query variants.

**This guide provides implementation patterns for updating the remaining resolvers.**

---

## Implementation Status

### Completed
- ✅ **Migration V1.0.10**: Database columns added to all master data tables
- ✅ **tenant.graphql**: Added SCD Type 2 fields to Facility type, added historical queries
- ✅ **operations.graphql**: Added SCD Type 2 fields to WorkCenter type, added historical queries
- ✅ **sales-materials.graphql**: Added SCD Type 2 fields to Customer, Vendor, Product, Material types, added historical queries
- ✅ **quality-hr-iot-security-marketplace-imposition.graphql**: Added SCD Type 2 fields to Employee type, added historical queries
- ✅ **tenant.resolver.ts**: Implemented SCD Type 2 query support for Facility

### Pending
- ⚠️ **operations.resolver.ts**: Add SCD Type 2 query support for WorkCenter
- ⚠️ **sales-materials.resolver.ts**: Add SCD Type 2 query support for Customer, Vendor, Product, Material
- ⚠️ **quality-hr-iot-security-marketplace-imposition.resolver.ts**: Add SCD Type 2 query support for Employee

---

## Implementation Pattern (Use tenant.resolver.ts as Reference)

### Pattern 1: Update List Query to Support includeHistory Parameter

**Before:**
```typescript
@Query('workCenters')
async getWorkCenters(
  @Args('facilityId') facilityId: string,
  @Args('status') status: string,
  @Context() context: any
) {
  const result = await this.db.query(
    `SELECT * FROM work_centers
     WHERE facility_id = $1 AND deleted_at IS NULL
     ORDER BY work_center_name`,
    [facilityId]
  );

  return result.rows.map(this.mapWorkCenterRow);
}
```

**After:**
```typescript
@Query('workCenters')
async getWorkCenters(
  @Args('facilityId') facilityId: string,
  @Args('status') status: string,
  @Args('includeHistory') includeHistory: boolean = false,
  @Context() context: any
) {
  // By default, only return current versions
  const whereClause = includeHistory
    ? 'facility_id = $1 AND deleted_at IS NULL'
    : 'facility_id = $1 AND is_current_version = TRUE AND deleted_at IS NULL';

  const result = await this.db.query(
    `SELECT * FROM work_centers
     WHERE ${whereClause}
     ORDER BY work_center_name, effective_from_date DESC`,
    [facilityId]
  );

  return result.rows.map(this.mapWorkCenterRow);
}
```

---

### Pattern 2: Update Single-Item Query to Filter Current Version

**Before:**
```typescript
@Query('workCenter')
async getWorkCenter(
  @Args('id') id: string,
  @Context() context: any
) {
  const result = await this.db.query(
    `SELECT * FROM work_centers WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error(`WorkCenter ${id} not found`);
  }

  return this.mapWorkCenterRow(result.rows[0]);
}
```

**After:**
```typescript
@Query('workCenter')
async getWorkCenter(
  @Args('id') id: string,
  @Context() context: any
) {
  // Get current version by default
  const result = await this.db.query(
    `SELECT * FROM work_centers
     WHERE id = $1 AND is_current_version = TRUE AND deleted_at IS NULL`,
    [id]
  );

  if (result.rows.length === 0) {
    throw new Error(`WorkCenter ${id} not found`);
  }

  return this.mapWorkCenterRow(result.rows[0]);
}
```

---

### Pattern 3: Add "As Of" Historical Query

**New Query (add after main query):**
```typescript
@Query('workCenterAsOf')
async getWorkCenterAsOf(
  @Args('workCenterCode') workCenterCode: string,
  @Args('facilityId') facilityId: string,
  @Args('tenantId') tenantId: string,
  @Args('asOfDate') asOfDate: string,
  @Context() context: any
) {
  // Query for work center version valid on asOfDate
  const result = await this.db.query(
    `SELECT * FROM work_centers
     WHERE tenant_id = $1
       AND facility_id = $2
       AND work_center_code = $3
       AND effective_from_date <= $4
       AND (effective_to_date IS NULL OR effective_to_date >= $4)
       AND deleted_at IS NULL
     ORDER BY effective_from_date DESC
     LIMIT 1`,
    [tenantId, facilityId, workCenterCode, asOfDate]
  );

  if (result.rows.length === 0) {
    throw new Error(`WorkCenter ${workCenterCode} not found as of ${asOfDate}`);
  }

  return this.mapWorkCenterRow(result.rows[0]);
}
```

**Business Value**: Enables queries like "What was this work center's hourly rate when the production run started?"

---

### Pattern 4: Add Full History Query

**New Query (add after "as of" query):**
```typescript
@Query('workCenterHistory')
async getWorkCenterHistory(
  @Args('workCenterCode') workCenterCode: string,
  @Args('facilityId') facilityId: string,
  @Args('tenantId') tenantId: string,
  @Context() context: any
) {
  // Get all versions of this work center
  const result = await this.db.query(
    `SELECT * FROM work_centers
     WHERE tenant_id = $1
       AND facility_id = $2
       AND work_center_code = $3
       AND deleted_at IS NULL
     ORDER BY effective_from_date DESC`,
    [tenantId, facilityId, workCenterCode]
  );

  return result.rows.map(this.mapWorkCenterRow);
}
```

**Business Value**: Enables audit trail queries like "Show me all changes to this work center's configuration over time"

---

### Pattern 5: Update Mapper to Include SCD Type 2 Fields

**Before:**
```typescript
private mapWorkCenterRow(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    facilityId: row.facility_id,
    workCenterCode: row.work_center_code,
    workCenterName: row.work_center_name,
    // ... other fields ...
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  };
}
```

**After:**
```typescript
private mapWorkCenterRow(row: any) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    facilityId: row.facility_id,
    workCenterCode: row.work_center_code,
    workCenterName: row.work_center_name,
    // ... other fields ...
    // SCD Type 2 fields
    effectiveFromDate: row.effective_from_date,
    effectiveToDate: row.effective_to_date,
    isCurrentVersion: row.is_current_version,
    createdAt: row.created_at,
    createdBy: row.created_by,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by
  };
}
```

---

## Resolver Update Checklist

### operations.resolver.ts (WorkCenter)

- [ ] Update `getWorkCenters()` to add `includeHistory` parameter
- [ ] Update `getWorkCenter()` to filter `is_current_version = TRUE`
- [ ] Add `getWorkCenterAsOf()` query method
- [ ] Add `getWorkCenterHistory()` query method
- [ ] Update `mapWorkCenterRow()` to include SCD Type 2 fields

**Natural Key**: `(tenant_id, facility_id, work_center_code)`

---

### sales-materials.resolver.ts (Customer, Vendor, Product, Material)

#### Customer

- [ ] Update `getCustomers()` to add `includeHistory` parameter
- [ ] Update `getCustomer()` to filter `is_current_version = TRUE`
- [ ] Add `getCustomerAsOf()` query method
- [ ] Add `getCustomerHistory()` query method
- [ ] Update `mapCustomerRow()` to include SCD Type 2 fields

**Natural Key**: `(tenant_id, customer_code)`

#### Vendor

- [ ] Update `getVendors()` to add `includeHistory` parameter
- [ ] Update `getVendor()` to filter `is_current_version = TRUE`
- [ ] Add `getVendorAsOf()` query method
- [ ] Add `getVendorHistory()` query method
- [ ] Update `mapVendorRow()` to include SCD Type 2 fields

**Natural Key**: `(tenant_id, vendor_code)`

#### Product

- [ ] Update `getProducts()` to add `includeHistory` parameter
- [ ] Update `getProduct()` to filter `is_current_version = TRUE`
- [ ] Add `getProductAsOf()` query method
- [ ] Add `getProductHistory()` query method
- [ ] Update `mapProductRow()` to include SCD Type 2 fields

**Natural Key**: `(tenant_id, product_code)`

#### Material

- [ ] Update `getMaterials()` to add `includeHistory` parameter
- [ ] Update `getMaterial()` to filter `is_current_version = TRUE`
- [ ] Add `getMaterialAsOf()` query method
- [ ] Add `getMaterialHistory()` query method
- [ ] Update `mapMaterialRow()` to include SCD Type 2 fields

**Natural Key**: `(tenant_id, material_code)`

---

### quality-hr-iot-security-marketplace-imposition.resolver.ts (Employee)

- [ ] Update `getEmployees()` to add `includeHistory` parameter
- [ ] Update `getEmployee()` to filter `is_current_version = TRUE`
- [ ] Add `getEmployeeAsOf()` query method
- [ ] Add `getEmployeeHistory()` query method
- [ ] Update `mapEmployeeRow()` to include SCD Type 2 fields

**Natural Key**: `(tenant_id, employee_number)`

---

## Testing Checklist

### Unit Tests

For each entity (Customer, Vendor, Product, Material, Employee, WorkCenter):

```typescript
describe('EntityResolver SCD Type 2', () => {
  it('should return only current versions by default', async () => {
    const result = await resolver.getEntities(tenantId, false);
    expect(result.every(e => e.isCurrentVersion === true)).toBe(true);
  });

  it('should return all versions when includeHistory is true', async () => {
    const result = await resolver.getEntities(tenantId, true);
    expect(result.length).toBeGreaterThan(1); // Assumes test data has history
  });

  it('should return entity as of specific date', async () => {
    const result = await resolver.getEntityAsOf(entityCode, tenantId, '2024-06-01');
    expect(result.effectiveFromDate).toBeLessThanOrEqual('2024-06-01');
    expect(result.effectiveToDate).toBeGreaterThanOrEqual('2024-06-01');
  });

  it('should return full history for entity', async () => {
    const history = await resolver.getEntityHistory(entityCode, tenantId);
    expect(history.length).toBeGreaterThan(0);
    // Should be ordered by effective_from_date DESC
    for (let i = 1; i < history.length; i++) {
      expect(history[i-1].effectiveFromDate >= history[i].effectiveFromDate).toBe(true);
    }
  });
});
```

### Integration Tests

```graphql
# Test current version query (default behavior - backward compatible)
query {
  customer(id: "123") {
    customerName
    creditLimit
    isCurrentVersion  # Should be TRUE
  }
}

# Test historical "as of" query
query {
  customerAsOf(customerCode: "ACME-001", tenantId: "tenant-1", asOfDate: "2024-06-01") {
    customerName
    creditLimit
    effectiveFromDate  # Should be <= 2024-06-01
    effectiveToDate    # Should be >= 2024-06-01 or NULL
  }
}

# Test full history query
query {
  customerHistory(customerCode: "ACME-001", tenantId: "tenant-1") {
    customerName
    creditLimit
    effectiveFromDate
    effectiveToDate
    isCurrentVersion
  }
}

# Test list with history
query {
  customers(tenantId: "tenant-1", includeHistory: true) {
    customerCode
    customerName
    effectiveFromDate
    isCurrentVersion
  }
}
```

---

## Business Intelligence Use Cases Enabled

### 1. Point-in-Time Pricing Analysis
```graphql
# What was customer's pricing tier when quote was generated?
query {
  quoteById(id: "quote-123") {
    quoteDate
    customer: customerAsOf(
      customerCode: "ACME-001"
      tenantId: "tenant-1"
      asOfDate: quoteDate  # Use quote's date
    ) {
      pricingTier
      creditLimit
    }
  }
}
```

### 2. Cost Variance Analysis
```graphql
# What was material's standard cost when production run started?
query {
  productionRunById(id: "run-456") {
    startDate
    material: materialAsOf(
      materialCode: "SUBSTRATE-001"
      tenantId: "tenant-1"
      asOfDate: startDate
    ) {
      standardCost  # Historical cost
    }
    actualMaterialCost  # Compare to actual
  }
}
```

### 3. Audit Trail Queries
```graphql
# Show all changes to vendor performance ratings
query {
  vendorHistory(vendorCode: "ACME-SUPPLIER", tenantId: "tenant-1") {
    effectiveFromDate
    effectiveToDate
    onTimeDeliveryPercentage
    qualityRatingPercentage
    overallRating
  }
}
```

### 4. Trend Analysis
```graphql
# Analyze material cost inflation over time
query {
  materialHistory(materialCode: "INK-CYAN", tenantId: "tenant-1") {
    effectiveFromDate
    standardCost
  }
}
```

---

## GraphQL Schema Patterns (Already Implemented)

All GraphQL schemas have been updated with this pattern:

```graphql
type Entity {
  # ... existing fields ...

  # SCD Type 2
  effectiveFromDate: Date!
  effectiveToDate: Date
  isCurrentVersion: Boolean!

  # ... audit fields ...
}

extend type Query {
  # List query with optional history
  entities(
    tenantId: ID!
    includeHistory: Boolean  # NEW
    # ... other filters ...
  ): [Entity!]!

  # Single entity (current version)
  entity(id: ID!): Entity

  # Historical "as of" query (NEW)
  entityAsOf(
    entityCode: String!
    tenantId: ID!
    asOfDate: Date!
  ): Entity

  # Full history query (NEW)
  entityHistory(
    entityCode: String!
    tenantId: ID!
  ): [Entity!]!
}
```

---

## Backward Compatibility Notes

**Critical**: All changes maintain backward compatibility for blue-green deployments.

1. **Existing Queries Continue to Work**
   - Old code calling `customer(id: "123")` still works
   - Returns current version (same behavior as before)

2. **New Columns Are Nullable with Defaults**
   - Database migration adds columns with defaults
   - Old code doesn't break if columns exist

3. **New Queries Are Optional**
   - `customerAsOf` and `customerHistory` are NEW queries
   - Old code doesn't call them
   - No impact on existing functionality

4. **includeHistory Parameter Has Default**
   - Defaults to `false` (current behavior)
   - Old code gets same results as before

---

## Performance Considerations

### Indexes Created by Migration V1.0.10

For each master data table:
1. **Current Version Index** (partial): `WHERE is_current_version = TRUE`
   - Optimizes default queries (most common case)
2. **Effective Date Range Index**: `(tenant_id, effective_from_date, effective_to_date)`
   - Optimizes "as of" queries
3. **Unique Current Index** (partial): `(tenant_id, natural_key) WHERE is_current_version = TRUE`
   - Enforces one current version per entity
4. **Natural Key + Effective From**: `(tenant_id, natural_key, effective_from_date)`
   - Prevents duplicate versions

### Query Performance

- **Current Version Queries**: Fast (uses partial index)
- **As Of Queries**: Moderate (uses effective date index)
- **Full History Queries**: Moderate (sequential scan of versions)

**Recommendation**: For high-volume OLAP queries, use the Star Schema warehouse (separate system) rather than querying OLTP directly.

---

## Next Steps

1. **Complete Resolver Updates** (this document)
   - Update operations.resolver.ts for WorkCenter
   - Update sales-materials.resolver.ts for Customer, Vendor, Product, Material
   - Update quality-hr-iot-security-marketplace-imposition.resolver.ts for Employee

2. **Create Unit Tests**
   - Test current version filtering
   - Test historical "as of" queries
   - Test full history queries

3. **Create Integration Tests**
   - GraphQL end-to-end tests
   - Verify backward compatibility

4. **Future: SCD Management Functions** (V1.0.11+)
   - Create trigger function to auto-manage version transitions
   - Create helper function to create new versions
   - Create validation function for SCD integrity

5. **Future: Build Star Schema (OLAP)**
   - Create dimensional model (separate database)
   - Build ETL processes (OLTP → OLAP nightly)
   - Create aggregate tables for performance

---

## References

- **Migration**: `Implementation/print-industry-erp/backend/migrations/V1.0.10__add_scd_type2_tracking.sql`
- **GraphQL Schemas**: `Implementation/print-industry-erp/backend/src/graphql/schema/*.graphql`
- **Example Resolver**: `Implementation/print-industry-erp/backend/src/graphql/resolvers/tenant.resolver.ts`
- **Dimensional Model**: `docs/DIMENSIONAL_MODEL_BUS_MATRIX.md`
- **Column Standards**: `docs/COLUMN_NAME_AUDIT.md`

---

**Last Updated**: 2025-12-17
**Status**: Implementation guide complete, partial resolver updates done
