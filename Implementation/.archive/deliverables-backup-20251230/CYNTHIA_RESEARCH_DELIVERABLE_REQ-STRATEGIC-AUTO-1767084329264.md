# RESEARCH DELIVERABLE: Material Requirements Planning (MRP) Engine
## REQ-STRATEGIC-AUTO-1767084329264

**Agent:** Cynthia (Research Analyst)
**Date:** 2025-12-30
**Status:** COMPLETE
**Priority:** HIGH - Core ERP Capability

---

## EXECUTIVE SUMMARY

This research deliverable provides a comprehensive analysis and implementation plan for a **Material Requirements Planning (MRP) Engine** for the AGOG print industry ERP system. The MRP engine will automate the calculation of material requirements based on production schedules, manage bill of materials (BOM) explosions, coordinate procurement with production demand, and integrate with existing forecasting and inventory management modules.

**Key Finding:** The existing schema and service architecture provide strong foundations for MRP implementation, with tables for materials, BOMs, production orders, inventory, and forecasting already in place. The primary gap is the **MRP calculation engine** itself and the integration layer connecting production planning with procurement.

---

## 1. RESEARCH FINDINGS

### 1.1 Existing Schema Analysis

#### Materials & BOM Infrastructure (STRONG FOUNDATION ✓)

**Location:** `database/schemas/sales-materials-procurement-module.sql`

**Existing Tables:**
1. **materials** (Line 30-119)
   - Comprehensive material master with:
     - Material types: RAW_MATERIAL, SUBSTRATE, INK, COATING, ADHESIVE, FINISHED_GOOD, WIP, KIT
     - Inventory management: lot tracking, ABC classification, shelf life
     - Purchasing parameters: lead_time_days, minimum_order_quantity, order_multiple
     - Safety stock: safety_stock_quantity, reorder_point, economic_order_quantity
     - Costing: standard_cost, average_cost, costing_method (FIFO, LIFO, AVERAGE, STANDARD)

2. **bill_of_materials** (Line 202-256)
   - Parent-component relationships
   - Quantity per parent with scrap allowance
   - Sequencing and operation linkage
   - Substitution support
   - Effective dating for BOM versioning

3. **products** (Line 134-195)
   - Finished goods linkage to materials
   - Standard production time and routing references
   - Standard costs (material, labor, overhead)

**Schema Strengths:**
- ✓ Complete BOM explosion capability with scrap percentage
- ✓ Multi-level BOM support via recursive parent-product relationships
- ✓ Substitution components for material shortages
- ✓ Effective dating for BOM version control
- ✓ Operation-level material consumption tracking

**Schema Gaps:**
- ⚠️ No dedicated MRP calculation results table
- ⚠️ No planned order table (intermediate between MRP output and PO/production orders)
- ⚠️ No pegging table to track demand sources (which sales order drives which material requirement)

#### Production Planning Infrastructure (STRONG FOUNDATION ✓)

**Location:** `database/schemas/operations-module.sql`

**Existing Tables:**
1. **production_orders** (Line 99-171)
   - Links to sales orders and products
   - Quantity tracking (ordered, completed, scrapped)
   - Scheduling fields (planned/actual start/completion dates)
   - Priority management
   - Manufacturing strategy support
   - Routing linkage (routing_id added in V0.0.40)

2. **routing_templates** & **routing_operations** (V0.0.40)
   - Reusable production routings
   - Operation sequencing with setup/run times
   - Yield and scrap calculations
   - Work center assignments
   - Concurrent operation support

3. **work_centers** (Line 17-92)
   - Manufacturing equipment capacity
   - Production rates and calendar
   - Hourly rates and costs

**Production Planning Strengths:**
- ✓ Complete routing infrastructure for operation-level material requirements
- ✓ Work center capacity tracking for finite scheduling
- ✓ Scrap and yield modeling at operation level
- ✓ Priority-based scheduling support

**Production Planning Gaps:**
- ⚠️ No capacity requirements planning (CRP) tables
- ⚠️ No planned production orders (MRP output)
- ⚠️ No backward/forward scheduling engine

#### Inventory & WMS Infrastructure (STRONG FOUNDATION ✓)

**Location:** `database/schemas/wms-module.sql`

**Existing Tables:**
1. **inventory_locations** (Line 17-87)
   - Physical warehouse locations with hierarchical structure
   - Location types: RECEIVING, PUTAWAY, PICK_FACE, RESERVE, etc.
   - ABC classification for cycle counting
   - Security zones and temperature control

2. **inventory_transactions** (Line 169-233)
   - Complete transaction history (RECEIPT, ISSUE, TRANSFER, ADJUSTMENT)
   - Lot tracking with traceability
   - Reference document linkage (PO, SO, production runs)

3. **lots** (Line 94-162)
   - Lot/batch tracking with expiration dates
   - Quality status management
   - Customer ownership (3PL support)

**Inventory Strengths:**
- ✓ Real-time inventory visibility with location tracking
- ✓ Lot/batch traceability for raw materials
- ✓ Transaction history for inventory accuracy
- ✓ Quality status for quarantine/released materials

**Inventory Gaps:**
- ⚠️ No on-hand/available/allocated summary view (requires aggregation query)
- ⚠️ No reservation table for hard allocations to production orders

#### Forecasting & Replenishment Infrastructure (RECENTLY DEPLOYED ✓)

**Location:** `migrations/V0.0.32__create_inventory_forecasting_tables_FIXED.sql`

**Existing Tables:**
1. **demand_history** (Line 22-80)
   - Historical demand tracking by material/facility/date
   - Disaggregated demand sources (sales, production, transfers)
   - External factors (pricing, promotions, campaigns)
   - Forecast accuracy metrics

2. **material_forecasts** (Line 149-206)
   - Generated demand forecasts with confidence intervals
   - Multiple algorithms (SARIMA, LIGHTGBM, MOVING_AVERAGE, EXP_SMOOTHING)
   - Manual override support
   - Versioning for reforecasting

3. **replenishment_suggestions** (Line 264-331)
   - Automated PO suggestions based on forecasts
   - Safety stock and reorder point calculations
   - Projected stockout dates
   - Economic order quantity recommendations

**Forecasting Strengths:**
- ✓ Advanced forecasting algorithms (MA, SES, Holt-Winters)
- ✓ Replenishment recommendations based on demand forecasts
- ✓ Safety stock calculations for independent demand
- ✓ Service implementation in `forecasting.service.ts` and `replenishment-recommendation.service.ts`

**Forecasting Integration Points:**
- MRP should use forecasts for independent demand (finished goods)
- MRP-generated dependent demand should feed back to forecasting accuracy metrics
- Replenishment suggestions should be coordinated with MRP planned orders

#### Procurement Infrastructure (STRONG FOUNDATION ✓)

**Location:** `database/schemas/sales-materials-procurement-module.sql`

**Existing Tables:**
1. **vendors** (Line 267-330)
   - Vendor master with performance tracking
   - Payment terms and approval workflow
   - Quality and on-time delivery ratings

2. **materials_suppliers** (Line 337-389)
   - Material-specific vendor pricing
   - Quantity price breaks
   - Lead times per vendor-material combination

3. **purchase_orders** & **purchase_order_lines** (Line 396-530)
   - Complete PO lifecycle management
   - Receiving tracking (quantity ordered vs received)
   - Multi-currency support
   - Approval workflows

**Procurement Strengths:**
- ✓ Multiple vendor sourcing with preferred vendor designation
- ✓ Lead time tracking per vendor-material
- ✓ Price break modeling for quantity discounts
- ✓ PO receiving integration with inventory

