# AgogSaaS Module Architecture - Full Enterprise Suite

**📍 Navigation Path:** [AGOG Home](../README.md) → [Docs](./README.md) → Module Architecture

**For AI Agents:** This document defines ALL modules in AgogSaaS suite and their data flow patterns. Read this BEFORE building any feature.

**For Humans:** This is the complete AgogSaaS product suite architecture. One subscription gets you everything.

---

## Executive Summary (For Humans)

**AgogSaaS is a FULL enterprise suite** for packaging/printing manufacturing companies, similar to:
- SAP (but specialized for packaging)
- Microsoft 365 (one subscription, all apps)
- Salesforce (complete business platform)

**One Subscription → All Modules**

Customers pay one monthly fee and get:
- ✅ WMS (Warehouse Management System)
- ✅ Sales & CRM
- ✅ Finance & Accounting
- ✅ Operations Management
- ✅ Production Scheduling
- ✅ Real-Time Monitoring
- ✅ IoT Equipment Monitoring
- ✅ Quality Control
- ✅ Procurement
- ✅ Human Resources
- ✅ Business Intelligence / Analytics

**NOT** individual products - it's ONE integrated platform.

---

## Module Inventory (AI Agents: Read Carefully)

### 1. **WMS (Warehouse Management System)**
**Purpose:** Inventory, storage, picking, shipping
**Data Flow:** Local → Regional → Global (inventory aggregates UP)
**Key Entities:** `inventory_levels`, `storage_locations`, `inventory_transactions`, `lot_tracking`
**Naming Pattern:** `inventory_*`, `storage_*`, `lot_*`, `warehouse_*`

### 2. **Sales & CRM**
**Purpose:** Customer management, quotes, orders, demand planning
**Data Flow:** **Global → Regional → Facility** (demand flows DOWN)
**Key Entities:** `customers`, `sales_orders`, `quotes`, `demand_forecasts`
**Naming Pattern:** `sales_*`, `customer_*`, `quote_*`, `order_*`

**CRITICAL:** Sales is GLOBAL because:
- Sales rep in Philippines creates order for customer in USA
- Order routes to LA facility (closest to customer)
- Demand distributes globally, fulfillment is local

### 3. **Finance & Accounting**
**Purpose:** Invoicing, AR/AP, GL, cost accounting, multi-currency
**Data Flow:** Local → Regional → Global (financials roll up)
**Key Entities:** `invoices`, `payments`, `gl_accounts`, `cost_centers`
**Naming Pattern:** `finance_*`, `invoice_*`, `payment_*`, `gl_*`

### 4. **Operations Management**
**Purpose:** Production execution, work orders, yield tracking
**Data Flow:** Local → Regional → Global (production data aggregates)
**Key Entities:** `work_orders`, `production_logs`, `yield_tracking`, `scrap_tracking`
**Naming Pattern:** `operations_*`, `work_order_*`, `production_*`

### 5. **Production Scheduling**
**Purpose:** Centralized global scheduling engine
**Data Flow:** **World → Region → Facility** (schedules push DOWN)
**Key Entities:** `schedules`, `production_runs`, `machine_allocations`, `shift_schedules`
**Naming Pattern:** `schedule_*`, `production_run_*`, `shift_*`

**CRITICAL:** Scheduling is CENTRALIZED because:
- Uses global capacity data (from all facilities)
- Uses global demand data (from sales)
- Optimizes globally, executes locally
- Example: "LA overbooked → schedule overflow to Seattle"

### 6. **Capacity Management**
**Purpose:** Track available capacity (machines, labor, materials)
**Data Flow:** **Local → Regional → Global** (capacity aggregates UP)
**Key Entities:** `facility_capacity`, `machine_capacity`, `labor_capacity`, `material_capacity`
**Naming Pattern:** `capacity_*`

**CRITICAL:** Capacity flows UP because:
- Each facility knows ITS capacity (machines, staff, materials)
- Regional view: Sum of facilities in region
- Global view: Sum of all regions
- Scheduler queries global capacity to make decisions

