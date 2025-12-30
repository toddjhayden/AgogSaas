# Cynthia Research Report: Customer-Specific Pricing Engine

**Feature:** REQ-CUSTOMER-PRICING-001 / Customer-Specific Pricing Engine
**Researched By:** Cynthia (Research Specialist)
**Date:** 2025-12-21
**Complexity:** Medium
**Estimated Effort:** 3-4 weeks

---

## Executive Summary

The Customer-Specific Pricing Engine will support volume discounts, customer-specific pricing, promotional pricing, contract pricing, and price history tracking (SCD Type 2). The goal is to increase average order value by 15% through sophisticated pricing strategies.

**CRITICAL FINDING:** The database schema and GraphQL API infrastructure already exist with comprehensive support for customer pricing (`customer_pricing` table), dynamic pricing rules (`pricing_rules` table), and quantity breaks (JSONB fields). However, **NO PRICING CALCULATION ENGINE EXISTS** - the system has the data structures but lacks the business logic to execute pricing calculations, apply rules by priority, handle quantity breaks, enforce approval workflows for large discounts, or maintain price history.

**Key Findings:**
- ✅ Database schema complete (`customer_pricing`, `pricing_rules` tables exist since V0.0.6)
- ✅ GraphQL queries functional for reading pricing data
- ✅ SCD Type 2 support via `effective_from`/`effective_to` columns
- ❌ **MISSING: Pricing calculation engine/service**
- ❌ **MISSING: Rule evaluation logic (priority-based)**
- ❌ **MISSING: Quantity break calculation algorithm**
- ❌ **MISSING: Promotional pricing application**
- ❌ **MISSING: Contract pricing validation**
- ❌ **MISSING: Discount approval workflow (>20% threshold)**
- ❌ **MISSING: Price history queries (as-of-date lookups)**
- ❌ **MISSING: Pricing audit trail and change notifications**

---

## Functional Requirements

### Primary Requirements (from OWNER_REQUESTS.md lines 83-98)

**1. Base Price Lists Per Item** (line 92)
- [ ] List price stored in `products.list_price` (already exists)
- [ ] Currency support via `products.price_currency_code` (already exists)
- [ ] Base price as fallback when no customer-specific pricing exists
- [ ] Multi-currency support with exchange rate conversion

**2. Customer-Specific Price Overrides** (line 93)
- [ ] Customer-product pricing in `customer_pricing` table (already exists)
- [ ] Override list price with customer-specific `unit_price`
- [ ] Support different UOM (Unit of Measure) pricing
- [ ] Effective date range support (`effective_from`, `effective_to`)
- [ ] Multiple concurrent pricing agreements per customer-product

**3. Volume Discount Tiers (Quantity Breaks)** (line 94)
- [ ] Quantity breaks stored in JSONB `customer_pricing.price_breaks` field (already exists)
- [ ] Example: `[{min_qty: 1000, price: 10.50}, {min_qty: 5000, price: 9.75}]`
- [ ] Algorithm needed to find best matching tier based on order quantity
- [ ] Support for percentage discount vs. fixed price tiers
- [ ] Automatic tier calculation during order entry

**4. Promotional Pricing with Date Ranges** (line 95)
- [ ] Promotional rules in `pricing_rules` table with `rule_type = 'PROMOTIONAL'` (already exists)
- [ ] Date-based activation via `effective_from`/`effective_to` (already exists)
- [ ] Support multiple promotions with priority resolution
- [ ] Conditions stored in JSONB `pricing_rules.conditions` field
- [ ] Actions: percentage discount, fixed discount, fixed price, markup

**5. Contract Pricing for Enterprise Customers** (line 96)
- [ ] Contract pricing as `pricing_rules` with `rule_type = 'CONTRACT_PRICING'` (already exists)
- [ ] Link to `vendor_contracts` table for vendor contracts (similar pattern needed for customers)
- [ ] Volume commitment tracking
- [ ] Contract expiration date enforcement
- [ ] Price lock guarantees

**6. Price History for Audit Trail (SCD Type 2)** (line 97)
- [ ] SCD Type 2 columns exist: `effective_from`, `effective_to`, `is_current_version` (NOT in current schema - needs addition)
- [ ] Historical price queries: `customerPricing(asOfDate: Date)` (partially exists in GraphQL)
- [ ] Price change audit: who changed, when, old vs. new value
- [ ] Compliance reporting for price audit requirements
- [ ] **CRITICAL GAP**: `customer_pricing` table does NOT have `is_current_version` flag for SCD Type 2

**7. Pricing Approval Workflow for Discounts > 20%** (line 98)
- [ ] Approval threshold configuration (system setting or tenant-specific)
- [ ] Workflow engine integration (NOT YET IMPLEMENTED - see REQ-SALES-ORDER-ENTRY-001-RESEARCH.md:695)
- [ ] Approval routing based on discount percentage
- [ ] Manager approval required for 20-40% discounts
- [ ] Executive approval required for >40% discounts
- [ ] Approval status tracking and notifications

### Acceptance Criteria

- [ ] Increase average order value by 15% (business metric)
- [ ] Customer-specific pricing applies correctly 100% of the time
- [ ] Volume discounts calculate accurately for all quantity tiers
- [ ] Promotional pricing auto-activates/deactivates on scheduled dates
- [ ] Contract pricing enforces volume commitments and expiration
- [ ] Price history retrievable for any past date (compliance requirement)
- [ ] Discounts >20% blocked until approval granted
- [ ] Price calculation time < 100ms per line item

### Out of Scope

- Dynamic cost-plus pricing (future enhancement)
- Competitor price matching (not requested)
- AI-powered price optimization (future phase)
- Multi-tier distributor pricing (not mentioned)
- Regional pricing by geography (deferred)

---

## Technical Constraints

### Database Requirements

**Existing Tables (Already Created):**

