# GraphQL Resolver to Service Layer Pattern - Research & Recommendations

**REQ:** REQ-1767924916114-88j1m
**Date:** 2026-01-10
**Researcher:** Cynthia (Research Agent)

## Executive Summary

Current GraphQL resolvers exhibit a **mixed architectural pattern** where some resolvers contain direct database queries while others properly delegate to service layers. This research identifies the resolvers requiring refactoring and provides a detailed migration strategy.

## Current State Analysis

### Resolvers Analyzed (28 total)

| Resolver | Lines | Pattern | Status |
|----------|-------|---------|--------|
| sales-materials.resolver.ts | 2,575 | Unknown | Needs Analysis |
| quality-hr-iot-security-marketplace-imposition.resolver.ts | 2,224 | Unknown | Needs Analysis |
| **finance.resolver.ts** | **1,858** | **Mixed** | **Requires Refactoring** |
| wms.resolver.ts | 1,759 | Unknown | Needs Analysis |
| **operations.resolver.ts** | **1,621** | **Mixed** | **Requires Refactoring** |
| crm.resolver.ts | 460 | ✅ Service Layer | Good |
| estimating.resolver.ts | 247 | ✅ Service Layer | Good |
| Others | Various | Unknown | Needs Analysis |

### Key Findings

#### 1. Finance Resolver (`finance.resolver.ts`)

**Current Pattern:**
- **Lines 57-447:** Direct DB queries for Financial Periods, Chart of Accounts, Exchange Rates, Journal Entries, GL Balances, Invoices, Payments
- **Lines 522-710:** Uses service layer for Cost Allocation Engine
- **Lines 1223-1378:** Mixed - uses both DB queries and service calls for mutations

**Issues:**
```typescript
// ❌ BAD: Direct DB query in resolver
@Query('financialPeriod')
async getFinancialPeriod(@Args('id') id: string, @Context() context: any) {
  const result = await this.db.query(
    `SELECT * FROM financial_periods WHERE id = $1`,
    [id]
  );
  return this.mapFinancialPeriodRow(result.rows[0]);
}
```

**Should Be:**
```typescript
// ✅ GOOD: Delegate to service
@Query('financialPeriod')
async getFinancialPeriod(@Args('id') id: string, @Context() context: any) {
  const tenantId = context.req.user.tenantId;
  return this.financialPeriodService.getById(id, tenantId);
}
```

#### 2. Operations Resolver (`operations.resolver.ts`)

**Current Pattern:**
- **Lines 45-416:** Direct DB queries for Work Centers, Production Orders, Production Runs, Operations, OEE, Schedules, Maintenance
- **Lines 1228-1325:** Uses ProductionAnalyticsService (service layer) ✅
- **Lines 1332-1620:** Uses PreflightService (service layer) ✅

**Mixed approach** - analytics and preflight use services, but core operations use direct DB queries.

#### 3. CRM Resolver (`crm.resolver.ts`) - GOOD EXAMPLE

**Pattern:**
```typescript
@Query('getContact')
async getContact(@Args('id') id: string, @Context() context: any) {
  const tenantId = context.req.headers['x-tenant-id'];
  return this.contactService.getContactById(tenantId, id);
}
```

**All methods delegate to:**
- ContactService
- OpportunityService
- ActivityService
- PipelineStageService
- NoteService

## Refactoring Strategy

### Phase 1: Financial Periods Service

**Create:** `Implementation/print-industry-erp/backend/src/modules/finance/services/financial-period.service.ts`

**Methods to Extract:**
- `getFinancialPeriod(id, tenantId)` - from line 57
- `getFinancialPeriods(filters)` - from line 70
- `getCurrentPeriod(tenantId)` - from line 102
- `createFinancialPeriod(input, userId)` - from line 916
- `closeFinancialPeriod(id, userId)` - from line 940
- `reopenFinancialPeriod(id, userId)` - from line 965

### Phase 2: Chart of Accounts Service

**Create:** `Implementation/print-industry-erp/backend/src/modules/finance/services/chart-of-accounts.service.ts`

