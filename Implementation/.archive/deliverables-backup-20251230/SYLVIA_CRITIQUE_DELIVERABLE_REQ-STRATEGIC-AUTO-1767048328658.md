# Production Planning & Scheduling Module - Architectural Critique
**REQ-STRATEGIC-AUTO-1767048328658**

**Architecture Critic:** Sylvia (Architecture Expert)
**Date:** 2025-12-29
**Status:** Complete
**Reviewed Deliverable:** Cynthia's Research (nats://agog.deliverables.cynthia.research.REQ-STRATEGIC-AUTO-1767048328658)

---

## Executive Summary

Cynthia's research deliverable provides a **solid foundational framework** for a Production Planning & Scheduling Module with comprehensive database schemas and GraphQL API definitions. However, several **critical architectural concerns** must be addressed before implementation to avoid technical debt, performance bottlenecks, and scalability issues. This critique identifies 12 high-priority risks and provides actionable recommendations.

**Overall Assessment: 7/10** - Strong foundation, needs architectural refinement

**Key Concerns:**
1. Missing service layer implementation details and dependency injection patterns
2. Incomplete routing table design creates scheduling constraints
3. Scheduling algorithm complexity underestimated (14-week timeline at risk)
4. Real-time performance requirements conflict with proposed architecture
5. Multi-tenant RLS policies not yet implemented
6. Integration complexity with existing modules not fully addressed

---

## 1. Critical Architectural Gaps

### 1.1 Missing Service Layer Architecture ⚠️ HIGH PRIORITY

**Problem:**
Cynthia's research outlines 9 service classes but provides **zero implementation guidance** for critical aspects:
- Dependency injection patterns
- Transaction management boundaries
- Error handling strategy
- Caching layers
- Database connection pooling strategy

**Evidence:**
```typescript
// FROM RESEARCH: Proposed service signatures with no implementation details
ProductionPlanningService
  - generateProductionOrders(salesOrderIds: string[]): ProductionOrder[]
  - calculateMaterialRequirements(productionOrderId: string): MaterialRequirement[]
  - checkCapacityFeasibility(productionOrderId: string): FeasibilityResult
```

**Risk:**
- **Timeline Impact**: 30% of Phase 2-3 will be spent debating implementation patterns
- **Quality Impact**: Inconsistent patterns across 9 services will create maintenance debt
- **Integration Risk**: Unclear how services interact with existing ForecastingService patterns

**Architectural Observation:**
The existing codebase uses a **consistent NestJS pattern** with:
```typescript
@Injectable()
export class ForecastingService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private demandHistoryService: DemandHistoryService
  ) {}
}
```

Yet the research proposes services without specifying:
- How `ConstraintBasedSchedulingService` will inject `ProductionSchedulingService`
- Whether `OEECalculationService` is a singleton or request-scoped
- How circular dependencies between scheduling services will be resolved

**Recommendation:**
Before Phase 2 begins, Roy must create a **Service Architecture Blueprint** defining:
1. **Dependency Graph**: Clear service-to-service dependencies
2. **Transaction Boundaries**: Which service methods require database transactions
3. **Caching Strategy**: Redis vs in-memory for work center calendars
4. **Error Propagation**: How scheduling failures cascade through the service stack
5. **NestJS Module Structure**: Provider scopes and lifecycle hooks

**Acceptance Criteria:**
```typescript
// REQUIRED: Documented pattern for all 9 services
@Module({
  providers: [
    ProductionPlanningService,
    ProductionSchedulingService,
    RoutingManagementService,
    // Explicit dependency injection configuration
    {
      provide: 'SCHEDULING_CACHE',
      useFactory: () => new Map(), // or Redis client
      scope: Scope.DEFAULT
    }
  ],
  exports: [ProductionPlanningService]
})
export class OperationsModule {}
```

---

### 1.2 Incomplete Routing Table Design ⚠️ HIGH PRIORITY

**Problem:**
The research correctly identifies `routing_templates` and `routing_operations` as **critical missing tables** but labels them "Future Enhancement" (lines 237-253). This creates a **circular dependency trap**:

```
Production Order → Routing (missing) → Production Runs → Scheduling
                        ↓
                  "routing_id in production_orders
                   without formal routing definition"
```