1. **`customer_pricing`** (V0.0.6:774)
   - ✅ id, tenant_id, customer_id, product_id
   - ✅ unit_price, price_currency_code, price_uom
   - ✅ minimum_quantity
   - ✅ price_breaks (JSONB) - For quantity tiers
   - ✅ effective_from, effective_to - For date ranges
   - ✅ is_active
   - ✅ Audit columns: created_at, created_by, updated_at, updated_by
   - ❌ **MISSING: is_current_version** (needed for SCD Type 2 history queries)
   - ❌ **MISSING: approval_status, approved_by_user_id, approved_at** (for discount approvals)

2. **`pricing_rules`** (V0.0.6:1100)
   - ✅ id, tenant_id, rule_code, rule_name, description
   - ✅ rule_type (VOLUME_DISCOUNT, CUSTOMER_TIER, PRODUCT_CATEGORY, SEASONAL, PROMOTIONAL, CLEARANCE, CONTRACT_PRICING)
   - ✅ priority (Integer, lower = higher priority)
   - ✅ conditions (JSONB) - Flexible rule conditions
   - ✅ pricing_action (PERCENTAGE_DISCOUNT, FIXED_DISCOUNT, FIXED_PRICE, MARKUP_PERCENTAGE)
   - ✅ action_value (Decimal)
   - ✅ effective_from, effective_to
   - ✅ is_active
   - ✅ Audit columns: created_at, created_by, updated_at, updated_by

3. **`products`** (V0.0.6:129)
   - ✅ list_price, price_currency_code (base pricing)
   - ✅ standard_material_cost, standard_labor_cost, standard_overhead_cost, standard_total_cost
   - ✅ Margin calculation possible

4. **`customers`** (V0.0.6:644)
   - ✅ pricing_tier (String) - For customer tier-based pricing rules
   - ✅ billing_currency_code - For currency conversion

**Schema Changes Needed:**

```sql
-- Migration: Add SCD Type 2 support to customer_pricing
ALTER TABLE customer_pricing
  ADD COLUMN is_current_version BOOLEAN DEFAULT TRUE;

-- Migration: Add approval workflow columns to customer_pricing
ALTER TABLE customer_pricing
  ADD COLUMN approval_status VARCHAR(20) DEFAULT 'APPROVED', -- PENDING, APPROVED, REJECTED
  ADD COLUMN approved_by_user_id UUID REFERENCES users(id),
  ADD COLUMN approved_at TIMESTAMPTZ,
  ADD COLUMN rejection_reason TEXT;

-- Index for historical queries
CREATE INDEX idx_customer_pricing_current_version
  ON customer_pricing(tenant_id, customer_id, product_id, is_current_version);

-- Index for approval workflow
CREATE INDEX idx_customer_pricing_approval_status
  ON customer_pricing(approval_status, tenant_id);
```

**RLS Policies:**
- ✅ Tenant isolation required (all tables have `tenant_id`)
- ✅ RLS policies should already exist (standard pattern)
- New: Approval workflow RLS - managers can approve within authority limit

**Multi-Tenant:**
- ✅ All tables include `tenant_id` with foreign key to `tenants(id)`
- ✅ All queries MUST filter by tenant_id
- ✅ GraphQL context provides tenant from JWT token

### API Requirements

**Existing GraphQL Queries:**

```graphql
# Already implemented in sales-materials.graphql

customerPricing(
  tenantId: ID!
  customerId: ID
  productId: ID
  asOfDate: Date  # SCD Type 2 support (partially implemented)
): [CustomerPricing!]!

pricingRules(
  tenantId: ID!
  ruleType: PricingRuleType
  isActive: Boolean
  asOfDate: Date
): [PricingRule!]!
```

**Missing GraphQL Queries (Need Implementation):**

```graphql
# NEW: Calculate final price for a customer-product combination
calculatePrice(
  tenantId: ID!
  customerId: ID!
  productId: ID!
  quantity: Float!
  orderDate: Date!
  currencyCode: String
): PriceCalculationResult!

type PriceCalculationResult {
  basePrice: Float!
  customerPrice: Float
  appliedRules: [AppliedPricingRule!]!
  quantityBreakDiscount: Float
  promotionalDiscount: Float
  contractDiscount: Float
  finalPrice: Float!
  currencyCode: String!
  requiresApproval: Boolean!
  approvalThreshold: Float
  discountPercentage: Float
  marginPercentage: Float
}

type AppliedPricingRule {
  ruleId: ID!
  ruleName: String!
  ruleType: String!
  discountAmount: Float!
  priority: Int!
}

# NEW: Get price history for a customer-product
priceHistory(
  tenantId: ID!
  customerId: ID!
  productId: ID!
  startDate: Date
  endDate: Date
): [CustomerPricingHistory!]!

type CustomerPricingHistory {
  effectiveFrom: Date!
  effectiveTo: Date
  unitPrice: Float!
  priceBreaks: JSON
  changedBy: User!
  changeReason: String
}

# NEW: Approve pending customer pricing
approvePricing(
  pricingId: ID!
  approvedByUserId: ID!
  comments: String
): CustomerPricing!

# NEW: Bulk price update (for contract renewals)
bulkUpdateCustomerPricing(
  tenantId: ID!
  customerId: ID
  productCategoryId: ID
  priceAdjustment: PriceAdjustmentInput!
  effectiveFrom: Date!
): [CustomerPricing!]!

input PriceAdjustmentInput {
  adjustmentType: PriceAdjustmentType! # PERCENTAGE, FIXED_AMOUNT
  adjustmentValue: Float!
  reason: String!
}

enum PriceAdjustmentType {
  PERCENTAGE_INCREASE
  PERCENTAGE_DECREASE
  FIXED_AMOUNT_INCREASE
  FIXED_AMOUNT_DECREASE
}
```

