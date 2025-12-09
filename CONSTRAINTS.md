**📍 Navigation Path:** [AGOG Home](./README.md) → Constraints

# AGOG System Constraints

> **🚫 Critical:** These are HARD RULES that must NEVER be violated  
> **⚠️ Warning:** Violating these constraints will cause architectural problems  
> **📅 Last Updated:** 2025-10-31

---

## Purpose of This Document

This document lists **non-negotiable architectural and technical constraints** for the AGOG system. These aren't suggestions or best practices - they are **requirements** that must be followed in all code and documentation.

**If you're unsure whether a constraint applies:** It probably does. Ask before violating.

**If you think a constraint should change:** Document the rationale in DECISION_LOG.md and discuss with Todd.

---

## PostgreSQL Requirements

### ✅ MUST USE: PostgreSQL 15+

**Rule:** AGOG requires PostgreSQL version 15 or later

**Rationale:**
- Need `uuid_generate_v7()` (added in PostgreSQL 15)
- Need enhanced MERGE statement capabilities
- Need logical replication improvements
- Need performance optimizations for multi-tenant workloads

**Impact:**
- Deployment environments must have PostgreSQL 15+
- Cannot use earlier PostgreSQL versions
- Cannot use other databases (MySQL, SQL Server, etc.)

**Examples:**
```sql
-- ✅ CORRECT
-- Assumes PostgreSQL 15+ features available
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    data JSONB
);

-- ❌ WRONG
-- Using generic SQL or older PostgreSQL syntax
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- UUIDv4, not v7
    data TEXT -- Should use JSONB
);
```

---

### ✅ MUST USE: Required PostgreSQL Extensions

**Rule:** Install and use these PostgreSQL extensions

**Required Extensions:**
- `uuid-ossp` - For uuid_generate_v7()
- `pgcrypto` - For cryptographic functions (if needed)
- `pg_trgm` - For text search optimization (when implemented)

**Installation:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

---

## UUID Requirements

### ✅ MUST USE: UUIDv7 for Primary Keys

**Rule:** ALL primary keys MUST use `uuid_generate_v7()`, NOT `gen_random_uuid()`

**Rationale:**
- UUIDv7 is time-ordered (first 48 bits = timestamp)
- Better B-tree index performance than random UUIDs
- Easier debugging (can see record creation order)
- Still globally unique
- Industry best practice

**Impact:**
- All `CREATE TABLE` statements use `uuid_generate_v7()`
- All SQL examples use UUIDv7
- Migration from UUIDv4 if changing existing tables

**Examples:**
```sql
-- ✅ CORRECT
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_number VARCHAR(50) NOT NULL
);

-- ❌ WRONG - Random UUID (UUIDv4)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(), -- NO!
    tenant_id UUID NOT NULL,
    customer_number VARCHAR(50) NOT NULL
);

-- ❌ WRONG - SERIAL (not globally unique)
CREATE TABLE customers (
    id SERIAL PRIMARY KEY, -- NO!
    tenant_id UUID NOT NULL,
    customer_number VARCHAR(50) NOT NULL
);
```

---

## Multi-Tenant Requirements

### ✅ MUST HAVE: Tenant Isolation in All Tables

**Rule:** ALL tables (except system tables) MUST include `tenant_id UUID NOT NULL`

**Rationale:**
- Multi-tenant SaaS architecture foundation
- Data isolation for security and compliance
- Required for Row Level Security (RLS)
- Prevents cross-tenant data leaks

**Impact:**
- Every table has `tenant_id` column
- Every query filters by `tenant_id`
- Foreign keys include `tenant_id` for referential integrity

**Examples:**
```sql
-- ✅ CORRECT
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sales_point_id UUID NOT NULL REFERENCES sales_points(id),
    order_number VARCHAR(50) NOT NULL,
    UNIQUE (tenant_id, sales_point_id, order_number)
);

-- ❌ WRONG - No tenant_id
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    order_number VARCHAR(50) NOT NULL -- Missing tenant isolation!
);
```

---

### ✅ MUST FILTER: Always Include tenant_id in Queries

**Rule:** ALL queries MUST filter by `tenant_id` (except system/tenant management queries)