**Procurement Gaps:**
- ⚠️ No planned PO table (MRP should generate planned POs before firm POs)
- ⚠️ No source determination engine (select best vendor based on price, lead time, quality)

#### Job Costing & Standard Costs (RECENTLY DEPLOYED ✓)

**Location:** `migrations/V0.0.40__create_jobs_and_standard_costs_tables.sql`

**Existing Tables:**
1. **jobs** (Line 15-98)
   - Job master linking customer requirements to production
   - Estimated vs actual cost tracking
   - Job status lifecycle

2. **standard_costs** (Line 163-235)
   - Standard costs for materials, operations, labor, overhead
   - Cost components breakdown
   - Effective dating and variance thresholds

**Costing Strengths:**
- ✓ Standard costing framework for cost estimation
- ✓ Job-level cost tracking (estimated vs actual)
- ✓ Cost variance analysis capability

### 1.2 Service Architecture Analysis

**Existing NestJS Services:**

1. **ForecastingService** (`modules/forecasting/services/forecasting.service.ts`)
   - Demand forecasting with multiple algorithms
   - Batch processing to avoid N+1 queries
   - Forecast generation and storage

2. **ReplenishmentRecommendationService** (`modules/forecasting/services/replenishment-recommendation.service.ts`)
   - PO recommendations based on forecasts
   - Safety stock calculations
   - Stockout date projections

3. **SafetyStockService** (`modules/forecasting/services/safety-stock.service.ts`)
   - Safety stock calculations using demand variability
   - Service level-based inventory buffers

4. **DemandHistoryService** (`modules/forecasting/services/demand-history.service.ts`)
   - Historical demand tracking
   - Batch demand history retrieval

**Service Architecture Strengths:**
- ✓ Mature NestJS module structure
- ✓ Dependency injection for testability
- ✓ Database pool management
- ✓ GraphQL resolver integration

**Service Architecture Gaps:**
- ⚠️ No MRP calculation service
- ⚠️ No BOM explosion service
- ⚠️ No capacity requirements planning (CRP) service
- ⚠️ No source determination service

---

## 2. MRP ENGINE REQUIREMENTS

### 2.1 Functional Requirements

#### FR-1: BOM Explosion
**Priority:** CRITICAL
**Description:** Explode multi-level BOMs to calculate gross material requirements.