**Existing GraphQL Mutations:**

```graphql
# Already implemented (basic CRUD)
createPricingRule(...): PricingRule!
updatePricingRule(...): PricingRule!
deletePricingRule(...): Boolean!
```

**Missing GraphQL Mutations:**

See above `approvePricing` and `bulkUpdateCustomerPricing`

**Authentication:**
- ✅ JWT token required (standard pattern)
- ✅ User context extracted from token
- Approval workflow: Check user role and authority limits

### Security Requirements

**Tenant Isolation:**
- ✅ MUST validate `tenant_id` on every query
- ✅ MUST use RLS policies on all pricing tables
- ✅ NEVER expose pricing data across tenants

**Input Validation:**
- Validate customer_id, product_id exist and belong to tenant
- Validate quantity > 0
- Validate price values are non-negative
- Validate date ranges (effective_from <= effective_to)
- Sanitize JSONB conditions input (prevent injection)

**Authorization:**
- Sales reps: Can view pricing, cannot modify
- Sales managers: Can create/update pricing with approval
- Finance team: Can create/update pricing, approve up to 20%
- Executives: Can approve any discount percentage
- System admin: Full access to pricing configuration

**Audit Requirements:**
- Log all price changes (who, when, old value, new value, reason)
- Log all pricing rule applications during order entry
- Log all approval workflow actions
- Retain price history for 7 years (compliance)

### Performance Requirements

**Response Time Targets:**
- Price calculation: < 100ms per line item
- Pricing history query: < 500ms
- Bulk price update: < 5 seconds for 1000 records
- Approval workflow: < 200ms

**Data Volume:**
- Expected: 10,000 customers × 5,000 products = 50M potential customer_pricing records
- Realistic: ~500K active customer-specific pricing agreements
- Pricing rules: ~200-500 active rules per tenant
- Historical records: Growing indefinitely (SCD Type 2)

**Optimization Strategies:**
- Index on (tenant_id, customer_id, product_id, is_current_version)
- Index on (tenant_id, effective_from, effective_to) for date range queries
- Cache frequently accessed pricing rules (Redis)
- Denormalize calculated prices into sales_order_lines for performance
- Partition customer_pricing by tenant_id for large multi-tenant deployments

### Integration Points

**Existing Systems:**

1. **Sales Order Entry** (REQ-SALES-ORDER-ENTRY-001)
   - Price calculation called during order line item entry
   - Real-time price display to user
   - Approval workflow blocks order confirmation if pricing requires approval

2. **Quote Generation** (existing)
   - Same pricing engine used for quotes
   - Quote-to-order conversion preserves pricing snapshot
   - Quote expiration may invalidate promotional pricing

3. **Customer Master** (existing)
   - Customer tier affects pricing rules
   - Customer currency affects price conversion
   - Customer credit limit affects discount approvals

4. **Product Master** (existing)
   - Base list price from products table
   - Product category affects category-based pricing rules
   - Standard cost used for margin validation

5. **Finance Module** (existing)
   - Margin percentage validation (prevent selling below cost)
   - Revenue recognition for contract pricing
   - Price variance analysis (actual vs. standard)

**External APIs:**
- None (all internal integration)

**NATS Channels:**
- `agog.pricing.calculated` - Publish price calculation events for analytics
- `agog.pricing.approval.requested` - Workflow engine integration (future)
- `agog.pricing.updated` - Notify downstream systems of price changes

---

## Codebase Analysis

### Existing Patterns Found

**1. Similar Feature: Material Supplier Pricing** (materials_suppliers table)

- **Files:**
  - `migrations/V0.0.6__create_sales_materials_procurement.sql:332` (materials_suppliers table)
  - `src/graphql/schema/sales-materials.graphql:52` (MaterialSupplier type)
  - `src/graphql/resolvers/sales-materials.resolver.ts` (materialSuppliers query)

- **Pattern:**
  - Same structure: material_id + vendor_id + unit_price + price_breaks (JSONB)
  - Effective dating: effective_from, effective_to
  - Preferred vendor flag (similar to preferred pricing)
  - Quantity breaks stored as JSONB array

- **Can Reuse:**
  - JSONB quantity break structure
  - Date range query logic
  - Preferred vendor/pricing pattern
  - GraphQL resolver structure

- **Lessons Learned:**
  - JSONB price_breaks work well for flexible quantity tiers
  - Date range queries need careful handling of NULL effective_to
  - Need index on (tenant_id, material_id, vendor_id, effective_from)

**2. Related Code: Pricing Rules GraphQL**

- **Files:**
  - `src/graphql/schema/sales-materials.graphql:938-989` (PricingRule type, enums)
  - `src/graphql/resolvers/sales-materials.resolver.ts:905-913` (pricingRules query)
  - `src/graphql/resolvers/sales-materials.resolver.ts:1804-1860` (mutations)

- **Pattern:**
  - CRUD operations: create, update, delete pricing rules
  - Query with filters: tenant_id, rule_type, is_active, as_of_date
  - Enums: PricingRuleType, PricingAction
  - JSONB conditions for flexible rule criteria

- **Can Reuse:**
  - GraphQL resolver structure
  - Enum pattern for rule types and actions
  - Date filtering logic (`asOfDate` parameter)
  - JSONB conditions pattern

- **Lessons Learned:**
  - Resolver uses parameterized queries (good security)
  - Mapping functions convert snake_case DB to camelCase GraphQL
  - Date filters check both effective_from and effective_to

**3. Existing Code: Customer Pricing GraphQL**

- **Files:**
  - `src/graphql/schema/sales-materials.graphql:666-695` (CustomerPricing type)
  - `src/graphql/resolvers/sales-materials.resolver.ts:622-654` (customerPricing query)

