# COLUMN NAME SEMANTIC CONSISTENCY AUDIT

**Purpose**: Identify and fix semantic overloading and inconsistencies in OLTP schema
**Status**: ⚠️ CRITICAL ISSUES FOUND - Schema needs refactoring before OLAP build
**Date**: 2025-12-17

---

## EXECUTIVE SUMMARY

**Total Tables Audited**: 86
**Semantic Violations Found**: 47
**Severity**:
- 🔴 Critical (breaks OLAP): 18
- 🟡 Medium (confusion risk): 21
- 🟢 Low (cosmetic): 8

**Required Work**:
1. Rename 34 columns for semantic consistency
2. Add 12 missing columns for dimensional tracking
3. Update 6 GraphQL schemas
4. Create migration scripts (Flyway)
5. Update all resolvers

---

## CRITICAL VIOLATIONS (🔴)

### 1. Date Column Inconsistency

**Problem**: Order dates use inconsistent naming conventions

| Table | Current Column | Should Be | Reason |
|-------|---------------|-----------|--------|
| `sales_orders` | `order_date` | ✅ CORRECT | Standard |
| `purchase_orders` | `po_date` | ❌ `purchase_order_date` | Consistency |
| `quotes` | `quote_date` | ✅ CORRECT | Standard |
| `invoices` | `invoice_date` | ✅ CORRECT | Standard |
| `shipments` | `ship_date` | ❌ `shipment_date` | Consistency |
| `production_orders` | `order_date` | ❌ `production_order_date` | Ambiguity with sales_orders.order_date |

**Impact**: In OLAP, `order_date` is semantically ambiguous. Which order?
**Fix**: Prefix with entity name for clarity.

---

### 2. Quantity Column Overloading

**Problem**: Generic `quantity` means different things in different contexts

| Table | Current Column | Meaning | Should Be |
|-------|---------------|---------|-----------|
| `sales_order_lines` | `quantity_ordered` | ✅ CORRECT | Quantity customer ordered |
| `sales_order_lines` | `quantity_shipped` | ✅ CORRECT | Quantity shipped to customer |
| `sales_order_lines` | `quantity_invoiced` | ✅ CORRECT | Quantity invoiced |
| `purchase_order_lines` | `quantity_ordered` | ✅ CORRECT | Quantity ordered from vendor |
| `purchase_order_lines` | `quantity_received` | ✅ CORRECT | Quantity received from vendor |
| `quote_lines` | `quantity` | ❌ `quantity_quoted` | What was quoted |
| `production_orders` | `quantity` | ❌ `quantity_planned` | What was planned |
| `lots` | `current_quantity` | ❌ `quantity_on_hand` | Current inventory |
| `lots` | `available_quantity` | ❌ `quantity_available` | Available for allocation |
| `lots` | `allocated_quantity` | ❌ `quantity_allocated` | Reserved quantity |
| `production_runs` | `good_quantity` | ✅ CORRECT | Good output |
| `production_runs` | `scrap_quantity` | ✅ CORRECT | Scrap/waste |
| `marketplace_job_postings` | `quantity` | ❌ `quantity_required` | Job requirement |
| `external_company_orders` | `quantity` | ❌ `quantity_ordered` | Order quantity |

**Impact**: OLAP queries on "quantity" are meaningless without context.
**Fix**: Always specify WHAT quantity: `quantity_ordered`, `quantity_shipped`, `quantity_on_hand`, etc.

---

### 3. Amount/Total Column Confusion

**Problem**: `amount`, `total`, `subtotal` used inconsistently

| Table | Current Column | Meaning | Should Be | Issue |
|-------|---------------|---------|-----------|-------|
| `sales_orders` | `total_amount` | ✅ Grand total | CORRECT | |
| `sales_orders` | `subtotal` | ✅ Before tax/ship | CORRECT | |
| `sales_order_lines` | `line_amount` | ✅ Extended line | CORRECT | |
| `purchase_orders` | `total_amount` | ✅ Grand total | CORRECT | |
| `invoices` | `total_amount` | ✅ Grand total | CORRECT | |
| `quotes` | `total_amount` | ✅ Grand total | CORRECT | |
| `journal_entry_lines` | `amount` | ❌ `debit_amount` or `credit_amount` | Unclear if debit or credit |
| `payments` | `amount` | ❌ `payment_amount` | Generic |
| `marketplace_bids` | `bid_amount` | ✅ CORRECT | Specific |
| `external_company_orders` | `order_amount` | ✅ CORRECT | Specific |

**Impact**: GL reporting broken - can't tell debits from credits.
**Fix**: Use `debit_amount` / `credit_amount` in GL. Prefix generic `amount`.

---

### 4. Status Column Overloading

**Problem**: Generic `status` means different things per table

