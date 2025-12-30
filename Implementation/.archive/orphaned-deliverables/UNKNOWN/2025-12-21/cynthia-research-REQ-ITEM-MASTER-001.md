# Cynthia Research Report: Item Master Pattern Implementation

**Feature:** REQ-ITEM-MASTER-001 / Item Master Pattern Implementation
**Researched By:** Cynthia (Research Specialist)
**Date:** 2025-12-20
**Complexity:** Complex
**Estimated Effort:** 6-8 weeks
**Priority:** Critical - Foundational architecture pattern

---

## Executive Summary

The Item Master Pattern consolidates the separate `materials` and `products` tables into a unified item catalog where Material and Product are **ROLES, not separate entities**. This architectural shift enables dual-role items (e.g., blank labels can be both purchased AND sold), multi-UOM support, and eliminates data duplication. The implementation requires creating 11 new tables (items core + 8 supporting tables), migrating existing data from 2 legacy tables, updating GraphQL schemas, and implementing frontend components. This is a CRITICAL foundation that impacts procurement, sales, manufacturing, and inventory modules.

**Key Insight**: Real-world print industry example - A customer orders 200,000 blank labels: 100,000 shipped directly (product role), 100,000 consumed to print custom labels (material role). Same item, different roles based on usage context.

---

## Functional Requirements

### Primary Requirements

- [ ] **FR-1**: Create unified `items` table with role flags (`can_be_purchased`, `can_be_sold`, `can_be_manufactured`, `can_be_inventoried`)
  - Source: items.yaml lines 25-132
  - Rationale: Material and Product are ROLES, not separate classifications

- [ ] **FR-2**: Implement multi-UOM system with context-specific preferences
  - Source: items.yaml lines 694-810
  - Rationale: Same item measured in different units (purchase in rolls, sell in sheets, manufacture in linear feet)

- [ ] **FR-3**: Create attribute extension pattern (material attributes, product attributes, physical attributes)
  - Source: items.yaml lines 351-693
  - Rationale: Populate specialized attributes based on role flags (material attrs if can_be_purchased=true)

- [ ] **FR-4**: Implement SCD Type 2 tracking for item price/cost history
  - Source: V0.0.10 migration pattern + items.yaml
  - Rationale: Need to track "What was this item's cost when production order started?"

- [ ] **FR-5**: Migrate existing `materials` (2,000+ records) and `products` (500+ records) to unified `items` table
  - Source: V0.0.6 migration + items.yaml migration notes lines 915-949
  - Rationale: Preserve existing data while transitioning to new architecture

- [ ] **FR-6**: Create reference tables: `item_types`, `item_statuses`, `measurement_types`, `units_of_measure`
  - Source: items.yaml lines 199-350
  - Rationale: Lookup data for type classifications, lifecycle statuses, measurement approaches

- [ ] **FR-7**: Support lot tracking and serialization based on measurement type
  - Source: items.yaml lines 334-349 + material attributes lines 409-415
  - Rationale: BATCH measurement type requires lot tracking (cannot mix lots in production)

- [ ] **FR-8**: Implement GraphQL queries for items with role-based filtering
  - Source: sales-materials.graphql pattern + items.yaml
  - Rationale: Query "show me all purchasable items" or "show me dual-role items"

### Acceptance Criteria

- [ ] **AC-1**: System successfully creates a dual-role item (blank labels) with both material and product attributes
- [ ] **AC-2**: Multi-UOM conversion calculates correctly: 1 roll = 5000 sheets, purchase price per roll converts to cost per sheet
- [ ] **AC-3**: SCD Type 2 tracking maintains history: Change item standard cost on 2025-01-15, historical queries return old cost for orders before that date
- [ ] **AC-4**: Migration completes with zero data loss: All 2,000+ materials and 500+ products migrated with foreign key integrity preserved
- [ ] **AC-5**: GraphQL query `items(tenantId: X, canBePurchased: true, canBeSold: true)` returns only dual-role items
- [ ] **AC-6**: Lot-tracked items (BATCH measurement type) enforce lot number on inventory transactions
- [ ] **AC-7**: Frontend item master form shows/hides attribute panels based on role flags (material attrs only if can_be_purchased=true)