**Rationale:**
- Prevents cross-tenant data access (security)
- Enables query optimization (partition pruning)
- Required for compliance (data isolation)
- Prevents accidental data leaks

**Impact:**
- WHERE clauses include `tenant_id = $1`
- JOIN conditions include `tenant_id` matching
- Indexes include `tenant_id` as first column

**Examples:**
```sql
-- ✅ CORRECT
SELECT * FROM orders
WHERE tenant_id = $1 
  AND sales_point_id = $2
  AND order_number = $3;

-- ✅ CORRECT - Index supports tenant filtering
CREATE INDEX idx_orders_lookup 
ON orders(tenant_id, sales_point_id, order_number);

-- ❌ WRONG - No tenant_id filter (security issue!)
SELECT * FROM orders
WHERE order_number = $1; -- Can access any tenant's data!

-- ❌ WRONG - Index doesn't start with tenant_id
CREATE INDEX idx_orders_lookup 
ON orders(order_number); -- Won't use partition pruning
```

---

### ✅ MUST HAVE: Sales Point Isolation for Transactional Data

**Rule:** Transactional tables (orders, inventory, etc.) MUST include `sales_point_id`

**Rationale:**
- Multi-location tenants need per-location isolation
- Sales points have separate inventory, pricing, workflows
- Enables location-specific reporting
- Required for distributed operations

**Impact:**
- Transactional tables include `sales_point_id UUID NOT NULL`
- Reference data (products, customers) may omit `sales_point_id`
- Queries for transactional data filter by both `tenant_id` AND `sales_point_id`

**Examples:**
```sql
-- ✅ CORRECT - Transactional data (orders)
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sales_point_id UUID NOT NULL REFERENCES sales_points(id),
    order_number VARCHAR(50) NOT NULL,
    UNIQUE (tenant_id, sales_point_id, order_number)
);

-- ✅ CORRECT - Reference data (products) - no sales_point_id
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product_code VARCHAR(50) NOT NULL,
    UNIQUE (tenant_id, product_code)
);

-- ❌ WRONG - Order without sales_point_id
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    order_number VARCHAR(50) NOT NULL -- Missing sales_point_id!
);
```

---

## ID Strategy Requirements

### ✅ MUST USE: Surrogate UUID + Business Key Pattern

**Rule:** Tables MUST have both a surrogate UUID `id` AND a unique constraint on business identifier

**Rationale:**
- ORMs expect single-column primary key (UUID id)
- Humans need recognizable identifiers (order_number, customer_number)
- Surrogate key for system use, business key for user-facing operations
- Unique constraint prevents duplicates within tenant scope

**Pattern:**
1. **Surrogate Key:** `id UUID PRIMARY KEY DEFAULT uuid_generate_v7()`
2. **Business Key:** `UNIQUE (tenant_id, sales_point_id, {business_identifier})`

**Examples:**
```sql
-- ✅ CORRECT - Both surrogate and business keys
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    UNIQUE (tenant_id, customer_number) -- Business key constraint
);

-- ✅ CORRECT - Transactional data includes sales_point_id
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sales_point_id UUID NOT NULL REFERENCES sales_points(id),
    order_number VARCHAR(50) NOT NULL,
    UNIQUE (tenant_id, sales_point_id, order_number) -- Business key
);

-- ❌ WRONG - Only surrogate key, no business key
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    customer_number VARCHAR(50) NOT NULL -- Should be UNIQUE constraint!
);

-- ❌ WRONG - Composite primary key (ORMs struggle with this)
CREATE TABLE customers (
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    customer_number VARCHAR(50) NOT NULL,
    customer_name VARCHAR(200) NOT NULL,
    PRIMARY KEY (tenant_id, customer_number) -- NO! Use surrogate id
);
```

---

## Material Tracking Requirements

### ✅ MUST IMPLEMENT: End-to-End Lot Genealogy

**Rule:** Material tracking with lot genealogy is ARCHITECTURAL FOUNDATION, not optional feature

**Rationale:**
- Core competitive differentiator
- Required for print industry compliance
- Enables quality root-cause analysis
- Customer requirement (raw materials → finished goods traceability)

**Impact:**
- All material-related tables include lot tracking
- Parent-child relationships tracked (lot genealogy)
- Material movements logged
- Cannot skip lot tracking to "simplify" implementation