- **Pattern:**
  - Query: `customerPricing(tenantId, customerId, productId, asOfDate)`
  - Returns array of CustomerPricing objects
  - Supports historical queries via asOfDate
  - Maps DB rows to GraphQL types

- **Can Reuse:**
  - Existing query structure
  - Date filtering logic
  - Resolver mapping pattern

- **Lessons Learned:**
  - Query builder uses dynamic WHERE clause construction
  - Date filtering: `effective_from <= asOfDate AND (effective_to IS NULL OR effective_to >= asOfDate)`
  - Returns all matching records, not just the "best" price

**4. Architectural Pattern: Service Layer**

- **Files:**
  - None found - resolvers directly query database (NO SERVICE LAYER)

- **Issue:**
  - Violates separation of concerns
  - Business logic mixed with data access
  - No reusable pricing calculation service

- **Recommendation:**
  - Create `pricing.service.ts` with business logic
  - Resolvers should call service, not DB directly
  - Service returns domain objects, resolver maps to GraphQL types

### Files That Need Modification

| File Path | Change Type | Reason |
|-----------|-------------|--------|
| `backend/src/services/pricing.service.ts` | **CREATE** | New pricing calculation engine service |
| `backend/src/services/pricing-rules.service.ts` | **CREATE** | Pricing rule evaluation logic |
| `backend/src/services/approval.service.ts` | **CREATE** | Pricing approval workflow (if not exists) |
| `backend/src/graphql/schema/sales-materials.graphql` | **MODIFY** | Add new queries/mutations for pricing |
| `backend/src/graphql/resolvers/sales-materials.resolver.ts` | **MODIFY** | Add resolvers for new pricing queries |
| `backend/migrations/V0.0.14__enhance_customer_pricing.sql` | **CREATE** | Add SCD Type 2 and approval columns |
| `backend/src/types/pricing.types.ts` | **CREATE** | TypeScript interfaces for pricing domain |
| `backend/tests/unit/pricing.service.test.ts` | **CREATE** | Unit tests for pricing engine |
| `backend/tests/integration/pricing.integration.test.ts` | **CREATE** | Integration tests for pricing API |
| `backend/src/utils/price-calculator.ts` | **CREATE** | Pure functions for price math |

### Architectural Patterns in Use

- **No Service Layer**: Resolvers directly query database (anti-pattern for complex business logic)
- **Repository Pattern**: Not explicitly used (could improve testability)
- **GraphQL-First**: Schema-first approach with code-first resolvers
- **Dependency Injection**: Not used (manual wiring in resolvers)
- **Error Handling**: Try/catch with error logging (basic)

### Code Conventions

- **Naming:** camelCase for variables/functions, PascalCase for types, snake_case for DB columns
- **File Structure:** Feature-based (sales-materials.graphql, sales-materials.resolver.ts)
- **Testing:** Jest framework (unit tests lacking, integration tests needed)
- **GraphQL:** Schema-first with separate .graphql files, resolvers in .ts files
- **Database:** PostgreSQL with parameterized queries ($1, $2, etc.)
- **TypeScript:** Strong typing for GraphQL types, looser typing in resolvers

---

## Edge Cases & Error Scenarios

### Edge Cases to Handle

**1. Overlapping Effective Dates**
- **Scenario:** Customer has multiple pricing records with overlapping effective dates for same product
- **Expected Behavior:** Return most recent record by created_at, or highest priority
- **Handling:** Add validation to prevent overlaps, or add priority column

**2. No Pricing Data**
- **Scenario:** Customer-product combination has no customer_pricing record
- **Expected Behavior:** Fall back to product list price
- **Handling:** Pricing engine checks customer_pricing first, then products.list_price

**3. Multiple Applicable Pricing Rules**
- **Scenario:** Customer qualifies for both VOLUME_DISCOUNT and PROMOTIONAL rules
- **Expected Behavior:** Apply rules by priority (lower number = higher priority), then cumulative or best-only
- **Handling:** Sort by priority, apply in order, decide stacking vs. best-only strategy

**4. Quantity Break Boundary**
- **Scenario:** Order quantity = 1000, break at 1000 units
- **Expected Behavior:** Apply the 1000-unit break price (inclusive)
- **Handling:** Use >= comparison, not >

**5. Future Effective Date**
- **Scenario:** Customer_pricing has effective_from in the future
- **Expected Behavior:** Use current pricing until future date, then switch
- **Handling:** Filter by `effective_from <= orderDate`

**6. Expired Pricing**
- **Scenario:** Customer_pricing has effective_to in the past
- **Expected Behavior:** Fall back to list price or error
- **Handling:** Filter by `effective_to IS NULL OR effective_to >= orderDate`

**7. Currency Mismatch**
- **Scenario:** Customer billing currency != product price currency
- **Expected Behavior:** Convert using exchange rate
- **Handling:** Query exchange_rates table, apply conversion, log for audit

**8. Negative Pricing**
- **Scenario:** Rule applies 110% discount (bug in configuration)
- **Expected Behavior:** Reject, log error, notify admin
- **Handling:** Validation: final price must be > 0

**9. Below-Cost Pricing**
- **Scenario:** Pricing rules result in price < standard_total_cost
- **Expected Behavior:** Warning (not blocker), flag for approval
- **Handling:** Calculate margin_percentage, if negative, require executive approval

**10. Approval Workflow Loop**
- **Scenario:** User requests approval, approver rejects, user re-submits same price
- **Expected Behavior:** Track rejection history, escalate to higher authority
- **Handling:** Store rejection_reason, increment rejection_count, escalation rules

### Error Scenarios

**1. Network Failures**
- GraphQL query timeout (> 30 seconds)
- Database connection lost mid-query
- NATS message delivery failure (pricing update event)

**Recovery:** Retry with exponential backoff, return cached pricing if available, log failure