### Out of Scope

- **DEFERRED**: Item variants/configurations (e.g., blank labels in 10 different sizes) - This would require additional `item_variants` table
- **DEFERRED**: Item images/attachments - File storage infrastructure not yet implemented
- **DEFERRED**: Item approval workflow - Workflow engine not yet implemented
- **DEFERRED**: Item lifecycle PLM features - Future enhancement for version control beyond SCD Type 2

---

## Technical Constraints

### Database Requirements

**Tables Needed:**

| Table | Type | Status | Row Estimate |
|-------|------|--------|--------------|
| `items` | Core catalog | CREATE NEW | 2,500+ (migrated from materials + products) |
| `item_types` | Reference | CREATE NEW | 15-20 (SUBSTRATE, INK, FINISHED_GOOD, etc.) |
| `item_statuses` | Reference | CREATE NEW | 5 (ACTIVE, INACTIVE, OBSOLETE, DISCONTINUED, PENDING) |
| `measurement_types` | Reference | CREATE NEW | 3 (DISCRETE, CONTINUOUS, BATCH) |
| `units_of_measure` | Reference | CREATE NEW | 30-40 (EA, GAL, LB, ROLL, SHEET, etc.) |
| `item_material_attributes` | Extension | CREATE NEW | 2,000+ (1:1 with items where can_be_purchased=true) |
| `item_product_attributes` | Extension | CREATE NEW | 1,000+ (1:1 with items where can_be_sold=true) |
| `item_physical_attributes` | Extension | CREATE NEW | 2,500+ (1:1 with all items - dimensions, weight, volume) |
| `item_uom_conversions` | UOM system | CREATE NEW | 5,000+ (avg 2-3 conversions per item) |
| `item_uom_preferences` | UOM system | CREATE NEW | 10,000+ (4 contexts x 2,500 items) |
| `materials` | Legacy | DEPRECATE | 2,000+ (migrate to items, drop in V0.0.20) |
| `products` | Legacy | DEPRECATE | 500+ (migrate to items, drop in V0.0.20) |

**SCD Type 2 Columns**: Following V0.0.10 pattern
- `effective_from_date DATE NOT NULL DEFAULT CURRENT_DATE`
- `effective_to_date DATE DEFAULT '9999-12-31'`
- `is_current_version BOOLEAN DEFAULT TRUE`

**Audit Columns**: Following V0.0.11 pattern
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `created_by_user_id UUID`
- `updated_at TIMESTAMPTZ`
- `updated_by_user_id UUID`
- `deleted_at TIMESTAMPTZ` (soft delete)
- `deleted_by_user_id UUID`

**RLS Policies**: NO - Items are company-wide catalog, not user-specific. Tenant isolation via `tenant_id` foreign key is sufficient.

**Multi-Tenant**: YES - `tenant_id UUID NOT NULL` with `UNIQUE (tenant_id, item_code)`

### API Requirements

**GraphQL Queries**:
```graphql
items(tenantId: ID!, canBePurchased: Boolean, canBeSold: Boolean, itemTypeId: ID, statusId: ID, includeHistory: Boolean, limit: Int, offset: Int): [Item!]!
item(id: ID!): Item
itemByCode(tenantId: ID!, itemCode: String!): Item
itemAsOf(itemCode: String!, tenantId: ID!, asOfDate: Date!): Item
itemHistory(itemCode: String!, tenantId: ID!): [Item!]!
itemTypes: [ItemType!]!
itemStatuses: [ItemStatus!]!
measurementTypes: [MeasurementType!]!
unitsOfMeasure(uomType: String): [UnitOfMeasure!]!
```