**Requirements:**
- FR-1.1: Support multi-level BOM explosion (up to 20 levels)
- FR-1.2: Calculate net requirements considering on-hand inventory, allocated inventory, and on-order quantities
- FR-1.3: Apply scrap percentages at each BOM level
- FR-1.4: Handle component substitutions when primary materials are unavailable
- FR-1.5: Support phantom assemblies (BOM items that don't have inventory)
- FR-1.6: Apply lot sizing rules (lot-for-lot, fixed order quantity, economic order quantity, period order quantity)

**Inputs:**
- Production orders (quantity, due date, product_id)
- Bill of materials (component_material_id, quantity_per_parent, scrap_percentage)
- Materials (on-hand quantity, allocated quantity, safety stock)
- Existing POs and production orders

**Outputs:**
- Gross requirements by material and date
- Net requirements after inventory netting
- Planned order releases (POs and production orders)

**Algorithm:**
```
FOR each production order (top-level demand):
  1. Explode BOM recursively (DFS or BFS traversal)
  2. For each component material:
     a. Calculate gross requirement = (parent quantity * quantity_per_parent) * (1 + scrap_percentage)
     b. Offset by lead time (backward schedule from due date)
     c. Net against on-hand, allocated, on-order quantities
     d. If net requirement > 0, create planned order
     e. If material is manufactured (has BOM), repeat explosion
     f. If material is purchased, create planned PO
```

#### FR-2: Net Change MRP
**Priority:** HIGH
**Description:** Support incremental MRP runs that only recalculate changed materials.

**Requirements:**
- FR-2.1: Track which materials have changed since last MRP run
- FR-2.2: Recalculate only affected materials and their parent/child relationships
- FR-2.3: Maintain MRP run history for audit trail
- FR-2.4: Support full regenerative MRP on demand

**Change Triggers:**
- New or modified production orders
- New or modified sales orders
- BOM changes (component additions, quantity changes)
- Inventory transactions (receipts, issues, adjustments)
- Lead time changes
- On-order status changes (PO cancellations, delivery date changes)

#### FR-3: Time Phasing & Lead Time Offsetting
**Priority:** CRITICAL
**Description:** Calculate when materials are needed based on lead times.

**Requirements:**
- FR-3.1: Backward schedule from production order due date
- FR-3.2: Account for material lead times (from materials table)
- FR-3.3: Account for production operation lead times (from routing_operations)
- FR-3.4: Support safety lead time buffers
- FR-3.5: Generate time-phased requirement report (by week/month)

**Formula:**
```
Material Required Date = Production Order Due Date
                        - Production Lead Time
                        - Material Lead Time
                        - Safety Lead Time
```

#### FR-4: Pegging & Where-Used
**Priority:** HIGH
**Description:** Track which demand sources drive material requirements.

**Requirements:**
- FR-4.1: Maintain pegging records linking material requirements to originating sales orders
- FR-4.2: Support multi-level pegging (component → subassembly → finished good → sales order)
- FR-4.3: Enable impact analysis (what happens if a material is delayed?)
- FR-4.4: Support critical path analysis (which materials are on critical path?)

**Use Cases:**
- "Which sales orders will be affected if this material shipment is delayed?"
- "What are the top-level demand sources for this raw material?"
- "If I expedite this PO, which customer orders will ship earlier?"

#### FR-5: Action Messages & Exception Reporting
**Priority:** HIGH
**Description:** Generate actionable recommendations for planners.

**Action Message Types:**
1. **Expedite:** Existing PO/production order needs earlier due date
2. **De-expedite:** Existing order can be delayed (reduce rush fees)
3. **Increase Quantity:** Existing order should be increased
4. **Decrease Quantity:** Existing order should be decreased
5. **Cancel:** Existing order is no longer needed
6. **New Order:** Create new PO or production order

**Requirements:**
- FR-5.1: Compare MRP planned orders against existing firm orders
- FR-5.2: Generate exception messages when discrepancies exceed tolerance thresholds
- FR-5.3: Prioritize action messages by impact (critical path, customer priority)
- FR-5.4: Support planner approval workflow for action message execution

#### FR-6: Lot Sizing & Order Policy
**Priority:** MEDIUM
**Description:** Apply intelligent order quantity rules.

**Lot Sizing Methods:**
1. **Lot-for-Lot (L4L):** Order exact net requirement (minimize inventory)
2. **Fixed Order Quantity (FOQ):** Order fixed quantity (e.g., 1000 sheets)
3. **Economic Order Quantity (EOQ):** Balance ordering costs vs holding costs
4. **Period Order Quantity (POQ):** Cover N periods of demand
5. **Min-Max:** Reorder to max when inventory drops below min

**Requirements:**
- FR-6.1: Configure lot sizing policy per material
- FR-6.2: Respect minimum order quantities and order multiples
- FR-6.3: Apply quantity price breaks when available
- FR-6.4: Consider storage constraints and shelf life

#### FR-7: Integration with Forecasting
**Priority:** HIGH
**Description:** Use demand forecasts for independent demand items.

**Requirements:**
- FR-7.1: Source finished goods demand from material_forecasts table
- FR-7.2: Combine forecasted demand with firm sales orders
- FR-7.3: Apply demand consumption (reduce forecast when sales orders are entered)
- FR-7.4: Support planning time fences (freeze period for firm orders only)

**Demand Sources Priority:**
```
1. Firm Sales Orders (highest priority, cannot be overridden)
2. Planned Sales Orders (from forecasts, can be consumed by firm orders)
3. Safety Stock Replenishment
```

#### FR-8: Capacity Requirements Planning (CRP) - Phase 2
**Priority:** MEDIUM (Future Phase)
**Description:** Validate that MRP plan is capacity-feasible.

**Requirements:**
- FR-8.1: Calculate work center load based on planned production orders
- FR-8.2: Identify capacity overloads and underutilization
- FR-8.3: Support finite capacity scheduling (reschedule if overloaded)
- FR-8.4: Generate capacity vs load charts by work center

---

### 2.2 Non-Functional Requirements

#### NFR-1: Performance
- MRP run should complete within 5 minutes for 10,000 materials
- BOM explosion should support up to 20 levels deep
- Support concurrent MRP runs per tenant (multi-tenancy isolation)
- Batch processing for large material sets

#### NFR-2: Scalability
- Support 100,000+ materials per tenant
- Support 1,000,000+ planned orders
- Horizontal scaling via read replicas for reporting

#### NFR-3: Accuracy
- Inventory netting must be 100% accurate (no phantom requirements)
- Lead time calculations must be accurate to the day
- Scrap percentage calculations must be correct at each level

#### NFR-4: Auditability
- Log all MRP runs with timestamp and parameters
- Track action message execution (which planner approved what)
- Maintain pegging history for compliance

#### NFR-5: Usability
- Planner dashboard with exception highlights
- One-click action message execution
- What-if scenario simulation (run MRP without committing)

---

## 3. PROPOSED ARCHITECTURE

### 3.1 Database Schema Extensions

#### New Table: mrp_runs
**Purpose:** Track MRP execution history and parameters.

```sql
CREATE TABLE mrp_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,

    -- Run identification
    run_number VARCHAR(50) UNIQUE NOT NULL,
    run_type VARCHAR(20) NOT NULL,
    -- REGENERATIVE, NET_CHANGE, SIMULATION

    -- Timing
    run_start_timestamp TIMESTAMPTZ NOT NULL,
    run_end_timestamp TIMESTAMPTZ,
    run_duration_seconds INTEGER,

    -- Scope
    material_ids UUID[], -- Null = all materials
    planning_horizon_days INTEGER DEFAULT 180,

    -- Results
    total_materials_processed INTEGER,
    total_planned_orders_generated INTEGER,
    total_action_messages_generated INTEGER,

    -- Status
    status VARCHAR(20) DEFAULT 'RUNNING',
    -- RUNNING, COMPLETED, FAILED, CANCELLED

    error_message TEXT,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,

    CONSTRAINT fk_mrp_run_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_mrp_run_facility FOREIGN KEY (facility_id) REFERENCES facilities(id)
);

CREATE INDEX idx_mrp_runs_tenant_facility ON mrp_runs(tenant_id, facility_id);
CREATE INDEX idx_mrp_runs_status ON mrp_runs(status);
CREATE INDEX idx_mrp_runs_timestamp ON mrp_runs(run_start_timestamp DESC);
```

#### New Table: planned_orders
**Purpose:** Store MRP-generated planned orders (before firming to PO/production orders).

```sql
CREATE TABLE planned_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    mrp_run_id UUID NOT NULL,

    -- Order identification
    planned_order_number VARCHAR(50) NOT NULL,
    order_type VARCHAR(20) NOT NULL,
    -- PURCHASE, PRODUCTION, TRANSFER

    -- Material
    material_id UUID NOT NULL,
    material_code VARCHAR(100),

    -- Quantity
    quantity DECIMAL(18,4) NOT NULL,
    unit_of_measure VARCHAR(20),

    -- Timing
    required_date DATE NOT NULL,
    order_date DATE NOT NULL,
    -- order_date = required_date - lead_time

    -- Sourcing
    vendor_id UUID,
    -- For purchase orders
    work_center_id UUID,
    -- For production orders

    -- Costing
    estimated_unit_cost DECIMAL(18,4),
    estimated_total_cost DECIMAL(18,4),

    -- Lot sizing
    lot_sizing_method VARCHAR(30),
    -- LOT_FOR_LOT, FIXED_ORDER_QUANTITY, EOQ, PERIOD_ORDER_QUANTITY

    -- Status
    status VARCHAR(20) DEFAULT 'PLANNED',
    -- PLANNED, FIRMED, CONVERTED, CANCELLED

    firmed_at TIMESTAMPTZ,
    firmed_by UUID,

    -- Conversion tracking
    converted_to_po_id UUID,
    converted_to_production_order_id UUID,
    converted_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,

    CONSTRAINT fk_planned_order_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_planned_order_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_planned_order_mrp_run FOREIGN KEY (mrp_run_id) REFERENCES mrp_runs(id),
    CONSTRAINT fk_planned_order_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT fk_planned_order_vendor FOREIGN KEY (vendor_id) REFERENCES vendors(id),
    CONSTRAINT uq_planned_order_number UNIQUE (tenant_id, planned_order_number)
);

CREATE INDEX idx_planned_orders_tenant_facility ON planned_orders(tenant_id, facility_id);
CREATE INDEX idx_planned_orders_mrp_run ON planned_orders(mrp_run_id);
CREATE INDEX idx_planned_orders_material ON planned_orders(material_id);
CREATE INDEX idx_planned_orders_status ON planned_orders(status);
CREATE INDEX idx_planned_orders_required_date ON planned_orders(required_date);
CREATE INDEX idx_planned_orders_type ON planned_orders(order_type);
```

#### New Table: mrp_pegging
**Purpose:** Track demand source for each material requirement (pegging/where-used).

```sql
CREATE TABLE mrp_pegging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    mrp_run_id UUID NOT NULL,

    -- Requirement (lower level)
    planned_order_id UUID NOT NULL,
    material_id UUID NOT NULL,
    required_quantity DECIMAL(18,4) NOT NULL,
    required_date DATE NOT NULL,

    -- Demand source (higher level)
    demand_source_type VARCHAR(30) NOT NULL,
    -- SALES_ORDER, PRODUCTION_ORDER, FORECAST, SAFETY_STOCK, PARENT_PLANNED_ORDER

    sales_order_id UUID,
    sales_order_line_id UUID,
    production_order_id UUID,
    forecast_id UUID,
    parent_planned_order_id UUID,

    -- Pegging level (0 = top-level demand)
    pegging_level INTEGER NOT NULL,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mrp_pegging_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_mrp_pegging_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_mrp_pegging_mrp_run FOREIGN KEY (mrp_run_id) REFERENCES mrp_runs(id),
    CONSTRAINT fk_mrp_pegging_planned_order FOREIGN KEY (planned_order_id) REFERENCES planned_orders(id),
    CONSTRAINT fk_mrp_pegging_material FOREIGN KEY (material_id) REFERENCES materials(id)
);

CREATE INDEX idx_mrp_pegging_tenant_facility ON mrp_pegging(tenant_id, facility_id);
CREATE INDEX idx_mrp_pegging_mrp_run ON mrp_pegging(mrp_run_id);
CREATE INDEX idx_mrp_pegging_planned_order ON mrp_pegging(planned_order_id);
CREATE INDEX idx_mrp_pegging_material ON mrp_pegging(material_id);
CREATE INDEX idx_mrp_pegging_sales_order ON mrp_pegging(sales_order_id) WHERE sales_order_id IS NOT NULL;
```

#### New Table: mrp_action_messages
**Purpose:** Store planner action recommendations.

```sql
CREATE TABLE mrp_action_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    facility_id UUID NOT NULL,
    mrp_run_id UUID NOT NULL,

    -- Action identification
    action_message_number VARCHAR(50) NOT NULL,
    action_type VARCHAR(30) NOT NULL,
    -- EXPEDITE, DE_EXPEDITE, INCREASE_QUANTITY, DECREASE_QUANTITY, CANCEL, NEW_ORDER

    -- Target order
    order_type VARCHAR(20) NOT NULL,
    -- PURCHASE_ORDER, PRODUCTION_ORDER, PLANNED_ORDER

    purchase_order_id UUID,
    production_order_id UUID,
    planned_order_id UUID,

    -- Material
    material_id UUID NOT NULL,
    material_code VARCHAR(100),

    -- Recommendation
    current_quantity DECIMAL(18,4),
    recommended_quantity DECIMAL(18,4),
    current_due_date DATE,
    recommended_due_date DATE,

    -- Impact
    impact_level VARCHAR(20),
    -- CRITICAL, HIGH, MEDIUM, LOW
    affected_sales_orders JSONB,
    -- [{sales_order_number, customer_name, due_date}, ...]

    -- Reason
    reason_code VARCHAR(50),
    reason_description TEXT,

    -- Status
    status VARCHAR(20) DEFAULT 'PENDING',
    -- PENDING, APPROVED, REJECTED, EXECUTED, CANCELLED

    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,

    executed_by UUID,
    executed_at TIMESTAMPTZ,

    -- Audit
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_mrp_action_msg_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_mrp_action_msg_facility FOREIGN KEY (facility_id) REFERENCES facilities(id),
    CONSTRAINT fk_mrp_action_msg_mrp_run FOREIGN KEY (mrp_run_id) REFERENCES mrp_runs(id),
    CONSTRAINT fk_mrp_action_msg_material FOREIGN KEY (material_id) REFERENCES materials(id),
    CONSTRAINT uq_action_message_number UNIQUE (tenant_id, action_message_number)
);

CREATE INDEX idx_mrp_action_msgs_tenant_facility ON mrp_action_messages(tenant_id, facility_id);
CREATE INDEX idx_mrp_action_msgs_mrp_run ON mrp_action_messages(mrp_run_id);
CREATE INDEX idx_mrp_action_msgs_status ON mrp_action_messages(status);
CREATE INDEX idx_mrp_action_msgs_impact ON mrp_action_messages(impact_level);
CREATE INDEX idx_mrp_action_msgs_material ON mrp_action_messages(material_id);
```

#### Extension to materials table
**Purpose:** Add MRP configuration fields.

```sql
ALTER TABLE materials ADD COLUMN IF NOT EXISTS mrp_type VARCHAR(20) DEFAULT 'MRP';
-- MRP (standard MRP calculation), MPS (master schedule item), NONE (no planning)

ALTER TABLE materials ADD COLUMN IF NOT EXISTS lot_sizing_method VARCHAR(30) DEFAULT 'LOT_FOR_LOT';
-- LOT_FOR_LOT, FIXED_ORDER_QUANTITY, EOQ, PERIOD_ORDER_QUANTITY, MIN_MAX

ALTER TABLE materials ADD COLUMN IF NOT EXISTS fixed_order_quantity DECIMAL(18,4);
-- For LOT_FOR_LOT method

ALTER TABLE materials ADD COLUMN IF NOT EXISTS period_order_quantity_days INTEGER DEFAULT 30;
-- For POQ method - cover N days of demand

ALTER TABLE materials ADD COLUMN IF NOT EXISTS safety_lead_time_days INTEGER DEFAULT 0;
-- Buffer time added to lead time

ALTER TABLE materials ADD COLUMN IF NOT EXISTS planning_time_fence_days INTEGER DEFAULT 0;
-- Period where only firm orders are considered (no forecasts)

ALTER TABLE materials ADD COLUMN IF NOT EXISTS is_phantom BOOLEAN DEFAULT FALSE;
-- Phantom assemblies are not stocked

ALTER TABLE materials ADD COLUMN IF NOT EXISTS yield_percentage DECIMAL(8,4) DEFAULT 100.0;
-- Overall yield for this material
```

---

### 3.2 Service Architecture

#### MRP Module Structure

```
src/modules/mrp/
├── mrp.module.ts
├── dto/
│   ├── mrp-run.dto.ts
│   ├── planned-order.dto.ts
│   ├── action-message.dto.ts
│   └── mrp-types.ts
├── services/
│   ├── mrp-engine.service.ts           # Core MRP calculation engine
│   ├── bom-explosion.service.ts        # Multi-level BOM explosion
│   ├── inventory-netting.service.ts    # Calculate net requirements
│   ├── lot-sizing.service.ts           # Apply lot sizing rules
│   ├── pegging.service.ts              # Track demand sources
│   ├── action-message.service.ts       # Generate planner recommendations
│   ├── planned-order.service.ts        # Manage planned orders
│   └── mrp-integration.service.ts      # Integration with forecasting/procurement
└── resolvers/
    └── mrp.resolver.ts                 # GraphQL API
```

#### Service: MRPEngineService

**Responsibility:** Orchestrate complete MRP run.

```typescript
@Injectable()
export class MRPEngineService {
  constructor(
    @Inject('DATABASE_POOL') private pool: Pool,
    private bomExplosionService: BOMExplosionService,
    private inventoryNettingService: InventoryNettingService,
    private lotSizingService: LotSizingService,
    private peggingService: PeggingService,
    private actionMessageService: ActionMessageService,
    private plannedOrderService: PlannedOrderService,
    private mrpIntegrationService: MRPIntegrationService
  ) {}

  /**
   * Execute MRP run
   */
  async runMRP(input: RunMRPInput): Promise<MRPRunResult> {
    // 1. Create MRP run record
    const mrpRun = await this.createMRPRun(input);

    try {
      // 2. Get demand sources (sales orders + forecasts)
      const demandSources = await this.mrpIntegrationService.getDemandSources(
        input.tenantId,
        input.facilityId,
        input.planningHorizonDays
      );

      // 3. For each demand source, explode BOM
      const allRequirements: MaterialRequirement[] = [];
      for (const demand of demandSources) {
        const requirements = await this.bomExplosionService.explodeBOM(
          demand.productId,
          demand.quantity,
          demand.dueDate,
          mrpRun.id
        );
        allRequirements.push(...requirements);
      }

      // 4. Aggregate requirements by material and date
      const aggregatedRequirements = this.aggregateRequirements(allRequirements);

      // 5. Net against inventory and on-order quantities
      const netRequirements = await this.inventoryNettingService.calculateNetRequirements(
        input.tenantId,
        input.facilityId,
        aggregatedRequirements
      );

      // 6. Apply lot sizing rules
      const plannedOrders = await this.lotSizingService.applyLotSizing(
        input.tenantId,
        input.facilityId,
        netRequirements
      );

      // 7. Store planned orders
      await this.plannedOrderService.bulkCreatePlannedOrders(plannedOrders, mrpRun.id);

      // 8. Generate pegging records
      await this.peggingService.generatePeggingRecords(
        plannedOrders,
        demandSources,
        mrpRun.id
      );

      // 9. Generate action messages
      const actionMessages = await this.actionMessageService.generateActionMessages(
        input.tenantId,
        input.facilityId,
        plannedOrders,
        mrpRun.id
      );

      // 10. Update MRP run status
      await this.completeMRPRun(mrpRun.id, {
        materialsProcessed: netRequirements.length,
        plannedOrdersGenerated: plannedOrders.length,
        actionMessagesGenerated: actionMessages.length
      });

      return {
        mrpRunId: mrpRun.id,
        status: 'COMPLETED',
        plannedOrders,
        actionMessages
      };

    } catch (error) {
      await this.failMRPRun(mrpRun.id, error.message);
      throw error;
    }
  }
}
```

#### Service: BOMExplosionService

**Responsibility:** Recursively explode multi-level BOMs.

```typescript
@Injectable()
export class BOMExplosionService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Explode BOM recursively to calculate gross requirements
   */
  async explodeBOM(
    productId: string,
    parentQuantity: number,
    dueDate: Date,
    mrpRunId: string,
    level: number = 0,
    peggingChain: PeggingRecord[] = []
  ): Promise<MaterialRequirement[]> {
    const requirements: MaterialRequirement[] = [];

    // Get BOM components for this product
    const bomComponents = await this.getBOMComponents(productId);

    for (const component of bomComponents) {
      // Calculate gross requirement
      const grossQuantity = parentQuantity * component.quantityPerParent * (1 + component.scrapPercentage / 100);

      // Offset by lead time
      const requiredDate = this.offsetByLeadTime(
        dueDate,
        component.leadTimeDays,
        component.safetyLeadTimeDays
      );

      // Create requirement record
      const requirement: MaterialRequirement = {
        mrpRunId,
        materialId: component.materialId,
        materialCode: component.materialCode,
        grossQuantity,
        requiredDate,
        demandSource: {
          type: level === 0 ? 'PRODUCTION_ORDER' : 'PARENT_COMPONENT',
          productId,
          parentQuantity,
          bomLevel: level
        },
        peggingChain: [...peggingChain, { productId, quantity: parentQuantity }]
      };

      requirements.push(requirement);

      // If component is manufactured (has BOM), recurse
      if (component.isManufactured && !component.isPhantom) {
        const childRequirements = await this.explodeBOM(
          component.materialId,
          grossQuantity,
          requiredDate,
          mrpRunId,
          level + 1,
          requirement.peggingChain
        );
        requirements.push(...childRequirements);
      }
    }

    return requirements;
  }

  /**
   * Get BOM components for a product
   */
  private async getBOMComponents(productId: string): Promise<BOMComponent[]> {
    const result = await this.pool.query(`
      SELECT
        bom.id,
        bom.component_material_id AS material_id,
        m.material_code,
        bom.quantity_per_parent AS quantity_per_parent,
        bom.scrap_percentage,
        m.lead_time_days,
        m.safety_lead_time_days,
        m.is_manufacturable AS is_manufactured,
        m.is_phantom
      FROM bill_of_materials bom
      JOIN materials m ON m.id = bom.component_material_id
      WHERE bom.parent_product_id = $1
        AND bom.is_active = TRUE
        AND (bom.effective_from IS NULL OR bom.effective_from <= CURRENT_DATE)
        AND (bom.effective_to IS NULL OR bom.effective_to >= CURRENT_DATE)
      ORDER BY bom.sequence_number
    `, [productId]);

    return result.rows;
  }

  /**
   * Offset date by lead time
   */
  private offsetByLeadTime(
    dueDate: Date,
    leadTimeDays: number,
    safetyLeadTimeDays: number
  ): Date {
    const totalLeadTime = leadTimeDays + safetyLeadTimeDays;
    const requiredDate = new Date(dueDate);
    requiredDate.setDate(requiredDate.getDate() - totalLeadTime);
    return requiredDate;
  }
}
```

#### Service: InventoryNettingService

**Responsibility:** Calculate net requirements after inventory netting.

```typescript
@Injectable()
export class InventoryNettingService {
  constructor(@Inject('DATABASE_POOL') private pool: Pool) {}

  /**
   * Calculate net requirements by netting gross requirements against inventory
   */
  async calculateNetRequirements(
    tenantId: string,
    facilityId: string,
    grossRequirements: MaterialRequirement[]
  ): Promise<NetRequirement[]> {
    const netRequirements: NetRequirement[] = [];

    // Group requirements by material
    const requirementsByMaterial = this.groupByMaterial(grossRequirements);

    for (const [materialId, requirements] of requirementsByMaterial) {
      // Get current inventory levels
      const inventory = await this.getInventoryLevels(tenantId, facilityId, materialId);

      // Get on-order quantities (existing POs and production orders)
      const onOrderSchedule = await this.getOnOrderSchedule(tenantId, facilityId, materialId);

      // Sort requirements by date
      const sortedRequirements = requirements.sort((a, b) =>
        a.requiredDate.getTime() - b.requiredDate.getTime()
      );

      // Simulate inventory over time
      let projectedOnHand = inventory.onHandQuantity - inventory.allocatedQuantity;

      for (const req of sortedRequirements) {
        // Add receipts scheduled before this requirement
        const receiptsBeforeDate = onOrderSchedule.filter(
          o => o.dueDate <= req.requiredDate
        );
        projectedOnHand += receiptsBeforeDate.reduce((sum, r) => sum + r.quantity, 0);

        // Calculate net requirement
        const netQuantity = Math.max(0, req.grossQuantity - projectedOnHand);

        if (netQuantity > 0) {
          netRequirements.push({
            materialId,
            materialCode: req.materialCode,
            grossQuantity: req.grossQuantity,
            projectedOnHand,
            netQuantity,
            requiredDate: req.requiredDate,
            peggingChain: req.peggingChain
          });
        }

        // Update projected on-hand
        projectedOnHand -= req.grossQuantity;
      }
    }

    return netRequirements;
  }

  /**
   * Get current inventory levels for a material
   */
  private async getInventoryLevels(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<InventoryLevels> {
    const result = await this.pool.query(`
      SELECT
        COALESCE(SUM(CASE WHEN it.transaction_type IN ('RECEIPT', 'ADJUSTMENT')
                     THEN it.quantity
                     ELSE -it.quantity END), 0) AS on_hand_quantity,
        0 AS allocated_quantity -- TODO: Calculate from reservations
      FROM inventory_transactions it
      WHERE it.tenant_id = $1
        AND it.facility_id = $2
        AND it.material_id = $3
        AND it.status = 'COMPLETED'
    `, [tenantId, facilityId, materialId]);

    return result.rows[0];
  }

  /**
   * Get on-order schedule (existing POs and production orders)
   */
  private async getOnOrderSchedule(
    tenantId: string,
    facilityId: string,
    materialId: string
  ): Promise<OnOrderItem[]> {
    const result = await this.pool.query(`
      SELECT
        pol.material_id,
        pol.quantity_ordered - pol.quantity_received AS quantity,
        po.promised_delivery_date AS due_date
      FROM purchase_order_lines pol
      JOIN purchase_orders po ON po.id = pol.purchase_order_id
      WHERE pol.tenant_id = $1
        AND po.facility_id = $2
        AND pol.material_id = $3
        AND pol.status IN ('OPEN', 'PARTIALLY_RECEIVED')
        AND po.status NOT IN ('CANCELLED', 'CLOSED')

      UNION ALL

      SELECT
        prod_ord.product_id AS material_id,
        prod_ord.quantity_ordered - prod_ord.quantity_completed AS quantity,
        prod_ord.planned_completion_date AS due_date
      FROM production_orders prod_ord
      WHERE prod_ord.tenant_id = $1
        AND prod_ord.facility_id = $2
        AND prod_ord.product_id = $3
        AND prod_ord.status IN ('PLANNED', 'RELEASED', 'IN_PROGRESS')

      ORDER BY due_date
    `, [tenantId, facilityId, materialId]);

    return result.rows;
  }
}
```

---

### 3.3 GraphQL API Design

```graphql
type MRPRun {
  id: ID!
  runNumber: String!
  runType: MRPRunType!
  runStartTimestamp: DateTime!
  runEndTimestamp: DateTime
  runDurationSeconds: Int
  planningHorizonDays: Int!
  totalMaterialsProcessed: Int
  totalPlannedOrdersGenerated: Int
  totalActionMessagesGenerated: Int
  status: MRPRunStatus!
  errorMessage: String
}

enum MRPRunType {
  REGENERATIVE
  NET_CHANGE
  SIMULATION
}

enum MRPRunStatus {
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

type PlannedOrder {
  id: ID!
  plannedOrderNumber: String!
  orderType: PlannedOrderType!
  material: Material!
  quantity: Float!
  unitOfMeasure: String!
  requiredDate: Date!
  orderDate: Date!
  vendor: Vendor
  workCenter: WorkCenter
  estimatedUnitCost: Float
  estimatedTotalCost: Float
  lotSizingMethod: LotSizingMethod!
  status: PlannedOrderStatus!
  pegging: [PeggingRecord!]!
}

enum PlannedOrderType {
  PURCHASE
  PRODUCTION
  TRANSFER
}

enum PlannedOrderStatus {
  PLANNED
  FIRMED
  CONVERTED
  CANCELLED
}

enum LotSizingMethod {
  LOT_FOR_LOT
  FIXED_ORDER_QUANTITY
  EOQ
  PERIOD_ORDER_QUANTITY
  MIN_MAX
}

type PeggingRecord {
  id: ID!
  plannedOrder: PlannedOrder!
  material: Material!
  requiredQuantity: Float!
  requiredDate: Date!
  demandSourceType: DemandSourceType!
  salesOrder: SalesOrder
  productionOrder: ProductionOrder
  parentPlannedOrder: PlannedOrder
  peggingLevel: Int!
}

enum DemandSourceType {
  SALES_ORDER
  PRODUCTION_ORDER
  FORECAST
  SAFETY_STOCK
  PARENT_PLANNED_ORDER
}

type ActionMessage {
  id: ID!
  actionMessageNumber: String!
  actionType: ActionType!
  orderType: String!
  material: Material!
  currentQuantity: Float
  recommendedQuantity: Float
  currentDueDate: Date
  recommendedDueDate: Date
  impactLevel: ImpactLevel!
  affectedSalesOrders: [SalesOrderImpact!]!
  reasonCode: String!
  reasonDescription: String
  status: ActionMessageStatus!
  reviewedBy: User
  reviewedAt: DateTime
  reviewNotes: String
}

enum ActionType {
  EXPEDITE
  DE_EXPEDITE
  INCREASE_QUANTITY
  DECREASE_QUANTITY
  CANCEL
  NEW_ORDER
}

enum ImpactLevel {
  CRITICAL
  HIGH
  MEDIUM
  LOW
}

enum ActionMessageStatus {
  PENDING
  APPROVED
  REJECTED
  EXECUTED
  CANCELLED
}

type SalesOrderImpact {
  salesOrderNumber: String!
  customerName: String!
  dueDate: Date!
  impactDescription: String
}

input RunMRPInput {
  tenantId: ID!
  facilityId: ID!
  runType: MRPRunType!
  materialIds: [ID!]
  planningHorizonDays: Int
}

type RunMRPResult {
  mrpRun: MRPRun!
  plannedOrders: [PlannedOrder!]!
  actionMessages: [ActionMessage!]!
}

input FirmPlannedOrderInput {
  plannedOrderId: ID!
  convertToPurchaseOrder: Boolean
  convertToProductionOrder: Boolean
}

type FirmPlannedOrderResult {
  plannedOrder: PlannedOrder!
  purchaseOrder: PurchaseOrder
  productionOrder: ProductionOrder
}

input ExecuteActionMessageInput {
  actionMessageId: ID!
  approved: Boolean!
  reviewNotes: String
}

type Mutation {
  runMRP(input: RunMRPInput!): RunMRPResult!
  firmPlannedOrder(input: FirmPlannedOrderInput!): FirmPlannedOrderResult!
  bulkFirmPlannedOrders(plannedOrderIds: [ID!]!): [FirmPlannedOrderResult!]!
  executeActionMessage(input: ExecuteActionMessageInput!): ActionMessage!
  bulkExecuteActionMessages(inputs: [ExecuteActionMessageInput!]!): [ActionMessage!]!
}

type Query {
  mrpRuns(
    tenantId: ID!
    facilityId: ID!
    limit: Int
    offset: Int
  ): [MRPRun!]!

  mrpRun(id: ID!): MRPRun

  plannedOrders(
    tenantId: ID!
    facilityId: ID!
    materialId: ID
    status: PlannedOrderStatus
    orderType: PlannedOrderType
    limit: Int
    offset: Int
  ): [PlannedOrder!]!

  actionMessages(
    tenantId: ID!
    facilityId: ID!
    status: ActionMessageStatus
    impactLevel: ImpactLevel
    materialId: ID
    limit: Int
    offset: Int
  ): [ActionMessage!]!

  materialPegging(
    materialId: ID!
    requiredDate: Date
  ): [PeggingRecord!]!

  salesOrderPegging(
    salesOrderId: ID!
  ): [PeggingRecord!]!
}
```

---

## 4. IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1-2)
**Goal:** Database schema and basic BOM explosion.

**Tasks:**
1. Create migration for MRP tables:
   - mrp_runs
   - planned_orders
   - mrp_pegging
   - mrp_action_messages
   - Extend materials table with MRP configuration

2. Implement BOMExplosionService:
   - Recursive BOM explosion algorithm
   - Scrap percentage calculations
   - Lead time offsetting
   - Multi-level traversal (DFS)

3. Unit tests for BOM explosion:
   - Single-level BOM
   - Multi-level BOM (5 levels deep)
   - Scrap percentage handling
   - Phantom assembly handling

**Deliverables:**
- Migration file: `V0.0.XX__create_mrp_engine_tables.sql`
- Service: `bom-explosion.service.ts`
- Test: `bom-explosion.service.spec.ts`

### Phase 2: Inventory Netting & Lot Sizing (Week 3)
**Goal:** Calculate net requirements and apply lot sizing rules.

**Tasks:**
1. Implement InventoryNettingService:
   - Inventory level queries
   - On-order schedule queries
   - Time-phased netting calculation
   - Projected on-hand simulation

2. Implement LotSizingService:
   - Lot-for-lot
   - Fixed order quantity
   - EOQ calculation
   - Period order quantity

3. Unit tests for inventory netting and lot sizing

**Deliverables:**
- Service: `inventory-netting.service.ts`
- Service: `lot-sizing.service.ts`
- Tests

### Phase 3: MRP Engine Integration (Week 4)
**Goal:** Orchestrate complete MRP run.

**Tasks:**
1. Implement MRPEngineService:
   - MRP run orchestration
   - Demand source aggregation
   - Planned order generation
   - MRP run status tracking

2. Implement MRPIntegrationService:
   - Integration with ForecastingService
   - Integration with sales orders
   - Demand consumption logic

3. End-to-end integration tests

**Deliverables:**
- Service: `mrp-engine.service.ts`
- Service: `mrp-integration.service.ts`
- Integration tests

### Phase 4: Pegging & Action Messages (Week 5)
**Goal:** Track demand sources and generate planner recommendations.

**Tasks:**
1. Implement PeggingService:
   - Multi-level pegging record generation
   - Where-used queries
   - Impact analysis

2. Implement ActionMessageService:
   - Compare planned vs firm orders
   - Generate exception messages
   - Priority/impact scoring

3. Unit tests for pegging and action messages

**Deliverables:**
- Service: `pegging.service.ts`
- Service: `action-message.service.ts`
- Tests

### Phase 5: GraphQL API (Week 6)
**Goal:** Expose MRP functionality via GraphQL.

**Tasks:**
1. Implement MRPResolver:
   - runMRP mutation
   - firmPlannedOrder mutation
   - executeActionMessage mutation
   - Query resolvers

2. Frontend integration planning document

3. API documentation

**Deliverables:**
- Resolver: `mrp.resolver.ts`
- GraphQL schema updates
- API documentation

### Phase 6: Testing & Performance Optimization (Week 7-8)
**Goal:** Production-ready MRP engine.

**Tasks:**
1. Performance testing:
   - 10,000 material MRP run benchmark
   - Multi-level BOM performance
   - Query optimization (indexes, explain plans)

2. Load testing:
   - Concurrent MRP runs per tenant
   - Large BOM explosion (20 levels)

3. Billy QA testing:
   - Functional test cases
   - Edge case testing
   - Error handling validation

**Deliverables:**
- Performance test report
- Optimized queries and indexes
- QA test report

---

## 5. INTEGRATION POINTS

### 5.1 Integration with Forecasting Module

**Existing Module:** `modules/forecasting`

**Integration Approach:**
- MRPIntegrationService will call ForecastingService.getMaterialForecasts()
- Forecasts will be used as independent demand for finished goods
- Demand consumption: When sales orders are entered, reduce forecasted demand
- Planning time fence: Within fence period, only use firm sales orders (no forecasts)

**Code Example:**
```typescript
// In MRPIntegrationService
async getDemandSources(tenantId: string, facilityId: string, horizonDays: number): Promise<DemandSource[]> {
  const demandSources: DemandSource[] = [];

  // 1. Get firm sales orders
  const salesOrders = await this.getSalesOrders(tenantId, facilityId, horizonDays);
  demandSources.push(...salesOrders.map(so => ({
    type: 'SALES_ORDER',
    productId: so.productId,
    quantity: so.quantity,
    dueDate: so.promisedDeliveryDate,
    priority: 'FIRM'
  })));

  // 2. Get forecasts for finished goods (outside planning time fence)
  const forecasts = await this.forecastingService.getMaterialForecasts(
    tenantId,
    facilityId,
    null, // all materials
    new Date(),
    new Date(Date.now() + horizonDays * 24 * 60 * 60 * 1000),
    ForecastStatus.ACTIVE
  );

  // Filter to finished goods only
  const finishedGoodsForecasts = forecasts.filter(f => f.materialType === 'FINISHED_GOOD');

  // Apply demand consumption
  const consumedForecasts = this.applyDemandConsumption(finishedGoodsForecasts, salesOrders);

  demandSources.push(...consumedForecasts.map(f => ({
    type: 'FORECAST',
    productId: f.materialId,
    quantity: f.forecastedDemandQuantity,
    dueDate: f.forecastDate,
    priority: 'FORECAST'
  })));

  return demandSources;
}
```

### 5.2 Integration with Procurement Module

**Existing Tables:** purchase_orders, purchase_order_lines, vendors, materials_suppliers

**Integration Approach:**
- PlannedOrderService.firmPlannedOrder() will convert planned purchase orders to firm POs
- Source determination: Select best vendor based on price, lead time, and performance
- Automatic PO creation for approved planned orders
- On-order tracking: Include firm POs in inventory netting calculation

**Code Example:**
```typescript
// In PlannedOrderService
async firmPlannedOrder(plannedOrderId: string): Promise<PurchaseOrder | ProductionOrder> {
  const plannedOrder = await this.getPlannedOrder(plannedOrderId);

  if (plannedOrder.orderType === 'PURCHASE') {
    // Create firm purchase order
    const vendor = await this.selectBestVendor(plannedOrder.materialId);

    const po = await this.pool.query(`
      INSERT INTO purchase_orders (
        tenant_id, facility_id, po_number, purchase_order_date,
        vendor_id, total_amount, status, po_currency_code
      ) VALUES ($1, $2, $3, $4, $5, $6, 'DRAFT', 'USD')
      RETURNING *
    `, [
      plannedOrder.tenantId,
      plannedOrder.facilityId,
      await this.generatePONumber(plannedOrder.tenantId),
      plannedOrder.orderDate,
      vendor.id,
      plannedOrder.estimatedTotalCost
    ]);

    // Create PO line
    await this.pool.query(`
      INSERT INTO purchase_order_lines (
        tenant_id, purchase_order_id, line_number, material_id,
        quantity_ordered, unit_of_measure, unit_price, line_amount,
        requested_delivery_date, status
      ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, 'OPEN')
    `, [
      plannedOrder.tenantId,
      po.rows[0].id,
      plannedOrder.materialId,
      plannedOrder.quantity,
      plannedOrder.unitOfMeasure,
      plannedOrder.estimatedUnitCost,
      plannedOrder.estimatedTotalCost,
      plannedOrder.requiredDate
    ]);

    // Update planned order status
    await this.updatePlannedOrderStatus(plannedOrderId, 'CONVERTED', po.rows[0].id);

    return po.rows[0];
  }

  // Similar logic for production orders
}
```

### 5.3 Integration with Production Planning

**Existing Tables:** production_orders, routing_templates, routing_operations

**Integration Approach:**
- MRP generates planned production orders for manufactured materials
- Planned production orders can be firmed to create actual production orders
- Routing determines operation-level material requirements and timing
- Backward scheduling from due date using routing operation lead times

**Code Example:**
```typescript
// In BOMExplosionService
async explodeBOMWithRouting(
  productId: string,
  quantity: number,
  dueDate: Date
): Promise<MaterialRequirement[]> {
  const requirements: MaterialRequirement[] = [];

  // Get routing for this product
  const routing = await this.getProductRouting(productId);

  if (routing) {
    // Backward schedule through routing operations
    let currentDate = dueDate;

    for (const operation of routing.operations.reverse()) {
      // Get materials consumed at this operation
      const operationMaterials = await this.getBOMComponentsForOperation(
        productId,
        operation.id
      );

      for (const material of operationMaterials) {
        const grossQuantity = quantity * material.quantityPerParent * (1 + material.scrapPercentage / 100);

        requirements.push({
          materialId: material.materialId,
          grossQuantity,
          requiredDate: currentDate,
          operationId: operation.id,
          operationSequence: operation.sequenceNumber
        });
      }

      // Offset by operation setup + run time
      const operationLeadTime = this.calculateOperationLeadTime(operation, quantity);
      currentDate = this.offsetDate(currentDate, -operationLeadTime);
    }
  }

  return requirements;
}
```

### 5.4 Integration with Inventory/WMS

**Existing Tables:** inventory_transactions, lots, inventory_locations

**Integration Approach:**
- InventoryNettingService queries current inventory levels from inventory_transactions
- Lot tracking: MRP can consider lot expiration dates for FEFO (First Expired, First Out)
- Reservation system: Hard allocate inventory to production orders (future enhancement)
- Cycle counting: MRP accuracy depends on inventory accuracy

**Code Example:**
```typescript
// In InventoryNettingService
async getInventoryLevelsWithLotTracking(
  tenantId: string,
  facilityId: string,
  materialId: string
): Promise<InventoryLevelsDetail> {
  // Get inventory by lot with expiration dates
  const result = await this.pool.query(`
    SELECT
      l.lot_number,
      l.current_quantity,
      l.available_quantity,
      l.allocated_quantity,
      l.expiration_date,
      l.quality_status,
      il.location_code
    FROM lots l
    JOIN inventory_locations il ON il.id = l.location_id
    WHERE l.tenant_id = $1
      AND l.facility_id = $2
      AND l.material_id = $3
      AND l.quality_status = 'RELEASED'
      AND l.is_active = TRUE
    ORDER BY l.expiration_date ASC NULLS LAST
  `, [tenantId, facilityId, materialId]);

  return {
    totalAvailable: result.rows.reduce((sum, r) => sum + r.available_quantity, 0),
    lotDetails: result.rows
  };
}
```

---

## 6. RISK ASSESSMENT

### 6.1 Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **BOM explosion performance degradation with deep BOMs (>10 levels)** | MEDIUM | HIGH | Implement caching, memoization, and parallel processing. Benchmark with 20-level test BOMs. |
| **Inventory netting accuracy issues with concurrent transactions** | MEDIUM | HIGH | Implement row-level locking for inventory queries. Use serializable isolation level for MRP runs. |
| **MRP run duration exceeds 5 minutes for large datasets** | HIGH | MEDIUM | Optimize queries with proper indexes. Implement incremental net change MRP. Use read replicas for reporting. |
| **Memory exhaustion with large requirement sets (100k+ requirements)** | LOW | HIGH | Process requirements in batches of 10,000. Stream results instead of loading all into memory. |
| **Deadlock issues with parallel MRP runs per tenant** | LOW | MEDIUM | Serialize MRP runs per tenant using Redis lock. Queue MRP jobs. |

### 6.2 Data Quality Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Inaccurate BOMs leading to incorrect material requirements** | HIGH | HIGH | Implement BOM validation rules. Require engineering approval for BOM changes. Track BOM version history. |
| **Inventory inaccuracy from poor cycle counting** | HIGH | HIGH | Implement automated cycle counting schedules. Generate action messages for large inventory variances. |
| **Incorrect lead times causing late deliveries** | MEDIUM | HIGH | Track actual vs promised delivery dates. Generate reports on vendor lead time accuracy. Auto-adjust lead times based on history. |
| **Outdated forecasts not reflecting current demand** | MEDIUM | MEDIUM | Automate forecast refresh on weekly basis. Alert planners when forecast accuracy drops below threshold. |

### 6.3 Integration Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| **Forecasting module changes breaking MRP integration** | LOW | MEDIUM | Use well-defined service interfaces. Implement integration tests. Version APIs. |
| **Sales order changes not triggering MRP recalculation** | MEDIUM | HIGH | Implement event-driven architecture with change listeners. Support manual MRP trigger. |
| **Concurrent PO creation from MRP and manual entry causing duplicates** | MEDIUM | MEDIUM | Implement duplicate detection logic. Use unique constraints on material + required date. |

---

## 7. SUCCESS METRICS

### 7.1 Performance Metrics

- **MRP Run Duration:** < 5 minutes for 10,000 materials
- **BOM Explosion Depth:** Support 20 levels without stack overflow
- **Action Message Generation:** < 30 seconds for 1,000 planned orders
- **Pegging Query Performance:** < 2 seconds for multi-level where-used query

### 7.2 Accuracy Metrics

- **Inventory Netting Accuracy:** 100% (zero phantom requirements)
- **Lead Time Calculation Accuracy:** ±0 days variance
- **BOM Explosion Accuracy:** 100% (correct gross requirements at all levels)

### 7.3 Business Metrics

- **Stock-out Reduction:** 30% reduction in material stock-outs
- **Inventory Carrying Cost Reduction:** 15% reduction via optimized lot sizing
- **Planner Productivity:** 50% reduction in manual planning time
- **On-Time Delivery Improvement:** 20% improvement in production order on-time completion

---

## 8. RECOMMENDATIONS

### 8.1 Immediate Next Steps

1. **Approve Schema Design** - Review and approve proposed database schema extensions (mrp_runs, planned_orders, mrp_pegging, mrp_action_messages)

2. **Assign to Roy (Backend)** - Implement Phase 1 (Foundation) database migrations and BOM explosion service

3. **Assign to Billy (QA)** - Prepare test cases for BOM explosion edge cases (deep BOMs, phantom assemblies, scrap percentages)

4. **Assign to Jen (Frontend)** - Design mockups for MRP planner dashboard (action messages, planned orders, pegging view)

### 8.2 Strategic Recommendations

1. **Start with Lot-for-Lot (Simple)** - Implement L4L lot sizing first, then add EOQ/POQ in Phase 2

2. **Incremental Rollout** - Deploy MRP for a single product family first (e.g., brochures), validate accuracy, then expand to all products

3. **Data Quality Initiative** - Run BOM validation and inventory accuracy assessments BEFORE MRP go-live

4. **Training Plan** - Develop planner training materials for interpreting action messages and firming planned orders

5. **KPI Dashboard** - Create real-time MRP performance dashboard (stock-outs, plan adherence, action message backlog)

---

## 9. CONCLUSION

The MRP Engine is a **critical capability** for the AGOG print industry ERP system. The existing schema and service architecture provide a **strong foundation** with comprehensive materials, BOMs, production orders, inventory, and forecasting infrastructure already in place.

**Key Gaps Identified:**
- MRP calculation engine and orchestration service
- Planned orders table (intermediate state before firming)
- Pegging table for demand source tracking
- Action message generation and workflow

**Implementation Complexity:** MEDIUM-HIGH
- Well-defined algorithms (BOM explosion, inventory netting, lot sizing)
- Complex integration with multiple modules (forecasting, procurement, production, inventory)
- Performance optimization required for large datasets

**Estimated Timeline:** 8 weeks (see Implementation Plan)

**Recommended Approach:**
- Phased implementation starting with core BOM explosion and inventory netting
- Incremental rollout by product family
- Heavy emphasis on data quality and testing
- Integration with existing forecasting and replenishment modules

---

## APPENDICES

### Appendix A: BOM Explosion Example

**Scenario:** Brochure (1000 qty) with 3-level BOM

```
Finished Good: BROCHURE-4C-8x11 (1000 qty, due 2025-02-15)
│
├─ Level 1: PAPER-80LB-GLOSS (1050 sheets, 5% scrap)
│   │  Required Date: 2025-02-12 (3 days lead time)
│   │  Net Requirement: 1050 - 500 on-hand = 550 sheets
│   │  → Planned PO for 550 sheets
│
├─ Level 1: INK-CYAN (2.5 lbs, 0% scrap)
│   ├─ Level 2: PIGMENT-CYAN (0.5 lbs)
│   │   Required Date: 2025-02-10 (2 days lead time)
│   │   → Planned PO for 0.5 lbs
│   └─ Level 2: CARRIER-BASE (2.0 lbs)
│       Required Date: 2025-02-10
│       → Planned PO for 2.0 lbs
│
└─ Level 1: FOLDING-OPERATION (1000 pieces)
    (No material requirement - labor operation only)
```

### Appendix B: Inventory Netting Example

**Material:** PAPER-80LB-GLOSS

| Date | Event | Gross Req | On-Hand | On-Order | Net Req | Action |
|------|-------|-----------|---------|----------|---------|--------|
| 2025-02-01 | Starting Inventory | - | 500 | 0 | - | - |
| 2025-02-05 | Existing PO Receipt | - | 500 | +200 | - | - |
| 2025-02-12 | Brochure Job #1 | 550 | 500 | 200 | 0 | (700 available > 550 needed) |
| 2025-02-15 | Brochure Job #2 | 800 | 150 | 0 | 650 | Planned PO for 650 sheets |

### Appendix C: Action Message Example

**Scenario:** Existing PO for 1000 sheets due 2025-02-20, but MRP calculates requirement for 1000 sheets on 2025-02-12

**Action Message:**
```
Action Type: EXPEDITE
Order: PO-12345 (1000 sheets, PAPER-80LB-GLOSS)
Current Due Date: 2025-02-20
Recommended Due Date: 2025-02-12
Impact: CRITICAL
Affected Sales Orders:
  - SO-56789 (ABC Corp, Brochure, due 2025-02-15)
  - SO-56790 (XYZ Inc, Business Cards, due 2025-02-16)
Reason: Production schedule requires material 8 days earlier
```

---

**END OF RESEARCH DELIVERABLE**