**2. Validation Failures**
- Invalid customer_id (not found or wrong tenant)
- Invalid product_id (not found or inactive)
- Invalid quantity (negative or zero)
- Invalid date range (effective_from > effective_to)

**Recovery:** Return 400 Bad Request with specific error message, do not save

**3. Permission Denied**
- Sales rep tries to approve pricing (requires manager role)
- User tries to view competitor tenant's pricing (RLS violation)
- Approval authority exceeded (user can approve up to 20%, request is 30%)

**Recovery:** Return 403 Forbidden, log security event, notify admin if repeated

**4. Data Integrity Issues**
- customer_pricing.product_id references deleted product
- pricing_rule.conditions JSONB is malformed
- Orphaned records after tenant deletion

**Recovery:** Foreign key constraints prevent orphans, JSONB validation on insert/update, soft-delete products

**5. Concurrency Issues**
- Two users update same customer_pricing record simultaneously
- Race condition: order placed using old price during price update

**Recovery:** Optimistic locking (version column), price snapshot in sales_order_lines preserves order price

### Recovery Strategies

- **Retry Logic:** Transient errors (network, DB) retry 3 times with exponential backoff
- **Graceful Degradation:** If pricing engine fails, fall back to list price, log warning
- **Price Snapshot:** Store calculated price in sales_order_lines, not reference (prevents retroactive changes)
- **Audit Trail:** All failures logged with context (tenant, user, product, customer, timestamp)
- **Circuit Breaker:** If pricing service fails repeatedly, bypass and use cached prices
- **User-Friendly Errors:** "Unable to calculate price. Please contact support." (not "500 Internal Server Error")

---

## Security Analysis

### Vulnerabilities to Avoid

**1. Tenant Isolation Breach**
- **Risk:** Sales rep queries pricing for customer in different tenant
- **Mitigation:**
  - MUST validate tenant_id from JWT matches customer.tenant_id
  - MUST use RLS policies on all pricing tables
  - NEVER trust client-provided tenant_id
  - Test: Attempt cross-tenant query, should return 403 or empty result

**2. SQL Injection**
- **Risk:** JSONB conditions field contains SQL injection payload
- **Mitigation:**
  - Use parameterized queries ($1, $2, etc.) ALWAYS
  - Validate JSONB structure before INSERT/UPDATE
  - Escape special characters in dynamic WHERE clauses
  - Test: Inject `'; DROP TABLE pricing_rules; --` in conditions field

**3. Price Manipulation**
- **Risk:** User modifies GraphQL request to pass lower price
- **Mitigation:**
  - Price calculation MUST happen server-side
  - NEVER trust client-provided prices
  - Sales order line price should be read-only (calculated by server)
  - Test: Modify GraphQL mutation payload, should be ignored

**4. Approval Bypass**
- **Risk:** User circumvents approval workflow by editing database directly
- **Mitigation:**
  - Database trigger validates approval_status matches discount percentage
  - Application enforces workflow (cannot set approved without approver_id)
  - Audit log tracks all status changes
  - Test: Attempt to set approval_status=APPROVED without approver, should fail

**5. Historical Data Tampering**
- **Risk:** User modifies past pricing records to affect reports
- **Mitigation:**
  - SCD Type 2: Never UPDATE historical records, only INSERT new versions
  - Audit trail with created_by prevents falsification
  - Immutable records after effective_to is set
  - Test: Attempt to UPDATE record with effective_to in past, should fail

**6. Unauthorized Discounts**
- **Risk:** Sales rep creates 50% discount rule without approval
- **Mitigation:**
  - Pricing rules require approval workflow integration
  - Role-based permissions: only managers can create rules
  - Executive approval for rules >20% discount
  - Test: Sales rep creates 50% rule, should be blocked or require approval

### Existing Security Patterns

- **Authentication:** JWT token validation (see `src/middleware/auth.ts` - ASSUME EXISTS)
- **Tenant Validation:** Extract tenant_id from JWT, validate on every query (ASSUME EXISTS)
- **RLS Policies:** Row-level security on all tables (see `database/rls-policies/` - CHECK IF EXISTS)
- **Parameterized Queries:** All resolvers use $1, $2 style (VERIFIED in sales-materials.resolver.ts)
- **Input Validation:** GraphQL schema enforces types, but need business rule validation

### Security Recommendations

1. **Create Pricing Service with Security Layer:**
   ```typescript
   class PricingService {
     async calculatePrice(context: SecurityContext, request: PriceRequest) {
       // Validate tenant isolation
       if (context.tenantId !== request.tenantId) throw new ForbiddenError();

       // Validate customer belongs to tenant
       await this.validateCustomerTenant(request.customerId, context.tenantId);

       // Perform pricing calculation (business logic)
       const price = await this.performCalculation(request);

       // Audit log
       await this.auditLog(context.userId, 'PRICE_CALCULATED', request, price);

       return price;
     }
   }
   ```

2. **Implement Approval Workflow Security:**
   - Check user role (manager, executive)
   - Check authority limit (manager: up to 20%, executive: unlimited)
   - Prevent self-approval (user cannot approve own pricing)
   - Audit all approval actions

3. **Add Database Triggers for Validation:**
   ```sql
   CREATE OR REPLACE FUNCTION validate_pricing_approval()
   RETURNS TRIGGER AS $$
   BEGIN
     -- Calculate discount percentage
     DECLARE
       list_price DECIMAL;
       discount_pct DECIMAL;
     BEGIN
       SELECT list_price INTO list_price FROM products WHERE id = NEW.product_id;
       discount_pct := ((list_price - NEW.unit_price) / list_price) * 100;

       -- If discount > 20%, require approval
       IF discount_pct > 20 AND NEW.approval_status = 'APPROVED' AND NEW.approved_by_user_id IS NULL THEN
         RAISE EXCEPTION 'Discounts > 20%% require approval';
       END IF;
     END;

     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;

   CREATE TRIGGER trg_validate_pricing_approval
   BEFORE INSERT OR UPDATE ON customer_pricing
   FOR EACH ROW EXECUTE FUNCTION validate_pricing_approval();
   ```