**GraphQL Mutations**:
```graphql
createItem(input: CreateItemInput!): Item!
updateItem(id: ID!, input: UpdateItemInput!): Item!
deleteItem(id: ID!): Item!
setMaterialAttributes(itemId: ID!, input: MaterialAttributesInput!): ItemMaterialAttributes!
setProductAttributes(itemId: ID!, input: ProductAttributesInput!): ItemProductAttributes!
setPhysicalAttributes(itemId: ID!, input: PhysicalAttributesInput!): ItemPhysicalAttributes!
addUomConversion(itemId: ID!, fromUomId: ID!, toUomId: ID!, conversionFactor: Float!): ItemUomConversion!
setUomPreference(itemId: ID!, context: UomContext!, preferredUomId: ID!): ItemUomPreference!
```

**Authentication**: YES - JWT required for all mutations, `user_id` extracted for audit trail

### Security Requirements

**Tenant Isolation**: CRITICAL
- Foreign key constraints: `CONSTRAINT fk_item_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)`
- Unique constraints: `CONSTRAINT uq_item_code UNIQUE (tenant_id, item_code)`
- Query filters: ALL queries MUST include `WHERE tenant_id = $1`
- Context validation: Extract `tenant_id` from JWT, never from client input

**Permission Checks**: Role-based at API level
- `ROLE_ITEM_MASTER_READ`: View items
- `ROLE_ITEM_MASTER_WRITE`: Create/update items
- `ROLE_ITEM_MASTER_DELETE`: Soft delete items
- `ROLE_ITEM_MASTER_ADMIN`: Manage reference data

**Input Validation**:
```typescript
validateItemCode(code: string) {
  if (!/^[A-Z0-9-]{1,50}$/.test(code)) {
    throw new ValidationError('Item code must be alphanumeric with hyphens, max 50 chars');
  }
}
```

### Performance Requirements

- **Expected Load**: 2,500+ items initially, ~500/year growth, 1,000+ queries/day
- **Response Time**: List < 200ms, Single < 50ms, Historical < 150ms
- **Data Volume**: ~50 MB for items core + attributes

### Integration Points

1. **Procurement**: `vendor_purchase_orders` → `items(id)` where `can_be_purchased = TRUE`
2. **Sales**: `sales_orders` → `items(id)` where `can_be_sold = TRUE`
3. **Manufacturing**: `bill_of_materials` → `items(id)` (parent & components)
4. **Inventory**: `inventory_transactions` → `items(id)` where `can_be_inventoried = TRUE`
5. **Finance**: `costing_transactions` → `items(id)`

---

## Codebase Analysis

### Existing Patterns Found

**1. Materials/Products (Current State)**
- Files: `V0.0.6__create_sales_materials_procurement.sql`, `sales-materials.graphql`, `sales-materials.resolver.ts`
- Pattern: Separate tables, direct pool queries, row mappers
- Lessons: ❌ Duplication for dual-role items, ✅ Direct SQL performant

**2. SCD Type 2 (Facilities, Customers, Vendors)**
- Files: `V0.0.10__add_scd_type2_tracking.sql`, `RESOLVER_SCD_TYPE2_IMPLEMENTATION_GUIDE.md`
- Pattern: 3 columns + partial indexes + historical queries
- Can reuse: ✅ Exact same pattern proven working

**3. Audit Columns**
- Files: `V0.0.11__standardize_audit_columns.sql`, `RESOLVER_DUAL_WRITE_PATTERN.md`
- Pattern: `*_user_id` suffix, dual-write triggers
- Can reuse: ✅ Standardized naming

### Files That Need Modification

| File | Change Type | Complexity |
|------|-------------|------------|
| `migrations/V0.0.14__create_items_core_tables.sql` | CREATE NEW | HIGH |
| `migrations/V0.0.15__create_items_attribute_tables.sql` | CREATE NEW | MEDIUM |
| `migrations/V0.0.16__create_items_uom_tables.sql` | CREATE NEW | MEDIUM |
| `migrations/V0.0.17__migrate_materials_to_items.sql` | CREATE NEW | HIGH |
| `migrations/V0.0.18__migrate_products_to_items.sql` | CREATE NEW | HIGH |
| `migrations/V0.0.19__update_foreign_keys_to_items.sql` | CREATE NEW | CRITICAL |
| `migrations/V0.0.20__drop_legacy_tables.sql` | CREATE NEW | MEDIUM |
| `src/graphql/schema/items.graphql` | CREATE NEW | MEDIUM |
| `src/graphql/resolvers/items.resolver.ts` | CREATE NEW | HIGH |
| `src/graphql/resolvers/sales-materials.resolver.ts` | MODIFY | MEDIUM |
| `frontend/src/pages/ItemMasterPage.tsx` | CREATE NEW | HIGH |
| `frontend/src/components/items/ItemForm.tsx` | CREATE NEW | HIGH |

