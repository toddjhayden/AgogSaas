# Naming Conventions Standard - AgogSaaS

**📍 Navigation Path:** [AGOG Home](../../README.md) → [Standards](../README.md) → [Code Standards](./README.md) → Naming Conventions

**For AI Agents:** **CRITICAL** - Read this BEFORE writing ANY code. These conventions are MANDATORY across ALL modules (Sales, WMS, Finance, Operations, etc.).

**For Humans:** Consistent naming makes code maintainable and prevents confusion across 13+ modules.

---

## Overview

**AgogSaaS has 13+ modules** (Sales, WMS, Finance, Operations, Scheduling, IoT, etc.). **Consistent naming across ALL modules is MANDATORY.**

**Principle:** Someone should be able to look at ANY table/type/file and immediately know:
1. Which module it belongs to
2. What it represents
3. How it relates to other entities

---

## Database Table Names

### Pattern: `{module}_{entity_plural}`

**Always:**
- Lowercase
- snake_case
- Plural (orders, not order)
- Module prefix (sales_orders, not orders)

**Examples:**

```sql
-- ✅ CORRECT
sales_orders
sales_order_lines
sales_customers
sales_quotes
wms_inventory_levels
wms_storage_locations
wms_inventory_transactions
finance_invoices
finance_invoice_lines
finance_payments
finance_gl_accounts
operations_work_orders
operations_production_logs
equipment_machines
equipment_maintenance_logs
iot_sensor_readings
iot_devices
quality_inspections
quality_defects
hr_employees
hr_employee_skills

-- ❌ WRONG
Orders                    -- Missing module prefix, PascalCase
sales-orders              -- Hyphens not allowed
order                     -- Singular (use plural)
SalesOrders               -- PascalCase not allowed
sales_order               -- Singular (use plural)
```

### Standard Columns (EVERY Table MUST Have)

```sql
CREATE TABLE {module}_{entity} (
    -- Primary key (time-ordered UUID)
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),

    -- Multi-tenant isolation (REQUIRED for ALL tables except system tables)
    tenant_id UUID NOT NULL REFERENCES tenants(id),

    -- Audit columns (REQUIRED)
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by UUID REFERENCES users(id),
    updated_by UUID REFERENCES users(id),

    -- Soft delete (RECOMMENDED)
    deleted_at TIMESTAMPTZ NULL,
    deleted_by UUID REFERENCES users(id)
);
```

### Foreign Key Columns

**Pattern:** `{referenced_table_singular}_id`

```sql
-- ✅ CORRECT
customer_id UUID REFERENCES sales_customers(id)
sales_order_id UUID REFERENCES sales_orders(id)
equipment_id UUID REFERENCES equipment_machines(id)
facility_id UUID REFERENCES facilities(id)

-- ❌ WRONG
customerId          -- camelCase not allowed
customer            -- Missing _id suffix
customers_id        -- Plural (use singular)
```

### Status/Enum Columns

**Pattern:** `{entity}_status`

**Type:** Custom enum (not varchar)

```sql
-- ✅ CORRECT
CREATE TYPE sales_order_status_enum AS ENUM (
    'draft',
    'pending_approval',
    'approved',
    'in_production',
    'completed',
    'cancelled'
);

CREATE TABLE sales_orders (
    ...
    order_status sales_order_status_enum DEFAULT 'draft' NOT NULL,
    ...
);

-- ❌ WRONG
status VARCHAR(50)  -- Use enum, not varchar
orderStatus         -- camelCase not allowed
```

### Junction Tables (Many-to-Many)

**Pattern:** `{table1}_{table2}` (alphabetical order)

```sql
-- ✅ CORRECT
CREATE TABLE equipment_employees (
    equipment_id UUID REFERENCES equipment_machines(id),
    employee_id UUID REFERENCES hr_employees(id),
    certification_date DATE,
    PRIMARY KEY (equipment_id, employee_id)
);

CREATE TABLE sales_orders_products (
    sales_order_id UUID REFERENCES sales_orders(id),
    product_id UUID REFERENCES products(id),
    ...
);

-- ❌ WRONG
EquipmentEmployees      -- PascalCase not allowed
equipment_to_employees  -- No "to" in name
employees_equipment     -- Wrong order (should be alphabetical)
```

---