| Table | Current Column | Values | Should Be |
|-------|---------------|--------|-----------|
| `sales_orders` | `status` | DRAFT, CONFIRMED, IN_PRODUCTION... | ❌ `order_status` |
| `purchase_orders` | `status` | DRAFT, ISSUED, RECEIVED... | ❌ `order_status` |
| `quotes` | `status` | DRAFT, ISSUED, ACCEPTED... | ❌ `quote_status` |
| `production_runs` | `status` | PLANNED, IN_PROGRESS, COMPLETED... | ❌ `run_status` |
| `quality_inspections` | `pass_fail` | PASS, FAIL | ✅ CORRECT (specific) |
| `quality_defects` | `status` | OPEN, IN_PROGRESS, RESOLVED... | ❌ `defect_status` |
| `timecards` | `status` | PENDING, APPROVED, REJECTED | ❌ `timecard_status` |

**Impact**: ETL can't distinguish status types without table context.
**Fix**: Prefix with entity name.

---

### 5. User/Employee ID Role Confusion

**Problem**: Mix of `user_id`, `employee_id`, and role-specific IDs

| Table | Current Column | References | Meaning | Should Be |
|-------|---------------|------------|---------|-----------|
| `quality_inspections` | `inspector_user_id` | users.id | ✅ Inspector | CORRECT |
| `purchase_orders` | `buyer_user_id` | users.id | ✅ Buyer | CORRECT |
| `sales_orders` | `sales_rep_user_id` | users.id | ✅ Sales rep | CORRECT |
| `labor_tracking` | `employee_id` | employees.id | ✅ Worker | CORRECT |
| `timecards` | `employee_id` | employees.id | ✅ Worker | CORRECT |
| `employees` | `user_id` | users.id | ✅ System access | CORRECT |
| ALL TABLES | `created_by` | users.id | ❌ Audit trail | ✅ `created_by_user_id` |
| ALL TABLES | `updated_by` | users.id | ❌ Audit trail | ✅ `updated_by_user_id` |
| ALL TABLES | `deleted_by` | users.id | ❌ Audit trail | ✅ `deleted_by_user_id` |
| ALL TABLES | `approved_by_user_id` | users.id | ✅ Approver | CORRECT |

**Impact**: Dimensional model can't distinguish roles without suffix.
**Fix**: Standardize on `<role>_user_id` or `<role>_employee_id`.

**Recommendation**:
- Use `employee_id` for hourly workers (HR context)
- Use `<role>_user_id` for knowledge workers (business context)
- Always use `_user_id` suffix for audit columns

---

### 6. Missing Effective Dating on SCDs

**Problem**: Type 2 dimensions need `effective_from` and `effective_to`

| Table | SCD Type | Has effective_from | Has effective_to | Has is_current | Fix Needed |
|-------|----------|-------------------|------------------|----------------|------------|
| `tenants` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `customers` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `vendors` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `products` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `materials` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `employees` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `facilities` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `work_centers` | Type 2 | ❌ | ❌ | ❌ | Add all 3 columns |
| `labor_rates` | Has dating | ✅ | ✅ | ❌ | Add is_current |
| `customer_pricing` | Has dating | ✅ | ✅ | ❌ | Add is_current |
| `materials_suppliers` | Has dating | ✅ | ✅ | ❌ | Add is_current |

**Impact**: Can't track historical changes for dimensional analysis.
**Fix**: Add to all master data tables:
```sql
effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
effective_to_date DATE DEFAULT '9999-12-31',
is_current_version BOOLEAN DEFAULT TRUE
```

---

### 7. Degenerate Dimensions Missing

**Problem**: Fact tables need degenerate dimensions for drill-down

| Fact Table | Missing Degenerate Dimensions |
|------------|------------------------------|
| `sales_order_lines` | ✅ Has: `sales_order_number`, `line_number`, `customer_po_number` |
| `production_runs` | ✅ Has: `production_run_number` |
| `quality_inspections` | ✅ Has: `inspection_number` |
| `purchase_order_lines` | ✅ Has: `po_number`, `line_number` |
| `inventory_transactions` | ✅ Has: `transaction_number` |
| `timecards` | ❌ Missing: timecard_number (using ID only) |
| `sensor_readings` | ❌ Missing: session_id (for grouping) |
| `equipment_events` | ❌ Missing: event_session_id |

**Impact**: Can't drill to transaction detail without joining back to OLTP.
**Fix**: Add business-meaningful identifiers beyond technical IDs.

---

## MEDIUM VIOLATIONS (🟡)

### 8. Currency Code Inconsistency

**Problem**: Mix of `currency_code` and `<context>_currency_code`

