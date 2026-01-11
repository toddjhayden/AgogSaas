# Database Service - Tenant Context & RLS Usage Guide

**REQ: REQ-1767508090235-mvcn3 - Multi-Tenant Row-Level Security Implementation**

This guide explains how to use the `DatabaseService` to ensure proper tenant isolation via Row-Level Security (RLS).

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Migration Guide](#migration-guide)
4. [API Reference](#api-reference)
5. [Best Practices](#best-practices)
6. [Common Patterns](#common-patterns)
7. [Testing](#testing)

---

## Overview

### Why Use DatabaseService?

The `DatabaseService` provides automatic tenant context management for PostgreSQL Row-Level Security (RLS):

- **Automatic tenant isolation**: Sets `app.current_tenant_id` session variable for every query
- **Transaction support**: Maintains tenant context across multiple queries in a transaction
- **Connection management**: Handles connection pooling and cleanup automatically
- **Type safety**: Full TypeScript support with generics

### How RLS Works

1. Every table with `tenant_id` column has RLS enabled
2. RLS policies filter rows based on `current_setting('app.current_tenant_id')`
3. DatabaseService sets this session variable before executing queries
4. PostgreSQL automatically filters results to only show the tenant's data

---

## Quick Start

### 1. Inject DatabaseService

```typescript
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class MyService {
  constructor(private readonly db: DatabaseService) {}
}
```

### 2. Simple Query

```typescript
async findInvoices(tenantId: string): Promise<Invoice[]> {
  const result = await this.db.query<Invoice>(
    { tenantId },
    'SELECT * FROM invoices WHERE status = $1',
    ['ACTIVE']
  );

  return result.rows;
}
```

### 3. Transaction

```typescript
async createInvoice(tenantId: string, dto: CreateInvoiceDto): Promise<Invoice> {
  return this.db.transaction({ tenantId }, async (client) => {
    // Insert invoice
    const invoiceResult = await client.query(
      'INSERT INTO invoices (...) VALUES (...) RETURNING *',
      [...]
    );

    // Insert line items
    await client.query(
      'INSERT INTO invoice_lines (...) VALUES (...)',
      [...]
    );

    return invoiceResult.rows[0];
  });
}
```

---

## Migration Guide

### Before (Direct Pool Usage)

```typescript
@Injectable()
export class OldService {
  constructor(
    @Inject('DATABASE_POOL') private readonly pool: Pool
  ) {}

  async findInvoices(tenantId: string): Promise<Invoice[]> {
    const client = await this.pool.connect();
    try {
      // Manual tenant context setup
      await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);

      const result = await client.query('SELECT * FROM invoices');
      return result.rows;
    } finally {
      client.release();
    }
  }
}
```

### After (DatabaseService)

```typescript
@Injectable()
export class NewService {
  constructor(
    private readonly db: DatabaseService
  ) {}

  async findInvoices(tenantId: string): Promise<Invoice[]> {
    const result = await this.db.query<Invoice>(
      { tenantId },
      'SELECT * FROM invoices'
    );

    return result.rows;
  }
}
```

### Migration Steps

1. **Replace dependency injection**:
   ```typescript
   // OLD
   @Inject('DATABASE_POOL') private readonly pool: Pool

   // NEW
   private readonly db: DatabaseService
   ```

2. **Convert simple queries**:
   ```typescript
   // OLD
   const client = await this.pool.connect();
   try {
     await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
     const result = await client.query(sql, params);
     return result.rows;
   } finally {
     client.release();
   }

   // NEW
   const result = await this.db.query({ tenantId }, sql, params);
   return result.rows;
   ```

3. **Convert transactions**:
   ```typescript
   // OLD
   const client = await this.pool.connect();
   try {
     await client.query('BEGIN');
     await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
     // ... queries ...
     await client.query('COMMIT');
   } catch (error) {
     await client.query('ROLLBACK');
     throw error;
   } finally {
     client.release();
   }

   // NEW
   await this.db.transaction({ tenantId }, async (client) => {
     // ... queries ...
   });
   ```

---

## API Reference

### `query<T>(options, sql, params)`

Execute a single query with tenant context.

**Parameters:**
- `options: TenantQueryOptions` - Tenant context (required)
  - `tenantId: string` - Tenant UUID (required)
  - `userId?: string` - User UUID for audit logging (optional)
- `sql: string` - SQL query
- `params?: any[]` - Query parameters

**Returns:** `Promise<QueryResult<T>>`

**Example:**
```typescript
const result = await this.db.query<Invoice>(
  { tenantId, userId },
  'SELECT * FROM invoices WHERE id = $1',
  [invoiceId]
);

const invoice = result.rows[0];
```

### `transaction<T>(options, callback)`

Execute multiple queries in a transaction.

**Parameters:**
- `options: TenantQueryOptions` - Tenant context
- `callback: (client: PoolClient) => Promise<T>` - Transaction logic

**Returns:** `Promise<T>` - Result from callback

**Example:**
```typescript
const result = await this.db.transaction(
  { tenantId },
  async (client) => {
    const invoice = await client.query('INSERT INTO invoices ...');
    const lines = await client.query('INSERT INTO invoice_lines ...');
    return { invoice, lines };
  }
);
```

### `querySystem<T>(sql, params)`

Execute a query without tenant context (system-level only).

**WARNING:** This bypasses RLS. Only use for:
- System administration
- Cross-tenant analytics (with authorization)
- Non-tenant tables

**Example:**
```typescript
const stats = await this.db.querySystem(
  'SELECT tenant_id, COUNT(*) FROM invoices GROUP BY tenant_id'
);
```

### `getClient()`

Get a raw database client (advanced usage).

**WARNING:** You must manually set tenant context and release the client.

**Example:**
```typescript
const client = await this.db.getClient();
try {
  await client.query('SET LOCAL app.current_tenant_id = $1', [tenantId]);
  const result = await client.query('SELECT ...');
} finally {
  client.release();
}
```

---

## Best Practices

### ✅ DO

1. **Always use DatabaseService for tenant-scoped queries**
   ```typescript
   const result = await this.db.query({ tenantId }, 'SELECT ...');
   ```

2. **Pass userId for audit trails**
   ```typescript
   await this.db.query({ tenantId, userId }, 'INSERT INTO ...');
   ```

3. **Use transactions for multi-step operations**
   ```typescript
   await this.db.transaction({ tenantId }, async (client) => {
     // Multiple related queries
   });
   ```

4. **Extract tenantId from authenticated user**
   ```typescript
   @UseGuards(JwtAuthGuard)
   async myResolver(@CurrentUser() user: ValidatedUser) {
     const result = await this.db.query({ tenantId: user.tenantId }, ...);
   }
   ```

### ❌ DON'T

1. **Never use pool.query() directly for tenant data**
   ```typescript
   // WRONG - Bypasses RLS
   const result = await this.pool.query('SELECT * FROM invoices');
   ```

2. **Don't forget to pass tenantId**
   ```typescript
   // WRONG - Will fail or return no results
   const result = await this.db.query({}, 'SELECT ...');
   ```

3. **Don't use querySystem() for tenant data**
   ```typescript
   // WRONG - Bypasses tenant isolation
   const result = await this.db.querySystem('SELECT * FROM invoices');
   ```

4. **Don't hard-code tenant IDs**
   ```typescript
   // WRONG - Security risk
   const result = await this.db.query(
     { tenantId: 'some-fixed-uuid' },
     'SELECT ...'
   );
   ```

---

## Common Patterns

### Pattern 1: Simple CRUD

```typescript
@Injectable()
export class InvoiceService {
  constructor(private readonly db: DatabaseService) {}

  async findAll(tenantId: string): Promise<Invoice[]> {
    const result = await this.db.query<Invoice>(
      { tenantId },
      'SELECT * FROM invoices ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async findById(tenantId: string, id: string): Promise<Invoice | null> {
    const result = await this.db.query<Invoice>(
      { tenantId },
      'SELECT * FROM invoices WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async create(tenantId: string, dto: CreateInvoiceDto): Promise<Invoice> {
    const result = await this.db.query<Invoice>(
      { tenantId },
      'INSERT INTO invoices (...) VALUES (...) RETURNING *',
      [...]
    );
    return result.rows[0];
  }

  async update(tenantId: string, id: string, dto: UpdateInvoiceDto): Promise<Invoice> {
    const result = await this.db.query<Invoice>(
      { tenantId },
      'UPDATE invoices SET ... WHERE id = $1 RETURNING *',
      [..., id]
    );
    return result.rows[0];
  }

  async delete(tenantId: string, id: string): Promise<void> {
    await this.db.query(
      { tenantId },
      'DELETE FROM invoices WHERE id = $1',
      [id]
    );
  }
}
```

### Pattern 2: Complex Transaction

```typescript
async createInvoiceWithLines(
  tenantId: string,
  userId: string,
  dto: CreateInvoiceDto
): Promise<InvoiceWithLines> {
  return this.db.transaction({ tenantId, userId }, async (client) => {
    // 1. Create invoice header
    const invoiceResult = await client.query(
      'INSERT INTO invoices (...) VALUES (...) RETURNING *',
      [...]
    );
    const invoice = invoiceResult.rows[0];

    // 2. Create invoice lines
    const lineResults = await Promise.all(
      dto.lines.map(line =>
        client.query(
          'INSERT INTO invoice_lines (...) VALUES (...) RETURNING *',
          [invoice.id, ...]
        )
      )
    );
    const lines = lineResults.map(r => r.rows[0]);

    // 3. Update invoice totals
    await client.query(
      'UPDATE invoices SET total_amount = $1 WHERE id = $2',
      [calculateTotal(lines), invoice.id]
    );

    // 4. Create GL entries
    await client.query(
      'INSERT INTO journal_entries (...) VALUES (...)',
      [...]
    );

    return { ...invoice, lines };
  });
}
```

### Pattern 3: Aggregate Queries

```typescript
async getInvoiceStats(tenantId: string): Promise<InvoiceStats> {
  const result = await this.db.query<{
    total_count: string;
    total_amount: string;
    paid_amount: string;
  }>(
    { tenantId },
    `SELECT
       COUNT(*) as total_count,
       SUM(total_amount) as total_amount,
       SUM(paid_amount) as paid_amount
     FROM invoices
     WHERE status = 'ACTIVE'`
  );

  const row = result.rows[0];
  return {
    totalCount: parseInt(row.total_count),
    totalAmount: parseFloat(row.total_amount),
    paidAmount: parseFloat(row.paid_amount),
  };
}
```

### Pattern 4: GraphQL Resolver

```typescript
@Resolver()
export class InvoiceResolver {
  constructor(private readonly invoiceService: InvoiceService) {}

  @Query(() => [Invoice])
  @UseGuards(JwtAuthGuard)
  async invoices(@CurrentUser() user: ValidatedUser): Promise<Invoice[]> {
    // tenantId automatically extracted from JWT
    return this.invoiceService.findAll(user.tenantId);
  }

  @Mutation(() => Invoice)
  @UseGuards(JwtAuthGuard)
  async createInvoice(
    @CurrentUser() user: ValidatedUser,
    @Args('input') input: CreateInvoiceInput,
  ): Promise<Invoice> {
    return this.invoiceService.create(user.tenantId, input);
  }
}
```

---

## Testing

### Unit Tests

```typescript
describe('InvoiceService', () => {
  let service: InvoiceService;
  let db: DatabaseService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        InvoiceService,
        {
          provide: DatabaseService,
          useValue: {
            query: jest.fn(),
            transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(InvoiceService);
    db = module.get(DatabaseService);
  });

  it('should find invoices with tenant context', async () => {
    const mockInvoices = [{ id: '1', tenant_id: 'tenant-1' }];
    jest.spyOn(db, 'query').mockResolvedValue({ rows: mockInvoices } as any);

    const result = await service.findAll('tenant-1');

    expect(db.query).toHaveBeenCalledWith(
      { tenantId: 'tenant-1' },
      expect.any(String)
    );
    expect(result).toEqual(mockInvoices);
  });
});
```

### Integration Tests

```typescript
describe('Invoice RLS Integration', () => {
  let db: DatabaseService;
  const tenant1 = 'tenant-1-uuid';
  const tenant2 = 'tenant-2-uuid';

  beforeAll(async () => {
    // Setup test database connection
    db = new DatabaseService(testPool);
  });

  it('should only return invoices for current tenant', async () => {
    // Create invoices for both tenants
    await db.query({ tenantId: tenant1 }, 'INSERT INTO invoices ...');
    await db.query({ tenantId: tenant2 }, 'INSERT INTO invoices ...');

    // Query as tenant1
    const result = await db.query({ tenantId: tenant1 }, 'SELECT * FROM invoices');

    // Should only see tenant1's invoices
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].tenant_id).toBe(tenant1);
  });

  it('should prevent cross-tenant updates', async () => {
    // Create invoice for tenant1
    const invoice = await db.query(
      { tenantId: tenant1 },
      'INSERT INTO invoices (...) VALUES (...) RETURNING id'
    );

    // Try to update as tenant2 (should affect 0 rows)
    const updateResult = await db.query(
      { tenantId: tenant2 },
      'UPDATE invoices SET status = $1 WHERE id = $2',
      ['PAID', invoice.rows[0].id]
    );

    expect(updateResult.rowCount).toBe(0);
  });
});
```

---

## Troubleshooting

### Error: "current_setting() not found"

**Cause:** RLS policy trying to access session variable that wasn't set.

**Solution:** Make sure you're using `DatabaseService.query()` or `transaction()`, not direct pool access.

### Error: "No rows returned"

**Cause:** Query executed with wrong tenant context or RLS policy filtering out results.

**Solution:**
1. Verify tenantId is correct
2. Check if data exists for that tenant
3. Verify RLS policies are correct

### Error: "Connection pool exhausted"

**Cause:** Connections not being released properly.

**Solution:**
- Use `DatabaseService.query()` or `transaction()` - they handle cleanup automatically
- If using `getClient()`, ensure you call `client.release()` in a `finally` block

---

## See Also

- [RLS Migration V0.0.84](../../migrations/V0.0.84__add_rls_api_webhook_notification_tables.sql)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [Multi-Tenant Architecture Guide](../../../docs/MULTI_TENANT_ARCHITECTURE.md)