**Methods to Extract:**
- `getAccount(id)` - from line 122
- `getChartOfAccounts(filters)` - from line 136
- `createAccount(input, userId)` - from line 992
- `updateAccount(id, input, userId)` - from line 1021

### Phase 3: Exchange Rate Service

**Create:** `Implementation/print-industry-erp/backend/src/modules/finance/services/exchange-rate.service.ts`

**Methods to Extract:**
- `getExchangeRate(fromCurrency, toCurrency, rateDate, tenantId)` - from line 170
- `getExchangeRates(filters)` - from line 197
- `createExchangeRate(input, userId)` - from line 1071

### Phase 4: GL Balance Service

**Create:** `Implementation/print-industry-erp/backend/src/modules/finance/services/gl-balance.service.ts`

**Methods to Extract:**
- `getGLBalance(accountId, year, month, currencyCode)` - from line 308
- `getGLBalances(filters)` - from line 343

### Phase 5: Financial Reports Service

**Create:** `Implementation/print-industry-erp/backend/src/modules/finance/services/financial-reports.service.ts`

**Methods to Extract:**
- `getTrialBalance(tenantId, year, month, currencyCode)` - from line 716
- `getProfitAndLoss(tenantId, startDate, endDate, currencyCode)` - from line 754
- `getBalanceSheet(tenantId, asOfDate, currencyCode)` - from line 795
- `getARAging(tenantId, asOfDate, currencyCode)` - from line 832
- `getAPAging(tenantId, asOfDate, currencyCode)` - from line 872

### Phase 6: Operations Services

**Work Center Service**
- Create: `Implementation/print-industry-erp/backend/src/modules/operations/services/work-center.service.ts`
- Extract queries and mutations from lines 45-520

**Production Order Service**
- Create: `Implementation/print-industry-erp/backend/src/modules/operations/services/production-order.service.ts`
- Extract queries and mutations from lines 86-651

**Production Run Service**
- Create: `Implementation/print-industry-erp/backend/src/modules/operations/services/production-run.service.ts`
- Extract queries and mutations from lines 169-756

**Operation Service**
- Create: `Implementation/print-industry-erp/backend/src/modules/operations/services/operation.service.ts`
- Extract queries and mutations from lines 241-849

## Implementation Principles

### 1. Service Layer Responsibilities

Services should handle:
- ✅ Database queries and transactions
- ✅ Business logic and validation
- ✅ Data transformation and mapping
- ✅ Cross-cutting concerns (logging, error handling)
- ✅ Integration with other services

### 2. Resolver Responsibilities

Resolvers should **only**:
- ✅ Extract parameters from GraphQL Args
- ✅ Extract context (tenantId, userId) from request context
- ✅ Call service methods
- ✅ Return results (no transformation)
- ✅ Handle GraphQL-specific errors

### 3. Database Pool Injection

**Current (BAD):**
```typescript
constructor(@Inject('DATABASE_POOL') private readonly db: Pool)
```

**Refactored (GOOD):**
```typescript
constructor(private readonly financialPeriodService: FinancialPeriodService)
```

Database pool should **only be injected into services**, never into resolvers.

### 4. Mapper Functions

**Move mappers to services:**

Current location: `finance.resolver.ts` lines 1513-1857

Move to:
- `financial-period.service.ts`
- `chart-of-accounts.service.ts`
- `exchange-rate.service.ts`
- etc.

Each service owns its own data transformation.

### 5. Transaction Management

Services should use database transactions for multi-step operations:

```typescript
// In service
async createJournalEntry(input: CreateJournalEntryDto, userId: string) {
  const client = await this.db.connect();
  try {
    await client.query('BEGIN');

    // Create header
    const header = await this.createHeader(client, input, userId);

    // Create lines
    await this.createLines(client, header.id, input.lines, userId);

    await client.query('COMMIT');
    return header;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

## Migration Priority

### Critical (P0) - Finance Module

1. **FinancialPeriodService** - Affects period close workflows
2. **JournalEntryService** - Already exists, needs enhancement
3. **GLBalanceService** - Required for period close
4. **FinancialReportsService** - High-visibility reports

### High (P1) - Operations Module

1. **WorkCenterService** - Core manufacturing entity
2. **ProductionOrderService** - Production planning
3. **ProductionRunService** - Shop floor execution

### Medium (P2) - Remaining Modules

1. Chart of Accounts
2. Exchange Rates
3. Other resolvers requiring analysis

## Testing Strategy

### Unit Tests for Services

Each new service requires:
- ✅ Mock database pool
- ✅ Test all CRUD operations
- ✅ Test error scenarios
- ✅ Test transaction rollback

### Integration Tests for Resolvers

Each refactored resolver requires:
- ✅ Test GraphQL queries
- ✅ Test GraphQL mutations
- ✅ Test context extraction
- ✅ Test error propagation

### Example Test Structure

```typescript
describe('FinancialPeriodService', () => {
  let service: FinancialPeriodService;
  let mockDb: jest.Mocked<Pool>;

  beforeEach(() => {
    mockDb = createMockPool();
    service = new FinancialPeriodService(mockDb);
  });

  describe('getById', () => {
    it('should return period when found', async () => {
      // Test implementation
    });

    it('should throw error when not found', async () => {
      // Test implementation
    });
  });
});
```

## Breaking Changes & Rollout

### No Breaking Changes to GraphQL API

The GraphQL schema and operations remain **100% unchanged**. Only internal implementation changes.

### Deployment Strategy

1. ✅ Deploy new services alongside existing code
2. ✅ Update resolver to use new services
3. ✅ Run smoke tests
4. ✅ Monitor for errors
5. ✅ Remove old database query code after 1 week

## Estimated Effort

| Phase | Service | Resolver Impact | Effort | Priority |
|-------|---------|-----------------|--------|----------|
| 1 | FinancialPeriodService | finance.resolver.ts | 4 hours | P0 |
| 2 | ChartOfAccountsService | finance.resolver.ts | 3 hours | P2 |
| 3 | ExchangeRateService | finance.resolver.ts | 2 hours | P2 |
| 4 | GLBalanceService | finance.resolver.ts | 3 hours | P0 |
| 5 | FinancialReportsService | finance.resolver.ts | 6 hours | P0 |
| 6 | WorkCenterService | operations.resolver.ts | 4 hours | P1 |
| 7 | ProductionOrderService | operations.resolver.ts | 5 hours | P1 |
| 8 | ProductionRunService | operations.resolver.ts | 5 hours | P1 |
| 9 | OperationService | operations.resolver.ts | 3 hours | P1 |
| **Total** | | | **35 hours** | |

## Risks & Mitigations

### Risk 1: Breaking Existing Functionality

**Mitigation:**
- Comprehensive test coverage before refactoring
- Parallel run (old and new) during transition
- Feature flags for gradual rollout

### Risk 2: Performance Regression

**Mitigation:**
- Benchmark queries before/after
- Monitor query execution times
- Database connection pooling optimization

### Risk 3: Transaction Scope Changes

**Mitigation:**
- Carefully audit transaction boundaries
- Test rollback scenarios
- Document transaction requirements

## Success Metrics

After refactoring:

1. ✅ **Zero direct DB queries in resolvers** (except for performance-critical read-only queries with explicit justification)
2. ✅ **All business logic in services** - testable in isolation
3. ✅ **Improved test coverage** - services have >80% coverage
4. ✅ **Reduced resolver complexity** - average <100 lines per resolver
5. ✅ **Better separation of concerns** - GraphQL layer vs business layer

## Next Steps

1. **Approve this research document**
2. **Create implementation REQs for each service**
3. **Assign to Roy (Backend) for implementation**
4. **Create test plans for each service**
5. **Schedule code reviews**

## References

- REQ-1767924916114-88j1m - This refactoring request
- `finance.resolver.ts` (1,858 lines) - Primary refactoring target
- `operations.resolver.ts` (1,621 lines) - Secondary target
- `crm.resolver.ts` (460 lines) - Good pattern reference
- `estimating.resolver.ts` (247 lines) - Good pattern reference

---

**Status:** Research Complete
**Recommendation:** Proceed with Phase 1-5 (Finance Module) as P0 priority
**Blocker:** None - all infrastructure in place