---

## Implementation Recommendations

### Recommended Approach

**Phase 1: Database Schema Enhancement (1-2 days)**
- Add SCD Type 2 columns to `customer_pricing` (is_current_version)
- Add approval workflow columns (approval_status, approved_by_user_id, approved_at, rejection_reason)
- Create database triggers for validation
- Create indexes for performance
- Test with sample data

**Phase 2: Pricing Calculation Service (1 week)**
- Create `pricing.service.ts` with core business logic
- Implement `calculatePrice()` method
- Implement quantity break algorithm
- Implement pricing rule evaluation (priority-based)
- Implement currency conversion
- Write unit tests (>80% coverage)

**Phase 3: GraphQL API Enhancement (3-4 days)**
- Add new queries: `calculatePrice`, `priceHistory`
- Add new mutations: `approvePricing`, `bulkUpdateCustomerPricing`
- Modify existing resolvers to use new service
- Add GraphQL types: `PriceCalculationResult`, `AppliedPricingRule`
- Write integration tests

**Phase 4: Approval Workflow Integration (3-4 days)**
- Create `approval.service.ts` (if not exists)
- Implement approval routing logic (role + authority limits)
- Implement notification system (email/NATS)
- Implement approval UI (frontend - out of scope for Cynthia)
- Test approval scenarios

**Phase 5: Historical Queries & SCD Type 2 (2-3 days)**
- Implement `priceHistory` query
- Implement as-of-date lookups
- Implement price change audit trail
- Test historical data integrity
- Performance testing with large datasets

**Phase 6: QA Testing (1 week)**
- Unit tests (pricing.service.test.ts)
- Integration tests (pricing API)
- Security testing (tenant isolation, SQL injection)
- Performance testing (price calculation < 100ms)
- Edge case testing (overlapping dates, no pricing, etc.)

### Implementation Order

1. **Database First** (blocks everything else)
2. **Service Layer Second** (core business logic)
3. **GraphQL API Third** (exposes service to clients)
4. **Approval Workflow Fourth** (integrates with service)
5. **Testing Last** (validates everything)

### Libraries/Tools Recommended

**1. Decimal.js** (for precise price calculations)
- Purpose: Avoid floating-point rounding errors in currency
- NPM: `npm install decimal.js`
- Usage: `new Decimal(price).times(quantity).toDecimalPlaces(2)`

**2. date-fns** (for date range queries)
- Purpose: Date manipulation for effective_from/to queries
- NPM: `npm install date-fns`
- Usage: `isWithinInterval(orderDate, {start: effectiveFrom, end: effectiveTo})`

**3. joi** or **zod** (for input validation)
- Purpose: Validate GraphQL input beyond type checking
- NPM: `npm install joi` or `npm install zod`
- Usage: Schema validation for JSONB conditions, price ranges, etc.

**4. Redis** (for pricing rule cache)
- Purpose: Cache frequently accessed pricing rules (read-heavy)
- Already in use? (check docker-compose.yml)
- Usage: Cache pricing rules by tenant_id, TTL 5 minutes

**5. Winston** (for audit logging)
- Purpose: Structured logging for price changes and approvals
- NPM: `npm install winston`
- Usage: Log all pricing events to file/DB for compliance

### Complexity Assessment

**This Feature Is: MEDIUM**

**Reasoning:**
- Database schema exists (LOW complexity)
- Business logic is moderately complex (quantity breaks, rule evaluation, SCD Type 2)
- Approval workflow integration adds complexity
- Security requirements (tenant isolation, audit trail) add rigor
- NOT simple CRUD (pricing calculations have edge cases)
- NOT overly complex (not AI/ML, not real-time streaming, not distributed transactions)

### Estimated Effort

- **Database (Ron):** 1-2 days
  - Write migration V0.0.14
  - Add columns, indexes, triggers
  - Test with sample data

- **Backend (Roy):** 2.5-3 weeks
  - Week 1: Pricing service (calculatePrice, rules evaluation)
  - Week 2: GraphQL API, approval workflow
  - Week 3: Historical queries, testing, bug fixes

- **Frontend (Jen):** 0 weeks (out of scope for pricing engine)
  - Pricing display in order entry (separate REQ)
  - Approval workflow UI (separate REQ)

- **QA (Billy):** 3-4 days
  - Unit tests review
  - Integration tests
  - Security testing
  - Performance testing

- **DevOps (Miki):** 1 day
  - Deploy migration
  - Monitor performance
  - Cache configuration (Redis)

**Total Estimated Effort: 3-4 weeks**

---

## Blockers & Dependencies

### Blockers (Must Resolve Before Starting)

- [ ] **NONE** - No hard blockers identified
- [ ] Optional: Workflow engine implementation (can use simple status flags as interim solution)

### Dependencies (Coordinate With)