**Total**: 18 files (7 migrations, 4 backend, 7 frontend)

---

## Edge Cases & Error Scenarios

1. **Empty State**: New tenant with zero items → Show "Import Items" button
2. **Dual-Role UOM Conflicts**: Purchase in ROLLS, sell in SHEETS, missing conversion → Error on sales order
3. **SCD Type 2 Overlapping**: Two versions with same `effective_from_date` → Validation error
4. **Migration Duplicates**: Material "LABEL-001" conflicts with Product "LABEL-001" → Append suffix "-MAT"/"-PROD"
5. **Lot Tracking**: BATCH measurement but lot tracking disabled → Validation error
6. **Role Flag Changes**: Disable `can_be_purchased` on item with open POs → Warning message
7. **Concurrent Updates**: Optimistic locking with `updated_at` check
8. **SQL Injection**: Parameterized queries only, validate item codes with regex

---

## Security Analysis

**Vulnerabilities to Avoid**:
1. **Tenant Bypass**: Validate `tenantId` from JWT matches query param
2. **SQL Injection**: Parameterized queries: `db.query('SELECT * FROM items WHERE item_code = $1', [code])`
3. **Mass Assignment**: Whitelist allowed fields, never merge raw input
4. **IDOR**: All queries include `WHERE tenant_id = $tokenTenantId`

**Security Patterns**:
- JWT validation: `src/middleware/auth.ts`
- Tenant validation: `src/utils/validate-tenant.ts`
- Audit trail: `created_by_user_id` from JWT context

---

## Implementation Recommendations

### Phase 1: Database Schema (2 weeks - Roy)
- Create 11 tables (items core + 3 attributes + 4 UOM + 3 reference)
- Add SCD Type 2 + audit columns
- Seed reference data (15 types, 5 statuses, 3 measurements, 40 UOMs)

### Phase 2: Data Migration (1.5 weeks - Roy)
- Migrate materials → items (`can_be_purchased = TRUE`)
- Migrate products → items (`can_be_sold = TRUE`)
- Update foreign keys in 5 dependent tables
- Handle duplicates with suffix

### Phase 3: Backend API (2 weeks - Roy)
- Create `items.graphql` schema
- Create `items.resolver.ts` with 10 queries + 8 mutations
- Implement SCD Type 2 queries following guide
- Add legacy compat layer

### Phase 4: Frontend UI (2.5 weeks - Jen)
- `ItemMasterPage.tsx` with filtering
- `ItemForm.tsx` with conditional attribute panels
- `ItemList.tsx` with role badges
- `UomConverter.tsx` widget

### Phase 5: QA Testing (1.5 weeks - Billy)
- Manual: Dual-role items, multi-UOM, SCD Type 2
- Security: SQL injection, cross-tenant, soft delete
- Migration: Row counts, FK integrity, checksums

### Phase 6: Statistics (0.5 weeks - Priya)
- Track migration success, query performance, error rate

### Complexity: COMPLEX
- 11 tables, 18 queries/mutations, 400 hours effort
- Database migration from 2 legacy tables
- Multi-module impact (5 modules)

### Estimated Effort:
- Roy (Backend): 220 hours = 5.5 weeks
- Jen (Frontend): 100 hours = 2.5 weeks
- Billy (QA): 60 hours = 1.5 weeks
- Priya (Stats): 20 hours = 0.5 weeks
- **Total: 400 hours = 6-8 weeks** (Roy + Jen parallel after Phase 2)

---

## Blockers & Dependencies

