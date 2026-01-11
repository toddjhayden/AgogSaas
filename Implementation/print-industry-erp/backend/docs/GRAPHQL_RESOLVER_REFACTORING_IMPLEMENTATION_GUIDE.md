# GraphQL Resolver Refactoring - Implementation Guide

**REQ:** REQ-1767924916114-88j1m
**For:** Roy (Backend Developer)
**Pattern:** Service Layer Pattern

## Quick Reference

### Before (Anti-Pattern)
```typescript
// ❌ Resolver with direct DB access
@Resolver('Finance')
export class FinanceResolver {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  @Query('financialPeriod')
  async getFinancialPeriod(@Args('id') id: string) {
    const result = await this.db.query('SELECT * FROM financial_periods WHERE id = $1', [id]);
    return this.mapFinancialPeriodRow(result.rows[0]);
  }
}
```

### After (Correct Pattern)
```typescript
// ✅ Resolver delegates to service
@Resolver('Finance')
export class FinanceResolver {
  constructor(private readonly financialPeriodService: FinancialPeriodService) {}

  @Query('financialPeriod')
  async getFinancialPeriod(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req.user.tenantId;
    return this.financialPeriodService.getById(id, tenantId);
  }
}
```

## Step-by-Step Implementation

### Step 1: Create Service File

**File:** `src/modules/finance/services/financial-period.service.ts`