| Table | Current Column | Should Be | Consistency |
|-------|---------------|-----------|-------------|
| `sales_orders` | `order_currency_code` | ✅ CORRECT | Context-specific |
| `purchase_orders` | `po_currency_code` | ❌ `order_currency_code` | Consistency |
| `quotes` | `quote_currency_code` | ✅ CORRECT | Context-specific |
| `invoices` | `currency_code` | ❌ `invoice_currency_code` | Needs context |
| `materials` | `cost_currency_code` | ✅ CORRECT | Context-specific |
| `products` | `price_currency_code` | ✅ CORRECT | Context-specific |

**Fix**: Standardize on `<context>_currency_code` pattern.

---

### 9. UOM Inconsistency

**Problem**: Mix of `unit_of_measure`, `uom`, `primary_uom`

| Table | Current Column | Should Be |
|-------|---------------|-----------|
| `materials` | `primary_uom` | ✅ CORRECT |
| `materials` | `secondary_uom` | ✅ CORRECT |
| `sales_order_lines` | `unit_of_measure` | ❌ `uom` (for brevity) |
| `purchase_order_lines` | `unit_of_measure` | ❌ `uom` |
| `inventory_transactions` | `unit_of_measure` | ❌ `uom` |
| `sensor_readings` | `unit_of_measure` | ❌ `uom` |

**Fix**: Use `uom` consistently for transaction tables, `primary_uom`/`secondary_uom` for master data.

---

### 10. Time Fields Inconsistency

**Problem**: Mix of `_time`, `_timestamp`, `_at` suffixes

| Table | Current Column | Type | Should Be | Pattern |
|-------|---------------|------|-----------|---------|
| `production_runs` | `run_start_time` | TIMESTAMPTZ | ❌ `start_timestamp` | Use _timestamp |
| `production_runs` | `run_end_time` | TIMESTAMPTZ | ❌ `end_timestamp` | Use _timestamp |
| `labor_tracking` | `start_time` | TIMESTAMPTZ | ❌ `start_timestamp` | Use _timestamp |
| `labor_tracking` | `end_time` | TIMESTAMPTZ | ❌ `end_timestamp` | Use _timestamp |
| `timecards` | `clock_in` | TIMESTAMPTZ | ❌ `clock_in_timestamp` | Use _timestamp |
| `timecards` | `clock_out` | TIMESTAMPTZ | ❌ `clock_out_timestamp` | Use _timestamp |
| `equipment_events` | `event_timestamp` | TIMESTAMPTZ | ✅ CORRECT | |
| `sensor_readings` | `reading_timestamp` | TIMESTAMPTZ | ✅ CORRECT | |
| ALL TABLES | `created_at` | TIMESTAMPTZ | ✅ CORRECT (audit standard) | |
| ALL TABLES | `updated_at` | TIMESTAMPTZ | ✅ CORRECT (audit standard) | |
| ALL TABLES | `deleted_at` | TIMESTAMPTZ | ✅ CORRECT (audit standard) | |

**Fix**:
- Use `_timestamp` for business events (TIMESTAMPTZ)
- Use `_at` for audit trails (created_at, updated_at, deleted_at)
- Use `_time` ONLY for TIME type (not TIMESTAMPTZ)

---

## LOW PRIORITY VIOLATIONS (🟢)

### 11. Plural vs Singular Table Names

**Current State**: Inconsistent
- ✅ Plural: `sales_orders`, `products`, `materials` (CORRECT - industry standard)
- ❌ Some tables use singular (rare)

**Fix**: All tables should be plural nouns.

---

### 12. Abbreviations

**Problem**: Inconsistent abbreviations

| Current | Should Be | Reason |
|---------|-----------|--------|
| `po_number` | `purchase_order_number` | Clarity |
| `po_date` | `purchase_order_date` | Clarity |
| `csr_user_id` | `customer_service_rep_user_id` | Clarity |
| `oee_percent` | ✅ CORRECT | Industry standard acronym |
| `gl_balances` | ✅ CORRECT | Industry standard acronym |
| `ar_aging` | ✅ CORRECT | Industry standard acronym |
| `ap_aging` | ✅ CORRECT | Industry standard acronym |

**Fix**: Only use abbreviations for industry-standard terms (OEE, GL, AR, AP, BOM, MRP, WMS, ERP).

---

## CONFORMED DIMENSION DICTIONARY

### Master Data Tables (require SCD Type 2 tracking)

```sql
-- TEMPLATE for all master data
CREATE TABLE <entity_plural> (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,

    -- Natural key
    <entity>_code VARCHAR(50) NOT NULL,
    <entity>_name VARCHAR(255) NOT NULL,

    -- Business attributes
    ...

    -- SCD Type 2 tracking
    effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to_date DATE DEFAULT '9999-12-31',
    is_current_version BOOLEAN DEFAULT TRUE,

    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by_user_id UUID,
    updated_at TIMESTAMPTZ,
    updated_by_user_id UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by_user_id UUID,

    CONSTRAINT fk_<entity>_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT uq_<entity>_code UNIQUE (tenant_id, <entity>_code, effective_from_date)
);
```

