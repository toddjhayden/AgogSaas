# Research Deliverable: Complete MRP Planned Order Generation & Inventory Netting

**Requirement ID**: REQ-STRATEGIC-AUTO-1767103864619
**Feature Title**: Complete MRP Planned Order Generation & Inventory Netting
**Researcher**: Cynthia (Research Analyst)
**Date**: 2025-12-30
**Status**: COMPLETE

---

## Executive Summary

This research deliverable provides a comprehensive analysis of the **Material Requirements Planning (MRP) Engine** implementation for planned order generation and inventory netting. The system is **substantially complete** with core functionality implemented across database schema, service layer, and type definitions. The implementation follows industry-standard MRP algorithms with batch-optimized queries and proper architectural patterns.

### Key Findings

✅ **COMPLETE**: Database schema for MRP runs, planned orders, pegging, and action messages
✅ **COMPLETE**: BOM explosion service with iterative BFS algorithm
✅ **COMPLETE**: Inventory netting service with batch-optimized queries
✅ **COMPLETE**: Lot sizing service (3 of 5 methods implemented)
✅ **COMPLETE**: Planned order service with automatic sequencing
⏳ **PHASE 2**: MRP orchestrator service (main execution controller)
⏳ **PHASE 2**: Period Order Quantity and Min-Max lot sizing methods
⏳ **PHASE 2**: Action message generation service
⏳ **PHASE 2**: Capacity Requirements Planning (CRP) integration

---

## 1. DATABASE SCHEMA ANALYSIS

### 1.1 Core MRP Tables (Migration V0.0.41)

**Location**: `backend/migrations/V0.0.41__create_mrp_engine_tables.sql`

#### Table: `mrp_runs`
**Purpose**: Track MRP execution history and results

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key (uuid_generate_v7()) |
| `run_number` | VARCHAR(50) | Unique run identifier |
| `run_type` | VARCHAR(20) | REGENERATIVE, NET_CHANGE, SIMULATION |
| `run_start_timestamp` | TIMESTAMPTZ | Execution start time |
| `run_end_timestamp` | TIMESTAMPTZ | Execution end time |
| `planning_horizon_days` | INTEGER | Planning period (1-365 days) |
| `material_ids` | UUID[] | Scope (null = all materials) |
| `total_materials_processed` | INTEGER | Count of materials processed |
| `total_planned_orders_generated` | INTEGER | Count of orders created |
| `total_action_messages_generated` | INTEGER | Count of recommendations |
| `status` | VARCHAR(20) | RUNNING, COMPLETED, COMPLETED_WITH_WARNINGS, FAILED, CANCELLED |
| `inventory_snapshot_timestamp` | TIMESTAMPTZ | Snapshot time for auditability |

**Indexes**:
- `idx_mrp_runs_tenant_facility` - Tenant/facility lookup
- `idx_mrp_runs_status` - Filter by status (RUNNING, FAILED)
- `idx_mrp_runs_timestamp` - Chronological sorting
- `idx_mrp_runs_facility_status` - Composite for reporting

**Security**: Row-Level Security (RLS) enabled with tenant isolation

---

#### Table: `planned_orders`
**Purpose**: Store MRP-generated orders before firming to PO/production orders

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `planned_order_number` | VARCHAR(50) | Format: PL-PO-YYYYMM-NNNNN or PL-PR-YYYYMM-NNNNN |
| `order_type` | VARCHAR(20) | PURCHASE, PRODUCTION, TRANSFER |
| `material_id` | UUID | Material to order |
| `quantity` | DECIMAL(18,4) | Order quantity (must be > 0) |
| `required_date` | DATE | When material is needed |
| `order_date` | DATE | When order should be placed (required_date - lead_time) |
| `vendor_id` | UUID | Preferred vendor (for PURCHASE orders) |
| `work_center_id` | UUID | Manufacturing location (for PRODUCTION orders) |
| `estimated_unit_cost` | DECIMAL(18,4) | Estimated cost per unit |
| `estimated_total_cost` | DECIMAL(18,4) | Total estimated cost |
| `lot_sizing_method` | VARCHAR(30) | LOT_FOR_LOT, FIXED_ORDER_QUANTITY, EOQ, etc. |
| `status` | VARCHAR(20) | PLANNED, FIRMED, CONVERTED, CANCELLED |
| `firmed_at` | TIMESTAMPTZ | When order was firmed |
| `converted_to_po_id` | UUID | Link to purchase order if converted |
| `converted_to_production_order_id` | UUID | Link to production order if converted |

**Indexes**:
- `idx_planned_orders_material` - Material lookup
- `idx_planned_orders_status` - Status filtering
- `idx_planned_orders_required_date` - Date-based queries
- `idx_planned_orders_material_status` - Composite for material status queries

**Constraints**:
- `chk_planned_order_dates` - Ensures order_date <= required_date
- Unique constraint on `planned_order_number` per tenant

**Security**: Row-Level Security (RLS) enabled

---

#### Table: `mrp_pegging`
**Purpose**: Track demand sources for material requirements (where-used analysis)

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `planned_order_id` | UUID | Planned order being pegged |
| `material_id` | UUID | Material required |
| `required_quantity` | DECIMAL(18,4) | Quantity needed |
| `demand_source_type` | VARCHAR(30) | SALES_ORDER, PRODUCTION_ORDER, FORECAST, SAFETY_STOCK, PARENT_PLANNED_ORDER |
| `sales_order_id` | UUID | Link to sales order (if applicable) |
| `sales_order_line_id` | UUID | Specific line item |
| `production_order_id` | UUID | Link to production order |
| `forecast_id` | UUID | Link to forecast entry |
| `parent_planned_order_id` | UUID | Parent planned order (for multi-level BOMs) |
| `pegging_level` | INTEGER | Depth in BOM (0 = top-level demand, max 50) |

**Indexes**:
- `idx_mrp_pegging_material_run` - Material + run composite
- `idx_mrp_pegging_sales_order_level` - Sales order traceability
- `idx_mrp_pegging_tenant_level` - Tenant + level queries

**Purpose**: Enables impact analysis (e.g., "Which sales orders will be affected if this material is delayed?")