**Blockers**: NONE - All prerequisites met

**Dependencies**:
1. **Marcus** - Approve 2-hour downtime for migration
2. **5 Modules** - Update references after migration
3. **Data Quality** - Clean duplicates before migration

**Risks**:
1. **Migration Downtime** - 2 hours read-only mode → Schedule Sunday 2am-4am
2. **Performance** - 2,500+ rows slower → Optimize indexes, pagination
3. **Data Loss** - Migration failure → Full backup, staging test
4. **User Confusion** - Dual-role concept → Training video, help text
5. **FK Update Failures** - Orphaned records → Integrity check, clean orphans

---

## Questions for Clarification

1. **Downtime Window**: Can we schedule 2-hour maintenance (Sunday 2am-4am) for migration?
2. **Duplicate Codes**: Auto-append suffix ("-MAT"/"-PROD") or manual resolution?
3. **Legacy Tables**: Keep for 2 weeks (safety) or drop immediately?
4. **Item Images**: In scope or deferred?
5. **Approval Workflow**: Required or optional?

**Recommendation**: Use AskUserQuestion tool to clarify with Marcus

---

## Next Steps

**Ready for Sylvia Critique**:
- ✅ Requirements: 8 functional, 7 acceptance criteria
- ✅ Codebase: 4 patterns, 18 files identified
- ✅ Constraints: 11 tables, 18 queries, 400 hours
- ✅ Approach: 6 phases, 6-8 weeks
- ✅ Security: 5 vulnerabilities + mitigations
- ✅ Complexity: COMPLEX, realistic estimate

**Sylvia Should Review**:
1. Are requirements complete?
2. Is approach sound (migration, SCD Type 2, FK updates)?
3. Are security risks identified?
4. Is complexity realistic?
5. Proceed with implementation?

---

## Research Artifacts

**Files Read** (12 files):
- `items.yaml` (949 lines)
- `terminology-standards.md` (420 lines)
- `V0.0.6-0.0.13` migrations (1,500+ lines)
- `RESOLVER_*_GUIDE.md` (1,200+ lines)
- `sales-materials.graphql/resolver.ts` (350+ lines)

**Grep Searches**: 4 searches (materials/products, items, resolvers, RLS)
**Glob Patterns**: 2 patterns (cynthia, terminology)
**Time Spent**: 145 minutes (~2.5 hours)

---

## Appendix: Real-World Examples

### Example 1: Dual-Role Item (Blank Labels)
```yaml
Item:
  item_code: "LABEL-4X6-BLANK"
  can_be_purchased: TRUE  # Buy from vendors
  can_be_sold: TRUE       # Sell to customers
  base_uom: SHEETS

  material_attributes:
    vendor_part_number: "VEN-LABEL-4X6"
    lead_time_days: 14

  product_attributes:
    customer_facing_name: "Premium 4x6 Blank Labels"
    default_sales_price: 0.05

  uom_conversions:
    - from: ROLLS, to: SHEETS, factor: 5000

  uom_preferences:
    PURCHASE: ROLLS
    SALES: SHEETS
    INVENTORY: SHEETS

Usage:
  - Customer orders 100,000 sheets → Ship (product role)
  - Production consumes 100,000 sheets → Inventory (material role)
  - Purchase 20 rolls → Convert to 100,000 sheets
```

### Example 2: Material-Only (Ink)
```yaml
Item:
  item_code: "INK-CYAN-5GAL"
  can_be_purchased: TRUE
  can_be_sold: FALSE
  measurement_type: CONTINUOUS  # Liquid, decimals OK

  material_attributes:
    is_hazmat: TRUE
    shelf_life_days: 365
```

### Example 3: Product-Only (Custom Box)
```yaml
Item:
  item_code: "BOX-CUSTOM-ACME-001"
  can_be_purchased: FALSE
  can_be_sold: TRUE
  can_be_manufactured: TRUE
  measurement_type: DISCRETE  # Countable, no decimals

  product_attributes:
    requires_artwork_approval: TRUE
```

---

**END OF REPORT - Ready for Sylvia Critique**
