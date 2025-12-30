# Research Report: Wire Job Costing Resolver to Service Layer
**REQ-STRATEGIC-AUTO-1767084329262**
**Agent:** Cynthia (Research Specialist)
**Date:** 2025-12-30
**Status:** COMPLETE

---

## Executive Summary

The Job Costing GraphQL Resolver is **already scaffolded but NOT wired** to the JobCostingService. The resolver currently throws "implementation pending" errors for all operations. This research provides a complete analysis of the current state and detailed implementation guidance for Marcus to wire the resolver to the service layer.

**Key Finding:** The resolver exists with placeholder methods but is missing the service injection in its constructor. The service layer is fully implemented and ready for integration.

---

## 1. Current Architecture Analysis

### 1.1 File Structure
```
print-industry-erp/backend/
├── src/
│   ├── graphql/
│   │   ├── schema/job-costing.graphql       ✅ Complete
│   │   └── resolvers/job-costing.resolver.ts ⚠️  Not wired
│   └── modules/
│       └── job-costing/
│           ├── job-costing.module.ts         ✅ Complete
│           ├── services/
│           │   └── job-costing.service.ts    ✅ Complete
│           └── interfaces/
│               └── job-costing.interface.ts  ✅ Complete
└── migrations/
    └── V0.0.42__create_job_costing_tables.sql ✅ Complete
```

### 1.2 Module Registration Status
- ✅ `JobCostingModule` is imported in `app.module.ts:33`
- ✅ `JobCostingModule` is registered in imports array at `app.module.ts:104`
- ✅ `JobCostingResolver` is provided in `JobCostingModule`
- ✅ `JobCostingService` is provided and exported in `JobCostingModule`

---

## 2. Current Resolver Issues

### 2.1 Constructor Problem
**File:** `src/graphql/resolvers/job-costing.resolver.ts:16-19`

**Current (Broken) Code:**
```typescript
constructor(
  // Will be injected when JobCostingService is created
  // private readonly jobCostingService: JobCostingService
) {}
```

**Issue:** The service is commented out, so it's not being injected.

### 2.2 All Methods Throw Errors
Every query and mutation currently throws:
```typescript
throw new Error('JobCostingService not yet initialized - implementation pending');
```

This is intentional scaffolding - the methods are waiting for service integration.

---

## 3. Service Layer Analysis

### 3.1 JobCostingService Methods
**File:** `src/modules/job-costing/services/job-costing.service.ts`

The service is **fully implemented** with all required methods:

#### Query Methods:
- `getJobCost(jobCostId, tenantId)` - Get single job cost by ID
- `listJobCosts(filters, limit, offset)` - List job costs with filtering
- `getJobProfitability(jobCostId, tenantId)` - Get profitability metrics
- `generateVarianceReport(filters)` - Generate variance report
- `getJobCostHistory(jobCostId, tenantId)` - Get cost update history

#### Mutation Methods:
- `initializeJobCost(input)` - Initialize job cost from estimate
- `updateActualCosts(jobCostId, tenantId, input)` - Update cost categories
- `incrementCost(tenantId, input)` - Add incremental cost with audit trail
- `rollupProductionCosts(tenantId, input)` - Rollup costs from production
- `addFinalAdjustment(tenantId, input)` - Add final cost adjustment
- `reconcileJobCost(tenantId, input)` - Mark job cost as reconciled
- `closeJobCosting(tenantId, input)` - Close and complete job costing
- `updateJobCostStatus(jobCostId, tenantId, input)` - Update status

### 3.2 Service Features
- ✅ Database connection via `@Inject('DATABASE_POOL')`
- ✅ Transaction support with BEGIN/COMMIT/ROLLBACK
- ✅ Error handling with try/catch blocks
- ✅ Result objects with `{ success, data, error }` pattern
- ✅ Row mapping with `mapJobCost()` and `mapJobCostUpdate()` helpers
- ✅ Logging with NestJS Logger

---

## 4. GraphQL Schema Analysis

### 4.1 Schema Completeness
**File:** `src/graphql/schema/job-costing.graphql`