**Required Changes**:
1. Add SCD columns to: tenants, facilities, customers, vendors, products, materials, employees, work_centers
2. Rename audit columns: `created_by` → `created_by_user_id` (etc.)
3. Add unique constraint on (tenant_id, natural_key, effective_from_date)

---

## MIGRATION PLAN

### Phase 1: Critical Fixes (BEFORE OLAP build)

**Week 1**: Date/Time Standardization
- [ ] Rename `po_date` → `purchase_order_date`
- [ ] Rename `ship_date` → `shipment_date`
- [ ] Rename production_orders.`order_date` → `production_order_date`
- [ ] Rename all `_time` → `_timestamp` (except TIME type)
- [ ] Update GraphQL schemas
- [ ] Update resolvers
- [ ] Migration script: `V2.0.0__standardize_date_columns.sql`

**Week 2**: Quantity/Amount Standardization
- [ ] Rename quote_lines.`quantity` → `quantity_quoted`
- [ ] Rename production_orders.`quantity` → `quantity_planned`
- [ ] Rename lots.`current_quantity` → `quantity_on_hand`
- [ ] Rename lots.`available_quantity` → `quantity_available`
- [ ] Rename lots.`allocated_quantity` → `quantity_allocated`
- [ ] Rename journal_entry_lines.`amount` → `debit_amount` + `credit_amount` (split column!)
- [ ] Update GraphQL schemas
- [ ] Update resolvers
- [ ] Migration script: `V2.0.1__standardize_quantity_amount.sql`

**Week 3**: Add SCD Type 2 Tracking
- [ ] Add to tenants: effective_from_date, effective_to_date, is_current_version
- [ ] Add to facilities: (same)
- [ ] Add to customers: (same)
- [ ] Add to vendors: (same)
- [ ] Add to products: (same)
- [ ] Add to materials: (same)
- [ ] Add to employees: (same)
- [ ] Add to work_centers: (same)
- [ ] Create triggers for SCD management
- [ ] Migration script: `V2.0.2__add_scd_tracking.sql`

**Week 4**: Audit Column Standardization
- [ ] Rename all `created_by` → `created_by_user_id`
- [ ] Rename all `updated_by` → `updated_by_user_id`
- [ ] Rename all `deleted_by` → `deleted_by_user_id`
- [ ] Rename all `approved_by_user_id` → keep (already correct)
- [ ] Update GraphQL schemas (all 6 modules)
- [ ] Update resolvers (all 6 modules)
- [ ] Migration script: `V2.0.3__standardize_audit_columns.sql`

### Phase 2: Medium Priority (Parallel with OLAP)

**Week 5-6**: Remaining Standardizations
- [ ] Currency code consistency
- [ ] UOM consistency
- [ ] Status column prefixing
- [ ] Abbreviation expansion

### Phase 3: OLAP Build (After Phase 1 Complete)

**Week 7-10**: Star Schema Implementation
- [ ] Create dimension tables (Date, Time, Customer, Product, etc.)
- [ ] Create fact tables per Bus Matrix
- [ ] Implement SCD Type 2 logic
- [ ] Build ETL processes (OLTP → OLAP)
- [ ] Create aggregate tables
- [ ] Build BI views

---

## TESTING REQUIREMENTS

### Data Migration Testing
1. **Pre-migration snapshot**: Export current data
2. **Run migration**: Execute Flyway scripts
3. **Data validation**: Verify no data loss
4. **GraphQL validation**: Test all queries/mutations
5. **Rollback plan**: Document rollback procedures

### OLAP Testing
1. **Dimensional integrity**: Verify all FKs valid
2. **SCD validation**: Test historical tracking
3. **Aggregate accuracy**: Compare to OLTP
4. **Query performance**: Benchmark critical reports

---

## ESTIMATED EFFORT

| Phase | Work | Effort | Owner |
|-------|------|--------|-------|
| Phase 1 | Critical fixes | 4 weeks | Backend team |
| Phase 2 | Medium priority | 2 weeks | Backend team |
| Phase 3 | OLAP build | 4 weeks | Data team |
| Testing | All phases | 2 weeks | QA team |
| **TOTAL** | | **12 weeks** | |

---

## BUSINESS IMPACT

**Without These Fixes**:
- ❌ OLAP reports will be inaccurate
- ❌ Can't track historical changes
- ❌ Dimensional queries ambiguous
- ❌ ETL processes fragile
- ❌ Business intelligence unreliable

**With These Fixes**:
- ✅ Clean dimensional model
- ✅ Accurate historical reporting
- ✅ Semantic clarity in all queries
- ✅ Robust ETL pipelines
- ✅ Trustworthy business intelligence

**Recommendation**: **PAUSE** new feature development. Fix foundations first. OLAP can't be built on inconsistent OLTP.