## GraphQL Schema Types

### Pattern: `{Module}{Entity}`

**Always:**
- PascalCase
- Module prefix (SalesOrder, not Order)
- Matches database table name structure

**Examples:**

```graphql
# ✅ CORRECT
type SalesOrder {
  id: UUID!
  tenantId: UUID!
  orderNumber: String!
  orderStatus: SalesOrderStatusEnum!
  customer: SalesCustomer!
  lines: [SalesOrderLine!]!
  createdAt: DateTime!
  updatedAt: DateTime!
}

type WmsInventoryLevel {
  id: UUID!
  tenantId: UUID!
  productId: UUID!
  product: Product!
  quantity: Int!
  facilityId: UUID!
  facility: Facility!
}

type EquipmentMachine {
  id: UUID!
  machineName: String!
  equipmentType: EquipmentTypeEnum!
  status: EquipmentStatusEnum!
}

# Enums
enum SalesOrderStatusEnum {
  DRAFT
  PENDING_APPROVAL
  APPROVED
  IN_PRODUCTION
  COMPLETED
  CANCELLED
}

# ❌ WRONG
type Order { ... }              # Missing module prefix
type sales_order { ... }        # snake_case not allowed
type SaleOrder { ... }          # Singular (should match DB: sales_orders)
type OrderSales { ... }         # Wrong order (module first)
```

---

## TypeScript Interfaces

### Pattern: `{Module}{Entity}`

**Always:**
- PascalCase
- Module prefix
- Matches GraphQL types exactly

**Examples:**

```typescript
// ✅ CORRECT
export interface SalesOrder {
  id: string;
  tenantId: string;
  orderNumber: string;
  orderStatus: SalesOrderStatusEnum;
  customerId: string;
  customer?: SalesCustomer;  // Optional if not always loaded
  lines: SalesOrderLine[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WmsInventoryLevel {
  id: string;
  tenantId: string;
  productId: string;
  quantity: number;
  facilityId: string;
}

export enum SalesOrderStatusEnum {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  IN_PRODUCTION = 'in_production',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

// ❌ WRONG
export interface Order { ... }          // Missing module prefix
export interface sales_order { ... }    // snake_case not allowed
export interface Salesorder { ... }     // Missing capital O
```

---

## File & Directory Names

### Backend Modules

**Pattern:** `backend/src/modules/{module}/`

```
backend/src/modules/
├── sales/
│   ├── schema/
│   │   ├── sales-order.graphql
│   │   ├── sales-customer.graphql
│   ├── resolvers/
│   │   ├── sales-order.resolver.ts
│   │   ├── sales-customer.resolver.ts
│   ├── services/
│   │   ├── sales-order.service.ts
│   │   ├── demand-redistribution.service.ts
│   ├── entities/
│   │   ├── sales-order.entity.ts
│   │   ├── sales-customer.entity.ts
├── wms/
│   ├── schema/
│   ├── resolvers/
│   ├── services/
├── finance/
├── operations/
```

**File Naming:**
- kebab-case (sales-order.service.ts)
- Module prefix in files (sales-order, not order)

### Frontend Modules

**Pattern:** `frontend/src/modules/{module}/`

```
frontend/src/modules/
├── sales/
│   ├── pages/
│   │   ├── SalesOrderList.tsx
│   │   ├── SalesOrderDetail.tsx
│   ├── components/
│   │   ├── SalesOrderCard.tsx
│   │   ├── SalesOrderForm.tsx
│   ├── hooks/
│   │   ├── useSalesOrders.ts
│   ├── api/
│   │   ├── salesOrderApi.ts
├── wms/
├── finance/
```

**File Naming:**
- PascalCase for React components (SalesOrderList.tsx)
- camelCase for hooks/utils (useSalesOrders.ts)

---

## Database Migrations

### Pattern: `V{version}__{description}.sql`

**Version:** Semantic (1.5.0 = version 1.5, migration 0)

**Description:** Verb + entity + module

```sql
-- ✅ CORRECT
V1.5.0__add_demand_redistribution_sales.sql
V1.5.1__add_capacity_alerts_scheduling.sql
V1.6.0__add_iot_sensor_readings.sql

-- ❌ WRONG
V1.5.0__DemandRedistribution.sql        -- PascalCase not allowed
V1.5.0__add-demand-redistribution.sql   -- Hyphens (use underscores)
V1.5.0__demand_redistribution.sql       -- Missing verb
```