The schema defines:
- ✅ 5 Query operations (lines 252-258)
- ✅ 8 Mutation operations (lines 264-284)
- ✅ 2 Subscription operations (lines 290-293)
- ✅ Complete type definitions for JobCost, JobCostUpdate, JobProfitability, etc.
- ✅ All input types for mutations
- ✅ Filter types for queries
- ✅ Enums for statuses and categories

### 4.2 Schema-to-Service Mapping

| GraphQL Query | Resolver Method | Service Method | Signature Match |
|--------------|----------------|----------------|-----------------|
| `jobCost(jobId)` | `getJobCost()` | `getJobCost(jobCostId, tenantId)` | ⚠️ Mismatch |
| `jobCosts(filters)` | `listJobCosts()` | `listJobCosts(filters, limit, offset)` | ✅ Match |
| `jobProfitability(jobId)` | `getJobProfitability()` | `getJobProfitability(jobCostId, tenantId)` | ⚠️ Mismatch |
| `varianceReport(filters)` | `generateVarianceReport()` | `generateVarianceReport(filters)` | ✅ Match |
| `jobCostHistory(jobId)` | `getJobCostHistory()` | `getJobCostHistory(jobCostId, tenantId)` | ⚠️ Mismatch |

**Critical Finding:** The GraphQL schema uses `jobId` but some service methods expect `jobCostId`. This needs to be resolved.

---

## 5. Database Schema Analysis

### 5.1 Tables
**File:** `migrations/V0.0.42__create_job_costing_tables.sql`

#### Table: `job_costs` (lines 16-136)
- Primary key: `id UUID` (uuid_generate_v7)
- Multi-tenant: `tenant_id UUID` with RLS policies
- Foreign keys: `job_id`, `estimate_id`
- Cost tracking: 6 cost categories + total
- Generated columns: profitability metrics and variance calculations
- Status workflow: estimated → in_progress → completed → reviewed → approved → closed
- Reconciliation: `is_reconciled`, `reconciled_at`, `reconciled_by`
- Audit trail: created/updated/approved/closed timestamps

#### Table: `job_cost_updates` (lines 157-192)
- Audit trail for incremental cost changes
- Tracks: source, category, delta, before/after totals
- Metadata support via JSONB column

#### Materialized View: `job_cost_variance_summary` (lines 206-230)
- Pre-aggregated variance metrics by month and status
- Fast reporting without scanning all job_costs

### 5.2 Database Functions
- `initialize_job_cost_from_estimate(p_job_id, p_estimate_id)` (lines 237-283)
- `update_job_cost_incremental(...)` (lines 288-363) - Handles incremental updates with audit
- `refresh_job_cost_variance_summary()` (lines 368-373) - Refresh materialized view

### 5.3 Triggers
- `trg_job_costs_timestamp` - Auto-updates timestamps and recalculates totals

### 5.4 Row-Level Security
- ✅ RLS enabled on both tables (lines 409-410)
- ✅ Tenant isolation policies using `current_setting('app.tenant_id')`

---

## 6. Resolver Pattern Analysis

### 6.1 Standard Pattern (from EstimatingResolver)
**File:** `src/graphql/resolvers/estimating.resolver.ts:14-17`

```typescript
export class EstimatingResolver {
  private readonly logger = new Logger(EstimatingResolver.name);

  constructor(private readonly estimatingService: EstimatingService) {}
```

**Key Elements:**
1. Service injected via constructor parameter
2. `private readonly` access modifier
3. NestJS automatically injects the service from the module's providers
4. Logger initialized with class name

### 6.2 Service Call Pattern
```typescript
@Query('estimate')
async getEstimate(
  @Args('estimateId') estimateId: string,
  @Args('tenantId') tenantId: string
) {
  this.logger.log(`Query: estimate(${estimateId})`);
  const result = await this.estimatingService.getEstimate(estimateId, tenantId);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.estimate;
}
```

**Pattern:**
1. Log the operation
2. Call service method
3. Check result.success
4. Throw error if failed
5. Return data if successful

---

## 7. Critical Issues to Address

