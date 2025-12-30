# Sylvia's Critique: Wire Job Costing Resolver to Service Layer
**REQ-STRATEGIC-AUTO-1767084329262**
**Agent:** Sylvia (Architecture Critic)
**Date:** 2025-12-30
**Status:** COMPLETE

---

## Executive Summary

The Job Costing module presents a **critical architectural discrepancy** between the GraphQL schema and the service layer implementation. While the service layer is well-designed and fully functional, the resolver is currently disconnected and contains significant schema-to-service mismatches that will prevent proper integration.

**Critical Issues Identified:**
1. **Service not injected** - Constructor has commented-out service dependency
2. **Schema parameter mismatch** - GraphQL uses `jobId`, service expects `jobCostId`
3. **Inconsistent argument patterns** - Some methods use discrete args, others use input objects
4. **Missing tenant context extraction** - No auth context integration
5. **Incomplete error handling** - Missing proper result unwrapping pattern

**Severity:** HIGH - This module is completely non-functional until wiring is completed

**Recommendation:** Do NOT proceed with implementation as-is. The schema must be revised to align with service layer expectations, or the service layer must be enhanced with `jobId`-based lookup methods.

---

## 1. Architectural Analysis

### 1.1 Module Structure Assessment

**STRENGTH:** The module structure follows NestJS best practices:
- ✅ Proper separation of concerns (resolver, service, module)
- ✅ Service exported for potential cross-module usage
- ✅ Dependency injection properly configured in module
- ✅ Clear layer boundaries maintained

**WEAKNESS:** The resolver layer is scaffolded but disconnected:
```typescript
// Current (BROKEN):
constructor(
  // Will be injected when JobCostingService is created
  // private readonly jobCostingService: JobCostingService
) {}
```

**Expected:**
```typescript
constructor(
  private readonly jobCostingService: JobCostingService
) {}
```

**CRITICAL:** Missing import statement for `JobCostingService` in resolver file.

### 1.2 Service Layer Evaluation

**EXCELLENT IMPLEMENTATION** - The service layer demonstrates:
- ✅ Comprehensive transaction management (BEGIN/COMMIT/ROLLBACK)
- ✅ Proper connection pooling with client release in finally blocks
- ✅ Structured result objects with `{ success, data, error }` pattern
- ✅ Database function integration (initialize_job_cost_from_estimate, update_job_cost_incremental)
- ✅ Row mapping helpers for clean data transformation
- ✅ Comprehensive logging with contextual information
- ✅ Well-organized method grouping by functional area

**Example of Quality Pattern:**
```typescript
async getJobCost(jobCostId: string, tenantId: string): Promise<JobCostResult> {
  try {
    const query = `SELECT * FROM job_costs WHERE id = $1 AND tenant_id = $2`;
    const result = await this.db.query(query, [jobCostId, tenantId]);

    if (result.rows.length === 0) {
      return { success: false, error: 'Job cost not found' };
    }

    return { success: true, jobCost: this.mapJobCost(result.rows[0]) };
  } catch (error) {
    this.logger.error(`Error getting job cost: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

**This is textbook service layer design.**

---

## 2. Critical Schema-Service Impedance Mismatch

### 2.1 The jobId vs jobCostId Problem

**SEVERITY:** CRITICAL - This is a fundamental architectural decision that affects all operations.

#### GraphQL Schema Expectations:
```graphql
extend type Query {
  jobCost(jobId: ID!): JobCost
  jobProfitability(jobId: ID!): JobProfitability!
  jobCostHistory(jobId: ID!): [JobCostUpdate!]!
}

extend type Mutation {
  updateActualCosts(jobId: ID!, costs: ActualCostInput!): JobCost!
  incrementCost(jobId: ID!, input: IncrementalCostInput!): JobCost!
  reconcileJobCost(jobId: ID!): JobCost!
  closeJobCosting(jobId: ID!): JobCost!
  updateJobCostStatus(jobId: ID!, status: JobCostStatus!): JobCost!
}
```

#### Service Layer Signatures:
```typescript
async getJobCost(jobCostId: string, tenantId: string): Promise<JobCostResult>
async updateActualCosts(jobCostId: string, tenantId: string, input: UpdateActualCostsInput)
async getJobProfitability(jobCostId: string, tenantId: string): Promise<JobProfitability | null>
async getJobCostHistory(jobCostId: string, tenantId: string): Promise<JobCostUpdate[]>
async updateJobCostStatus(jobCostId: string, tenantId: string, input: UpdateJobCostStatusInput)
```

**THE PROBLEM:**
- Frontend/GraphQL layer thinks in terms of **jobs** (business entities users interact with)
- Service layer operates on **job costs** (technical records with UUID primary keys)
- There's a 1:1 relationship but different identifiers

**Database Schema Context:**
```sql
CREATE TABLE job_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  tenant_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES jobs(id),
  ...
)
```

A `job_id` is a foreign key to the `jobs` table, while `id` is the primary key of `job_costs`.

### 2.2 Three Potential Solutions

#### Solution A: Service Layer Enhancement (RECOMMENDED)
**Approach:** Add `getJobCostByJobId()` and similar methods to service layer.

**Pros:**
- GraphQL schema remains user-friendly (users think in jobs, not job costs)
- Maintains semantic clarity at API boundary
- Follows "API-first" design principle
- Aligns with how estimating.resolver.ts uses `getEstimateByNumber()`

**Cons:**
- Requires additional service methods
- Extra database lookup (negligible performance impact with proper indexing)