**Examples:**
```sql
-- ✅ CORRECT - Lot tracking in material tables
CREATE TABLE inventory_lots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    sales_point_id UUID NOT NULL,
    lot_number VARCHAR(100) NOT NULL,
    material_id UUID NOT NULL,
    parent_lot_id UUID, -- For genealogy
    UNIQUE (tenant_id, sales_point_id, lot_number)
);

-- ✅ CORRECT - Track material consumption
CREATE TABLE material_consumption (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    work_order_id UUID NOT NULL,
    lot_id UUID NOT NULL REFERENCES inventory_lots(id),
    quantity_consumed DECIMAL(18,4) NOT NULL
);

-- ❌ WRONG - Generic inventory without lot tracking
CREATE TABLE inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    material_id UUID NOT NULL,
    quantity DECIMAL(18,4) NOT NULL -- No lot tracking!
);
```

---

## Schema-Driven Development Requirements

### ✅ MUST USE: YAML Schemas as Source of Truth

**Rule:** Entity definitions MUST start as YAML schemas before code generation

**Rationale:**
- Single source of truth (DRY principle)
- Enables AI code generation
- Structured input → higher quality output
- Self-documenting

**Impact:**
- Define entities in `Implementation/print-industry-erp/data-models/schemas/*.yaml`
- Generate TypeScript types, SQL DDL, API endpoints from schemas
- Update schema first, then regenerate code
- Do not hand-write what can be generated

**Examples:**
```yaml
# ✅ CORRECT - YAML schema first
# File: schemas/customer.yaml
entity: Customer
description: Customer master data
fields:
  - name: id
    type: uuid
    primaryKey: true
    default: uuid_generate_v7()
  
  - name: tenant_id
    type: uuid
    nullable: false
    references: tenants.id
  
  - name: customer_number
    type: varchar(50)
    nullable: false
    businessKey: true
```

**Process:**
1. Define entity in YAML
2. AI generates TypeScript types, SQL DDL, API routes
3. Human reviews and refines generated code
4. Commit both YAML and generated code

---

## Documentation Requirements

### ✅ MUST HAVE: Navigation Path in All Documentation

**Rule:** ALL documentation files MUST include Navigation Path at top and bottom

**Rationale:**
- Prevents users getting lost in nested documentation
- Provides context (where am I?)
- Enables quick navigation
- International team-friendly (clear, literal terminology)

**Pattern:**
```markdown
**📍 Navigation Path:** [AGOG Home](../README.md) → Parent → Current

# Document Title

[content]

---

[⬆ Back to top](#anchor) | [🏠 AGOG Home](../README.md) | [Parent](../README.md)
```

**Impact:**
- All new documentation includes Navigation Path
- Update existing documentation to add Navigation Path
- Remove old `[← Back]` links (redundant with bottom navigation)

**Standard:** See `.github/NAVIGATION_PATH_STANDARD.md`

---

### ✅ MUST AVOID: Unvalidated Performance Claims

**Rule:** Do NOT include specific percentages or performance claims without source attribution

**Rationale:**
- Credibility - unvalidated claims hurt trust
- Accuracy - targets vs. proven results must be clear
- Professional - marketing speak doesn't belong in technical docs

**Impact:**
- Remove unvalidated percentages from technical docs
- Qualify claims in business docs ("target outcome", "based on industry research")
- Use qualitative language where specific numbers not essential

**Examples:**
```markdown
<!-- ✅ CORRECT - Qualified claim -->
Material tracking enables faster root cause analysis compared to 
systems without end-to-end traceability.

<!-- ✅ CORRECT - Qualified target -->
**Target Outcome:** Based on industry research, lot genealogy can 
reduce time to identify defect root cause by 70-90%.

<!-- ❌ WRONG - Unvalidated claim -->
AGOG provides 90% faster root cause analysis.
```

---

## Deployment Requirements

### ✅ MUST USE: Blue-Green Deployment Pattern

**Rule:** Production deployments MUST use blue-green pattern with database replication

**Rationale:**
- Zero-downtime deployments
- Zero-loss rollback capability
- 48-96 hour stabilization window for confidence
- Database safety critical for production

**Impact:**
- Deployment requires Blue and Green environments
- Bidirectional logical replication during transition
- Cannot do direct production deployments
- Rollback plan required for every deployment