### 7.1 Parameter Mismatch: jobId vs jobCostId

**Problem:** The GraphQL schema uses `jobId` in several queries, but the service expects `jobCostId`.

**Schema (job-costing.graphql:253):**
```graphql
jobCost(jobId: ID!): JobCost
```

**Service (job-costing.service.ts:107):**
```typescript
async getJobCost(jobCostId: string, tenantId: string): Promise<JobCostResult>
```

**Impact:**
- The resolver receives `jobId` from GraphQL
- The service expects `jobCostId`
- Need to either:
  1. Update schema to use `jobCostId`, OR
  2. Update service to accept `jobId` and look up the job_cost record, OR
  3. Add a translation layer in the resolver

**Recommendation:** Option 2 is most user-friendly. The schema should accept `jobId` since users think in terms of jobs, not job costs. The service should be updated to handle this.

### 7.2 Missing Import in Resolver

**File:** `src/graphql/resolvers/job-costing.resolver.ts`

The resolver file is missing the service import:
```typescript
// MISSING:
import { JobCostingService } from '../../modules/job-costing/services/job-costing.service';
```

### 7.3 Argument Mapping Issues

Several resolver methods have placeholder argument names that don't match the GraphQL schema:

**Example: initializeJobCost**
- Schema: `initializeJobCost(jobId: ID!, estimateId: ID): JobCost!`
- Resolver: Takes generic `input` object
- Service: Expects `InitializeJobCostInput` with `tenantId`, `jobId`, `estimateId`, `totalAmount`, `createdBy`

Need to properly destructure and map arguments.

---

## 8. Implementation Guidance for Marcus

### 8.1 Step-by-Step Wiring Process

#### Step 1: Fix the Resolver Constructor
**File:** `src/graphql/resolvers/job-costing.resolver.ts:16-19`

**Change from:**
```typescript
constructor(
  // Will be injected when JobCostingService is created
  // private readonly jobCostingService: JobCostingService
) {}
```

**To:**
```typescript
constructor(
  private readonly jobCostingService: JobCostingService
) {}
```

**And add import at top:**
```typescript
import { JobCostingService } from '../../modules/job-costing/services/job-costing.service';
```

#### Step 2: Wire Query Methods

**Pattern for each query:**
```typescript
@Query('queryName')
async methodName(@Args('param1') param1: string, ...) {
  this.logger.log(`Query: queryName(${param1})`);
  const result = await this.jobCostingService.serviceMethod(param1, ...);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data; // or result.jobCost, result.estimate, etc.
}
```