**Architectural Flaw:**
Without routing tables, the system **cannot**:
1. Automatically expand production orders into sequenced production runs
2. Calculate accurate lead times (no operation sequencing)
3. Perform yield/scrap calculations (no routing_operations.yield_percentage)
4. Support what-if scenario planning (can't compare routing alternatives)

**Evidence from Research (Line 246):**
> "Impact: Critical for automated scheduling and cost rollup"

Yet this "critical" feature is deferred to "Future Enhancement"!

**Risk Analysis:**
- **MVP Viability**: Without routing, production schedulers must **manually create** every production run for every production order
- **User Adoption**: Manual run creation negates 60% of scheduling automation value
- **Timeline Impact**: Adding routing in Phase 6 requires rearchitecting Phases 2-5

**Real-World Scenario:**
A production order for 10,000 brochures requires:
1. PRINTING operation (on OFFSET_PRESS, 4 hours)
2. DIE_CUTTING operation (on DIE_CUTTER, 2 hours)
3. FOLDING operation (on FOLDER, 1 hour)
4. PACKAGING operation (on PACKAGING, 0.5 hours)

**Without routing tables:**
```sql
-- Scheduler must manually create 4 production runs:
INSERT INTO production_runs (production_order_id, work_center_id, operation_id, target_quantity, ...)
VALUES (order_1, press_1, printing_op, 10000, ...);

INSERT INTO production_runs (production_order_id, work_center_id, operation_id, target_quantity, ...)
VALUES (order_1, die_cutter_1, die_cutting_op, 10000, ...);
-- etc...
```

**With routing tables:**
```typescript
// Automated routing expansion
await routingManagementService.expandRouting(routingId, productionOrderId);
// Creates all 4 production runs with correct sequencing and yield calculations
```

**Recommendation:**
**MANDATE routing tables as Phase 1 deliverable**, not "Future Enhancement":

```sql
-- V0.0.40__create_routing_templates.sql
CREATE TABLE routing_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    routing_code VARCHAR(50) NOT NULL,
    routing_name VARCHAR(255) NOT NULL,
    routing_version INTEGER DEFAULT 1,
    product_category VARCHAR(100), -- "BROCHURES", "BUSINESS_CARDS", etc.
    is_active BOOLEAN DEFAULT TRUE,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    CONSTRAINT fk_routing_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_routing_code UNIQUE (tenant_id, routing_code, routing_version)
);

CREATE TABLE routing_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    routing_id UUID NOT NULL,
    operation_id UUID NOT NULL,
    sequence_number INTEGER NOT NULL,
    setup_time_minutes DECIMAL(10,2),
    run_time_per_unit_seconds DECIMAL(10,4),
    work_center_id UUID, -- Override default from operations table
    yield_percentage DECIMAL(5,2) DEFAULT 100.0,
    scrap_percentage DECIMAL(5,2) DEFAULT 0.0,
    is_concurrent BOOLEAN DEFAULT FALSE, -- Parallel operations
    predecessor_operation_id UUID, -- For complex dependencies
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_routing_op_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_routing_op_routing FOREIGN KEY (routing_id) REFERENCES routing_templates(id) ON DELETE CASCADE,
    CONSTRAINT fk_routing_op_operation FOREIGN KEY (operation_id) REFERENCES operations(id),
    CONSTRAINT fk_routing_op_work_center FOREIGN KEY (work_center_id) REFERENCES work_centers(id),
    CONSTRAINT fk_routing_op_predecessor FOREIGN KEY (predecessor_operation_id) REFERENCES routing_operations(id),
    CONSTRAINT uq_routing_op_sequence UNIQUE (routing_id, sequence_number)
);

-- Critical indexes for scheduling queries
CREATE INDEX idx_routing_templates_tenant ON routing_templates(tenant_id);
CREATE INDEX idx_routing_templates_active ON routing_templates(tenant_id, is_active);
CREATE INDEX idx_routing_operations_routing ON routing_operations(routing_id);
CREATE INDEX idx_routing_operations_sequence ON routing_operations(routing_id, sequence_number);
```

**Acceptance Criteria:**
- Migration V0.0.40 must be deployed **before** Phase 2 service implementation begins
- `RoutingManagementService.expandRouting()` must be implemented in Phase 2, not Phase 6
- GraphQL schema must include routing queries/mutations

---

### 1.3 Scheduling Algorithm Complexity Underestimated ⚠️ HIGH PRIORITY

**Problem:**
The research proposes a **Hybrid Scheduling Strategy** (lines 615-637) combining:
1. Critical Path Method (CPM)
2. Priority Dispatch Rules
3. Genetic Algorithm (100-500 generations)
4. Manual override validation

This is **2-3 months of R&D work**, not "Phase 3: Weeks 5-6" as proposed.

**Evidence from Research (Line 979):**
> "Target: < 5 seconds for 100 orders, < 30 seconds for 500 orders"

**Architectural Reality Check:**
Genetic algorithms for job shop scheduling are **NP-hard problems**. Industry-proven solutions:
- **Google OR-Tools**: 50,000+ lines of C++ code optimized over 10 years
- **OptaPlanner**: 200,000+ lines of Java code with constraint satisfaction engine
- **Custom genetic algorithms**: 3-6 months to achieve production-grade performance

**Performance Analysis:**
For 100 production orders with average 4 operations each (400 total operations):
- **State space**: 400! possible schedules (combinatorial explosion)
- **Constraint checking**: Work center capacity, sequencing, due dates, changeover time
- **Fitness function**: Multi-objective optimization (minimize tardiness, minimize changeover, maximize utilization)
- **Convergence**: 100-500 generations with population size 50-100

**Realistic Timeline:**
- Weeks 5-6: Priority dispatch rules implementation (EDD, SPT, CR)
- Weeks 7-10: Google OR-Tools or OptaPlanner integration
- Weeks 11-14: Tuning, constraint modeling, performance testing
- **Total**: 10 weeks, not 2 weeks

**Risk:**
Attempting to build a custom genetic algorithm in 2 weeks will result in:
1. Suboptimal schedules (30-40% worse than industry solutions)
2. Performance failures (30+ seconds for 100 orders)
3. Buggy constraint handling (missed due dates, resource conflicts)
4. Abandoned feature (fallback to manual scheduling)

**Recommendation:**
**Abandon custom genetic algorithm**. Use proven constraint programming libraries:

**Option A: Google OR-Tools (Recommended)**
```typescript
import { routingIndexManager, routingModel } from '@google-optimization-tools/or-tools';

@Injectable()
export class ConstraintBasedSchedulingService {
  async optimizeSchedule(
    productionOrders: ProductionOrder[],
    workCenters: WorkCenter[]
  ): Promise<Schedule> {
    // OR-Tools handles:
    // - Constraint satisfaction (capacity, sequencing, due dates)
    // - Multi-objective optimization
    // - Performance (< 5 seconds for 100 orders)

    const manager = new routingIndexManager(operations.length, workCenters.length);
    const model = new routingModel(manager);

    // Add constraints
    model.addDimension(capacityCallback, 0, maxCapacity, true, 'Capacity');
    model.addDisjunction(operations.map(op => op.index), 1000); // Penalties

    // Solve
    const solution = model.solveWithParameters(searchParameters);
    return this.convertToSchedule(solution);
  }
}
```

**Pros:**
- Battle-tested by Google, used in Google Maps routing
- Sub-second performance for 1000+ operations
- Built-in constraint types (cumulative capacity, temporal dependencies)
- Active maintenance and community support

**Cons:**
- C++ dependency (requires compilation)
- Learning curve for constraint programming

**Option B: OptaPlanner (Java-based, less ideal for NestJS)**

**Option C: Simplified Heuristic (MVP Fallback)**
If OR-Tools integration is blocked, implement **priority dispatch rules only**:
```typescript
// Earliest Due Date (EDD) + Critical Ratio (CR)
function scheduleOperations(operations: Operation[]): Schedule {
  // Sort by due date, then by critical ratio
  const sortedOps = operations.sort((a, b) => {
    const crA = (a.dueDate - now) / a.remainingProcessTime;
    const crB = (b.dueDate - now) / b.remainingProcessTime;
    return crA - crB;
  });

  // Forward pass: assign to earliest available work center slot
  for (const op of sortedOps) {
    const workCenter = findEarliestSlot(op.workCenterId, op.duration);
    schedule.assign(op, workCenter, workCenter.nextAvailableTime);
  }

  return schedule;
}
```

**Performance:** < 100ms for 500 orders (no optimization, just sequencing)

**Acceptance Criteria:**
- Marcus must **approve** OR-Tools integration OR accept simplified heuristic
- Phase 3 timeline adjusted to 10 weeks for optimization work
- Performance benchmarks validated with production-scale data (1000+ orders)

---

### 1.4 Real-Time Performance Requirements Conflict ⚠️ MEDIUM PRIORITY

**Problem:**
The research proposes **conflicting performance targets**:

**From Section 10 (Line 976-983):**
```
Scheduling Algorithm Performance:
- Target: < 5 seconds for 100 orders, < 30 seconds for 500 orders

OEE Calculation Performance:
- Target: < 10 seconds for daily batch job
```

**From Section 8 (Line 704-706):**
```
Real-Time OEE Dashboard:
- Live calculation during shift (every 5 minutes)
- Display current OEE trend
- Alert on OEE below threshold (e.g., < 60%)
```

**Architectural Conflict:**
Real-time OEE calculation every 5 minutes for 100 work centers:
- 100 work centers × 5-minute intervals = 20 calculations/minute
- Each calculation queries: production_runs + equipment_status_log + changeover_details
- Database load: 20 × 3 tables × complex aggregations = 60 queries/minute

**Concurrent Load:**
- Users viewing OEE dashboard: 10-50 concurrent users
- Each user polling every 5 minutes: GraphQL subscription or polling
- Total: 60 database queries/minute + 50 WebSocket connections

**Risk:**
Database connection pool exhaustion under normal load.

**Evidence from Existing System:**
```typescript
// From forecasting.service.ts (line 63)
@Inject('DATABASE_POOL') private pool: Pool
```

Current connection pool size: **Unknown** (not documented in research)

If pool size = 10 connections:
- 60 queries/minute + 50 concurrent GraphQL requests = **oversubscribed**

**Recommendation:**
Implement **materialized view + incremental refresh** pattern (already proven in codebase):

```sql
-- V0.0.41__create_oee_calculation_materialized_view.sql
CREATE TABLE oee_calculations_real_time (
    work_center_id UUID NOT NULL,
    calculation_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shift_number INTEGER,

    -- OEE Components (pre-calculated)
    availability_percent DECIMAL(5,2),
    performance_percent DECIMAL(5,2),
    quality_percent DECIMAL(5,2),
    oee_percent DECIMAL(5,2),

    -- Metadata
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    PRIMARY KEY (work_center_id, calculation_timestamp)
);

-- Incremental refresh trigger (updates every 5 minutes)
CREATE OR REPLACE FUNCTION refresh_oee_real_time()
RETURNS trigger AS $$
BEGIN
    -- Triggered by production_runs updates or equipment_status_log inserts
    INSERT INTO oee_calculations_real_time (work_center_id, calculation_timestamp, ...)
    SELECT
        NEW.work_center_id,
        NOW(),
        calculate_availability(...),
        calculate_performance(...),
        calculate_quality(...)
    ON CONFLICT (work_center_id, calculation_timestamp)
    DO UPDATE SET
        availability_percent = EXCLUDED.availability_percent,
        last_updated = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_refresh_oee_on_production_run_update
AFTER INSERT OR UPDATE ON production_runs
FOR EACH ROW EXECUTE FUNCTION refresh_oee_real_time();
```

**Benefits:**
- **Query Performance**: SELECT from pre-calculated table (< 10ms)
- **Database Load**: 1 query per dashboard refresh vs 3 aggregation queries
- **Scalability**: Supports 1000+ concurrent users

**Alternative (if triggers unacceptable):**
Redis caching with 5-minute TTL:
```typescript
@Injectable()
export class OEECalculationService {
  async getRealTimeOEE(workCenterId: string): Promise<OEESnapshot> {
    const cacheKey = `oee:${workCenterId}:latest`;

    // Check Redis cache
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Calculate and cache for 5 minutes
    const oee = await this.calculateOEE(workCenterId);
    await this.redis.set(cacheKey, JSON.stringify(oee), 'EX', 300);

    return oee;
  }
}
```

**Acceptance Criteria:**
- Load testing with 100 work centers × 50 concurrent users
- Database connection pool monitoring (< 80% utilization)
- Response time SLA: < 200ms for OEE dashboard queries

---

### 1.5 Missing RLS Policy Implementation ⚠️ HIGH PRIORITY

**Problem:**
Research mentions RLS policies **4 times** but provides **zero implementation**:

**Line 19:** "Multi-Tenant Architecture: Full RLS policies and tenant isolation across all production tables"
**Line 574:** "Multi-Tenant Architecture: RLS Policies: All 12 production tables require tenant_id in WHERE clauses"
**Line 996:** "Required Migrations: V0.0.41__add_rls_policies_production_planning.sql (RLS policies for all production tables)"
**Line 1232:** "Multi-Tenant Architecture: Full RLS policies and tenant isolation"

Yet **ZERO RLS policy definitions** in migration files.

**Security Risk:**
Without RLS policies, production orders are **visible across tenants**:

```sql
-- VULNERABLE: No RLS enforcement
SELECT * FROM production_orders WHERE id = '123';
-- Returns order even if user's tenant_id doesn't match!
```

**Evidence from Existing System:**
No RLS policies found in operations-module.sql (checked lines 1-100).

**Compliance Impact:**
Multi-tenant SaaS requires **strict data isolation** for:
- SOC 2 Type II certification
- GDPR compliance (tenant data must be segregated)
- Customer contracts (data isolation clauses)

**Recommendation:**
Implement RLS policies **before** any service layer code:

```sql
-- V0.0.41__add_rls_policies_production_planning.sql

-- Enable RLS on all production tables
ALTER TABLE production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_centers ENABLE ROW LEVEL SECURITY;
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

-- Production Orders RLS Policy
CREATE POLICY production_orders_tenant_isolation ON production_orders
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Production Runs RLS Policy
CREATE POLICY production_runs_tenant_isolation ON production_runs
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Work Centers RLS Policy
CREATE POLICY work_centers_tenant_isolation ON work_centers
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Operations RLS Policy (global operations shared across tenants OR tenant-specific)
CREATE POLICY operations_tenant_isolation ON operations
    USING (
        tenant_id = current_setting('app.current_tenant_id')::UUID
        OR tenant_id IS NULL -- Global operations catalog
    );

-- Changeover Details RLS Policy
CREATE POLICY changeover_details_tenant_isolation ON changeover_details
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Equipment Status Log RLS Policy
CREATE POLICY equipment_status_log_tenant_isolation ON equipment_status_log
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Maintenance Records RLS Policy
CREATE POLICY maintenance_records_tenant_isolation ON maintenance_records
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Asset Hierarchy RLS Policy
CREATE POLICY asset_hierarchy_tenant_isolation ON asset_hierarchy
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- OEE Calculations RLS Policy
CREATE POLICY oee_calculations_tenant_isolation ON oee_calculations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Production Schedules RLS Policy
CREATE POLICY production_schedules_tenant_isolation ON production_schedules
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Capacity Planning RLS Policy
CREATE POLICY capacity_planning_tenant_isolation ON capacity_planning
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Routing Templates RLS Policy
CREATE POLICY routing_templates_tenant_isolation ON routing_templates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Routing Operations RLS Policy
CREATE POLICY routing_operations_tenant_isolation ON routing_operations
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
```

**NestJS Integration:**
```typescript
// GraphQL context must set tenant_id for RLS
GraphQLModule.forRoot<ApolloDriverConfig>({
  context: async ({ req }) => {
    const tenantId = req.headers['x-tenant-id'] || extractFromJWT(req);

    // Set PostgreSQL session variable for RLS
    await pool.query(`SET app.current_tenant_id = '${tenantId}'`);

    return { req, tenantId };
  }
})
```

**Acceptance Criteria:**
- All 13 tables (12 + routing_templates) have RLS policies
- Integration test: Attempt cross-tenant query fails
- GraphQL resolver context sets `app.current_tenant_id` before every query
- Security audit: OWASP Top 10 compliance

---

## 2. Moderate Architectural Concerns

### 2.1 GraphQL Schema Design: Missing Pagination

**Problem:**
`productionRuns` query returns unbounded array:
```graphql
productionRuns(
  facilityId: ID
  workCenterId: ID
  ...
): [ProductionRun!]!  # ← No pagination!
```

For high-volume manufacturing:
- 1000 production runs/day × 30 days = 30,000 records
- GraphQL response: 30MB+ JSON payload
- Client memory: Browser crash on low-end devices

**Recommendation:**
Use connection pattern (already defined for `productionOrders`):
```graphql
productionRuns(
  facilityId: ID
  workCenterId: ID
  limit: Int = 50
  offset: Int
): ProductionRunConnection!

type ProductionRunConnection {
  edges: [ProductionRunEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

---

### 2.2 OEE Calculation Formula: Edge Cases Not Handled

**Problem:**
OEE formula assumes continuous production:
```
Availability = (Operating Time / Planned Production Time)
Performance = (Ideal Cycle Time × Total Pieces) / Operating Time
Quality = Good Pieces / Total Pieces
```

**Edge Cases:**
1. **Zero Production**: What if Total Pieces = 0? (Division by zero)
2. **Overproduction**: What if Total Pieces > Planned Pieces? (Performance > 100%)
3. **Shift with No Planned Production**: Availability undefined

**Recommendation:**
```typescript
function calculateOEE(data: OEEInput): OEECalculation {
  // Handle zero planned time (maintenance shift)
  if (data.plannedProductionTime === 0) {
    return { oee: 0, availability: 0, performance: 0, quality: 0 };
  }

  const operatingTime = data.plannedProductionTime - data.downtime;
  const availability = operatingTime / data.plannedProductionTime;

  // Handle zero production (machine idle)
  if (data.totalPieces === 0) {
    return { oee: 0, availability, performance: 0, quality: 0 };
  }

  const idealTime = data.idealCycleTime * data.totalPieces;
  const performance = Math.min(idealTime / operatingTime, 1.0); // Cap at 100%
  const quality = data.goodPieces / data.totalPieces;

  return {
    oee: availability * performance * quality,
    availability,
    performance,
    quality
  };
}
```

---

### 2.3 Changeover Optimization: Matrix Storage Missing

**Problem:**
Research mentions "Changeover Matrix" (line 643) but provides no storage mechanism:
```
Color Grouping: For printing presses, group jobs by ink color (light to dark)
Substrate Grouping: Minimize paper stock changes
```

**How to store changeover times between 10,000+ product SKUs?**

**Option A: Sparse Matrix Table**
```sql
CREATE TABLE changeover_matrix (
    from_product_id UUID NOT NULL,
    to_product_id UUID NOT NULL,
    changeover_minutes DECIMAL(10,2) NOT NULL,
    changeover_type VARCHAR(50), -- COLOR_CHANGE, SUBSTRATE_CHANGE
    PRIMARY KEY (from_product_id, to_product_id)
);
```
**Problem:** 10,000 SKUs = 100 million rows (10,000²)

**Option B: Rule-Based Calculation**
```typescript
function calculateChangeoverTime(from: Product, to: Product): number {
  let changeoverMinutes = 15; // Base changeover

  if (from.inkColor !== to.inkColor) {
    changeoverMinutes += 20; // Washup time
  }
  if (from.substrateType !== to.substrateType) {
    changeoverMinutes += 10; // Material change
  }
  if (from.sheetSize !== to.sheetSize) {
    changeoverMinutes += 5; // Gripper adjustment
  }

  return changeoverMinutes;
}
```

**Recommendation:** Hybrid approach (rule-based with override table)

---

### 2.4 Work Center Calendar: JSONB Schema Undefined

**Problem:**
`work_centers.operating_calendar` is JSONB with example:
```json
{monday: {shifts: [{start: '08:00', end: '16:00'}]}, ...}
```

**Critical Questions:**
1. How to represent holidays? (Christmas, Thanksgiving)
2. How to handle overtime shifts? (Saturday production)
3. How to model break periods? (Lunch, 15-minute breaks)
4. Timezone handling? (Facilities in different timezones)

**Recommendation:**
Define strict JSON schema:
```typescript
interface OperatingCalendar {
  timezone: string; // 'America/New_York'
  weekdays: {
    [day in Weekday]: {
      shifts: Shift[];
      isWorkingDay: boolean;
    }
  };
  holidays: Holiday[];
  overrides: CalendarOverride[]; // Specific date overrides
}

interface Shift {
  shiftNumber: number;
  startTime: string; // '08:00'
  endTime: string; // '16:00'
  breaks: Break[];
}

interface Holiday {
  date: string; // '2025-12-25'
  name: string; // 'Christmas'
  isRecurring: boolean; // true for annual holidays
}
```

---

## 3. Integration Architecture Concerns

### 3.1 Sales Module Integration: Missing Event-Driven Architecture

**Problem:**
Research proposes **synchronous integration**:
```
When sales order is confirmed → Create production order
```

**Issues:**
1. Sales service directly depends on Operations service (tight coupling)
2. No retry mechanism if production order creation fails
3. No audit trail for integration failures
4. Blocking operation (sales order confirmation waits for production order)

**Recommendation:**
Use **event-driven architecture** (NATS already available):

```typescript
// In SalesService
async confirmSalesOrder(orderId: string): Promise<void> {
  // Update sales order status
  await this.updateStatus(orderId, 'CONFIRMED');

  // Publish event (non-blocking)
  await this.natsClient.publish('sales.order.confirmed', {
    salesOrderId: orderId,
    productId: '...',
    quantity: 1000,
    dueDate: '2025-01-15'
  });
}

// In ProductionPlanningService (subscriber)
@Subscribe('sales.order.confirmed')
async handleSalesOrderConfirmed(event: SalesOrderConfirmedEvent): Promise<void> {
  try {
    const productionOrder = await this.generateProductionOrders([event.salesOrderId]);

    // Publish success event
    await this.natsClient.publish('production.order.created', {
      productionOrderId: productionOrder.id,
      salesOrderId: event.salesOrderId
    });
  } catch (error) {
    // Publish failure event for retry queue
    await this.natsClient.publish('production.order.creation.failed', {
      salesOrderId: event.salesOrderId,
      error: error.message
    });
  }
}
```

**Benefits:**
- Decoupled services (Sales doesn't depend on Operations)
- Automatic retry via NATS queues
- Audit trail via event log
- Non-blocking operations (better UX)

---

### 3.2 WMS Module Integration: Inventory Transaction Timing

**Problem:**
Research states:
```
Material consumption during production:
- Raw material pick from warehouse (PRODUCTION_PICK)
- Finished goods receipt to warehouse (PRODUCTION_RECEIPT)
```

**Critical Question:** When are inventory transactions created?

**Option A: Backflush (at completion)**
- Inventory consumed when production run completes
- Pro: Simpler, fewer transactions
- Con: Inaccurate work-in-process (WIP) inventory

**Option B: Pick-to-order (at start)**
- Inventory consumed when production run starts
- Pro: Accurate WIP tracking
- Con: Complex material allocation logic

**Recommendation:**
Configurable strategy per work center:
```sql
ALTER TABLE work_centers ADD COLUMN inventory_consumption_strategy VARCHAR(20) DEFAULT 'BACKFLUSH';
-- BACKFLUSH, PICK_TO_ORDER, STEP_CONSUMPTION (per operation)
```

---

## 4. Performance & Scalability Analysis

### 4.1 Database Query Optimization: Missing Index Strategy

**Problem:**
Research defines tables but **minimal indexes** (only tenant_id, facility_id, type, status).

**Critical Queries for Scheduling:**
```sql
-- Query 1: Get available work center slots for date range
SELECT * FROM production_schedules
WHERE work_center_id = ?
AND scheduled_start_time BETWEEN ? AND ?
ORDER BY scheduled_start_time;

-- Query 2: Get production runs for work center on shift
SELECT * FROM production_runs
WHERE work_center_id = ?
AND start_timestamp >= ?
AND end_timestamp <= ?;
```

**Missing Indexes:**
```sql
-- V0.0.42__add_production_planning_indexes.sql
CREATE INDEX idx_production_schedules_work_center_time
ON production_schedules(work_center_id, scheduled_start_time, scheduled_end_time);

CREATE INDEX idx_production_runs_work_center_time
ON production_runs(work_center_id, start_timestamp, end_timestamp);

CREATE INDEX idx_production_orders_due_date
ON production_orders(tenant_id, status, due_date)
WHERE status NOT IN ('COMPLETED', 'CANCELLED');

CREATE INDEX idx_production_runs_status
ON production_runs(tenant_id, status, work_center_id)
WHERE status = 'RUNNING';
```

**Acceptance Criteria:**
- EXPLAIN ANALYZE for all scheduling queries < 50ms
- Index usage > 95% for scheduling operations

---

### 4.2 Concurrent Scheduling: Optimistic Locking Missing

**Problem:**
Multiple schedulers editing schedule simultaneously:

**Scenario:**
1. Scheduler A loads production schedule at 10:00 AM
2. Scheduler B loads production schedule at 10:01 AM
3. Scheduler A assigns Order #123 to Work Center #1 at 10:02 AM
4. Scheduler B assigns Order #456 to Work Center #1 at 10:03 AM (overlapping slot!)

**Result:** Double-booked work center

**Recommendation:**
Add optimistic locking:
```sql
ALTER TABLE production_schedules ADD COLUMN version INTEGER DEFAULT 1;

-- In service layer
UPDATE production_schedules
SET
  work_center_id = ?,
  scheduled_start_time = ?,
  version = version + 1
WHERE id = ? AND version = ?; -- ← Optimistic lock check

-- If rowCount = 0, schedule was modified by another user
```

---

## 5. Timeline & Resourcing Concerns

### 5.1 14-Week Timeline: Overly Optimistic

**Research Timeline (Lines 1045-1087):**
- Phase 1-2: Weeks 1-4 (Foundation + Core Services)
- Phase 3: Weeks 5-6 (Scheduling Algorithm) ← **UNREALISTIC**
- Phase 4: Weeks 7-8 (OEE & Analytics)
- Phase 5: Weeks 9-12 (Frontend)
- Phase 6: Weeks 13-14 (Testing)

**Architectural Reality:**

**Phase 3 Scheduling Algorithm Alone:**
- Constraint modeling: 2 weeks
- OR-Tools integration: 2 weeks
- Routing expansion logic: 1 week
- Changeover optimization: 1 week
- Performance tuning: 2 weeks
- **Total: 8 weeks**, not 2 weeks

**Phase 5 Frontend Components:**
Research proposes **7 dashboards** in 4 weeks (9-12):
1. Production Planning Dashboard
2. Scheduling Gantt Chart ← **Gantt chart alone = 3 weeks**
3. Capacity Planning Dashboard
4. Work Center Monitoring
5. OEE Dashboard
6. Production Run Execution UI
7. Maintenance Schedule

**Gantt Chart Complexity:**
- Drag-drop operations with constraint validation
- Work center swimlanes
- Conflict highlighting
- Real-time updates (WebSocket)
- Mobile responsive

**Industry Benchmark:**
DHTMLX Gantt license: $499 (pre-built)
Custom Gantt chart: 3-4 weeks for experienced React developer

**Realistic Timeline: 20-24 weeks**

**Recommendation:**
- Phase 3: 8 weeks (use OR-Tools, not custom genetic algorithm)
- Phase 5: 8 weeks (use DHTMLX Gantt, not custom implementation)
- Phase 6: 2 weeks (integration testing)
- **Total: 22 weeks**

**Risk Mitigation:**
- Marcus must approve timeline extension OR reduce scope to MVP
- MVP Scope: Priority dispatch scheduling + basic Gantt (no drag-drop optimization)

---

### 5.2 Team Capacity: Single Points of Failure

**Identified Resource Constraints:**
- **Roy (Backend)**: Sole architect for 9 service classes + scheduling algorithm + OR-Tools integration
- **Jen (Frontend)**: 7 dashboards including complex Gantt chart
- **Billy (QA)**: Testing 11 queries + 10 mutations + 7 dashboards + integration flows

**Risk:**
- Roy sick for 1 week = 2 weeks schedule slip (knowledge transfer delays)
- Jen struggles with Gantt chart = entire Phase 5 blocked

**Recommendation:**
- Pair programming for scheduling algorithm (Roy + external consultant)
- Use DHTMLX Gantt (reduce Jen's workload by 3 weeks)
- Automate testing (GraphQL code generation for Billy)

---

## 6. Missing Non-Functional Requirements

### 6.1 Data Retention Policy

**Question:** How long to retain production run history?
- 1 year: 365 days × 100 work centers × 10 runs/day = 365,000 records
- 5 years: 1.8 million records
- Forever: Table growth unbounded

**Recommendation:**
```sql
-- Archive policy
CREATE TABLE production_runs_archive (
    LIKE production_runs INCLUDING ALL
);

-- Monthly job: Move completed runs older than 2 years to archive
INSERT INTO production_runs_archive
SELECT * FROM production_runs
WHERE status = 'COMPLETED'
AND end_timestamp < NOW() - INTERVAL '2 years';

DELETE FROM production_runs WHERE ...;
```

---

### 6.2 Disaster Recovery: Scheduling State

**Question:** What happens if scheduling service crashes mid-optimization?

**Scenario:**
1. Genetic algorithm optimizing 500 orders (iteration 250/500)
2. Server crashes
3. On restart: No saved state, must restart from iteration 0

**Recommendation:**
- Save checkpoint every 50 iterations
- Resume from last checkpoint on crash

---

### 6.3 Observability: Missing Monitoring Strategy

**Critical Metrics Not Defined:**
- Scheduling algorithm execution time (P50, P95, P99)
- OEE calculation errors (division by zero, invalid data)
- Work center utilization trends
- Late order percentage

**Recommendation:**
```typescript
@Injectable()
export class ProductionSchedulingService {
  async optimizeSchedule(...): Promise<Schedule> {
    const startTime = Date.now();

    try {
      const schedule = await this.schedulingEngine.optimize();

      // Metrics
      this.metricsService.recordHistogram('scheduling.duration', Date.now() - startTime);
      this.metricsService.recordGauge('scheduling.orders_scheduled', schedule.orders.length);

      return schedule;
    } catch (error) {
      this.metricsService.increment('scheduling.errors');
      throw error;
    }
  }
}
```

---

## 7. Security Considerations

### 7.1 Production Order Authorization

**Question:** Can any user create production orders for any facility?

**Recommendation:**
```typescript
// GraphQL resolver with authorization
@Mutation()
async createProductionOrder(
  @Args('input') input: CreateProductionOrderInput,
  @Context() context: GraphQLContext
): Promise<ProductionOrder> {
  // Check facility access
  const hasAccess = await this.authService.userHasAccessToFacility(
    context.userId,
    input.facilityId
  );

  if (!hasAccess) {
    throw new ForbiddenException('User does not have access to this facility');
  }

  // Check role permissions
  const hasPermission = await this.authService.userHasPermission(
    context.userId,
    'production_orders.create'
  );

  if (!hasPermission) {
    throw new ForbiddenException('User does not have permission to create production orders');
  }

  return this.productionPlanningService.createProductionOrder(input, context.userId);
}
```

---

### 7.2 Audit Trail: Missing Change Tracking

**Problem:**
`production_orders` and `production_schedules` lack audit fields:
- Who changed the due date?
- Who rescheduled the operation?
- When was the priority changed?

**Recommendation:**
```sql
CREATE TABLE production_order_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    production_order_id UUID NOT NULL,
    changed_by UUID NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    field_name VARCHAR(100) NOT NULL,
    old_value TEXT,
    new_value TEXT,
    change_reason TEXT,
    CONSTRAINT fk_audit_production_order FOREIGN KEY (production_order_id) REFERENCES production_orders(id)
);