### 7. **Assets - Manufacturing Equipment**
**Purpose:** Track machines, presses, tools, maintenance
**Data Flow:** **Local → Regional → Global** (assets aggregate UP)
**Key Entities:** `manufacturing_equipment`, `equipment_maintenance`, `equipment_status`
**Naming Pattern:** `equipment_*`, `machine_*`, `press_*`, `tool_*`

**Example Equipment:**
- HP Indigo 7900 Digital Press
- Heidelberg Speedmaster Offset Press
- Bobst Die-Cutting Machine
- Komori Flexo Press

### 8. **Assets - Human Resources**
**Purpose:** Employees, skills, certifications, labor tracking
**Data Flow:** **Local → Regional → Global** (headcount aggregates UP)
**Key Entities:** `employees`, `employee_skills`, `certifications`, `labor_hours`
**Naming Pattern:** `employee_*`, `labor_*`, `hr_*`

### 9. **Real-Time Monitoring**
**Purpose:** Live dashboards, KPIs, alerts
**Data Flow:** Local → Regional → Global (metrics aggregate)
**Key Entities:** `kpi_metrics`, `alerts`, `dashboard_widgets`
**Naming Pattern:** `monitoring_*`, `kpi_*`, `alert_*`

**Already Implemented:** Layer 2 monitoring in `backend/src/modules/monitoring/`

### 10. **IoT Equipment Monitoring**
**Purpose:** Machine sensors, OEE, predictive maintenance
**Data Flow:** Local (edge) → Regional → Global (telemetry aggregates)
**Key Entities:** `iot_devices`, `sensor_readings`, `machine_telemetry`, `oee_metrics`
**Naming Pattern:** `iot_*`, `sensor_*`, `telemetry_*`, `oee_*`

**Example Sensors:**
- Press speed (impressions/hour)
- Temperature (drying ovens)
- Vibration (bearing health)
- Material waste (scrap percentage)

### 11. **Quality Control**
**Purpose:** Inspections, defects, compliance, certifications
**Data Flow:** Local → Regional → Global (quality data aggregates)
**Key Entities:** `quality_inspections`, `defects`, `compliance_records`
**Naming Pattern:** `quality_*`, `inspection_*`, `defect_*`, `compliance_*`

### 12. **Procurement & Supply Chain**
**Purpose:** Vendor management, POs, material receiving
**Data Flow:** Local (facility orders) → Regional → Global (vendor contracts)
**Key Entities:** `vendors`, `purchase_orders`, `material_receipts`
**Naming Pattern:** `procurement_*`, `vendor_*`, `purchase_order_*`, `po_*`

### 13. **Business Intelligence / Analytics**
**Purpose:** Reporting, dashboards, data warehouse
**Data Flow:** Global (all data aggregated for analysis)
**Key Entities:** `bi_reports`, `data_warehouse_facts`, `data_warehouse_dimensions`
**Naming Pattern:** `bi_*`, `report_*`, `analytics_*`

---

## Data Flow Patterns by Module (AI Agents: Critical)

### Pattern 1: Global → Regional → Facility (Demand/Planning Flows DOWN)

**Modules:** Sales, Scheduling
**Direction:** ⬇️ DOWN
**Reason:** Centralized planning, distributed execution

```
Example: Sales Order
──────────────────────
1. Sales rep (Philippines, connected to US-EAST) creates order
2. Order routes to region based on customer location (US-EAST)
3. Order routes to facility based on proximity + capacity (LA)
4. LA facility produces order

Data Flow: Global (sales rep) → Regional (routing) → Facility (production)
```

### Pattern 2: Local → Regional → Global (Data/Capacity Flows UP)

**Modules:** Capacity, Assets (Manufacturing), Assets (HR), Operations, Finance, Quality
**Direction:** ⬆️ UP
**Reason:** Data originates locally, aggregates for visibility

```
Example: Machine Capacity
─────────────────────────
1. LA facility: HP Indigo press (1000 sheets/hour available)
2. US-EAST region: Sum LA + Seattle + NYC capacities
3. Global view: Sum US-EAST + EU-CENTRAL + APAC

Data Flow: Facility (local capacity) → Regional (sum) → Global (total)
```