**Example - getJobCost:**
```typescript
@Query('jobCost')
async getJobCost(
  @Args('jobId') jobId: string,
  @Args('tenantId') tenantId: string
) {
  this.logger.log(`Query: jobCost(${jobId})`);

  // Need to get jobCostId from jobId first
  // This requires a lookup query or service method update
  const result = await this.jobCostingService.getJobCostByJobId(jobId, tenantId);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

#### Step 3: Wire Mutation Methods

**Pattern for mutations:**
```typescript
@Mutation('mutationName')
async methodName(@Args('input') input: any) {
  this.logger.log(`Mutation: mutationName for ${input.id}`);
  const result = await this.jobCostingService.serviceMethod(input);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.data;
}
```

**Example - initializeJobCost:**
```typescript
@Mutation('initializeJobCost')
async initializeJobCost(
  @Args('jobId') jobId: string,
  @Args('estimateId') estimateId: string,
  @Args('tenantId') tenantId: string
) {
  this.logger.log(`Mutation: initializeJobCost for job ${jobId}`);

  // Note: We need to get totalAmount from somewhere (quote/job record?)
  // This might require additional service calls
  const input = {
    tenantId,
    jobId,
    estimateId,
    totalAmount: 0, // TODO: Get from job/quote
    createdBy: 'system', // TODO: Get from auth context
  };

  const result = await this.jobCostingService.initializeJobCost(input);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

### 8.2 Service Method Updates Needed

#### Add getJobCostByJobId Method
The service currently only has `getJobCost(jobCostId, tenantId)`. Add a new method:

```typescript
async getJobCostByJobId(jobId: string, tenantId: string): Promise<JobCostResult> {
  try {
    const query = `
      SELECT * FROM job_costs
      WHERE job_id = $1 AND tenant_id = $2
    `;

    const result = await this.db.query(query, [jobId, tenantId]);

    if (result.rows.length === 0) {
      return {
        success: false,
        error: 'Job cost not found for this job',
      };
    }

    return {
      success: true,
      jobCost: this.mapJobCost(result.rows[0]),
    };
  } catch (error) {
    this.logger.error(`Error getting job cost by job ID: ${error.message}`);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

### 8.3 Resolver-to-Service Mapping Table

| Resolver Method | GraphQL Args | Service Method | Service Args | Notes |
|----------------|--------------|----------------|--------------|-------|
| `getJobCost()` | `jobId, tenantId` | `getJobCostByJobId()` | `jobId, tenantId` | Add new service method |
| `listJobCosts()` | `filters, limit, offset` | `listJobCosts()` | `filters, limit, offset` | Direct mapping |
| `getJobProfitability()` | `jobId, tenantId` | `getJobProfitabilityByJobId()` | `jobId, tenantId` | Add new service method |
| `generateVarianceReport()` | `filters` | `generateVarianceReport()` | `filters` | Direct mapping |
| `getJobCostHistory()` | `jobId, tenantId` | `getJobCostHistoryByJobId()` | `jobId, tenantId` | Add new service method |
| `initializeJobCost()` | `jobId, estimateId` | `initializeJobCost()` | `InitializeJobCostInput` | Map args to input object |
| `updateActualCosts()` | `jobId, costs` | `updateActualCostsByJobId()` | `jobId, tenantId, input` | Add new service method |
| `incrementCost()` | `input` | `incrementCost()` | `tenantId, input` | Extract tenantId from context |
| `rollupProductionCosts()` | `input` | `rollupProductionCosts()` | `tenantId, input` | Extract tenantId from context |
| `addFinalAdjustment()` | `input` | `addFinalAdjustment()` | `tenantId, input` | Extract tenantId from context |
| `reconcileJobCost()` | `input` | `reconcileJobCost()` | `tenantId, input` | Extract tenantId from context |
| `closeJobCosting()` | `input` | `closeJobCosting()` | `tenantId, input` | Extract tenantId from context |
| `updateJobCostStatus()` | `jobId, status` | `updateJobCostStatusByJobId()` | `jobId, tenantId, input` | Add new service method |

---

## 9. Testing Strategy

### 9.1 Unit Testing Checklist
- [ ] Test resolver constructor injection
- [ ] Test each query resolver method
- [ ] Test each mutation resolver method
- [ ] Test error handling (service returns success: false)
- [ ] Test argument mapping and transformation
- [ ] Mock JobCostingService for isolated tests

### 9.2 Integration Testing Checklist
- [ ] Test full GraphQL query → resolver → service → database flow
- [ ] Test tenant isolation (RLS policies)
- [ ] Test transaction rollback on errors
- [ ] Test generated column calculations
- [ ] Test database function calls (initialize_job_cost_from_estimate, etc.)
- [ ] Test materialized view refresh

### 9.3 GraphQL Playground Testing

**Sample Query:**
```graphql
query GetJobCost($jobId: ID!, $tenantId: ID!) {
  jobCost(jobId: $jobId, tenantId: $tenantId) {
    id
    jobId
    totalAmount
    totalCost
    grossProfit
    grossProfitMargin
    status
    materialCost
    laborCost
    estimatedTotalCost
    costVariance
    costVariancePercentage
  }
}
```

**Sample Mutation:**
```graphql
mutation InitializeJobCost($jobId: ID!, $estimateId: ID) {
  initializeJobCost(jobId: $jobId, estimateId: $estimateId) {
    id
    jobId
    estimateId
    status
    estimatedTotalCost
  }
}
```

---

## 10. Potential Pitfalls & Solutions

### 10.1 Tenant Context
**Problem:** Service expects `tenantId` but it should come from auth context, not GraphQL args.

**Solution:** Extract from request context in resolver:
```typescript
@Query('jobCost')
async getJobCost(
  @Args('jobId') jobId: string,
  @Context() context: any
) {
  const tenantId = context.req.user?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in auth context');
  }

  const result = await this.jobCostingService.getJobCostByJobId(jobId, tenantId);
  // ...
}
```

### 10.2 Database Connection Leak
**Problem:** If GraphQL context creates a client but resolver errors before releasing it.

**Solution:** Use NestJS interceptors or ensure service methods always release connections in `finally` blocks (already implemented in service).

### 10.3 Generated Column Updates
**Problem:** Updating cost categories doesn't automatically recalculate generated columns in PostgreSQL.

**Solution:** The migration includes a trigger `trg_job_costs_timestamp` that recalculates on UPDATE. Verify it's working correctly.

### 10.4 Schema-Service Version Mismatch
**Problem:** GraphQL schema evolves separately from service implementation.

**Solution:** Use TypeScript interfaces from `job-costing.interface.ts` for both schema types and service return types to keep them in sync.

---

## 11. Dependencies & Prerequisites

### 11.1 Required Migrations
- ✅ `V0.0.0__enable_extensions.sql` - UUID v7 support
- ✅ `V0.0.42__create_job_costing_tables.sql` - Job costing tables

### 11.2 Required Modules
- ✅ `DatabaseModule` - Provides DATABASE_POOL
- ✅ `JobCostingModule` - Provides JobCostingService
- ✅ `AuthModule` - Provides user/tenant context (if using)

### 11.3 Related Modules
- `EstimatingModule` - Job costs can be initialized from estimates
- `OperationsModule` - Production costs may roll up to job costs
- `FinanceModule` - Profitability data may flow to financial reports

---

## 12. Implementation Checklist for Marcus

### Phase 1: Basic Wiring (1-2 hours)
- [ ] Add `JobCostingService` import to resolver
- [ ] Uncomment service injection in constructor
- [ ] Wire `listJobCosts` query (simplest - direct mapping)
- [ ] Wire `generateVarianceReport` query (direct mapping)
- [ ] Test basic connectivity with GraphQL Playground

### Phase 2: Query Methods (2-3 hours)
- [ ] Add `getJobCostByJobId` method to service
- [ ] Wire `getJobCost` query
- [ ] Add `getJobProfitabilityByJobId` method to service
- [ ] Wire `getJobProfitability` query
- [ ] Add `getJobCostHistoryByJobId` method to service
- [ ] Wire `getJobCostHistory` query
- [ ] Test all queries

### Phase 3: Mutation Methods (3-4 hours)
- [ ] Fix `initializeJobCost` argument mapping
- [ ] Wire `initializeJobCost` mutation
- [ ] Wire `updateActualCosts` mutation
- [ ] Wire `incrementCost` mutation
- [ ] Wire `rollupProductionCosts` mutation
- [ ] Wire `addFinalAdjustment` mutation
- [ ] Wire `reconcileJobCost` mutation
- [ ] Wire `closeJobCosting` mutation
- [ ] Wire `updateJobCostStatus` mutation
- [ ] Test all mutations

### Phase 4: Tenant Context Integration (1-2 hours)
- [ ] Update resolver methods to extract tenantId from auth context
- [ ] Remove tenantId from GraphQL arguments
- [ ] Update GraphQL schema to remove tenantId args
- [ ] Test with authenticated requests

### Phase 5: Error Handling & Polish (1-2 hours)
- [ ] Add proper error messages for each failure case
- [ ] Add input validation
- [ ] Add logging for debugging
- [ ] Test error scenarios
- [ ] Update resolver comments/documentation

**Total Estimated Effort:** 8-13 hours

---

## 13. Recommendations

### 13.1 Immediate Actions (Critical)
1. **Fix Constructor:** Uncomment and import JobCostingService
2. **Add Service Methods:** Create `getJobCostByJobId`, `getJobProfitabilityByJobId`, `getJobCostHistoryByJobId`
3. **Wire One Query:** Start with `listJobCosts` as proof-of-concept
4. **Test Database:** Verify migrations are applied and tables exist

### 13.2 Short-Term Actions (High Priority)
1. **Standardize Parameter Naming:** Decide on `jobId` vs `jobCostId` convention
2. **Tenant Context:** Implement proper tenant extraction from auth context
3. **Complete All Queries:** Wire remaining query resolvers
4. **Complete All Mutations:** Wire remaining mutation resolvers

### 13.3 Long-Term Actions (Medium Priority)
1. **Add Unit Tests:** Test resolver methods in isolation
2. **Add Integration Tests:** Test full GraphQL → Database flow
3. **Add Subscriptions:** Implement real-time updates via subscriptions
4. **Performance Optimization:** Add DataLoader for N+1 query prevention
5. **Add Field Resolvers:** Resolve nested fields like `job`, `estimate` relations

---

## 14. Code Examples

### 14.1 Complete Resolver Constructor
```typescript
import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { Logger } from '@nestjs/common';
import { JobCostingService } from '../../modules/job-costing/services/job-costing.service';