**Implementation:**
```typescript
// Add to JobCostingService:
async getJobCostByJobId(jobId: string, tenantId: string): Promise<JobCostResult> {
  try {
    const query = `
      SELECT * FROM job_costs
      WHERE job_id = $1 AND tenant_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const result = await this.db.query(query, [jobId, tenantId]);

    if (result.rows.length === 0) {
      return { success: false, error: 'Job cost not found for this job' };
    }

    return { success: true, jobCost: this.mapJobCost(result.rows[0]) };
  } catch (error) {
    this.logger.error(`Error getting job cost by job ID: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

#### Solution B: Schema Revision
**Approach:** Change GraphQL schema to use `jobCostId` everywhere.

**Pros:**
- Direct mapping to service layer
- No additional service methods needed
- Technically simpler

**Cons:**
- **POOR UX:** Forces frontend to track job cost IDs separately from job IDs
- **Breaks semantic clarity:** Users don't think in terms of "job costs", they think in "jobs"
- **Inconsistent with estimating module:** Estimating uses business identifiers (estimate numbers)

**VERDICT:** This solution is architecturally lazy and user-hostile. DO NOT RECOMMEND.

#### Solution C: Resolver Translation Layer
**Approach:** Resolver queries for job cost ID using job ID before calling service.

**Cons:**
- Violates single responsibility principle (resolver doing data access)
- Creates N+1 query patterns
- Mixes concerns (resolver should orchestrate, not query)
- Poor separation of concerns

**VERDICT:** Anti-pattern. DO NOT RECOMMEND.

### 2.3 Architectural Decision

**RECOMMENDATION:** Implement Solution A.

**Rationale:**
1. **User-centric design:** GraphQL schema should model business concepts, not database implementation
2. **Precedent:** The estimating module demonstrates this pattern with `getEstimateByNumber()`
3. **Maintainability:** Service layer is the appropriate place for data access logic
4. **Performance:** Index on `(tenant_id, job_id)` makes lookup efficient
5. **Semantic clarity:** A job "has a" job cost, so querying by job makes conceptual sense

---

## 3. Resolver Implementation Pattern Analysis

### 3.1 Established Pattern (from EstimatingResolver)

The codebase has established a clear pattern:

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

**Pattern Elements:**
1. Log the operation with key identifier
2. Call service method
3. Check result.success
4. Throw error if failed (GraphQL will wrap this appropriately)
5. Return unwrapped data if successful

### 3.2 Current JobCostingResolver Deviations

**ISSUE 1: No service injection**
```typescript
// CURRENT (line 16-19):
constructor(
  // Will be injected when JobCostingService is created
  // private readonly jobCostingService: JobCostingService
) {}

// SHOULD BE:
constructor(
  private readonly jobCostingService: JobCostingService
) {}
```

**ISSUE 2: Placeholder throws instead of service calls**
```typescript
// CURRENT:
@Query('jobCost')
async getJobCost(
  @Args('jobCostId') jobCostId: string,
  @Args('tenantId') tenantId: string
) {
  this.logger.log(`Query: jobCost(${jobCostId})`);
  throw new Error('JobCostingService not yet initialized - implementation pending');
}

// SHOULD BE:
@Query('jobCost')
async getJobCost(
  @Args('jobId') jobId: string,
  @Args('tenantId') tenantId: string
) {
  this.logger.log(`Query: jobCost for job ${jobId}`);
  const result = await this.jobCostingService.getJobCostByJobId(jobId, tenantId);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

**ISSUE 3: Argument name mismatch with schema**

Resolver line 27-28:
```typescript
@Args('jobCostId') jobCostId: string,
@Args('tenantId') tenantId: string
```

But schema line 253:
```graphql
jobCost(jobId: ID!): JobCost
```

**This will cause runtime errors.** GraphQL will not find the `jobCostId` argument.

### 3.3 Missing Import

The resolver must import the service:
```typescript
import { JobCostingService } from '../../modules/job-costing/services/job-costing.service';
```

Currently missing from line 1-10 of job-costing.resolver.ts.

---

## 4. Tenant Context Security Issue

### 4.1 Current Anti-Pattern

The resolver accepts `tenantId` as a GraphQL argument:
```graphql
jobCost(jobId: ID!, tenantId: ID!): JobCost
```

**SECURITY FLAW:** This allows clients to request data from ANY tenant by passing different tenant IDs.

### 4.2 Correct Pattern

Tenant context should come from **authentication context**, not GraphQL arguments:

```typescript
@Query('jobCost')
async getJobCost(
  @Args('jobId') jobId: string,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  if (!tenantId) {
    throw new Error('Unauthorized: No tenant context found');
  }

  this.logger.log(`Query: jobCost for job ${jobId} (tenant: ${tenantId})`);
  const result = await this.jobCostingService.getJobCostByJobId(jobId, tenantId);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

**GraphQL Schema Update:**
```graphql
extend type Query {
  jobCost(jobId: ID!): JobCost  # Remove tenantId argument
}
```

### 4.3 RLS Policy Alignment

The database already has Row-Level Security policies:
```sql
CREATE POLICY job_costs_tenant_isolation ON job_costs
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
```

The resolver must set this context before service calls:
```typescript
await this.db.query(`SET app.tenant_id = $1`, [tenantId]);
```

**However**, the service layer already handles this via `tenant_id` parameters in WHERE clauses. The RLS provides defense-in-depth but is not the primary isolation mechanism.

---

## 5. Method-by-Method Implementation Guidance

### 5.1 Query Methods

#### getJobCost
**Current Schema:** `jobCost(jobId: ID!): JobCost`
**Service Method Needed:** `getJobCostByJobId(jobId, tenantId)` (ADD NEW)

**Resolver Implementation:**
```typescript
@Query('jobCost')
async getJobCost(
  @Args('jobId') jobId: string,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Query: jobCost for job ${jobId}`);
  const result = await this.jobCostingService.getJobCostByJobId(jobId, tenantId);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

#### listJobCosts
**Current Schema:** `jobCosts(filters: JobCostFilters, limit: Int, offset: Int): [JobCost!]!`
**Service Method:** `listJobCosts(filters, limit, offset)` (EXISTS)

**Resolver Implementation:**
```typescript
@Query('jobCosts')
async listJobCosts(
  @Args('filters') filters: any,
  @Args('limit') limit?: number,
  @Args('offset') offset?: number,
  @Context() context?: any
) {
  const tenantId = context?.req?.user?.tenantId;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Query: jobCosts with filters`);

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

#### getJobProfitability
**Current Schema:** `jobProfitability(jobId: ID!): JobProfitability!`
**Service Method Needed:** `getJobProfitabilityByJobId(jobId, tenantId)` (ADD NEW)

**Service Implementation:**
```typescript
async getJobProfitabilityByJobId(jobId: string, tenantId: string): Promise<JobProfitability | null> {
  try {
    // First get job cost ID
    const jobCostQuery = `SELECT id FROM job_costs WHERE job_id = $1 AND tenant_id = $2`;
    const jobCostResult = await this.db.query(jobCostQuery, [jobId, tenantId]);

    if (jobCostResult.rows.length === 0) {
      return null;
    }

    const jobCostId = jobCostResult.rows[0].id;
    return await this.getJobProfitability(jobCostId, tenantId);
  } catch (error) {
    this.logger.error(`Error getting job profitability by job ID: ${error.message}`);
    return null;
  }
}
```

**Resolver Implementation:**
```typescript
@Query('jobProfitability')
async getJobProfitability(
  @Args('jobId') jobId: string,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Query: jobProfitability for job ${jobId}`);
  const profitability = await this.jobCostingService.getJobProfitabilityByJobId(jobId, tenantId);

  if (!profitability) {
    throw new Error('Job profitability data not found');
  }

  return profitability;
}
```

#### generateVarianceReport
**Current Schema:** `varianceReport(filters: VarianceReportFilters): VarianceReport!`
**Service Method:** `generateVarianceReport(filters)` (EXISTS)

**Resolver Implementation:**
```typescript
@Query('varianceReport')
async generateVarianceReport(
  @Args('filters') filters: any,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Query: varianceReport with filters`);

  const filtersWithTenant = {
    ...filters,
    tenantId,
  };

  const result = await this.jobCostingService.generateVarianceReport(filtersWithTenant);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.report;
}
```

#### getJobCostHistory
**Current Schema:** `jobCostHistory(jobId: ID!): [JobCostUpdate!]!`
**Service Method Needed:** `getJobCostHistoryByJobId(jobId, tenantId)` (ADD NEW)

**Service Implementation:**
```typescript
async getJobCostHistoryByJobId(jobId: string, tenantId: string): Promise<JobCostUpdate[]> {
  try {
    // Get job cost ID first
    const jobCostQuery = `SELECT id FROM job_costs WHERE job_id = $1 AND tenant_id = $2`;
    const jobCostResult = await this.db.query(jobCostQuery, [jobId, tenantId]);

    if (jobCostResult.rows.length === 0) {
      return [];
    }

    const jobCostId = jobCostResult.rows[0].id;
    return await this.getJobCostHistory(jobCostId, tenantId);
  } catch (error) {
    this.logger.error(`Error getting job cost history by job ID: ${error.message}`);
    return [];
  }
}
```

**Resolver Implementation:**
```typescript
@Query('jobCostHistory')
async getJobCostHistory(
  @Args('jobId') jobId: string,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Query: jobCostHistory for job ${jobId}`);
  return await this.jobCostingService.getJobCostHistoryByJobId(jobId, tenantId);
}
```

### 5.2 Mutation Methods

#### initializeJobCost
**Current Schema:** `initializeJobCost(jobId: ID!, estimateId: ID): JobCost!`
**Service Method:** `initializeJobCost(input: InitializeJobCostInput)` (EXISTS)

**ISSUE:** Service expects `totalAmount` and `createdBy`, but schema doesn't provide them.

**SOLUTION 1:** Fetch total amount from job/quote record
**SOLUTION 2:** Add parameters to GraphQL schema

**Recommended Approach:**
```typescript
@Mutation('initializeJobCost')
async initializeJobCost(
  @Args('jobId') jobId: string,
  @Args('estimateId') estimateId: string,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  const userId = context.req?.user?.id;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Mutation: initializeJobCost for job ${jobId}`);

  // Fetch total amount from job or quote
  // This is a simplified example - actual implementation would query jobs table
  const jobQuery = `SELECT total_amount FROM jobs WHERE id = $1 AND tenant_id = $2`;
  const jobResult = await this.db.query(jobQuery, [jobId, tenantId]);

  if (jobResult.rows.length === 0) {
    throw new Error('Job not found');
  }

  const totalAmount = jobResult.rows[0].total_amount;

  const input = {
    tenantId,
    jobId,
    estimateId,
    totalAmount,
    createdBy: userId,
  };

  const result = await this.jobCostingService.initializeJobCost(input);

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

**CRITICAL:** This requires database access in the resolver, which violates separation of concerns. **Better approach:** Move this logic into the service layer:

```typescript
// In JobCostingService:
async initializeJobCostFromJob(
  jobId: string,
  tenantId: string,
  estimateId: string | null,
  createdBy: string
): Promise<JobCostResult> {
  const client = await this.db.connect();

  try {
    await client.query('BEGIN');

    // Get total amount from job
    const jobQuery = `SELECT total_amount FROM jobs WHERE id = $1 AND tenant_id = $2`;
    const jobResult = await client.query(jobQuery, [jobId, tenantId]);

    if (jobResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, error: 'Job not found' };
    }

    const totalAmount = jobResult.rows[0].total_amount;

    // Call existing initializeJobCost logic
    const query = `SELECT * FROM initialize_job_cost_from_estimate($1, $2, $3, $4, $5)`;
    const result = await client.query(query, [
      tenantId,
      jobId,
      estimateId,
      totalAmount,
      createdBy,
    ]);

    await client.query('COMMIT');

    if (result.rows.length === 0) {
      return { success: false, error: 'Failed to initialize job cost' };
    }

    this.logger.log(`Initialized job cost for job ${jobId}`);
    return { success: true, jobCost: this.mapJobCost(result.rows[0]) };
  } catch (error) {
    await client.query('ROLLBACK');
    this.logger.error(`Error initializing job cost from job: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    client.release();
  }
}
```

Then resolver becomes clean:
```typescript
@Mutation('initializeJobCost')
async initializeJobCost(
  @Args('jobId') jobId: string,
  @Args('estimateId') estimateId: string | null,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  const userId = context.req?.user?.id;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Mutation: initializeJobCost for job ${jobId}`);

  const result = await this.jobCostingService.initializeJobCostFromJob(
    jobId,
    tenantId,
    estimateId,
    userId
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

#### updateActualCosts
**Current Schema:** `updateActualCosts(jobId: ID!, costs: ActualCostInput!): JobCost!`
**Service Method:** `updateActualCosts(jobCostId, tenantId, input)` (EXISTS)

**Service Enhancement Needed:**
```typescript
async updateActualCostsByJobId(
  jobId: string,
  tenantId: string,
  input: UpdateActualCostsInput
): Promise<JobCostResult> {
  try {
    // Get job cost ID
    const jobCostQuery = `SELECT id FROM job_costs WHERE job_id = $1 AND tenant_id = $2`;
    const jobCostResult = await this.db.query(jobCostQuery, [jobId, tenantId]);

    if (jobCostResult.rows.length === 0) {
      return { success: false, error: 'Job cost not found for this job' };
    }

    const jobCostId = jobCostResult.rows[0].id;
    return await this.updateActualCosts(jobCostId, tenantId, input);
  } catch (error) {
    this.logger.error(`Error updating actual costs by job ID: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

**Resolver:**
```typescript
@Mutation('updateActualCosts')
async updateActualCosts(
  @Args('jobId') jobId: string,
  @Args('costs') costs: any,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  const userId = context.req?.user?.id;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Mutation: updateActualCosts for job ${jobId}`);

  const input = {
    ...costs,
    updatedBy: userId,
  };

  const result = await this.jobCostingService.updateActualCostsByJobId(
    jobId,
    tenantId,
    input
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

#### incrementCost
**Current Schema:** `incrementCost(jobId: ID!, input: IncrementalCostInput!): JobCost!`
**Service Method:** `incrementCost(tenantId, input)` where input contains jobCostId

**CHALLENGE:** Schema provides `jobId` separately, service expects `jobCostId` inside input.

**Service Enhancement:**
```typescript
async incrementCostByJobId(
  jobId: string,
  tenantId: string,
  input: IncrementCostInput
): Promise<JobCostResult> {
  try {
    // Get job cost ID
    const jobCostQuery = `SELECT id FROM job_costs WHERE job_id = $1 AND tenant_id = $2`;
    const jobCostResult = await this.db.query(jobCostQuery, [jobId, tenantId]);

    if (jobCostResult.rows.length === 0) {
      return { success: false, error: 'Job cost not found for this job' };
    }

    const jobCostId = jobCostResult.rows[0].id;
    const inputWithJobCostId = { ...input, jobCostId };

    return await this.incrementCost(tenantId, inputWithJobCostId);
  } catch (error) {
    this.logger.error(`Error incrementing cost by job ID: ${error.message}`);
    return { success: false, error: error.message };
  }
}
```

**Resolver:**
```typescript
@Mutation('incrementCost')
async incrementCost(
  @Args('jobId') jobId: string,
  @Args('input') input: any,
  @Context() context: any
) {
  const tenantId = context.req?.user?.tenantId;
  if (!tenantId) throw new Error('Unauthorized: No tenant context');

  this.logger.log(`Mutation: incrementCost for job ${jobId}`);

  const result = await this.jobCostingService.incrementCostByJobId(
    jobId,
    tenantId,
    input
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  return result.jobCost;
}
```

#### Other Mutations (rollupProductionCosts, addFinalAdjustment, reconcileJobCost, closeJobCosting, updateJobCostStatus)

All follow the same pattern:
1. Extract tenant and user from auth context
2. Convert `jobId` to `jobCostId` via service layer helper
3. Call service method
4. Check result and throw/return accordingly

**I'm omitting full implementations to avoid repetition, but the pattern is consistent.**

---

## 6. Schema Inconsistencies

### 6.1 VarianceSummary Missing Field

**Schema Definition (line 141-154):**
```graphql
type VarianceSummary {
  totalJobs: Int!
  totalRevenue: Float!
  totalCost: Float!
  totalProfit: Float!
  avgMargin: Float!
  minMargin: Float
  maxMargin: Float
  medianMargin: Float
  totalVariance: Float!
  jobsOverBudget: Int!
  jobsUnderBudget: Int!
  jobsOnBudget: Int!  # <-- THIS FIELD
}
```

**Service Implementation (line 928-981):**
```typescript
return {
  totalJobs,
  totalRevenue,
  totalCost,
  totalProfit,
  avgMargin,
  minMargin,
  maxMargin,
  medianMargin,
  totalVariance,
  avgVariancePercentage,  // <-- NOT IN SCHEMA
  jobsOverBudget,
  jobsUnderBudget,
  // jobsOnBudget is MISSING from service
};
```

**MISMATCH:**
- Schema expects `jobsOnBudget: Int!`
- Service returns `avgVariancePercentage` instead

**FIX:**
```typescript
// In calculateVarianceSummary():
const jobsOnBudget = jobs.filter(job =>
  job.costVariance !== undefined &&
  Math.abs(job.costVariance) < 100 // or some threshold
).length;

return {
  totalJobs,
  totalRevenue,
  totalCost,
  totalProfit,
  avgMargin,
  minMargin,
  maxMargin,
  medianMargin,
  totalVariance,
  avgVariancePercentage, // Keep this, add to schema
  jobsOverBudget,
  jobsUnderBudget,
  jobsOnBudget, // Add this
};
```

**Schema update:**
```graphql
type VarianceSummary {
  totalJobs: Int!
  totalRevenue: Float!
  totalCost: Float!
  totalProfit: Float!
  avgMargin: Float!
  minMargin: Float
  maxMargin: Float
  medianMargin: Float
  totalVariance: Float!
  avgVariancePercentage: Float!  # Add this
  jobsOverBudget: Int!
  jobsUnderBudget: Int!
  jobsOnBudget: Int!
}
```

### 6.2 Missing Nested Field Resolvers

The schema defines relationships:
```graphql
type JobCost {
  job: Job!
  estimate: Estimate
  costBreakdown: [CostLineItem!]!
  costHistory: [JobCostUpdate!]!
  finalAdjustments: [CostAdjustment!]
}
```

But the resolver has no field resolvers for these nested types. GraphQL will return `null` for these fields.

**REQUIRED:**
```typescript
@ResolveField('job')
async getJob(@Parent() jobCost: any) {
  // Fetch job details
  const jobQuery = `SELECT * FROM jobs WHERE id = $1`;
  const result = await this.db.query(jobQuery, [jobCost.jobId]);
  return result.rows[0];
}

@ResolveField('estimate')
async getEstimate(@Parent() jobCost: any) {
  if (!jobCost.estimateId) return null;
  const estimateQuery = `SELECT * FROM estimates WHERE id = $1`;
  const result = await this.db.query(estimateQuery, [jobCost.estimateId]);
  return result.rows[0];
}

@ResolveField('costBreakdown')
async getCostBreakdown(@Parent() jobCost: any) {
  // Generate breakdown from cost categories
  const categories: CostCategory[] = [
    'MATERIAL', 'LABOR', 'EQUIPMENT', 'OVERHEAD', 'OUTSOURCING', 'OTHER'
  ];

  return categories.map(category => ({
    costCategory: category,
    estimatedCost: jobCost[`estimated${category.toLowerCase()}Cost`] || 0,
    actualCost: jobCost[`${category.toLowerCase()}Cost`] || 0,
    variance: jobCost[`${category.toLowerCase()}Variance`] || 0,
    variancePercentage: /* calculation */
  }));
}

@ResolveField('costHistory')
async getCostHistory(@Parent() jobCost: any, @Context() context: any) {
  const tenantId = context.req?.user?.tenantId;
  return await this.jobCostingService.getJobCostHistory(jobCost.id, tenantId);
}

@ResolveField('finalAdjustments')
async getFinalAdjustments(@Parent() jobCost: any) {
  // Parse from notes field or separate table
  // This depends on how adjustments are stored
  return [];
}
```

**NOTE:** Implementing these field resolvers is CRITICAL for the GraphQL schema to work as designed.

---

## 7. Performance & Optimization Concerns

### 7.1 N+1 Query Problem

If a client queries:
```graphql
query {
  jobCosts(filters: { status: IN_PROGRESS }) {
    id
    job {
      jobNumber
      customerName
    }
    estimate {
      estimateNumber
    }
  }
}
```

With the field resolver pattern above, this will execute:
1. One query to get all job costs (N results)
2. N queries to get each job (1 per job cost)
3. N queries to get each estimate (1 per job cost)

**Total: 1 + N + N = O(2N) queries**

**SOLUTION: DataLoader**

Implement DataLoader to batch and cache nested entity fetches:
```typescript
import DataLoader from 'dataloader';

export class JobCostingResolver {
  private jobLoader: DataLoader<string, any>;
  private estimateLoader: DataLoader<string, any>;

  constructor(
    private readonly jobCostingService: JobCostingService
  ) {
    this.jobLoader = new DataLoader(async (jobIds: string[]) => {
      const query = `SELECT * FROM jobs WHERE id = ANY($1)`;
      const result = await this.db.query(query, [jobIds]);
      const jobMap = new Map(result.rows.map(job => [job.id, job]));
      return jobIds.map(id => jobMap.get(id));
    });

    this.estimateLoader = new DataLoader(async (estimateIds: string[]) => {
      const query = `SELECT * FROM estimates WHERE id = ANY($1)`;
      const result = await this.db.query(query, [estimateIds]);
      const estimateMap = new Map(result.rows.map(est => [est.id, est]));
      return estimateIds.map(id => estimateMap.get(id));
    });
  }

  @ResolveField('job')
  async getJob(@Parent() jobCost: any) {
    return this.jobLoader.load(jobCost.jobId);
  }

  @ResolveField('estimate')
  async getEstimate(@Parent() jobCost: any) {
    if (!jobCost.estimateId) return null;
    return this.estimateLoader.load(jobCost.estimateId);
  }
}
```

**Result:** Reduces 1 + 2N queries to 3 queries total (1 for job costs, 1 batched for jobs, 1 batched for estimates).

### 7.2 Database Query Optimization

The service layer uses indexed columns for lookups, which is good. However:

**RECOMMENDATION:** Ensure the following indexes exist:
```sql
CREATE INDEX IF NOT EXISTS idx_job_costs_job_id_tenant_id
  ON job_costs(job_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_job_costs_tenant_status
  ON job_costs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_job_costs_tenant_date
  ON job_costs(tenant_id, costing_date);

CREATE INDEX IF NOT EXISTS idx_job_cost_updates_job_cost_id
  ON job_cost_updates(job_cost_id, created_at DESC);
```

These indexes support the query patterns used by `listJobCosts()`, `generateVarianceReport()`, and nested field resolution.

---

## 8. Error Handling & Observability

### 8.1 Current Error Pattern

The service layer returns structured errors:
```typescript
return { success: false, error: 'Job cost not found' };
```

The resolver throws these as generic errors:
```typescript
if (!result.success) {
  throw new Error(result.error);
}
```

**PROBLEM:** All errors become generic GraphQL errors with 500 status codes. No differentiation between:
- Not found (should be 404)
- Unauthorized (should be 401/403)
- Invalid input (should be 400)
- Database errors (should be 500)

**SOLUTION: Custom GraphQL Error Types**

```typescript
import { ApolloError } from 'apollo-server-express';

class JobCostNotFoundError extends ApolloError {
  constructor(message: string) {
    super(message, 'JOB_COST_NOT_FOUND');
  }
}

class UnauthorizedError extends ApolloError {
  constructor(message: string) {
    super(message, 'UNAUTHORIZED');
  }
}

class ValidationError extends ApolloError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

// In resolver:
if (!result.success) {
  if (result.error.includes('not found')) {
    throw new JobCostNotFoundError(result.error);
  }
  if (result.error.includes('Unauthorized')) {
    throw new UnauthorizedError(result.error);
  }
  throw new ApolloError(result.error, 'INTERNAL_ERROR');
}
```

**Better: Service Layer Returns Error Codes**

Update service result type:
```typescript
interface JobCostResult {
  success: boolean;
  jobCost?: JobCost;
  error?: string;
  errorCode?: 'NOT_FOUND' | 'UNAUTHORIZED' | 'VALIDATION_ERROR' | 'INTERNAL_ERROR';
}
```

Then resolver maps codes to appropriate error types.

### 8.2 Logging & Tracing

**CURRENT:**
```typescript
this.logger.log(`Query: jobCost(${jobCostId})`);
```

**IMPROVED:**
```typescript
this.logger.log({
  operation: 'jobCost',
  jobId,
  tenantId,
  userId: context.req?.user?.id,
  timestamp: new Date().toISOString(),
});
```

This structured logging enables:
- Filtering by tenant for multi-tenant debugging
- Tracking which user made which changes
- Performance analysis (add duration tracking)
- Audit trails

**RECOMMENDATION:** Add correlation IDs for request tracing:
```typescript
const correlationId = context.req?.headers['x-correlation-id'] || uuidv4();
this.logger.log({ correlationId, operation: 'jobCost', jobId, tenantId });
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Resolver Unit Tests:**
```typescript
describe('JobCostingResolver', () => {
  let resolver: JobCostingResolver;
  let mockService: jest.Mocked<JobCostingService>;

  beforeEach(() => {
    mockService = {
      getJobCostByJobId: jest.fn(),
      // ... other methods
    } as any;

    resolver = new JobCostingResolver(mockService);
  });

  it('should get job cost by job ID', async () => {
    const mockJobCost = { id: 'jc-1', jobId: 'job-1', totalCost: 1000 };
    mockService.getJobCostByJobId.mockResolvedValue({
      success: true,
      jobCost: mockJobCost,
    });

    const context = { req: { user: { tenantId: 'tenant-1', id: 'user-1' } } };
    const result = await resolver.getJobCost('job-1', context);

    expect(result).toEqual(mockJobCost);
    expect(mockService.getJobCostByJobId).toHaveBeenCalledWith('job-1', 'tenant-1');
  });

  it('should throw error if tenant context missing', async () => {
    const context = { req: { user: {} } };

    await expect(resolver.getJobCost('job-1', context)).rejects.toThrow('Unauthorized');
  });

  it('should throw error if service returns failure', async () => {
    mockService.getJobCostByJobId.mockResolvedValue({
      success: false,
      error: 'Job cost not found',
    });

    const context = { req: { user: { tenantId: 'tenant-1' } } };

    await expect(resolver.getJobCost('job-1', context)).rejects.toThrow('Job cost not found');
  });
});
```

### 9.2 Integration Tests

**End-to-End GraphQL Tests:**
```typescript
describe('JobCostingResolver Integration', () => {
  let app: INestApplication;
  let db: Pool;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();

    db = moduleRef.get('DATABASE_POOL');
  });

  it('should initialize job cost from job', async () => {
    // Setup: Create test job
    const jobId = await createTestJob(db, {
      jobNumber: 'JOB-001',
      totalAmount: 5000,
    });

    // Execute GraphQL mutation
    const mutation = `
      mutation {
        initializeJobCost(jobId: "${jobId}", estimateId: null) {
          id
          jobId
          totalAmount
          status
        }
      }
    `;

    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: mutation })
      .set('Authorization', 'Bearer <token>')
      .expect(200);

    expect(response.body.data.initializeJobCost).toMatchObject({
      jobId,
      totalAmount: 5000,
      status: 'ESTIMATED',
    });

    // Verify database state
    const dbCheck = await db.query('SELECT * FROM job_costs WHERE job_id = $1', [jobId]);
    expect(dbCheck.rows).toHaveLength(1);
  });
});
```

### 9.3 Load Testing

**Scenario: Variance report for 1000 jobs**

Expected performance:
- Query time: < 2 seconds
- Database connections: < 10 concurrent
- Memory usage: < 100MB for result set

Use tools like `artillery` or `k6` to simulate load:
```yaml
# artillery-load-test.yml
config:
  target: http://localhost:3000
  phases:
    - duration: 60
      arrivalRate: 10
scenarios:
  - name: Variance Report
    flow:
      - post:
          url: /graphql
          json:
            query: |
              query {
                varianceReport(filters: { status: IN_PROGRESS }) {
                  jobs { jobId costVariance }
                  summary { totalJobs avgMargin }
                }
              }
```

---

## 10. Security Audit

### 10.1 SQL Injection Risk

**CURRENT STATE:** Service layer uses parameterized queries. ✅ SAFE

Example:
```typescript
const query = `SELECT * FROM job_costs WHERE id = $1 AND tenant_id = $2`;
await this.db.query(query, [jobCostId, tenantId]);
```

**DO NOT change to string concatenation:**
```typescript
// UNSAFE - DO NOT DO THIS:
const query = `SELECT * FROM job_costs WHERE id = '${jobCostId}'`;
```

### 10.2 Tenant Isolation

**CURRENT IMPLEMENTATION:**
- Every service method accepts `tenantId` parameter ✅
- All queries include `WHERE tenant_id = $N` clause ✅
- RLS policies provide defense-in-depth ✅

**VULNERABILITY:** If tenant ID extraction from auth context is buggy or missing, users could access other tenants' data.

**MITIGATION:**
1. **Centralize tenant extraction:** Create a decorator or guard
2. **Fail closed:** Throw error if no tenant ID, don't default to null
3. **Audit logging:** Log all cross-tenant access attempts

**Recommended Guard:**
```typescript
// tenant.guard.ts
@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    if (!request.user?.tenantId) {
      throw new UnauthorizedException('No tenant context found');
    }

    return true;
  }
}

// Apply to resolver:
@UseGuards(TenantGuard)
@Resolver('JobCost')
export class JobCostingResolver {
  // ...
}
```

### 10.3 Authorization

**MISSING:** Role-based access control for sensitive operations.

Example: Only managers should be able to close job costing.

**RECOMMENDATION:**
```typescript
@Mutation('closeJobCosting')
@RequireRole('MANAGER', 'ADMIN')
async closeJobCosting(/* ... */) {
  // ...
}
```

Implement with NestJS guards:
```typescript
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;
    const userRoles = request.user?.roles || [];

    return requiredRoles.some(role => userRoles.includes(role));
  }
}
```

---

## 11. Deployment Considerations

### 11.1 Migration Dependency

The resolver depends on:
- ✅ `V0.0.42__create_job_costing_tables.sql` (job_costs, job_cost_updates tables)
- ✅ `V0.0.0__enable_extensions.sql` (uuid_generate_v7)

**Verify migrations are applied:**
```bash
npm run migration:status
```

**If not applied:**
```bash
npm run migration:run
```

### 11.2 Environment Configuration

Required env vars:
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
GRAPHQL_PLAYGROUND=true  # for development only
GRAPHQL_INTROSPECTION=true  # for development only
```

**Production:** Set `GRAPHQL_PLAYGROUND=false` and `GRAPHQL_INTROSPECTION=false` to prevent schema leakage.

### 11.3 Monitoring & Alerting

**Metrics to track:**
- GraphQL query latency (p50, p95, p99)
- Error rate by operation
- Database connection pool usage
- Active job costs count
- Variance report generation time

**Recommended tools:**
- Apollo Studio for GraphQL monitoring
- Prometheus + Grafana for metrics
- Sentry for error tracking
- CloudWatch/Datadog for infrastructure

**Critical alerts:**
- Job cost initialization failures > 1% of attempts
- Variance report generation > 5 seconds
- Database connection pool exhaustion
- Any 500 errors in production

---

## 12. Documentation Requirements

### 12.1 GraphQL Schema Documentation

**CURRENT:** Schema has inline comments (good start).

**RECOMMENDED:** Add comprehensive descriptions:
```graphql
"""
Represents the cost tracking record for a manufacturing job.
Tracks estimated vs actual costs across six cost categories,
calculates variance and profitability metrics, and maintains
an audit trail of all cost updates.
"""
type JobCost {
  """
  Unique identifier for this job cost record (UUID v7).
  """
  id: ID!

  """
  The job this cost record belongs to.
  """
  jobId: ID!

  # ... etc.
}
```

Use GraphQL schema directives for deprecation:
```graphql
type JobCost {
  estimateId: ID @deprecated(reason: "Use estimate { id } instead")
}
```

### 12.2 API Usage Examples

Create a `docs/api-examples.md` file:
```markdown
# Job Costing API Examples

## Initialize Job Cost

```graphql
mutation InitializeJobCost {
  initializeJobCost(
    jobId: "job_01HQZF8XYZ123456789ABC"
    estimateId: "est_01HQZF8XYZ987654321DEF"
  ) {
    id
    jobId
    status
    estimatedTotalCost
  }
}
```

## Update Actual Costs

```graphql
mutation UpdateCosts {
  updateActualCosts(
    jobId: "job_01HQZF8XYZ123456789ABC"
    costs: {
      materialCost: 1250.50
      laborCost: 840.00
      equipmentCost: 320.00
    }
  ) {
    id
    totalCost
    costVariance
    costVariancePercentage
  }
}
```

## Generate Variance Report

```graphql
query VarianceReport {
  varianceReport(
    filters: {
      dateFrom: "2025-01-01"
      dateTo: "2025-12-31"
      minVariancePercentage: 10.0
      status: IN_PROGRESS
    }
  ) {
    jobs {
      jobNumber
      customerName
      costVariance
      costVariancePercentage
    }
    summary {
      totalJobs
      avgMargin
      jobsOverBudget
      jobsUnderBudget
    }
  }
}
```
```

### 12.3 Service Method Documentation

The service layer already has good JSDoc comments. Enhance with examples:
```typescript
/**
 * Get job cost by ID
 *
 * @param jobCostId - UUID of the job cost record
 * @param tenantId - UUID of the tenant (for RLS)
 * @returns JobCostResult with jobCost or error
 *
 * @example
 * ```typescript
 * const result = await service.getJobCost(
 *   'jc_01HQZF8XYZ123456789ABC',
 *   'tenant_01HQZF8XYZ987654321DEF'
 * );
 * if (result.success) {
 *   console.log(`Total cost: $${result.jobCost.totalCost}`);
 * }
 * ```
 */
async getJobCost(jobCostId: string, tenantId: string): Promise<JobCostResult>
```

---

## 13. Architectural Recommendations Summary

### 13.1 Critical Path (Must Fix Before Deployment)

1. **Uncomment service injection** in resolver constructor
2. **Add service import** to resolver file
3. **Create `*ByJobId` helper methods** in service layer:
   - `getJobCostByJobId()`
   - `getJobProfitabilityByJobId()`
   - `getJobCostHistoryByJobId()`
   - `updateActualCostsByJobId()`
   - `incrementCostByJobId()`
   - `updateJobCostStatusByJobId()`
   - `initializeJobCostFromJob()`
4. **Implement tenant context extraction** from auth context
5. **Remove `tenantId` from GraphQL schema** arguments
6. **Fix `jobsOnBudget` field** in VarianceSummary
7. **Implement error handling** with proper error types

### 13.2 High Priority (Before Production)

1. **Implement field resolvers** for nested types (job, estimate, costBreakdown, costHistory)
2. **Add DataLoader** for N+1 query prevention
3. **Create database indexes** for query optimization
4. **Implement role-based authorization**
5. **Add comprehensive logging** with correlation IDs
6. **Write unit and integration tests**
7. **Set up monitoring and alerting**

### 13.3 Medium Priority (Post-Launch Improvements)

1. **Add GraphQL subscriptions** for real-time updates
2. **Implement batch operations** (bulk cost updates)
3. **Create materialized view refresh** endpoints
4. **Add export functionality** (variance reports to PDF/Excel)
5. **Implement cost forecasting** based on historical variance
6. **Add anomaly detection** for unusual cost variances

---

## 14. Code Quality Assessment

### 14.1 Service Layer: A+ (Excellent)

**Strengths:**
- Comprehensive error handling
- Transaction management
- Structured result objects
- Clean separation of concerns
- Good logging practices
- Database function integration
- Row mapping helpers

**Minor improvements:**
- Add more granular error codes
- Consider extracting common query patterns
- Add retry logic for transient database errors

### 14.2 Resolver Layer: D (Needs Significant Work)

**Issues:**
- Service not injected (completely non-functional)
- No tenant context extraction
- Schema-service parameter mismatch
- Missing field resolvers
- No error type differentiation
- No DataLoader implementation

**Required work:** Approximately 8-12 hours to implement all resolver methods with proper patterns.

### 14.3 Schema Design: B+ (Good with Minor Issues)

**Strengths:**
- Comprehensive type coverage
- Clear enum definitions
- Proper use of nullable fields
- Good input type organization

**Issues:**
- `jobId` vs `jobCostId` inconsistency
- `tenantId` exposed in schema (security issue)
- Missing `avgVariancePercentage` in VarianceSummary
- Inconsistent argument patterns (some use discrete args, some use input objects)

---

## 15. Risk Assessment

### 15.1 Technical Risks

| Risk | Severity | Probability | Mitigation |
|------|----------|-------------|------------|
| Schema-service mismatch causes runtime errors | HIGH | 100% | Implement `*ByJobId` methods |
| Tenant isolation breach | CRITICAL | LOW | Implement TenantGuard, audit logging |
| N+1 query performance | HIGH | 90% | Implement DataLoader |
| Missing field resolvers cause null returns | HIGH | 100% | Implement all field resolvers |
| Transaction rollback failures | MEDIUM | 10% | Add retry logic, alerting |
| Database connection pool exhaustion | MEDIUM | 20% | Configure pool limits, monitor |

### 15.2 Business Risks

| Risk | Severity | Impact | Mitigation |
|------|----------|--------|------------|
| Incorrect cost variance calculations | HIGH | Financial reporting errors | Add unit tests for variance math |
| Unauthorized cost modifications | CRITICAL | Audit failures | Implement RBAC, audit logging |
| Lost cost update history | HIGH | Compliance issues | Verify trigger functionality |
| Slow variance report generation | MEDIUM | User frustration | Optimize queries, add caching |

---

## 16. Comparison with Estimating Module

The estimating module (estimating.resolver.ts) provides a good reference:

**What Estimating Does Right:**
- ✅ Service properly injected
- ✅ Consistent error handling pattern
- ✅ Clean argument mapping
- ✅ Proper logging

**What Job Costing Should Adopt:**
```typescript
// From EstimatingResolver:
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

**Apply this exact pattern** to JobCostingResolver methods.

**Key Difference:**
Estimating uses `estimateId` (primary key) while Job Costing wants to use `jobId` (foreign key). This is the root cause of most issues.

**Solution:** Follow estimating's pattern of providing lookup-by-business-identifier:
```typescript
// EstimatingResolver line 38-51:
@Query('estimateByNumber')
async getEstimateByNumber(
  @Args('estimateNumber') estimateNumber: string,
  @Args('tenantId') tenantId: string
) { /* ... */ }
```

Similarly, Job Costing should have `getJobCostByJobId()`.

---

## 17. Implementation Checklist

### Phase 1: Basic Wiring (2-3 hours)
- [ ] Add `JobCostingService` import to resolver
- [ ] Uncomment service injection in constructor
- [ ] Create `getJobCostByJobId()` in service
- [ ] Wire `listJobCosts` query (simplest - direct mapping)
- [ ] Test basic connectivity with GraphQL Playground

### Phase 2: Service Enhancements (3-4 hours)
- [ ] Implement `getJobProfitabilityByJobId()`
- [ ] Implement `getJobCostHistoryByJobId()`
- [ ] Implement `updateActualCostsByJobId()`
- [ ] Implement `incrementCostByJobId()`
- [ ] Implement `updateJobCostStatusByJobId()`
- [ ] Implement `initializeJobCostFromJob()`

### Phase 3: Resolver Wiring (2-3 hours)
- [ ] Wire all query methods
- [ ] Wire all mutation methods
- [ ] Implement tenant context extraction
- [ ] Remove `tenantId` from GraphQL args
- [ ] Update GraphQL schema

### Phase 4: Field Resolvers (2-3 hours)
- [ ] Implement `@ResolveField('job')`
- [ ] Implement `@ResolveField('estimate')`
- [ ] Implement `@ResolveField('costBreakdown')`
- [ ] Implement `@ResolveField('costHistory')`
- [ ] Implement `@ResolveField('finalAdjustments')`

### Phase 5: Optimization (2-3 hours)
- [ ] Implement DataLoader for job/estimate fetching
- [ ] Create database indexes
- [ ] Add error type differentiation
- [ ] Add structured logging

### Phase 6: Testing (3-4 hours)
- [ ] Write resolver unit tests
- [ ] Write service integration tests
- [ ] Test GraphQL operations in Playground
- [ ] Perform load testing
- [ ] Test tenant isolation

### Phase 7: Documentation (1-2 hours)
- [ ] Add GraphQL schema descriptions
- [ ] Create API usage examples
- [ ] Document service methods
- [ ] Create deployment guide

**Total Estimated Effort:** 15-22 hours

---

## 18. Final Verdict

**CURRENT STATE:** The job costing module is **architecturally sound but functionally incomplete**. The service layer is production-ready, but the resolver is a non-functional scaffold.

**PRIMARY BLOCKER:** Schema-service parameter mismatch (`jobId` vs `jobCostId`).

**RECOMMENDATION:** Implement Solution A (Service Layer Enhancement) to bridge the gap. This requires adding 6-7 helper methods to the service layer that accept `jobId` and internally lookup `jobCostId`.

**DEPLOYMENT READINESS:** NOT READY

**Blockers:**
1. Service not injected (resolver will crash on startup)
2. Schema parameters don't match service signatures (runtime errors)
3. Missing field resolvers (nested fields return null)
4. No tenant context extraction (security vulnerability)

**Post-Fix Deployment Readiness:** READY (after 15-22 hours of work)

**CODE QUALITY SCORE:**
- Service Layer: 9/10
- Resolver Layer: 2/10 (currently non-functional)
- Schema Design: 7/10
- Overall: 6/10

**ARCHITECTURAL INTEGRITY:** Maintains separation of concerns and follows NestJS best practices, but implementation is incomplete.

---

## 19. Recommendations to Marcus

Marcus, as the backend implementer, here's my guidance:

### Do This (Priority Order):
1. **Start with `listJobCosts`** - It's the simplest to wire (direct mapping)
2. **Add service helpers incrementally** - Don't try to implement all 7 at once
3. **Test each method in GraphQL Playground** as you wire it
4. **Follow EstimatingResolver patterns** exactly - Don't reinvent the wheel
5. **Extract tenant from context early** - Get this pattern right from the start
6. **Use DataLoader from the beginning** - Don't retrofit performance later

### Don't Do This:
1. **Don't change the schema to use `jobCostId`** - Poor UX
2. **Don't put database queries in the resolver** - Violates SoC
3. **Don't skip field resolvers** - They're critical for the schema to work
4. **Don't expose `tenantId` in GraphQL args** - Security risk
5. **Don't forget connection pool management** - Use `finally` blocks
6. **Don't assume success** - Always check `result.success`

### When You're Stuck:
1. Look at EstimatingResolver for patterns
2. Check service method signatures match resolver calls
3. Verify GraphQL arg names match `@Args()` decorators
4. Test tenant isolation with different tenant IDs
5. Use GraphQL Playground's schema introspection

### Success Criteria:
- [ ] All GraphQL operations execute without errors
- [ ] Nested fields (job, estimate) resolve correctly
- [ ] Tenant isolation prevents cross-tenant data access
- [ ] Variance reports generate in < 2 seconds for 100 jobs
- [ ] Unit tests achieve > 80% coverage
- [ ] Integration tests pass for all CRUD operations

---

## 20. Conclusion

The job costing module has a **solid foundation** but requires significant resolver implementation work to become functional. The service layer is exemplary, demonstrating proper transaction management, error handling, and database integration. The primary architectural issue is the schema-service impedance mismatch around `jobId` vs `jobCostId`, which can be resolved by adding service-layer helper methods.

**Time to Production:** 2-3 days (assuming 8-hour workdays) for a single developer following this guidance.

**Complexity Rating:** MEDIUM - Not algorithmically complex, but requires careful attention to patterns and proper dependency injection.

**Risk Level:** LOW (after fixes applied) - Well-defined requirements, existing patterns to follow, comprehensive database schema.

**My Confidence in Success:** HIGH - Clear path forward, good service layer foundation, established patterns in codebase.

---

**End of Critique**

**Next Step:** Marcus should begin Phase 1 (Basic Wiring) and report back when `listJobCosts` is functional as proof-of-concept.