---

#### Table: `mrp_action_messages`
**Purpose**: Store planner recommendations for expediting, cancellation, quantity changes

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `action_message_number` | VARCHAR(50) | Unique identifier |
| `action_type` | VARCHAR(30) | EXPEDITE, DE_EXPEDITE, INCREASE_QUANTITY, DECREASE_QUANTITY, CANCEL, NEW_ORDER, CAPACITY_WARNING |
| `order_type` | VARCHAR(20) | PURCHASE_ORDER, PRODUCTION_ORDER, PLANNED_ORDER, WORK_CENTER |
| `material_id` | UUID | Material affected |
| `current_quantity` | DECIMAL(18,4) | Current order quantity |
| `recommended_quantity` | DECIMAL(18,4) | Recommended quantity |
| `current_due_date` | DATE | Current due date |
| `recommended_due_date` | DATE | Recommended due date |
| `impact_level` | VARCHAR(20) | CRITICAL, HIGH, MEDIUM, LOW |
| `affected_sales_orders` | JSONB | Array of impacted sales orders with customer info |
| `reason_code` | VARCHAR(50) | Categorization code |
| `reason_description` | TEXT | Human-readable explanation |
| `status` | VARCHAR(20) | PENDING, APPROVED, REJECTED, EXECUTED, CANCELLED |
| `reviewed_by` | UUID | User who reviewed |
| `executed_by` | UUID | User who executed |

**Indexes**:
- `idx_mrp_action_msgs_status_impact` - Composite for priority filtering

**Workflow**: PENDING → APPROVED/REJECTED → EXECUTED/CANCELLED

---

#### Materialized View: `planned_orders_summary`
**Purpose**: Fast aggregated reporting by material

Aggregates:
- Order count
- Total quantity
- Date ranges (earliest/latest required date)
- Total estimated cost

Grouped by: Tenant, Facility, Material, Order Type, Status

**Refresh Strategy**: Manual refresh via `REFRESH MATERIALIZED VIEW CONCURRENTLY`

---

### 1.2 Material Master Enhancements

**New MRP Configuration Fields**:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `mrp_type` | VARCHAR(20) | 'MRP' | MRP (standard), MPS (master schedule), NONE |
| `lot_sizing_method` | VARCHAR(30) | 'LOT_FOR_LOT' | Default lot sizing approach |
| `fixed_order_quantity` | DECIMAL(18,4) | NULL | For FIXED_ORDER_QUANTITY method |
| `period_order_quantity_days` | INTEGER | 30 | Days of demand to cover (POQ method) |
| `safety_lead_time_days` | INTEGER | 0 | Buffer time (0-365 days) |
| `planning_time_fence_days` | INTEGER | 0 | Firm order period (0-180 days) |
| `is_phantom` | BOOLEAN | FALSE | Phantom assemblies (not stocked, exploded) |
| `yield_percentage` | DECIMAL(8,4) | 100.0 | Overall yield for scrap calculations |

**Index**: `idx_materials_mrp_config` on (mrp_type, is_phantom) where mrp_type != 'NONE'

---

### 1.3 Bill of Materials (BOM) Structure

**Location**: `backend/database/schemas/sales-materials-procurement-module.sql`

#### Table: `bill_of_materials`

| Column | Description |
|--------|-------------|
| `parent_product_id` | Parent product being manufactured |
| `component_material_id` | Component material required |
| `quantity_per_parent` | Quantity of component per 1 unit of parent |
| `scrap_percentage` | Scrap allowance (default 0%) |
| `sequence_number` | Manufacturing sequence |
| `operation_number` | Which operation consumes this component |
| `is_substitutable` | Can be substituted with alternative |
| `substitute_material_id` | Alternative material |
| `effective_from` | Effective start date |
| `effective_to` | Effective end date |
| `is_active` | Active flag |

**Features**:
- Multi-level BOM support (unlimited depth)
- Effective dating for BOM versioning
- Substitution support
- Operation-level material requirements
- Scrap allowance at component level

---

### 1.4 Inventory Transactions (WMS Integration)

**Location**: `backend/database/schemas/wms-module.sql`

#### Table: `inventory_transactions`

Transaction Types:
- RECEIPT (from PO)
- ISSUE (to production/sales)
- TRANSFER (location to location)
- ADJUSTMENT (cycle count, damage)
- CYCLE_COUNT
- RETURN (customer return)
- SCRAP

**Key Fields**:
- `quantity` - Transaction quantity
- `lot_id` - Lot-level tracking
- `from_location_id` / `to_location_id` - Movement tracking
- `reference_type` / `reference_id` - Source document linkage
- `cost_per_unit` - Financial integration
- `status` - PENDING, COMPLETED, REVERSED

**Used by Inventory Netting Service** to calculate on-hand quantities

---

#### Table: `lots`

| Column | Description |
|--------|-------------|
| `lot_number` | Unique lot identifier |
| `original_quantity` | Initial quantity received |
| `current_quantity` | Current on-hand |
| `available_quantity` | Available for allocation |
| `allocated_quantity` | Reserved for orders |
| `quality_status` | QUARANTINE, PENDING_INSPECTION, RELEASED, REJECTED, HOLD |
| `expiration_date` | Expiration tracking |
| `certifications` | JSONB (FDA, FSC, etc.) |
| `vendor_lot_number` | Supplier's lot number |

**Purpose**: Enables lot-level tracking and FIFO/expiration-based allocation

---

### 1.5 Production Orders (Operations Integration)

**Location**: `backend/database/schemas/operations-module.sql`

#### Table: `production_orders`

| Column | Description |
|--------|-------------|
| `product_id` | Product being manufactured |
| `quantity_ordered` | Quantity to produce |
| `quantity_completed` | Quantity finished |
| `quantity_scrapped` | Scrap quantity |
| `planned_start_date` | Start date |
| `planned_completion_date` | Due date |
| `manufacturing_strategy` | MTS, MTO, CTO, ETO, POD, VDP, LEAN, DIGITAL |
| `status` | PLANNED, RELEASED, IN_PROGRESS, COMPLETED, CANCELLED, ON_HOLD |
| `priority` | 1 (URGENT) to 10 (LOW) |
| `sales_order_id` | Link to sales order (for MTO) |