```typescript
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';

export interface FinancialPeriod {
  id: string;
  tenantId: string;
  periodYear: number;
  periodMonth: number;
  periodName: string;
  periodStartDate: Date;
  periodEndDate: Date;
  status: 'OPEN' | 'CLOSED';
  closedByUserId?: string;
  closedAt?: Date;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
}

export interface CreateFinancialPeriodDto {
  periodYear: number;
  periodMonth: number;
  periodStartDate: Date;
  periodEndDate: Date;
}

export interface FinancialPeriodFilters {
  tenantId: string;
  year?: number;
  status?: 'OPEN' | 'CLOSED';
}

@Injectable()
export class FinancialPeriodService {
  constructor(@Inject('DATABASE_POOL') private readonly db: Pool) {}

  /**
   * Get financial period by ID
   * @throws NotFoundException if period not found
   */
  async getById(id: string, tenantId: string): Promise<FinancialPeriod> {
    const result = await this.db.query(
      `SELECT * FROM financial_periods
       WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Financial period ${id} not found`);
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * List financial periods with filters
   */
  async list(filters: FinancialPeriodFilters): Promise<FinancialPeriod[]> {
    let whereClause = `tenant_id = $1`;
    const params: any[] = [filters.tenantId];
    let paramIndex = 2;

    if (filters.year) {
      whereClause += ` AND period_year = $${paramIndex++}`;
      params.push(filters.year);
    }

    if (filters.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(filters.status);
    }

    const result = await this.db.query(
      `SELECT * FROM financial_periods
       WHERE ${whereClause}
       ORDER BY period_year DESC, period_month DESC`,
      params
    );

    return result.rows.map(this.mapRow);
  }

  /**
   * Get current open period
   * @throws NotFoundException if no open period exists
   */
  async getCurrentPeriod(tenantId: string): Promise<FinancialPeriod> {
    const result = await this.db.query(
      `SELECT * FROM financial_periods
       WHERE tenant_id = $1 AND status = 'OPEN'
       ORDER BY period_year DESC, period_month DESC
       LIMIT 1`,
      [tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException('No open financial period found');
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Create new financial period
   */
  async create(
    dto: CreateFinancialPeriodDto,
    tenantId: string,
    userId: string
  ): Promise<FinancialPeriod> {
    const result = await this.db.query(
      `INSERT INTO financial_periods (
        tenant_id, period_year, period_month,
        period_start_date, period_end_date, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        tenantId,
        dto.periodYear,
        dto.periodMonth,
        dto.periodStartDate,
        dto.periodEndDate,
        userId
      ]
    );

    return this.mapRow(result.rows[0]);
  }

  /**
   * Close financial period
   * Runs month-end close procedures
   */
  async close(id: string, tenantId: string, userId: string): Promise<FinancialPeriod> {
    const client = await this.db.connect();

    try {
      await client.query('BEGIN');

      // Update period status
      const result = await client.query(
        `UPDATE financial_periods
         SET status = 'CLOSED',
             closed_by_user_id = $1,
             closed_at = NOW(),
             updated_at = NOW(),
             updated_by = $1
         WHERE id = $2 AND tenant_id = $3
         RETURNING *`,
        [userId, id, tenantId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundException(`Financial period ${id} not found`);
      }

      // TODO: Run month-end close procedures
      // - Update GL balances
      // - Generate closing entries
      // - Lock period for further changes

      await client.query('COMMIT');
      return this.mapRow(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Reopen closed period
   */
  async reopen(id: string, tenantId: string, userId: string): Promise<FinancialPeriod> {
    const result = await this.db.query(
      `UPDATE financial_periods
       SET status = 'OPEN',
           closed_by_user_id = NULL,
           closed_at = NULL,
           updated_at = NOW(),
           updated_by = $1
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [userId, id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundException(`Financial period ${id} not found`);
    }

    return this.mapRow(result.rows[0]);
  }

  /**
   * Map database row to domain object
   */
  private mapRow(row: any): FinancialPeriod {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      periodYear: row.period_year,
      periodMonth: row.period_month,
      periodName: row.period_name,
      periodStartDate: row.period_start_date,
      periodEndDate: row.period_end_date,
      status: row.status,
      closedByUserId: row.closed_by_user_id,
      closedAt: row.closed_at,
      createdAt: row.created_at,
      createdBy: row.created_by,
      updatedAt: row.updated_at,
      updatedBy: row.updated_by
    };
  }
}
```

### Step 2: Update Module Provider

**File:** `src/modules/finance/finance.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { FinancialPeriodService } from './services/financial-period.service';
import { FinanceResolver } from '../../graphql/resolvers/finance.resolver';

@Module({
  imports: [DatabaseModule],
  providers: [
    FinancialPeriodService,
    FinanceResolver,
    // ... other services
  ],
  exports: [FinancialPeriodService]
})
export class FinanceModule {}
```

### Step 3: Refactor Resolver

**File:** `src/graphql/resolvers/finance.resolver.ts`

```typescript
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { FinancialPeriodService } from '../../modules/finance/services/financial-period.service';

@Resolver('Finance')
export class FinanceResolver {
  constructor(
    // Remove: @Inject('DATABASE_POOL') private readonly db: Pool,
    private readonly financialPeriodService: FinancialPeriodService,
    // ... other services
  ) {}

  // =====================================================
  // FINANCIAL PERIOD QUERIES
  // =====================================================

  @Query('financialPeriod')
  async getFinancialPeriod(@Args('id') id: string, @Context() context: any) {
    const tenantId = context.req.user.tenantId;
    return this.financialPeriodService.getById(id, tenantId);
  }

  @Query('financialPeriods')
  async getFinancialPeriods(
    @Args('tenantId') tenantId: string,
    @Args('year') year?: number,
    @Args('status') status?: string,
    @Context() context?: any
  ) {
    return this.financialPeriodService.list({
      tenantId,
      year,
      status: status as any
    });
  }

  @Query('currentPeriod')
  async getCurrentPeriod(@Args('tenantId') tenantId: string, @Context() context: any) {
    return this.financialPeriodService.getCurrentPeriod(tenantId);
  }

  // =====================================================
  // MUTATIONS - FINANCIAL PERIOD
  // =====================================================

  @Mutation('createFinancialPeriod')
  async createFinancialPeriod(@Args('input') input: any, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    return this.financialPeriodService.create(
      {
        periodYear: input.periodYear,
        periodMonth: input.periodMonth,
        periodStartDate: input.periodStartDate,
        periodEndDate: input.periodEndDate
      },
      tenantId,
      userId
    );
  }

  @Mutation('closeFinancialPeriod')
  async closeFinancialPeriod(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    return this.financialPeriodService.close(id, tenantId, userId);
  }

  @Mutation('reopenFinancialPeriod')
  async reopenFinancialPeriod(@Args('id') id: string, @Context() context: any) {
    const userId = context.req.user.id;
    const tenantId = context.req.user.tenantId;

    return this.financialPeriodService.reopen(id, tenantId, userId);
  }

  // Remove: private mapFinancialPeriodRow() - now in service
}
```

### Step 4: Write Tests

**File:** `src/modules/finance/services/__tests__/financial-period.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { FinancialPeriodService } from '../financial-period.service';

describe('FinancialPeriodService', () => {
  let service: FinancialPeriodService;
  let mockDb: jest.Mocked<Pool>;

  beforeEach(async () => {
    mockDb = {
      query: jest.fn(),
      connect: jest.fn()
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinancialPeriodService,
        {
          provide: 'DATABASE_POOL',
          useValue: mockDb
        }
      ]
    }).compile();

    service = module.get<FinancialPeriodService>(FinancialPeriodService);
  });

  describe('getById', () => {
    it('should return period when found', async () => {
      const mockRow = {
        id: '123',
        tenant_id: 'tenant1',
        period_year: 2026,
        period_month: 1,
        period_name: 'January 2026',
        period_start_date: new Date('2026-01-01'),
        period_end_date: new Date('2026-01-31'),
        status: 'OPEN',
        created_at: new Date(),
        created_by: 'user1',
        updated_at: new Date(),
        updated_by: 'user1'
      };

      mockDb.query.mockResolvedValue({ rows: [mockRow] } as any);

      const result = await service.getById('123', 'tenant1');

      expect(result).toMatchObject({
        id: '123',
        tenantId: 'tenant1',
        periodYear: 2026,
        periodMonth: 1
      });
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM financial_periods'),
        ['123', 'tenant1']
      );
    });

    it('should throw NotFoundException when not found', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await expect(service.getById('999', 'tenant1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('list', () => {
    it('should return all periods for tenant', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.list({ tenantId: 'tenant1' });

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should filter by year', async () => {
      mockDb.query.mockResolvedValue({ rows: [] } as any);

      await service.list({ tenantId: 'tenant1', year: 2026 });

      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('period_year'),
        expect.arrayContaining(['tenant1', 2026])
      );
    });
  });

  describe('close', () => {
    it('should close period with transaction', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      mockDb.connect.mockResolvedValue(mockClient as any);
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
      mockClient.query.mockResolvedValueOnce({ rows: [{ id: '123' }] }); // UPDATE
      mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

      await service.close('123', 'tenant1', 'user1');

      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
      const mockClient = {
        query: jest.fn(),
        release: jest.fn()
      };

      mockDb.connect.mockResolvedValue(mockClient as any);
      mockClient.query.mockRejectedValue(new Error('DB error'));

      await expect(service.close('123', 'tenant1', 'user1')).rejects.toThrow();

      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
      expect(mockClient.release).toHaveBeenCalled();
    });
  });
});
```

## Common Patterns

### Pattern 1: Simple Query with Filters

```typescript
// Service
async list(filters: MyFilters): Promise<MyEntity[]> {
  let whereClause = 'tenant_id = $1';
  const params: any[] = [filters.tenantId];
  let paramIndex = 2;

  if (filters.status) {
    whereClause += ` AND status = $${paramIndex++}`;
    params.push(filters.status);
  }

  const result = await this.db.query(
    `SELECT * FROM my_table WHERE ${whereClause} ORDER BY created_at DESC`,
    params
  );

  return result.rows.map(this.mapRow);
}

// Resolver
@Query('myEntities')
async getMyEntities(@Args('filters') filters: any) {
  return this.myService.list(filters);
}
```

### Pattern 2: Transaction with Multiple Operations

```typescript
// Service
async createWithRelations(dto: CreateDto, tenantId: string, userId: string) {
  const client = await this.db.connect();

  try {
    await client.query('BEGIN');

    // Create parent
    const parent = await this.createParent(client, dto, tenantId, userId);

    // Create children
    for (const child of dto.children) {
      await this.createChild(client, parent.id, child, tenantId, userId);
    }

    await client.query('COMMIT');
    return parent;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

### Pattern 3: Error Handling

```typescript
// Service
import { NotFoundException, BadRequestException } from '@nestjs/common';

async getById(id: string, tenantId: string): Promise<Entity> {
  const result = await this.db.query(
    'SELECT * FROM table WHERE id = $1 AND tenant_id = $2',
    [id, tenantId]
  );

  if (result.rows.length === 0) {
    throw new NotFoundException(`Entity ${id} not found`);
  }

  return this.mapRow(result.rows[0]);
}

async create(dto: CreateDto, tenantId: string): Promise<Entity> {
  // Validation
  if (!dto.name) {
    throw new BadRequestException('Name is required');
  }

  // Business logic
  const existing = await this.findByName(dto.name, tenantId);
  if (existing) {
    throw new BadRequestException(`Entity with name ${dto.name} already exists`);
  }

  // Create
  const result = await this.db.query(/* ... */);
  return this.mapRow(result.rows[0]);
}
```

## Checklist for Each Service

- [ ] Create service file in `src/modules/{module}/services/`
- [ ] Define interfaces for entities and DTOs
- [ ] Move all database queries from resolver to service
- [ ] Move mapper functions from resolver to service
- [ ] Add proper error handling (NotFoundException, BadRequestException, etc.)
- [ ] Use transactions for multi-step operations
- [ ] Add JSDoc comments for public methods
- [ ] Write unit tests
- [ ] Update module providers
- [ ] Refactor resolver to use service
- [ ] Remove DATABASE_POOL injection from resolver
- [ ] Remove mapper functions from resolver
- [ ] Run integration tests
- [ ] Update documentation

## Files to Refactor (Priority Order)

### P0 - Finance Module
1. ✅ FinancialPeriodService (example above)
2. ChartOfAccountsService
3. ExchangeRateService
4. GLBalanceService
5. FinancialReportsService

### P1 - Operations Module
6. WorkCenterService
7. ProductionOrderService
8. ProductionRunService
9. OperationService

## Anti-Patterns to Avoid

### ❌ Don't: Keep DB pool in resolver
```typescript
constructor(
  @Inject('DATABASE_POOL') private readonly db: Pool,
  private readonly myService: MyService
) {}
```

### ✅ Do: Remove DB pool completely
```typescript
constructor(private readonly myService: MyService) {}
```

### ❌ Don't: Mix service calls with DB queries
```typescript
@Query('getData')
async getData(@Args('id') id: string) {
  const result = await this.db.query(/* ... */);
  return this.myService.process(result.rows[0]);
}
```

### ✅ Do: Fully delegate to service
```typescript
@Query('getData')
async getData(@Args('id') id: string, @Context() context: any) {
  const tenantId = context.req.user.tenantId;
  return this.myService.getById(id, tenantId);
}
```

### ❌ Don't: Put business logic in resolver
```typescript
@Query('getData')
async getData(@Args('id') id: string) {
  const data = await this.myService.getRaw(id);

  // ❌ Business logic in resolver
  if (data.status === 'active') {
    data.displayName = `${data.name} (Active)`;
  }

  return data;
}
```

### ✅ Do: Put business logic in service
```typescript
// Service
async getById(id: string): Promise<Entity> {
  const data = await this.getRaw(id);

  // ✅ Business logic in service
  if (data.status === 'active') {
    data.displayName = `${data.name} (Active)`;
  }

  return data;
}

// Resolver
@Query('getData')
async getData(@Args('id') id: string) {
  return this.myService.getById(id);
}
```

## Questions?

Contact Cynthia (Research) or Roy (Backend) for clarification.

---

**Document Version:** 1.0
**Last Updated:** 2026-01-10
**Status:** Implementation Ready