**Standard:** See `Standards/code/blue-green-deployment.md`

---

## Terminology Requirements

### ✅ MUST USE: Standard Terminology

**Rule:** Use these terms consistently (not alternatives)

**Rationale:** International team clarity, avoid confusion

**Standard Terms:**
- **Navigation Path** (NOT "breadcrumbs")
- **Multi-tenant** (NOT "Multitenant" or "Multi-Tenant")
- **Sales point** (NOT "location" or "store")
- **Lot genealogy** (NOT "lot tracking" for parent-child relationships)
- **Material tracking** (for inventory/lot system)

**Impact:**
- Documentation uses standard terms
- Code comments use standard terms
- API naming uses standard terms

---

## Testing Requirements (Future)

### ✅ MUST TEST: Multi-Tenant Isolation

**Rule:** ALL features MUST be tested for tenant isolation

**Rationale:**
- Security critical - cross-tenant access = data breach
- Compliance requirement
- Cannot ship without isolation testing

**Impact:**
- Write tests that verify tenant_id filtering
- Test that User A (tenant 1) cannot access User B's data (tenant 2)
- Test Row Level Security policies

---

## What's NOT Constrained

These are **flexible** and can be adjusted based on needs:

- Specific frameworks (within TypeScript/Node.js ecosystem)
- UI library choice (React chosen but could change)
- Specific PostgreSQL minor version (15.x)
- Deployment infrastructure (as long as supports blue-green)
- Development tools and IDEs
- Code formatting preferences (as long as consistent)
- Testing frameworks (as long as comprehensive)

---

## Constraint Violations

### If You Violate a Constraint

**Accidentally:**
1. Fix immediately
2. Review related code for same issue
3. Note in commit message what was fixed

**Intentionally (with good reason):**
1. Document rationale in `.github/DECISION_LOG.md`
2. Discuss with Todd
3. Update this CONSTRAINTS.md file if constraint changes
4. Update affected standards documents

### If You Think a Constraint is Wrong

1. **Don't ignore it** - follow it until changed
2. **Document your reasoning** - why should it change?
3. **Propose alternative** - what should it be instead?
4. **Discuss with Todd** - get agreement before changing
5. **Update documentation** - CONSTRAINTS.md, DECISION_LOG.md, affected standards

---

## Enforcement

**Human Review:**
- Todd reviews all code and documentation
- Violations caught in review process

**Automated (Future):**
- Linting rules for code
- Schema validation for YAML
- SQL linting for database scripts
- Documentation structure validation

---

## Quick Reference Checklist

**Before creating a table:**
- [ ] Uses `uuid_generate_v7()` for primary key?
- [ ] Includes `tenant_id UUID NOT NULL`?
- [ ] Includes `sales_point_id` if transactional?
- [ ] Has UNIQUE constraint on business key?
- [ ] Pattern: `UNIQUE (tenant_id, [sales_point_id,] business_identifier)`?

**Before writing a query:**
- [ ] Filters by `tenant_id`?
- [ ] Filters by `sales_point_id` if transactional?
- [ ] Index includes `tenant_id` as first column?

**Before creating documentation:**
- [ ] Includes Navigation Path at top?
- [ ] Includes bottom navigation with horizontal rule?
- [ ] No unvalidated percentage claims?
- [ ] Uses standard terminology?

**Before making architectural decision:**
- [ ] Violates any constraints in this document?
- [ ] Documented in `.github/DECISION_LOG.md`?
- [ ] Discussed with Todd?

---

## Related Documentation

- [.github/DECISION_LOG.md](./.github/DECISION_LOG.md) - WHY constraints exist
- [Standards/data/database-standards.md](./Standards/data/database-standards.md) - Implementation details
- [.github/AI_ONBOARDING.md](./.github/AI_ONBOARDING.md) - Quick patterns reference
- [Standards/code/schema-driven-development.md](./Standards/code/schema-driven-development.md) - Schema workflow

---

**⚠️ When in doubt, follow these constraints. They exist for good reasons documented in DECISION_LOG.md.**

---

[⬆ Back to top](#agog-system-constraints) | [🏠 AGOG Home](./README.md) | [📋 Decision Log](./.github/DECISION_LOG.md)