@Resolver('JobCost')
export class JobCostingResolver {
  private readonly logger = new Logger(JobCostingResolver.name);

  constructor(
    private readonly jobCostingService: JobCostingService
  ) {}

  // ... rest of methods
}
```

### 14.2 Complete Query Example
```typescript
@Query('jobCosts')
async listJobCosts(
  @Args('filters') filters: any,
  @Args('limit') limit?: number,
  @Args('offset') offset?: number,
  @Context() context?: any
) {
  this.logger.log(`Query: jobCosts with filters`);

  // Extract tenant ID from auth context
  const tenantId = context?.req?.user?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in authentication context');
  }

  // Add tenantId to filters
  const filtersWithTenant = {
    ...filters,
    tenantId,
  };

  const result = await this.jobCostingService.listJobCosts(
    filtersWithTenant,
    limit || 50,
    offset || 0
  );

  return result.jobCosts;
}
```

### 14.3 Complete Mutation Example
```typescript
@Mutation('initializeJobCost')
async initializeJobCost(
  @Args('jobId') jobId: string,
  @Args('estimateId') estimateId: string,
  @Context() context?: any
) {
  this.logger.log(`Mutation: initializeJobCost for job ${jobId}`);

  const tenantId = context?.req?.user?.tenantId;
  const userId = context?.req?.user?.id;

  if (!tenantId) {
    throw new Error('Tenant ID not found in authentication context');
  }

  // TODO: Get totalAmount from job or quote record
  // For now, using placeholder value
  const input = {
    tenantId,
    jobId,
    estimateId,
    totalAmount: 0, // Should be fetched from job/quote
    createdBy: userId,
  };

  const result = await this.jobCostingService.initializeJobCost(input);

  if (!result.success) {
    throw new Error(result.error || 'Failed to initialize job cost');
  }

  return result.jobCost;
}
```

---

## 15. Conclusion

The Job Costing module has a solid foundation with:
- ✅ Complete database schema with RLS, triggers, and functions
- ✅ Fully implemented service layer with all business logic
- ✅ Well-defined GraphQL schema
- ✅ Scaffolded resolver with method signatures

**The only missing piece is wiring the resolver to the service.** This is a straightforward task that involves:
1. Uncommenting the service injection
2. Replacing the "throw new Error" placeholders with service calls
3. Adding a few helper methods to the service for jobId-based lookups

**Estimated effort:** 8-13 hours for complete implementation and testing.

**Complexity:** Medium (straightforward dependency injection but requires careful argument mapping)

**Risk:** Low (service layer is stable, just needs API integration)

---

## 16. Next Steps for Implementation Team

1. **Marcus (Backend Developer):** Implement resolver wiring per guidance above
2. **Billy (QA):** Create test plan and verify all GraphQL operations
3. **Berry (DevOps):** Ensure migrations are applied in all environments
4. **Priya (Statistician):** Validate variance calculations match business requirements
5. **Sylvia (Critic):** Review completed implementation for architectural consistency

---

**End of Research Report**
