# Resolver Dual-Write Pattern - Quick Reference

**Purpose:** Guide for updating GraphQL resolvers to write to both old and new audit columns during V1.0.11 migration.

---

## Core Principle

**During V1.0.11 deployment:**
- Blue environment (old code) writes to `created_by` → trigger syncs to `created_by_user_id`
- Green environment (new code) writes to `created_by_user_id` → trigger syncs to `created_by`
- **Both columns must have identical values**

**Trigger handles the sync, but resolvers should write to new column explicitly.**

---

## Pattern 1: Create Mutation (INSERT)

### Before V1.0.11 (Old Code)
```typescript
async createCustomer(parent, { input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    INSERT INTO customers (
      tenant_id,
      customer_code,
      customer_name,
      created_by,          -- ❌ Old column only
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `, [tenant_id, input.customerCode, input.customerName, user_id]);

  return mapCustomerFromDb(result.rows[0]);
}
```

### During V1.0.11 (Dual-Write)
```typescript
async createCustomer(parent, { input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    INSERT INTO customers (
      tenant_id,
      customer_code,
      customer_name,
      created_by_user_id,  -- ✅ New column (trigger syncs to created_by)
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `, [tenant_id, input.customerCode, input.customerName, user_id]);

  return mapCustomerFromDb(result.rows[0]);
}
```

**Note:** No need to write to both columns in INSERT - trigger handles sync automatically.

### After V1.0.12 (Cleanup)
```typescript
// Same as V1.0.11 - no changes needed!
async createCustomer(parent, { input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    INSERT INTO customers (
      tenant_id,
      customer_code,
      customer_name,
      created_by_user_id,  -- ✅ Only column remaining
      created_at
    ) VALUES ($1, $2, $3, $4, NOW())
    RETURNING *
  `, [tenant_id, input.customerCode, input.customerName, user_id]);

  return mapCustomerFromDb(result.rows[0]);
}
```

---

## Pattern 2: Update Mutation

### Before V1.0.11 (Old Code)
```typescript
async updateCustomer(parent, { id, input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    UPDATE customers
    SET customer_name = $3,
        updated_by = $4,      -- ❌ Old column only
        updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, [id, tenant_id, input.customerName, user_id]);

  if (result.rows.length === 0) {
    throw new Error('Customer not found');
  }

  return mapCustomerFromDb(result.rows[0]);
}
```

### During V1.0.11 (Dual-Write)
```typescript
async updateCustomer(parent, { id, input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    UPDATE customers
    SET customer_name = $3,
        updated_by_user_id = $4,  -- ✅ New column (trigger syncs to updated_by)
        updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, [id, tenant_id, input.customerName, user_id]);

  if (result.rows.length === 0) {
    throw new Error('Customer not found');
  }

  return mapCustomerFromDb(result.rows[0]);
}
```

### After V1.0.12 (Cleanup)
```typescript
// Same as V1.0.11 - no changes needed!
async updateCustomer(parent, { id, input }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    UPDATE customers
    SET customer_name = $3,
        updated_by_user_id = $4,  -- ✅ Only column remaining
        updated_at = NOW()
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `, [id, tenant_id, input.customerName, user_id]);

  if (result.rows.length === 0) {
    throw new Error('Customer not found');
  }

  return mapCustomerFromDb(result.rows[0]);
}
```

---

## Pattern 3: Soft Delete Mutation

### Before V1.0.11 (Old Code)
```typescript
async deleteCustomer(parent, { id }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    UPDATE customers
    SET deleted_at = NOW(),
        deleted_by = $3      -- ❌ Old column only
    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    RETURNING *
  `, [id, tenant_id, user_id]);

  if (result.rows.length === 0) {
    throw new Error('Customer not found or already deleted');
  }

  return mapCustomerFromDb(result.rows[0]);
}
```

### During V1.0.11 (Dual-Write)
```typescript
async deleteCustomer(parent, { id }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    UPDATE customers
    SET deleted_at = NOW(),
        deleted_by_user_id = $3  -- ✅ New column (trigger syncs to deleted_by)
    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    RETURNING *
  `, [id, tenant_id, user_id]);

  if (result.rows.length === 0) {
    throw new Error('Customer not found or already deleted');
  }

  return mapCustomerFromDb(result.rows[0]);
}
```

### After V1.0.12 (Cleanup)
```typescript
// Same as V1.0.11 - no changes needed!
async deleteCustomer(parent, { id }, context) {
  const { tenant_id, user_id } = context.user;

  const result = await pool.query(`
    UPDATE customers
    SET deleted_at = NOW(),
        deleted_by_user_id = $3  -- ✅ Only column remaining
    WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL
    RETURNING *
  `, [id, tenant_id, user_id]);

  if (result.rows.length === 0) {
    throw new Error('Customer not found or already deleted');
  }

  return mapCustomerFromDb(result.rows[0]);
}
```

---

## Pattern 4: Mapping Function (Database → GraphQL)

### Before V1.0.11 (Old Mapper)
```typescript
function mapCustomerFromDb(row: any): Customer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,

    // Audit fields
    createdAt: row.created_at,
    createdBy: row.created_by,      // ❌ Old field only
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,      // ❌ Old field only
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by       // ❌ Old field only
  };
}
```

### During V1.0.11 (Dual-Write Mapper)
```typescript
function mapCustomerFromDb(row: any): Customer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,

    // Audit fields (both old and new)
    createdAt: row.created_at,
    createdBy: row.created_by,                  // ❌ Deprecated (for backward compat)
    createdByUserId: row.created_by_user_id,    // ✅ New field
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,                  // ❌ Deprecated (for backward compat)
    updatedByUserId: row.updated_by_user_id,    // ✅ New field
    deletedAt: row.deleted_at,
    deletedBy: row.deleted_by,                  // ❌ Deprecated (for backward compat)
    deletedByUserId: row.deleted_by_user_id     // ✅ New field
  };
}
```

**TypeScript Interface (V1.0.11):**
```typescript
interface Customer {
  id: string;
  tenantId: string;
  customerCode: string;
  customerName: string;

  // Audit
  createdAt: Date;
  createdBy?: string;         // @deprecated
  createdByUserId?: string;   // New
  updatedAt?: Date;
  updatedBy?: string;         // @deprecated
  updatedByUserId?: string;   // New
  deletedAt?: Date;
  deletedBy?: string;         // @deprecated
  deletedByUserId?: string;   // New
}
```

### After V1.0.12 (Cleanup Mapper)
```typescript
function mapCustomerFromDb(row: any): Customer {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    customerCode: row.customer_code,
    customerName: row.customer_name,

    // Audit fields (only new)
    createdAt: row.created_at,
    createdByUserId: row.created_by_user_id,    // ✅ Only field remaining
    updatedAt: row.updated_at,
    updatedByUserId: row.updated_by_user_id,    // ✅ Only field remaining
    deletedAt: row.deleted_at,
    deletedByUserId: row.deleted_by_user_id     // ✅ Only field remaining
  };
}
```

**TypeScript Interface (V1.0.12):**
```typescript
interface Customer {
  id: string;
  tenantId: string;
  customerCode: string;
  customerName: string;

  // Audit
  createdAt: Date;
  createdByUserId?: string;   // Only new field
  updatedAt?: Date;
  updatedByUserId?: string;   // Only new field
  deletedAt?: Date;
  deletedByUserId?: string;   // Only new field
}
```

---

## Common Mistakes to Avoid

### ❌ MISTAKE 1: Writing to old column in V1.0.11
```typescript
// DON'T DO THIS in V1.0.11+
INSERT INTO customers (..., created_by, ...) VALUES (..., $4, ...);
```

**Why bad:** Clients will migrate to use `createdByUserId`. If you write to `created_by`, trigger syncs to new column, but it's inconsistent coding.

**Do this instead:**
```typescript
// ✅ CORRECT in V1.0.11
INSERT INTO customers (..., created_by_user_id, ...) VALUES (..., $4, ...);
```

### ❌ MISTAKE 2: Forgetting to return new field in mapper
```typescript
// DON'T DO THIS in V1.0.11
function mapCustomerFromDb(row: any): Customer {
  return {
    ...
    createdBy: row.created_by,
    // Missing: createdByUserId
  };
}
```

**Why bad:** GraphQL clients expecting `createdByUserId` will get `null`.

**Do this instead:**
```typescript
// ✅ CORRECT in V1.0.11
function mapCustomerFromDb(row: any): Customer {
  return {
    ...
    createdBy: row.created_by,                  // For backward compat
    createdByUserId: row.created_by_user_id,    // For new clients
  };
}
```

### ❌ MISTAKE 3: Dropping old fields from mapper too early
```typescript
// DON'T DO THIS in V1.0.11 (only in V1.0.12)
function mapCustomerFromDb(row: any): Customer {
  return {
    ...
    // Missing: createdBy (old clients need this!)
    createdByUserId: row.created_by_user_id,
  };
}
```

**Why bad:** Old clients (Blue environment) still expect `createdBy` field.

**Do this instead:**
```typescript
// ✅ CORRECT in V1.0.11 (include both)
function mapCustomerFromDb(row: any): Customer {
  return {
    ...
    createdBy: row.created_by,                  // For old clients
    createdByUserId: row.created_by_user_id,    // For new clients
  };
}
```

---

## Testing Your Resolver

### Unit Test Template
```typescript
describe('Customer Resolvers - V1.0.11 Dual-Write', () => {
  describe('createCustomer', () => {
    it('should write to created_by_user_id (trigger syncs to created_by)', async () => {
      const context = {
        user: {
          tenant_id: 'test-tenant-id',
          user_id: 'test-user-id'
        }
      };

      const input = {
        customerCode: 'TEST001',
        customerName: 'Test Customer'
      };

      const result = await resolvers.Mutation.createCustomer(null, { input }, context);

      // Both fields should exist and have same value
      expect(result.createdBy).toBe('test-user-id');
      expect(result.createdByUserId).toBe('test-user-id');
    });
  });

  describe('updateCustomer', () => {
    it('should write to updated_by_user_id (trigger syncs to updated_by)', async () => {
      // ... similar test
    });
  });

  describe('deleteCustomer', () => {
    it('should write to deleted_by_user_id (trigger syncs to deleted_by)', async () => {
      // ... similar test
    });
  });
});
```

### Integration Test Template
```typescript
describe('Customer GraphQL API - V1.0.11 Dual-Write', () => {
  it('should return both createdBy and createdByUserId fields', async () => {
    const mutation = gql`
      mutation CreateCustomer($input: CreateCustomerInput!) {
        createCustomer(input: $input) {
          id
          customerCode
          customerName
          createdBy          # Old field (deprecated)
          createdByUserId    # New field
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

    const customer = result.data.createCustomer;

    // Both fields should exist and match
    expect(customer.createdBy).toBeDefined();
    expect(customer.createdByUserId).toBeDefined();
    expect(customer.createdBy).toBe(customer.createdByUserId);
  });
});
```

---

## Bulk Update Script (Find & Replace)

**Use this to quickly update all resolvers:**

### Step 1: Find all INSERT statements
```bash
grep -r "INSERT INTO.*created_by[^_]" src/graphql/resolvers/*.ts
```

### Step 2: Replace with new column
```bash
# Find: created_by,
# Replace: created_by_user_id,

# Find: created_by)
# Replace: created_by_user_id)
```

### Step 3: Find all UPDATE statements
```bash
grep -r "UPDATE.*updated_by[^_]" src/graphql/resolvers/*.ts
```

### Step 4: Replace with new column
```bash
# Find: updated_by =
# Replace: updated_by_user_id =
```

### Step 5: Find all soft-delete statements
```bash
grep -r "deleted_by[^_]" src/graphql/resolvers/*.ts
```

### Step 6: Replace with new column
```bash
# Find: deleted_by =
# Replace: deleted_by_user_id =
```

### Step 7: Update mappers
```bash
# Add to all mapper functions:
createdBy: row.created_by,
createdByUserId: row.created_by_user_id,
updatedBy: row.updated_by,
updatedByUserId: row.updated_by_user_id,
deletedBy: row.deleted_by,
deletedByUserId: row.deleted_by_user_id
```

---

## Checklist for Each Resolver File

For every resolver file you update:
- [ ] All `INSERT` statements use `created_by_user_id`
- [ ] All `UPDATE` statements use `updated_by_user_id`
- [ ] All soft-delete statements use `deleted_by_user_id`
- [ ] Mapper function returns BOTH old and new fields
- [ ] TypeScript interface includes BOTH old and new fields
- [ ] Unit tests verify both fields populated
- [ ] Integration tests verify GraphQL response includes both fields

---

## Quick Reference Summary

| Operation | Column to Use in SQL | Trigger Action |
|-----------|---------------------|----------------|
| INSERT | `created_by_user_id` | Syncs to `created_by` |
| UPDATE | `updated_by_user_id` | Syncs to `updated_by` |
| Soft-delete | `deleted_by_user_id` | Syncs to `deleted_by` |

| Phase | SQL Writes To | Mapper Returns | GraphQL Schema |
|-------|---------------|----------------|----------------|
| V1.0.10 (Before) | `created_by` | `createdBy` | `createdBy: ID` |
| V1.0.11 (Dual) | `created_by_user_id` | `createdBy` + `createdByUserId` | `createdBy: ID @deprecated` + `createdByUserId: ID` |
| V1.0.12 (After) | `created_by_user_id` | `createdByUserId` | `createdByUserId: ID` |

---

**Last Updated:** 2025-12-17
**Status:** Ready for V1.0.11 implementation
**Next Review:** After V1.0.11 deployment