**Used by Inventory Netting Service** to calculate on-order supply

---

## 2. SERVICE LAYER IMPLEMENTATION

### 2.1 BOM Explosion Service

**File**: `backend/src/modules/mrp/services/bom-explosion.service.ts`
**Author**: Roy (Backend Developer)
**Requirement**: REQ-STRATEGIC-AUTO-1767084329264

#### Algorithm: Iterative Breadth-First Search (BFS)

**Why BFS instead of Recursion?**
- Prevents stack overflow with deep BOMs
- More predictable memory usage
- Easier to implement max depth safety checks

**Process Flow**:

```
1. Initialize queue with top-level product
2. While queue is not empty:
   a. Dequeue next BOM node
   b. Check for circular BOM (visited set)
   c. Check max depth (50 levels)
   d. Get BOM components from database
   e. For each component:
      - Calculate gross quantity (with scrap)
      - Offset required date by lead time
      - Create material requirement
      - Track pegging chain (traceability)
      - If manufactured (not phantom), enqueue for further explosion
3. Return array of all material requirements
```

**Key Features**:

1. **Circular BOM Detection**
   - Maintains visited set with `productId-level` key
   - Logs warning and continues if circular reference detected
   - Prevents infinite loops

2. **Scrap Percentage Calculation**
   ```
   grossQuantity = parentQuantity × quantityPerParent × (1 + scrapPercentage / 100)
   ```

3. **Lead Time Offsetting** (Backward Scheduling)
   ```
   requiredDate = parentDueDate - (leadTimeDays + safetyLeadTimeDays)
   ```

4. **Phantom Assembly Handling**
   - Phantom assemblies are exploded but not stocked
   - BOM components pass through to next level
   - Common for kitting or sub-assemblies

5. **Pegging Chain Tracking**
   - Maintains full traceability from top-level demand to component
   - Format: `[{productId, quantity}, {productId, quantity}, ...]`
   - Enables where-used analysis

**Database Query**:
- Single query per BOM level
- Filters by effective dates (effective_from, effective_to)
- Joins materials table to get lead times, manufacturability flags
- Orders by sequence_number for proper assembly order

**Error Handling**:
- `CIRCULAR_BOM` - Circular reference detected
- `MISSING_BOM` - No BOM found for product
- `MAX_DEPTH_EXCEEDED` - Exceeds 50-level limit
- `INVALID_LEAD_TIME` - Negative lead time
- `DATABASE_TIMEOUT` - Query timeout (retryable)

**Output**: Array of `MaterialRequirement` objects containing:
- Material ID and code
- Gross quantity (includes scrap)
- Required date (offset by lead time)
- Demand source information
- Pegging chain (full traceability)

---

### 2.2 Inventory Netting Service

**File**: `backend/src/modules/mrp/services/inventory-netting.service.ts`
**Author**: Roy (Backend Developer)
**Requirement**: REQ-STRATEGIC-AUTO-1767084329264

#### Purpose

Calculate **net material requirements** by netting gross requirements against:
- On-hand inventory
- Allocated inventory (reserved)
- On-order quantities (POs and production orders)

#### Batch Query Optimization

**Problem**: Naive approach would query each material individually (N+1 query problem)

**Solution**: Batch queries per Sylvia's recommendation

1. **BATCH QUERY 1**: Get all inventory levels in one query
   - Groups by material_id
   - Sums inventory transactions (RECEIPT, ADJUSTMENT, CYCLE_COUNT = positive; others = negative)
   - Returns map of material_id → {onHandQuantity, allocatedQuantity}

2. **BATCH QUERY 2**: Get all on-order schedules in one query
   - UNION of purchase orders and production orders
   - Filters: OPEN/PARTIALLY_RECEIVED purchase orders, PLANNED/RELEASED/IN_PROGRESS production orders
   - Returns map of material_id → array of {quantity, dueDate, orderType, orderId}

#### Netting Algorithm

```
For each material:
1. Get inventory levels (on-hand, allocated)
2. Get on-order schedule sorted by due date
3. Initialize projectedOnHand = onHand - allocated
4. For each gross requirement (sorted by date):
   a. Add receipts scheduled before this requirement
   b. Calculate netQuantity = max(0, grossQuantity - projectedOnHand)
   c. If netQuantity > 0, create net requirement
   d. Update projectedOnHand -= grossQuantity
```

**Example**:

```
Material: Paper Stock A
On-hand: 5,000 sheets
Allocated: 1,000 sheets
On-order: 10,000 sheets (due 2025-01-15)

Gross Requirements:
- 2025-01-10: 3,000 sheets (Job #123)
- 2025-01-20: 8,000 sheets (Job #456)

Netting Calculation:
Time         | Gross | Receipts | Projected | Net Req
-------------|-------|----------|-----------|--------
Start        |       |          | 4,000     |
2025-01-10   | 3,000 |          | 1,000     | 0 (covered by on-hand)
2025-01-20   | 8,000 | 10,000   | 3,000     | 0 (covered by on-order + on-hand)

Result: No net requirements (no orders needed)
```

#### Lot Tracking Support

**Method**: `getInventoryLevelsWithLotTracking()`

Returns:
- Total available quantity
- Array of lot details:
  - Lot number
  - Current quantity
  - Available quantity
  - Allocated quantity
  - Expiration date
  - Quality status (only RELEASED lots included)
  - Location code

**Use Case**: FIFO allocation, expiration-based picking

---

### 2.3 Lot Sizing Service

**File**: `backend/src/modules/mrp/services/lot-sizing.service.ts`
**Author**: Roy (Backend Developer)
**Requirement**: REQ-STRATEGIC-AUTO-1767084329264

#### Purpose

Apply lot sizing rules to net requirements to determine optimal order quantities.

#### Implemented Methods

##### 1. LOT_FOR_LOT (Default)
**Purpose**: Minimize inventory carrying costs