### Pattern 3: Bidirectional (Sync Both Ways)

**Modules:** WMS (inventory), Procurement (materials)
**Direction:** ⬆️⬇️ BOTH
**Reason:** Master data DOWN, transactional data UP

```
Example: Inventory
──────────────────
DOWN: Product catalog, pricing (from regional/global)
UP: Inventory transactions, stock levels (from facility)

Data Flow: Bidirectional sync
```

---

## Naming Convention Standards (MANDATORY for ALL Modules)

**File:** `Standards/code/naming-conventions.md` (to be created)

### Database Table Names

**Pattern:** `{module}_{entity}` (lowercase, snake_case)

**Examples:**
```sql
-- ✅ CORRECT
sales_orders
sales_order_lines
finance_invoices
finance_invoice_lines
wms_inventory_levels
wms_storage_locations
equipment_machines
equipment_maintenance_logs
iot_sensor_readings
quality_inspections

-- ❌ WRONG
Orders              -- Missing module prefix
SalesOrders         -- PascalCase not allowed
sales-orders        -- Hyphens not allowed
order               -- Singular (should be plural)
```

### Database Column Names

**Pattern:** `{descriptive_name}` (lowercase, snake_case)

**Standard Columns (EVERY table MUST have):**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v7()  -- Time-ordered UUID
tenant_id UUID NOT NULL                          -- Multi-tenant isolation
created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
created_by UUID                                  -- User who created
updated_by UUID                                  -- User who last updated
```

**Foreign Keys:**
```sql
-- Pattern: {referenced_table}_id
customer_id UUID REFERENCES customers(id)
sales_order_id UUID REFERENCES sales_orders(id)
equipment_id UUID REFERENCES equipment_machines(id)
```

**Status Fields:**
```sql
-- Pattern: {entity}_status (enum type)
order_status order_status_enum DEFAULT 'pending'
invoice_status invoice_status_enum DEFAULT 'draft'
```

### GraphQL Schema Types

**Pattern:** `{Module}{Entity}` (PascalCase)

**Examples:**
```graphql
# ✅ CORRECT
type SalesOrder {
  id: UUID!
  tenantId: UUID!
  orderNumber: String!
  customerId: UUID!
  customer: Customer!  # Nested type
}

type WmsInventoryLevel {
  id: UUID!
  productId: UUID!
  quantity: Int!
  facilityId: UUID!
}

type EquipmentMachine {
  id: UUID!
  machineName: String!
  equipmentType: EquipmentTypeEnum!
  status: EquipmentStatusEnum!
}

# ❌ WRONG
type Order { ... }           # Missing module prefix
type sales_order { ... }     # snake_case not allowed
type SaleOrder { ... }       # Singular (should match DB: sales_orders)
```

### TypeScript Interfaces

**Pattern:** `{Module}{Entity}` (PascalCase, matches GraphQL)

**Examples:**
```typescript
// ✅ CORRECT
export interface SalesOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  customerId: string;
  orderStatus: OrderStatusEnum;
  createdAt: Date;
}

export interface WmsInventoryLevel {
  id: string;
  productId: string;
  quantity: number;
  facilityId: string;
}

// ❌ WRONG
export interface Order { ... }          // Missing module prefix
export interface sales_order { ... }    // snake_case not allowed
```

---

## Cross-Module Relationships (AI Agents: Critical)

### Example: Sales Order → Production → Inventory

```
1. Sales Module creates sales_orders
   ↓
2. Operations Module creates work_orders (references sales_order_id)
   ↓
3. Production logs in operations_production_logs
   ↓
4. WMS updates wms_inventory_levels (finished goods)
   ↓
5. WMS creates wms_shipments
   ↓