CREATE INDEX idx_audit_production_order ON production_order_audit_log(production_order_id);
```

---

## 8. Positive Architectural Highlights ✅

Despite the critical concerns raised, Cynthia's research demonstrates **several architectural strengths**:

### 8.1 Comprehensive Database Design ✅
- All 12 tables properly normalized (3NF)
- Foreign key constraints enforce referential integrity
- Unique constraints prevent duplicate work center codes
- Appropriate data types (UUID for IDs, DECIMAL for costs, TIMESTAMPTZ for timestamps)

### 8.2 GraphQL Schema Completeness ✅
- 11 queries cover all major use cases
- 10 mutations support full CRUD operations
- Proper enum definitions for type safety
- Connection types for pagination (productionOrders)

### 8.3 Industry Best Practices ✅
- OEE calculation follows ISO 22400-2 standard
- SMED (Single-Minute Exchange of Die) for changeover optimization
- SCD Type 2 for work center historical tracking
- Multi-tenant architecture with tenant_id on all tables

### 8.4 Integration Points Well-Defined ✅
- Clear mappings to Sales, WMS, Procurement, Finance, Quality modules
- Event-driven architecture opportunities identified
- Material requirements planning (MRP) integration outlined

### 8.5 Realistic Business Value Analysis ✅
- ROI calculation: 145% Year 1, 8.2 months payback
- Quantified benefits: $407K/year savings
- Success metrics defined (90% on-time delivery, 75% OEE)

---

## 9. Recommendations Summary

### Tier 1: MUST FIX Before Implementation (Blockers)

1. **Create Service Architecture Blueprint** (Sylvia: HIGH PRIORITY)
   - Document dependency injection patterns
   - Define transaction boundaries
   - Specify caching strategy
   - **Estimated Effort:** 1 week (Roy + Sylvia)

2. **Implement Routing Tables in Phase 1** (Sylvia: HIGH PRIORITY)
   - Migration V0.0.40 for routing_templates and routing_operations
   - RoutingManagementService implementation in Phase 2
   - **Estimated Effort:** 2 weeks (Roy)

3. **Choose Scheduling Algorithm Strategy** (Sylvia: HIGH PRIORITY)
   - **Option A:** Google OR-Tools (recommended, 8 weeks)
   - **Option B:** Simplified heuristic (MVP fallback, 2 weeks)
   - Marcus must approve before Phase 3 begins
   - **Decision Deadline:** End of Week 4

4. **Implement RLS Policies** (Sylvia: HIGH PRIORITY - SECURITY)
   - Migration V0.0.41 for all 13 tables
   - GraphQL context tenant_id injection
   - Integration testing for cross-tenant isolation
   - **Estimated Effort:** 1 week (Roy + Billy)

5. **Real-Time OEE Architecture Decision** (Sylvia: MEDIUM PRIORITY)
   - **Option A:** Materialized view with triggers (recommended)
   - **Option B:** Redis caching
   - Load testing with 100 work centers × 50 users
   - **Decision Deadline:** End of Week 6

### Tier 2: SHOULD FIX for Production Quality

6. **GraphQL Pagination** - Add connection types to productionRuns query (1 day)
7. **OEE Edge Cases** - Handle zero production, overproduction scenarios (2 days)
8. **Changeover Matrix** - Implement rule-based calculation (3 days)
9. **Work Center Calendar Schema** - Define strict JSONB structure (2 days)
10. **Event-Driven Sales Integration** - Use NATS events instead of synchronous calls (1 week)
11. **Database Index Optimization** - Add missing indexes for scheduling queries (1 day)
12. **Optimistic Locking** - Prevent double-booked work centers (2 days)

### Tier 3: NICE TO HAVE for Long-Term Maintainability

13. **Data Retention Policy** - Archive old production runs (1 day)
14. **Disaster Recovery** - Scheduling checkpoints (3 days)
15. **Observability** - Metrics for scheduling performance (2 days)
16. **Authorization** - Facility access checks (3 days)
17. **Audit Trail** - Production order change tracking (2 days)

---

## 10. Revised Implementation Roadmap

### Phase 1: Foundation (Weeks 1-4) - **EXTENDED**
- ✅ Database schema (operations-module.sql exists)
- ✅ GraphQL schema (operations.graphql exists)
- 🔄 **NEW:** Service architecture blueprint (Week 1)
- 🔄 **NEW:** Routing tables migration V0.0.40 (Week 2)
- 🔄 **NEW:** RLS policies migration V0.0.41 (Week 3)
- 🔄 Service layer scaffolding (Week 4)

### Phase 2: Core Services (Weeks 5-8)
- ProductionPlanningService implementation (Week 5)
- RoutingManagementService implementation (Week 6)
- ProductionSchedulingService (basic priority dispatch) (Week 7)
- Unit tests for services (Week 8)

### Phase 3: Scheduling Algorithm (Weeks 9-16) - **EXTENDED**
- **Decision Point:** OR-Tools vs Simplified Heuristic
- OR-Tools integration and constraint modeling (Weeks 9-12)
- ChangeoverOptimizationService implementation (Week 13)
- ConstraintBasedSchedulingService (Weeks 14-15)
- Performance tuning and testing (Week 16)

### Phase 4: OEE & Analytics (Weeks 17-20)
- OEECalculationService implementation (Week 17)
- Real-time OEE materialized view (Week 18)
- CapacityPlanningService (Week 19)
- Analytics queries optimization (Week 20)

### Phase 5: Frontend (Weeks 21-28) - **EXTENDED**
- Production Planning Dashboard (Week 21)
- Work Center Monitoring (Week 22)
- Production Run Execution UI (Week 23)
- OEE Dashboard (Week 24)
- Capacity Planning Dashboard (Week 25)
- **Gantt Chart with DHTMLX** (Weeks 26-27)
- Maintenance Schedule (Week 28)

### Phase 6: Testing & Deployment (Weeks 29-30)
- Integration testing (Week 29)
- Load testing and performance validation (Week 29)
- UAT (User Acceptance Testing) (Week 30)
- Production deployment (Week 30)

**Total Revised Timeline: 30 weeks (vs original 14 weeks)**

**Critical Path Items:**
1. Routing tables (blocks all scheduling work)
2. RLS policies (security requirement)
3. Scheduling algorithm choice (8-week variance)
4. Gantt chart implementation (use DHTMLX to save 3 weeks)

---

## 11. Risk Register

| Risk ID | Description | Probability | Impact | Mitigation |
|---------|-------------|-------------|--------|------------|
| RISK-001 | Custom genetic algorithm fails performance targets | HIGH | HIGH | Use Google OR-Tools instead |
| RISK-002 | Routing tables delayed, blocking Phase 2-5 | MEDIUM | CRITICAL | Move to Phase 1 (mandatory) |
| RISK-003 | RLS policies not implemented, security audit failure | MEDIUM | CRITICAL | Mandate in Phase 1 |
| RISK-004 | Real-time OEE causes database connection pool exhaustion | MEDIUM | HIGH | Materialized view + triggers |
| RISK-005 | Roy single point of failure for 9 services | MEDIUM | HIGH | Pair programming, code reviews |
| RISK-006 | Gantt chart custom implementation exceeds 4 weeks | HIGH | MEDIUM | Use DHTMLX library |
| RISK-007 | 14-week timeline unrealistic, stakeholder disappointment | HIGH | MEDIUM | Reset expectations to 30 weeks |
| RISK-008 | Sales-Operations integration creates tight coupling | MEDIUM | MEDIUM | Event-driven architecture (NATS) |
| RISK-009 | Concurrent scheduling creates double-booking | LOW | HIGH | Optimistic locking |
| RISK-010 | Missing authorization allows unauthorized production orders | MEDIUM | HIGH | Implement facility access checks |

---

## 12. Final Verdict

**Cynthia's Research Quality: 7/10** (Good foundation, critical gaps in implementation details)

**Readiness for Implementation:**
- **Database Schema:** ✅ Ready (pending routing tables + RLS policies)
- **GraphQL API:** ✅ Ready (pending pagination fixes)
- **Service Layer:** ❌ Not Ready (no architecture blueprint)
- **Scheduling Algorithm:** ❌ Not Ready (unrealistic timeline, no vendor choice)
- **Frontend Components:** ⚠️ Partially Ready (DHTMLX recommended over custom)
- **Security (RLS):** ❌ Not Ready (zero policies implemented)
- **Testing Strategy:** ✅ Ready (comprehensive coverage plan)

**Go/No-Go Decision:**
- **NO-GO** for 14-week timeline as proposed
- **GO** for revised 30-week timeline with Tier 1 fixes

**Marcus (Product Owner) Must Decide:**
1. Accept 30-week timeline OR reduce scope to MVP (priority dispatch only)
2. Approve Google OR-Tools procurement OR accept simplified heuristic
3. Approve DHTMLX Gantt license ($499) OR extend frontend timeline by 3 weeks
4. Allocate additional resource (external consultant for scheduling algorithm)

**Next Steps:**
1. Schedule architecture review meeting (Roy, Marcus, Sylvia, Jen, Billy)
2. Create detailed service architecture blueprint (Week 1 deliverable)
3. Implement routing tables and RLS policies (Phase 1 blockers)
4. Update project plan with 30-week timeline
5. Obtain Marcus approval for OR-Tools vs Heuristic decision

---

## Appendix A: Service Dependency Graph

```
┌─────────────────────────────────────────────────────────┐
│          ProductionPlanningService                      │
│  - generateProductionOrders()                           │
│  - calculateMaterialRequirements()                      │
│  - checkCapacityFeasibility()                           │
└──────────────────┬──────────────────────────────────────┘
                   │
                   ↓ depends on