**Migration Header (REQUIRED):**

```sql
-- Migration: V1.5.0__add_demand_redistribution_sales.sql
-- Module: Sales
-- Type: SAFE (backward-compatible) | UNSAFE (breaking change)
-- Purpose: Enable demand redistribution for disaster recovery
-- Related ADR: ADR 003

-- ✅ SAFE: Adding nullable column
ALTER TABLE sales_orders ADD COLUMN redistributed_to_facility_id UUID NULL;

-- ❌ UNSAFE: Do NOT rename columns (breaks blue-green rollback)
-- ALTER TABLE sales_orders RENAME COLUMN status TO order_status;
```

---

## API Endpoints (REST - if used)

**Pattern:** `/api/{module}/{resource}`

```
# ✅ CORRECT
GET    /api/sales/orders
POST   /api/sales/orders
GET    /api/sales/orders/:id
PUT    /api/sales/orders/:id
DELETE /api/sales/orders/:id

GET    /api/wms/inventory-levels
GET    /api/finance/invoices

# ❌ WRONG
GET /api/orders              # Missing module
GET /api/sales/order         # Singular (use plural)
GET /api/sales-orders        # Wrong separator (use /)
```

---

## NATS Channels

**Pattern:** `agog.{category}.{agent}.{module}.{feature}`

```typescript
// ✅ CORRECT
'agog.deliverables.roy.sales.demand-redistribution'
'agog.deliverables.jen.wms.inventory-dashboard'
'agog.results.billy.sales.order-tests'

// ❌ WRONG
'sales.demand.redistribution'     // Missing agog prefix
'agog.sales.redistribution'       // Missing agent/category
```

---

## Environment Variables

**Pattern:** `{MODULE}_{CATEGORY}_{NAME}`

```bash
# ✅ CORRECT
DATABASE_URL=postgresql://...
SALES_API_URL=https://api.sales.agog.com
WMS_WAREHOUSE_ID=warehouse-la-001
IOT_SENSOR_POLL_INTERVAL=5000

# ❌ WRONG
databaseUrl=...       # Not SCREAMING_SNAKE_CASE
db_url=...            # Missing category
```

---

## Test Files

**Pattern:** `{entity}.{type}.spec.ts`

```
# ✅ CORRECT
sales-order.service.spec.ts
sales-order.resolver.spec.ts
sales-order.e2e.spec.ts
demand-redistribution.integration.spec.ts

# ❌ WRONG
SalesOrderTest.ts             # Not kebab-case
sales-order-test.ts           # Missing .spec
sales_order.service.spec.ts   # Underscores (use hyphens)
```

---

## Quick Reference Table

| Artifact | Pattern | Example |
|----------|---------|---------|
| **Database Table** | `{module}_{entity_plural}` | `sales_orders` |
| **DB Column** | `{descriptive_name}` | `order_status` |
| **Foreign Key** | `{table_singular}_id` | `customer_id` |
| **GraphQL Type** | `{Module}{Entity}` | `SalesOrder` |
| **GraphQL Enum** | `{Module}{Entity}{Field}Enum` | `SalesOrderStatusEnum` |
| **TypeScript Interface** | `{Module}{Entity}` | `SalesOrder` |
| **Backend File** | `{module-entity}.{type}.ts` | `sales-order.service.ts` |
| **Frontend Component** | `{ModuleEntity}{Type}.tsx` | `SalesOrderList.tsx` |
| **Migration** | `V{ver}__{verb_entity_module}.sql` | `V1.5.0__add_orders_sales.sql` |
| **API Endpoint** | `/api/{module}/{resources}` | `/api/sales/orders` |
| **NATS Channel** | `agog.{cat}.{agent}.{module}.{feat}` | `agog.deliverables.roy.sales.orders` |

---

## Enforcement

**Primary Assistant (Claude) will reject code that violates these conventions.**

Before merging:
- [ ] All table names follow pattern
- [ ] All GraphQL types follow pattern
- [ ] All TypeScript interfaces follow pattern
- [ ] All files named correctly
- [ ] Migrations have headers

---

[⬆ Back to top](#naming-conventions-standard---agogsaas) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../README.md)