6. Finance Module creates finance_invoices (references sales_order_id)
```

**Key Insight:** Modules are LOOSELY COUPLED via foreign keys, events (NATS), and GraphQL federation.

---

## Scheduling Deep Dive (Centralized Intelligence)

**Why Scheduling is Centralized (World → Region → Facility):**

### Input Data (Aggregated from ALL facilities):

**From Capacity Module (Local → Global):**
- LA: 1000 orders/day capacity, 60% utilized
- Seattle: 500 orders/day capacity, 45% utilized
- Frankfurt: 800 orders/day capacity, 70% utilized

**From Sales Module (Global → Local):**
- 2000 orders this week for US customers
- 500 orders this week for EU customers

**From Assets Module (Local → Global):**
- LA: HP Indigo press available Mon-Fri 8am-8pm
- Seattle: Heidelberg press down for maintenance Tue-Thu
- Frankfurt: Komori flexo press 24/7 operation

### Scheduling Algorithm (Runs Centrally):

```typescript
// backend/src/modules/scheduling/services/global-scheduler.service.ts

export class GlobalSchedulerService {
  async generateGlobalSchedule(week: Date) {
    // 1. Get global demand (from Sales)
    const orders = await salesModule.getOrdersDueThisWeek(week);

    // 2. Get global capacity (from Capacity + Assets)
    const facilities = await capacityModule.getAvailableCapacity(week);

    // 3. Optimize assignments
    const schedule = this.optimizeSchedule(orders, facilities);
    // Uses algorithm:
    // - Minimize shipping distance (customer proximity)
    // - Balance workload across facilities
    // - Respect equipment constraints
    // - Handle material availability

    // 4. Push schedule DOWN to facilities
    for (const facilitySchedule of schedule) {
      await this.publishSchedule(facilitySchedule.facilityId, facilitySchedule.runs);
    }
  }

  optimizeSchedule(orders, facilities) {
    // This is where magic happens:
    // - Linear programming
    // - Constraint satisfaction
    // - Load balancing
    // Returns: Which facility produces which order
  }
}
```

**Result:**
- Monday: LA produces orders 1-100, Seattle produces 101-150
- Tuesday: LA produces 151-250, Seattle down (maintenance), Frankfurt picks up overflow
- Wednesday: ...

Schedule flows DOWN to facilities, execution data flows UP.

---

## For AI Agents: Module-Aware Development

**Before building ANY feature, determine:**

1. **Which module?** (Sales, WMS, Finance, etc.)
2. **Data flow direction?** (UP, DOWN, or BOTH)
3. **Naming convention?** (sales_orders, WmsInventoryLevel, etc.)
4. **Cross-module dependencies?** (Does this reference other modules?)

**Example Task:** "Build customer order feature"

**AI Agent Analysis:**
- Module: Sales
- Data Flow: Global → Regional → Facility (order creation is global)
- Naming: `sales_orders` table, `SalesOrder` GraphQL type
- Dependencies: References `customers` (Sales), triggers `work_orders` (Operations), creates `finance_invoices` (Finance)

---

## For Humans: Product Suite Value Proposition

**Why customers pay for the FULL suite (not individual modules):**

1. **Integrated Data:** Sales knows capacity, Finance knows production costs, Scheduling knows equipment availability
2. **Single Source of Truth:** One customer record, one order, flows through all modules
3. **Real-Time Visibility:** CEO sees sales → production → shipping → invoicing in one dashboard
4. **No Integration Hell:** Unlike buying WMS from Vendor A, ERP from Vendor B (which don't talk)
5. **One Subscription:** Simpler pricing, predictable costs

**Like Microsoft 365:**
- Don't buy Word separately, Excel separately, Teams separately
- Buy the SUITE, use what you need

---

## References

- [ADR 002: Multi-Tenant SaaS Architecture](../project-spirit/adr/002-multi-tenant-saas-edge-architecture.md)
- [ADR 003: 3-Tier Database](../project-spirit/adr/003-3-tier-database-offline-resilience.md)
- [Naming Convention Standards](../Standards/code/naming-conventions.md) (to be created)

---

[⬆ Back to top](#agogsaas-module-architecture---full-enterprise-suite) | [🏠 AGOG Home](../README.md) | [📚 Docs](./README.md)