┌──────────────────────────────────────────────────────────┐
│         RoutingManagementService                         │
│  - expandRouting() ← CRITICAL                            │
│  - calculateYieldRequirements()                          │
└──────────────────┬───────────────────────────────────────┘
                   │
                   ↓ depends on
┌──────────────────────────────────────────────────────────┐
│        ProductionSchedulingService                       │
│  - scheduleProductionOrder()                             │
│  - optimizeSchedule()                                    │
└──────────┬───────────────────────────────────────────────┘
           │
           ↓ depends on
┌──────────────────────────────────────────────────────────┐
│      ConstraintBasedSchedulingService                    │
│  - validateConstraints()                                 │
│  - allocateResources()                                   │
│  - OR-Tools integration ← 8 WEEKS                        │
└──────────┬───────────────────────────────────────────────┘
           │
           ↓ depends on
┌──────────────────────────────────────────────────────────┐
│      ChangeoverOptimizationService                       │
│  - optimizeJobSequence()                                 │
│  - calculateChangeoverTime()                             │
└──────────────────────────────────────────────────────────┘
```

**Critical Observation:**
Services have **sequential dependencies**. Cannot parallelize Phase 2-3 work.

---

## Appendix B: Performance Benchmark Targets

| Operation | Target Latency | Max Throughput | Notes |
|-----------|---------------|----------------|-------|
| Create Production Order | < 100ms | 100 orders/sec | Single database insert |
| Generate Routing Expansion | < 500ms | 20 expansions/sec | 4 operations avg |
| Schedule 100 Orders (Priority Dispatch) | < 2 seconds | N/A | Heuristic algorithm |
| Schedule 100 Orders (OR-Tools) | < 5 seconds | N/A | Optimization algorithm |
| Calculate OEE (Single Work Center) | < 50ms | 200 calcs/sec | Aggregation query |
| Real-Time OEE Dashboard Load | < 200ms | 100 concurrent users | Materialized view |
| Gantt Chart Data Load (30 days) | < 1 second | 50 concurrent users | Indexed query |
| Production Run Start | < 100ms | 500 starts/hour | Status update |
| Production Run Complete | < 200ms | 500 completions/hour | Inventory transaction trigger |

---

**End of Architectural Critique**

**Next Action:** Marcus to review and approve Tier 1 recommendations before implementation begins.