**Algorithm**:
```
quantity = netRequirement
if (quantity < minimumOrderQuantity) {
  quantity = minimumOrderQuantity
}
if (orderMultiple > 1) {
  quantity = ceil(quantity / orderMultiple) × orderMultiple
}
```

**Use Case**: Expensive materials, low-volume production, made-to-order items

---

##### 2. FIXED_ORDER_QUANTITY
**Purpose**: Simplify ordering with fixed batch sizes

**Algorithm**:
```
numOrders = ceil(netRequirement / fixedOrderQuantity)
quantity = numOrders × fixedOrderQuantity
```

**Use Case**: Standard container sizes, vendor-imposed quantities, manufacturing batch sizes

**Example**:
- Fixed order quantity: 500 units
- Net requirement: 1,200 units
- Result: 3 orders × 500 = 1,500 units

---

##### 3. ECONOMIC ORDER QUANTITY (EOQ)
**Purpose**: Balance ordering costs vs. holding costs

**Formula**:
```
EOQ = √(2 × D × S / H)

Where:
  D = Annual demand
  S = Order cost per order
  H = Holding cost per unit per year
```

**Algorithm**:
```
quantity = economicOrderQuantity (pre-calculated in material master)
if (netRequirement > quantity) {
  numOrders = ceil(netRequirement / quantity)
  quantity = numOrders × quantity
}
Apply minimumOrderQuantity constraint
Apply orderMultiple constraint
```

**Use Case**: High-volume, predictable demand items where both ordering and holding costs are significant

**Example**:
- EOQ: 1,000 units
- Net requirement: 2,500 units
- Result: 3 × 1,000 = 3,000 units

---

##### 4. PERIOD_ORDER_QUANTITY (Phase 2)
**Purpose**: Cover N periods of future demand

**Algorithm** (not yet implemented):
```
futureRequirements = getFutureRequirements(periodDays)
quantity = sum(futureRequirements)
```

**Use Case**: High setup costs, stable demand patterns

**Dependency**: Requires forecast integration

---

##### 5. MIN_MAX (Phase 2)
**Purpose**: Reorder to maximum when inventory drops below minimum

**Algorithm** (not yet implemented):
```
if (projectedOnHand < minimumLevel) {
  quantity = maximumLevel - projectedOnHand
}
```

**Use Case**: Maintenance inventory, spare parts, consumables

**Dependency**: Requires min/max configuration in material master

---

#### Batch Loading

**Method**: `getBatchLotSizingConfigs()`

- Single query for all materials
- Returns map of material_id → LotSizingConfig
- Config includes: method, fixedOrderQuantity, periodOrderQuantityDays, minimumOrderQuantity, orderMultiple, economicOrderQuantity

**Performance**: O(1) database queries regardless of number of materials (avoids N+1 problem)

---

### 2.4 Planned Order Service

**File**: `backend/src/modules/mrp/services/planned-order.service.ts`
**Author**: Roy (Backend Developer)
**Requirement**: REQ-STRATEGIC-AUTO-1767084329264

#### Purpose

Create planned orders (intermediate state before firming to PO/production orders)

#### Method: `bulkCreatePlannedOrders()`

**Process**:

```
BEGIN TRANSACTION
For each planned order input:
  1. Determine order type (PURCHASE vs PRODUCTION)
     - Check is_manufacturable flag
     - Check is_purchasable flag
     - Default: PURCHASE

  2. Calculate order date
     - orderDate = requiredDate - leadTimeDays

  3. Determine source
     - For PURCHASE: Get preferred vendor (shortest lead time)
     - For PRODUCTION: Identify work center (Phase 2)

  4. Estimate cost
     - Try vendor-specific pricing
     - Fall back to standard/average cost

  5. Get lot sizing method from material master

  6. Generate planned order number
     - Format: PL-PO-YYYYMM-NNNNN (purchase)
     - Format: PL-PR-YYYYMM-NNNNN (production)
     - Sequence number based on orders created this month

  7. Insert into database
     - Status: PLANNED
     - Ready for review and firming

COMMIT
```

#### Order Number Generation

**Format**: `{PREFIX}-{YYYYMM}-{NNNNN}`

- Prefix: PL-PO (planned purchase) or PL-PR (planned production)
- YYYYMM: Year and month
- NNNNN: Sequential number within month

**Example**: `PL-PO-202501-00042`

**Sequence Query**:
```sql
SELECT COUNT(*) + 1 AS next_seq
FROM planned_orders
WHERE tenant_id = $1
  AND order_type = $2
  AND EXTRACT(YEAR FROM created_at) = $3
  AND EXTRACT(MONTH FROM created_at) = $4
```

#### Order Type Determination

| Condition | Order Type |
|-----------|------------|
| is_manufacturable = TRUE, is_purchasable = FALSE | PRODUCTION |
| is_purchasable = TRUE | PURCHASE (preferred) |
| Both FALSE | PURCHASE (default) |

**Rationale**: Prefer purchasing over manufacturing to minimize lead time and cost

#### Vendor Selection

**Query**:
```sql
SELECT vendor_id
FROM materials_suppliers
WHERE material_id = $1 AND is_preferred = TRUE
ORDER BY lead_time_days ASC
LIMIT 1
```

**Logic**: Prefer vendor marked as preferred with shortest lead time

#### Cost Estimation

1. **Try vendor-specific pricing**:
   ```sql
   SELECT unit_price
   FROM materials_suppliers
   WHERE material_id = $1 AND vendor_id = $2
   ```

2. **Fall back to material cost**:
   ```sql
   SELECT COALESCE(standard_cost, average_cost, 0) AS cost
   FROM materials
   WHERE id = $1
   ```

#### Transaction Safety

- Uses `BEGIN` / `COMMIT` / `ROLLBACK`
- If any planned order fails, entire batch is rolled back
- Ensures data consistency

---

## 3. TYPE DEFINITIONS

**File**: `backend/src/modules/mrp/dto/mrp-types.ts`
**Purpose**: Type-safe TypeScript definitions for MRP engine

### 3.1 Enumerations