**1. REQ-SALES-ORDER-ENTRY-001 (Sarah's team)**
- Pricing engine will be called from order entry workflow
- Need coordination on API contract (PriceCalculationResult type)
- Order entry UI will display calculated prices
- Approval workflow blocks order confirmation

**2. Item Master (REQ-ITEM-MASTER-001) (Marcus's team)**
- Product list prices from products table
- Product costs for margin calculation
- Product category for category-based pricing rules

**3. Customer Master (Existing)**
- Customer pricing_tier field
- Customer billing_currency_code
- Customer credit_limit (affects discount approvals)

**4. Finance Module (Existing)**
- Standard cost data for margin validation
- Currency exchange rates
- Revenue recognition for contract pricing

### Risks

**Risk 1: Pricing Rule Complexity Explosion**
- **Description:** Customers request increasingly complex pricing rules (combinatorial conditions)
- **Likelihood:** High
- **Impact:** Medium (slows down price calculation)
- **Mitigation:**
  - Limit rule complexity (max 5 conditions per rule)
  - Cache rule evaluation results
  - Index JSONB conditions for performance

**Risk 2: SCD Type 2 Data Growth**
- **Description:** Historical pricing records grow indefinitely, slow queries
- **Likelihood:** High (if pricing changes frequently)
- **Impact:** Medium (query performance degrades over time)
- **Mitigation:**
  - Partition customer_pricing table by year
  - Archive records older than 7 years
  - Index on is_current_version for fast current-only queries

**Risk 3: Approval Workflow Bottleneck**
- **Description:** Large discount requests pile up waiting for executive approval
- **Likelihood:** Medium
- **Impact:** High (blocks sales orders)
- **Mitigation:**
  - Auto-approve low-risk discounts (< 10%)
  - Escalation rules (if not approved in 24 hours, notify VP)
  - Temporary approval authority delegation

**Risk 4: Currency Conversion Errors**
- **Description:** Exchange rates outdated or missing, incorrect price conversions
- **Likelihood:** Low (if exchange rate feed is reliable)
- **Impact:** High (financial errors, customer disputes)
- **Mitigation:**
  - Daily exchange rate updates from reliable source
  - Validation: exchange rate must be updated within 24 hours
  - Manual override option for finance team

---

## Questions for Clarification

### Unanswered Questions

**1. Pricing Rule Stacking vs. Best-Only**
- **Question:** When multiple pricing rules apply (e.g., volume discount + promotional discount), should they stack (cumulative) or apply best-only?
- **Impact:** Affects pricing calculation algorithm significantly
- **Recommendation:** Ask Sarah (product owner) for business decision

**2. Approval Authority Limits**
- **Question:** What are the exact discount thresholds for each role?
  - Sales rep: Can approve up to X%?
  - Sales manager: Can approve up to Y%?
  - VP Sales: Can approve up to Z%?
  - CFO: Unlimited?
- **Impact:** Determines approval routing logic
- **Recommendation:** Get approval matrix from Sarah or Finance team

**3. Contract Pricing Volume Commitments**
- **Question:** Should system enforce volume commitments (e.g., customer must order 10K units to get contract price)?
- **Impact:** Requires tracking cumulative order volume against contract
- **Recommendation:** Ask Sarah if enforcement is required or just reporting

**4. Price Change Notifications**
- **Question:** When customer pricing changes, should customers be notified? Auto-email or manual?
- **Impact:** Requires notification system integration
- **Recommendation:** Ask Sarah about notification requirements

**5. Historical Price Audit Period**
- **Question:** How long must price history be retained? 7 years (compliance)? Forever?
- **Impact:** Affects data archival strategy
- **Recommendation:** Confirm with Finance/Legal team

**6. Multi-Currency Pricing**
- **Question:** Can same customer have different prices in different currencies? Or single currency per customer?
- **Impact:** Affects customer_pricing table design (add currency_code to unique constraint?)
- **Recommendation:** Ask Sarah about multi-currency requirements

### Use AskUserQuestion Tool

**Recommended:** Before starting implementation, clarify questions 1-2 above with Sarah (product owner). Questions 3-6 can be deferred or use default assumptions.

---

## Next Steps

### Ready for Sylvia Critique

- ✅ Requirements analyzed (from OWNER_REQUESTS.md)
- ✅ Codebase researched (database schema, GraphQL API, resolvers)
- ✅ Technical constraints documented (database, API, security, performance)
- ✅ Implementation approach recommended (6 phases, 3-4 weeks)
- ✅ Risks identified and mitigated
- ✅ Questions flagged for clarification

### Sylvia Should Review

1. **Are the requirements complete?**
   - Are the 7 functional requirements sufficient?
   - Are acceptance criteria measurable?
   - Are edge cases covered?

2. **Is the recommended approach sound?**
   - Is the phased approach appropriate?
   - Should we use a service layer (vs. resolver-only)?
   - Is the complexity estimate realistic (Medium, 3-4 weeks)?

3. **Are security risks identified?**
   - Is tenant isolation sufficient?
   - Is approval workflow secure?
   - Are audit requirements met?

4. **Is the complexity estimate realistic?**
   - Is 3-4 weeks sufficient for Roy (backend)?
   - Are dependencies with other REQs manageable?
   - Are there hidden complexities?

5. **Should we proceed with implementation?**
   - Are there blockers we missed?
   - Should we clarify questions first?
   - Should we prototype the pricing engine before full implementation?

---

## Research Artifacts

### Files Read

1. `OWNER_REQUESTS.md` (lines 83-98) - Requirements
2. `backend/src/graphql/schema/sales-materials.graphql` - GraphQL types and operations
3. `backend/migrations/V0.0.6__create_sales_materials_procurement.sql` (lines 774-814, 1100-1150) - customer_pricing and pricing_rules tables
4. `backend/src/graphql/resolvers/sales-materials.resolver.ts` (lines 622-654, 905-913) - customerPricing and pricingRules queries
5. `backend/agent-output/deliverables/cynthia-research-REQ-SALES-ORDER-ENTRY-001.md` - Related research (pricing calculation flow)
6. `backend/docs/REQ-SALES-ORDER-ENTRY-001-RESEARCH.md` (lines 336-346) - Pricing calculation flow

### Grep Searches Performed

- Pattern: `pricing` - Found 3 files (resolvers, scripts, graphql schema)
- Pattern: `customer_pricing` - Found 30+ matches (migrations, resolvers, schema, docs)
- Pattern: `pricing_rules` - Found 25+ matches (migrations, resolvers, schema, docs)
- Pattern: `volume.*discount|quantity.*break` (case-insensitive) - Found 8 files (graphql, migrations, docs)
- Pattern: `approval.*workflow|requires.*approval` - Found 20 matches (purchase orders, timecards, docs)

### Glob Patterns Used

- `**/sales*.{graphql,ts,yaml}` - Found 2 files
- `**/pricing*.{graphql,ts,yaml}` - Found 0 files (pricing is embedded in sales-materials)
- `**/customer*.{graphql,yaml}` - Found 1 file (customer-rejection.yaml)
- `**/migrations/*.sql` - Found 15 migration files
- `**/item*.{graphql,yaml,ts}` - Found items.yaml

### Key Findings

1. **Database schema exists** but lacks SCD Type 2 columns (is_current_version)
2. **GraphQL queries exist** but lack pricing calculation engine
3. **No service layer** - resolvers directly query database (anti-pattern for complex logic)
4. **JSONB price_breaks** pattern used in materials_suppliers (can reuse for customer_pricing)
5. **Approval workflow** mentioned in requirements but NOT implemented (deferred to future)
6. **Similar pattern** in materials_suppliers table provides reference implementation

### Time Spent

- Requirements analysis: 30 minutes
- Database schema research: 45 minutes
- GraphQL API research: 30 minutes
- Resolver code analysis: 30 minutes
- Related features research: 45 minutes
- Documentation writing: 2 hours
- **Total: ~5 hours**

---

## Recommendations for Roy (Backend Developer)

### Start Here

1. **Read this research report thoroughly** (especially Technical Constraints, Edge Cases, Security Analysis)
2. **Review existing code:**
   - `backend/src/graphql/resolvers/sales-materials.resolver.ts` (lines 622-654, 905-913)
   - `backend/migrations/V0.0.6__create_sales_materials_procurement.sql` (lines 774-814, 1100-1150)
3. **Create service layer** (do NOT put business logic in resolvers)
4. **Write tests FIRST** (TDD approach for pricing calculation engine)
5. **Start with Phase 1** (database migration) and get Ron's help
6. **Coordinate with Jen** (if frontend integration needed for approval workflow)

### Key Design Decisions

**Decision 1: Pricing Rule Stacking**
- **Option A:** Cumulative (apply all rules, sum discounts)
- **Option B:** Best-only (apply single best rule)
- **Recommendation:** Ask Sarah, default to best-only (simpler logic)

**Decision 2: Service Layer Architecture**
- **Option A:** Single `pricing.service.ts` with all logic
- **Option B:** Separate `pricing.service.ts`, `pricing-rules.service.ts`, `approval.service.ts`
- **Recommendation:** Option B (separation of concerns)

**Decision 3: Caching Strategy**
- **Option A:** No caching (query DB every time)
- **Option B:** Redis cache for pricing rules (5 min TTL)
- **Option C:** In-memory cache with cache invalidation
- **Recommendation:** Option B (balance performance + freshness)

### Potential Pitfalls

1. **Floating-point rounding errors** - Use Decimal.js for all currency math
2. **SQL injection in JSONB** - Always parameterize, validate structure
3. **Tenant isolation bugs** - Test cross-tenant queries, should return empty or 403
4. **Date range logic errors** - Test boundary conditions (effective_from = orderDate, NULL effective_to)
5. **Performance with large datasets** - Test with 1M+ customer_pricing records, ensure indexes work

---

**END OF REPORT**

---

## Appendix: Sample Data Structures

### Sample customer_pricing Record

```json
{
  "id": "uuid-123",
  "tenant_id": "tenant-abc",
  "customer_id": "customer-456",
  "product_id": "product-789",
  "unit_price": 10.50,
  "price_currency_code": "USD",
  "price_uom": "M",
  "minimum_quantity": 1000,
  "price_breaks": [
    {"min_qty": 1000, "price": 10.50},
    {"min_qty": 5000, "price": 9.75},
    {"min_qty": 10000, "price": 9.00}
  ],
  "effective_from": "2025-01-01",
  "effective_to": null,
  "is_active": true,
  "is_current_version": true,
  "approval_status": "APPROVED",
  "approved_by_user_id": "user-999",
  "approved_at": "2024-12-15T10:30:00Z",
  "created_at": "2024-12-15T10:00:00Z",
  "created_by": "user-888"
}
```

### Sample pricing_rules Record

```json
{
  "id": "uuid-456",
  "tenant_id": "tenant-abc",
  "rule_code": "PROMO-Q1-2025",
  "rule_name": "Q1 2025 Promotional Discount",
  "description": "10% off all labels for Q1 2025",
  "rule_type": "PROMOTIONAL",
  "priority": 5,
  "conditions": {
    "product_category": "LABELS",
    "customer_tier": ["GOLD", "PLATINUM"],
    "min_order_value": 5000
  },
  "pricing_action": "PERCENTAGE_DISCOUNT",
  "action_value": 10.00,
  "effective_from": "2025-01-01",
  "effective_to": "2025-03-31",
  "is_active": true,
  "created_at": "2024-12-01T09:00:00Z",
  "created_by": "user-777"
}
```

### Sample PriceCalculationResult

```json
{
  "basePrice": 12.00,
  "customerPrice": 10.50,
  "appliedRules": [
    {
      "ruleId": "uuid-456",
      "ruleName": "Q1 2025 Promotional Discount",
      "ruleType": "PROMOTIONAL",
      "discountAmount": 1.05,
      "priority": 5
    }
  ],
  "quantityBreakDiscount": 0.00,
  "promotionalDiscount": 1.05,
  "contractDiscount": 0.00,
  "finalPrice": 9.45,
  "currencyCode": "USD",
  "requiresApproval": false,
  "approvalThreshold": 20.00,
  "discountPercentage": 21.25,
  "marginPercentage": 35.5
}
```

---

**Research Complete. Ready for Sylvia Critique.**