```typescript
export enum MRPRunType {
  REGENERATIVE = 'REGENERATIVE',    // Full recalculation
  NET_CHANGE = 'NET_CHANGE',        // Incremental update
  SIMULATION = 'SIMULATION',        // What-if scenario
}

export enum PlannedOrderType {
  PURCHASE = 'PURCHASE',
  PRODUCTION = 'PRODUCTION',
  TRANSFER = 'TRANSFER',
}

export enum PlannedOrderStatus {
  PLANNED = 'PLANNED',
  FIRMED = 'FIRMED',
  CONVERTED = 'CONVERTED',
  CANCELLED = 'CANCELLED',
}

export enum LotSizingMethod {
  LOT_FOR_LOT = 'LOT_FOR_LOT',
  FIXED_ORDER_QUANTITY = 'FIXED_ORDER_QUANTITY',
  EOQ = 'EOQ',
  PERIOD_ORDER_QUANTITY = 'PERIOD_ORDER_QUANTITY',
  MIN_MAX = 'MIN_MAX',
}

export enum DemandSourceType {
  SALES_ORDER = 'SALES_ORDER',
  PRODUCTION_ORDER = 'PRODUCTION_ORDER',
  FORECAST = 'FORECAST',
  SAFETY_STOCK = 'SAFETY_STOCK',
  PARENT_PLANNED_ORDER = 'PARENT_PLANNED_ORDER',
}

export enum ActionType {
  EXPEDITE = 'EXPEDITE',
  DE_EXPEDITE = 'DE_EXPEDITE',
  INCREASE_QUANTITY = 'INCREASE_QUANTITY',
  DECREASE_QUANTITY = 'DECREASE_QUANTITY',
  CANCEL = 'CANCEL',
  NEW_ORDER = 'NEW_ORDER',
  CAPACITY_WARNING = 'CAPACITY_WARNING',
}

export enum ImpactLevel {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export enum MRPErrorCode {
  CIRCULAR_BOM = 'CIRCULAR_BOM',
  INVALID_LEAD_TIME = 'INVALID_LEAD_TIME',
  MISSING_BOM = 'MISSING_BOM',
  INVENTORY_QUERY_FAILED = 'INVENTORY_QUERY_FAILED',
  DATABASE_TIMEOUT = 'DATABASE_TIMEOUT',
  CONCURRENCY_CONFLICT = 'CONCURRENCY_CONFLICT',
  MAX_DEPTH_EXCEEDED = 'MAX_DEPTH_EXCEEDED',
}
```

### 3.2 Key Interfaces

#### BOMComponent
```typescript
interface BOMComponent {
  id: string;
  materialId: string;
  materialCode: string;
  quantityPerParent: number;
  scrapPercentage: number;
  leadTimeDays: number;
  safetyLeadTimeDays: number;
  isManufactured: boolean;
  isPhantom: boolean;
  sequenceNumber: number;
}
```

#### MaterialRequirement
```typescript
interface MaterialRequirement {
  mrpRunId: string;
  materialId: string;
  materialCode: string;
  grossQuantity: number;
  requiredDate: Date;
  demandSource: {
    type: string;
    productId: string;
    parentQuantity: number;
    bomLevel: number;
  };
  peggingChain: PeggingChainItem[];
}
```

#### NetRequirement
```typescript
interface NetRequirement {
  materialId: string;
  materialCode: string;
  grossQuantity: number;
  projectedOnHand: number;
  netQuantity: number;
  requiredDate: Date;
  peggingChain: PeggingChainItem[];
}
```

#### PlannedOrderResult
```typescript
interface PlannedOrderResult {
  id: string;
  plannedOrderNumber: string;
  orderType: PlannedOrderType;
  materialId: string;
  materialCode: string;
  quantity: number;
  unitOfMeasure: string;
  requiredDate: Date;
  orderDate: Date;
  vendorId?: string;
  workCenterId?: string;
  estimatedUnitCost: number;
  estimatedTotalCost: number;
  lotSizingMethod: LotSizingMethod;
  status: PlannedOrderStatus;
}
```

---

## 4. ARCHITECTURAL PATTERNS

### 4.1 Performance Optimizations

1. **Batch Queries** (per Sylvia's recommendation)
   - Single query for multiple materials
   - Avoids N+1 query problem
   - Maps results by material_id

2. **Iterative Algorithms** (no recursion)
   - Prevents stack overflow
   - Predictable memory usage
   - Easier to debug

3. **Composite Indexes**
   - `idx_mrp_pegging_material_run` for material + run queries
   - `idx_mrp_action_msgs_status_impact` for priority filtering
   - `idx_planned_orders_material_status` for material status queries

4. **Materialized Views**
   - `planned_orders_summary` for fast aggregated reporting
   - Refreshed manually via `REFRESH MATERIALIZED VIEW CONCURRENTLY`

### 4.2 Data Integrity

1. **Row-Level Security (RLS)**
   - All tables have tenant isolation policies
   - Uses `current_setting('app.current_tenant_id', TRUE)`
   - Prevents cross-tenant data leakage

2. **Transactional Integrity**
   - Planned order creation uses `BEGIN` / `COMMIT` / `ROLLBACK`
   - All-or-nothing for batch operations

3. **Foreign Key Constraints**
   - CASCADE on tenant/facility deletes
   - SET NULL on vendor/work center deletes
   - Prevents orphaned records

4. **Check Constraints**
   - Quantity must be > 0
   - Planning horizon 1-365 days
   - Pegging level 0-50
   - order_date <= required_date

### 4.3 Error Handling

1. **Custom MRPEngineError Class**
   - Error code categorization
   - Product/material context
   - Retryable flag

2. **Logging**
   - NestJS Logger service
   - Structured logging with context
   - Performance metrics (nodes processed, requirements generated)

3. **Graceful Degradation**
   - Falls back to LOT_FOR_LOT if config missing
   - Continues processing if non-critical errors
   - Returns warnings with results

---

## 5. INTEGRATION POINTS

### 5.1 Sales Module
- Sales order → demand source for MRP
- Sales order lines → pegging targets
- Customer due dates → required dates

### 5.2 Procurement Module
- Vendor master → preferred vendor selection
- Materials_suppliers → vendor-specific pricing, lead times
- Purchase orders → on-order supply

### 5.3 Operations Module
- Production orders → on-order supply
- Work centers → capacity planning (Phase 2)
- Routings → operation-level material requirements (Phase 2)

### 5.4 WMS Module
- Inventory transactions → on-hand calculations
- Lots → lot-level tracking, FIFO allocation
- Inventory locations → location-based planning (Phase 2)

### 5.5 Finance Module
- Material costs → cost estimation
- Standard cost vs. average cost → costing methods
- Estimated total cost → budgeting

---

## 6. GAPS & PHASE 2 REQUIREMENTS

### 6.1 Missing Components

#### 1. MRP Orchestrator Service (CRITICAL)
**Purpose**: Main controller that orchestrates the entire MRP run

**Required Methods**:
```typescript
async runMRP(
  tenantId: string,
  facilityId: string,
  options: MRPRunOptions
): Promise<MRPRunResult>
```

**Process Flow**:
```
1. Create MRP run record (status: RUNNING)
2. Get demand sources (sales orders, forecasts, safety stock)
3. For each demand source:
   a. Call BOMExplosionService.explodeBOM()
   b. Call InventoryNettingService.calculateNetRequirements()
   c. Call LotSizingService.applyLotSizing()
   d. Call PlannedOrderService.bulkCreatePlannedOrders()
4. Generate action messages for existing orders
5. Update MRP run record (status: COMPLETED)
6. Refresh planned_orders_summary materialized view
7. Return MRP run results
```

**Dependencies**:
- BOMExplosionService ✅ (exists)
- InventoryNettingService ✅ (exists)
- LotSizingService ✅ (exists)
- PlannedOrderService ✅ (exists)
- ActionMessageService ⏳ (Phase 2)
- DemandSourceService ⏳ (Phase 2)

---

#### 2. Action Message Service
**Purpose**: Generate planner recommendations

**Required Methods**:
```typescript
async generateActionMessages(
  mrpRunId: string,
  plannedOrders: PlannedOrderResult[]
): Promise<ActionMessageResult[]>
```

**Logic**:
- Compare planned orders to existing POs/production orders
- Detect: early/late due dates, quantity mismatches, excess orders
- Generate action messages with impact level
- Link to affected sales orders for impact analysis

**Action Types**:
- EXPEDITE: Order due date is later than requirement
- DE_EXPEDITE: Order due date is earlier than requirement
- INCREASE_QUANTITY: Order quantity less than requirement
- DECREASE_QUANTITY: Order quantity exceeds requirement
- CANCEL: Order has no corresponding requirement
- NEW_ORDER: Requirement has no corresponding order

---

#### 3. Demand Source Service
**Purpose**: Collect all demand sources for MRP

**Required Methods**:
```typescript
async getDemandSources(
  tenantId: string,
  facilityId: string,
  planningHorizon: number
): Promise<DemandSource[]>
```

**Sources**:
- Open sales orders (firm demand)
- Production orders (dependent demand)
- Demand forecasts (forecast demand)
- Safety stock requirements
- Inter-facility transfers

**Priority Handling**:
- Firm orders (sales orders, production orders) take precedence
- Forecasts only within planning time fence
- Safety stock as minimum level

---

#### 4. Capacity Requirements Planning (CRP)
**Purpose**: Validate that production capacity is available

**Required Methods**:
```typescript
async validateCapacity(
  plannedOrders: PlannedOrderResult[]
): Promise<CapacityFeasibility>
```

**Process**:
1. For each PRODUCTION planned order:
   a. Get routing (sequence of operations)
   b. For each operation:
      - Calculate required work center hours
      - Get available work center hours (calendar, shifts)
      - Calculate utilization percentage
2. Identify bottlenecks (utilization > 100%)
3. Generate capacity warning action messages

**Dependencies**:
- Routing integration ⏳ (Phase 2)
- Work center calendars ⏳ (Phase 2)
- Operation-level planning ⏳ (Phase 2)

---

#### 5. Period Order Quantity Lot Sizing
**Purpose**: Order to cover N periods of future demand

**Required Methods**:
```typescript
async periodOrderQuantity(
  materialId: string,
  netQuantity: number,
  requiredDate: Date,
  periodDays: number
): Promise<number>
```

**Dependencies**:
- Forecast integration ⏳ (Phase 2)
- Time-phased requirements ⏳ (Phase 2)

---

#### 6. Min-Max Lot Sizing
**Purpose**: Reorder to max when inventory drops below min

**Required Methods**:
```typescript
async minMaxLotSizing(
  materialId: string,
  projectedOnHand: number
): Promise<number>
```

**Dependencies**:
- Min/max configuration in materials table ⏳ (Phase 2)

---

### 6.2 GraphQL Resolvers & Module Definition

#### MRP Module File (Missing)
**File**: `backend/src/modules/mrp/mrp.module.ts`

```typescript
@Module({
  providers: [
    BOMExplosionService,
    InventoryNettingService,
    LotSizingService,
    PlannedOrderService,
    MRPOrchestratorService,  // Phase 2
    ActionMessageService,     // Phase 2
    DemandSourceService,      // Phase 2
  ],
  exports: [
    BOMExplosionService,
    InventoryNettingService,
    LotSizingService,
    PlannedOrderService,
  ],
})
export class MRPModule {}
```

#### GraphQL Schema (Missing)
**File**: `backend/src/graphql/schema/mrp.graphql`

```graphql
type MRPRun {
  id: ID!
  runNumber: String!
  runType: MRPRunType!
  status: MRPRunStatus!
  totalMaterialsProcessed: Int!
  totalPlannedOrdersGenerated: Int!
  totalActionMessagesGenerated: Int!
  runStartTimestamp: DateTime!
  runEndTimestamp: DateTime
  runDurationSeconds: Int
}

type PlannedOrder {
  id: ID!
  plannedOrderNumber: String!
  orderType: PlannedOrderType!
  material: Material!
  quantity: Float!
  requiredDate: Date!
  orderDate: Date!
  vendor: Vendor
  workCenter: WorkCenter
  estimatedUnitCost: Float!
  estimatedTotalCost: Float!
  status: PlannedOrderStatus!
}

type ActionMessage {
  id: ID!
  actionMessageNumber: String!
  actionType: ActionType!
  material: Material!
  currentQuantity: Float
  recommendedQuantity: Float
  currentDueDate: Date
  recommendedDueDate: Date
  impactLevel: ImpactLevel!
  affectedSalesOrders: [SalesOrder!]!
  reasonDescription: String
  status: ActionMessageStatus!
}

type MRPRunResult {
  mrpRun: MRPRun!
  plannedOrders: [PlannedOrder!]!
  actionMessages: [ActionMessage!]!
}

type Query {
  mrpRuns(facilityId: ID!, limit: Int, offset: Int): [MRPRun!]!
  plannedOrders(facilityId: ID!, status: PlannedOrderStatus): [PlannedOrder!]!
  actionMessages(facilityId: ID!, status: ActionMessageStatus): [ActionMessage!]!
}

type Mutation {
  runMRP(input: RunMRPInput!): MRPRunResult!
  firmPlannedOrder(id: ID!): PlannedOrder!
  convertPlannedOrder(id: ID!): ConversionResult!
  approveActionMessage(id: ID!, notes: String): ActionMessage!
  executeActionMessage(id: ID!): ActionMessage!
}

input RunMRPInput {
  facilityId: ID!
  runType: MRPRunType!
  planningHorizonDays: Int!
  materialIds: [ID!]
}
```

#### GraphQL Resolver (Missing)
**File**: `backend/src/graphql/resolvers/mrp.resolver.ts`

---

## 7. TESTING RECOMMENDATIONS

### 7.1 Unit Tests

1. **BOM Explosion Service**
   - Single-level BOM
   - Multi-level BOM (3+ levels)
   - Circular BOM detection
   - Max depth exceeded
   - Phantom assembly handling
   - Scrap percentage calculation
   - Lead time offsetting

2. **Inventory Netting Service**
   - Simple netting (on-hand covers requirement)
   - On-order coverage
   - Time-phased netting
   - Multiple requirements for same material
   - Lot tracking detail

3. **Lot Sizing Service**
   - LOT_FOR_LOT with MOQ
   - LOT_FOR_LOT with order multiple
   - FIXED_ORDER_QUANTITY
   - EOQ
   - Minimum order quantity constraint
   - Order multiple constraint

4. **Planned Order Service**
   - Order type determination (PURCHASE vs PRODUCTION)
   - Order date calculation
   - Vendor selection
   - Cost estimation
   - Order number generation
   - Transaction rollback on error

### 7.2 Integration Tests

1. **End-to-End MRP Run**
   - Sales order → BOM explosion → inventory netting → lot sizing → planned orders
   - Verify planned order quantities
   - Verify order dates
   - Verify pegging chain integrity

2. **Multi-Tenant Isolation**
   - Verify RLS policies prevent cross-tenant access
   - Verify planned orders belong to correct tenant

3. **Performance Tests**
   - 1,000 materials with 10,000 requirements
   - Measure BOM explosion time
   - Measure inventory netting time
   - Measure planned order creation time

### 7.3 Scenario Tests

1. **Make-to-Stock (MTS)**
   - Safety stock triggers planned orders
   - Forecast-driven planning

2. **Make-to-Order (MTO)**
   - Sales order triggers BOM explosion
   - Pegging to sales order line

3. **Multi-Level BOM**
   - Product → Sub-assembly → Component
   - Verify lead time offsets at each level

4. **Phantom Assembly**
   - Verify component pass-through
   - Verify no inventory planned for phantom

5. **Lot Sizing**
   - Verify LOT_FOR_LOT minimizes inventory
   - Verify EOQ balances costs
   - Verify FIXED_ORDER_QUANTITY uses batch sizes

---

## 8. DEPLOYMENT CONSIDERATIONS

### 8.1 Database Migration

**File**: `backend/migrations/V0.0.41__create_mrp_engine_tables.sql`

**Migration Steps**:
1. Run migration V0.0.41
2. Verify tables created: `mrp_runs`, `planned_orders`, `mrp_pegging`, `mrp_action_messages`
3. Verify materialized view: `planned_orders_summary`
4. Verify materials table alterations: MRP configuration columns added
5. Test RLS policies with tenant isolation
6. Verify indexes created

**Rollback Plan**:
```sql
DROP MATERIALIZED VIEW IF EXISTS planned_orders_summary;
DROP TABLE IF EXISTS mrp_action_messages;
DROP TABLE IF EXISTS mrp_pegging;
DROP TABLE IF EXISTS planned_orders;
DROP TABLE IF EXISTS mrp_runs;

ALTER TABLE materials DROP COLUMN IF EXISTS mrp_type;
ALTER TABLE materials DROP COLUMN IF EXISTS lot_sizing_method;
ALTER TABLE materials DROP COLUMN IF EXISTS fixed_order_quantity;
-- ... (drop all added columns)
```

### 8.2 Performance Tuning

1. **Materialized View Refresh**
   - Schedule: After each MRP run
   - Command: `REFRESH MATERIALIZED VIEW CONCURRENTLY planned_orders_summary`
   - Frequency: Hourly or on-demand

2. **Index Maintenance**
   - Monitor index usage with `pg_stat_user_indexes`
   - Drop unused indexes
   - Add indexes for slow queries

3. **Query Optimization**
   - Use `EXPLAIN ANALYZE` for slow queries
   - Optimize batch query sizes
   - Consider partitioning for large datasets

### 8.3 Monitoring

1. **MRP Run Metrics**
   - Run duration (seconds)
   - Materials processed
   - Planned orders generated
   - Action messages generated
   - Failure rate

2. **Performance Metrics**
   - BOM explosion time per product
   - Inventory netting time per material
   - Planned order creation time
   - Database query times

3. **Data Quality Metrics**
   - Circular BOMs detected
   - Missing BOMs
   - Invalid lead times
   - Database timeouts

---

## 9. BUSINESS VALUE

### 9.1 Operational Efficiency

1. **Automated Planning**
   - Eliminates manual material requirement calculations
   - Reduces planning cycle time from days to hours
   - Enables daily or on-demand MRP runs

2. **Inventory Optimization**
   - Lot sizing methods minimize carrying costs
   - Just-in-time planning with LOT_FOR_LOT
   - Batch ordering with FIXED_ORDER_QUANTITY/EOQ

3. **Visibility**
   - Pegging shows which sales orders drive material requirements
   - Action messages highlight problem orders
   - Projected on-hand prevents stockouts

### 9.2 Financial Impact

1. **Cost Reduction**
   - Reduced inventory carrying costs (15-30% typical savings)
   - Minimized expedite fees
   - Reduced obsolescence

2. **Revenue Protection**
   - Prevents stockouts that cause lost sales
   - Improves on-time delivery
   - Enhances customer satisfaction

3. **Working Capital**
   - Lower inventory investment
   - Better cash flow
   - Optimized order timing

### 9.3 Compliance & Traceability

1. **Pegging Chain**
   - Full traceability from sales order to component
   - Impact analysis for material shortages
   - Regulatory compliance (FDA, ISO)

2. **Audit Trail**
   - MRP run history
   - Inventory snapshots
   - Action message approvals/executions

---

## 10. IMPLEMENTATION RECOMMENDATIONS

### 10.1 Immediate Priorities (Phase 1 Completion)

1. **Create MRP Orchestrator Service** (1-2 weeks)
   - Implement `runMRP()` method
   - Wire up existing services (BOM, netting, lot sizing, planned orders)
   - Add basic demand source collection
   - Create MRP run record management

2. **Create MRP Module & GraphQL Schema** (1 week)
   - Define NestJS module with all services
   - Create GraphQL schema for MRP queries/mutations
   - Implement resolvers for `runMRP`, `plannedOrders`, `mrpRuns`

3. **Unit & Integration Tests** (1 week)
   - Test each service independently
   - End-to-end MRP run test
   - Performance benchmarking

4. **Documentation** (3 days)
   - API documentation for GraphQL
   - User guide for planners
   - Deployment guide

**Total Estimated Effort**: 3-4 weeks for one backend developer

---

### 10.2 Phase 2 Enhancements (Future)

1. **Action Message Service** (1 week)
   - Generate EXPEDITE/DE_EXPEDITE messages
   - Detect quantity mismatches
   - Link to affected sales orders

2. **Advanced Lot Sizing** (1 week)
   - Period Order Quantity (requires forecast integration)
   - Min-Max method (requires min/max configuration)

3. **Capacity Requirements Planning** (2-3 weeks)
   - Routing integration
   - Work center calendar support
   - Bottleneck analysis
   - Capacity warning messages

4. **Net-Change MRP** (1 week)
   - Incremental updates instead of full regeneration
   - Change tracking (material master, BOM, inventory)
   - Faster execution for large datasets

5. **Forecast Integration** (1-2 weeks)
   - Demand forecast as demand source
   - Forecast consumption
   - Planning time fence support

---

## 11. CONCLUSION

The MRP Planned Order Generation & Inventory Netting implementation is **substantially complete** with a solid foundation:

✅ **Comprehensive database schema** with proper indexing, constraints, and RLS
✅ **Four core services** (BOM explosion, inventory netting, lot sizing, planned orders)
✅ **Type-safe TypeScript** with comprehensive interfaces and enums
✅ **Performance-optimized** with batch queries and iterative algorithms
✅ **Production-ready architecture** with transactions, error handling, logging

The missing components are primarily **orchestration layer** (MRP orchestrator service, GraphQL resolvers) and **Phase 2 enhancements** (action messages, advanced lot sizing, CRP).

**Recommended Next Steps**:

1. Implement MRP Orchestrator Service to wire up existing components
2. Create NestJS module and GraphQL schema
3. Write comprehensive unit/integration tests
4. Deploy Phase 1 for user acceptance testing
5. Gather feedback and plan Phase 2 enhancements

This implementation positions the system for enterprise-grade material requirements planning with full traceability, multi-level BOM support, and sophisticated inventory netting algorithms.

---

## APPENDIX A: File Inventory

### Database Migrations
- ✅ `backend/migrations/V0.0.41__create_mrp_engine_tables.sql` (MRP tables)
- ✅ `backend/database/schemas/sales-materials-procurement-module.sql` (BOM table)
- ✅ `backend/database/schemas/operations-module.sql` (Production orders)
- ✅ `backend/database/schemas/wms-module.sql` (Inventory transactions, lots)

### TypeScript Services
- ✅ `backend/src/modules/mrp/dto/mrp-types.ts` (Type definitions)
- ✅ `backend/src/modules/mrp/services/bom-explosion.service.ts` (BOM explosion)
- ✅ `backend/src/modules/mrp/services/inventory-netting.service.ts` (Inventory netting)
- ✅ `backend/src/modules/mrp/services/lot-sizing.service.ts` (Lot sizing)
- ✅ `backend/src/modules/mrp/services/planned-order.service.ts` (Planned orders)
- ⏳ `backend/src/modules/mrp/services/mrp-orchestrator.service.ts` (Phase 2)
- ⏳ `backend/src/modules/mrp/services/action-message.service.ts` (Phase 2)
- ⏳ `backend/src/modules/mrp/services/demand-source.service.ts` (Phase 2)

### Module & GraphQL
- ⏳ `backend/src/modules/mrp/mrp.module.ts` (NestJS module)
- ⏳ `backend/src/graphql/schema/mrp.graphql` (GraphQL schema)
- ⏳ `backend/src/graphql/resolvers/mrp.resolver.ts` (GraphQL resolver)

---

## APPENDIX B: References

### Industry Standards
- APICS Dictionary (MRP terminology)
- ISO 9001 (Quality management, traceability)
- FDA 21 CFR Part 11 (Electronic records, audit trails)

### Algorithms
- BFS (Breadth-First Search) for BOM explosion
- EOQ (Economic Order Quantity) for lot sizing
- Backward scheduling for lead time offsetting

### Database Patterns
- Row-Level Security (RLS) for multi-tenancy
- Materialized views for performance
- Composite indexes for query optimization

---

**END OF RESEARCH DELIVERABLE**
