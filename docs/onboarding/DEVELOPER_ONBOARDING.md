**📍 Navigation Path:** [AGOG Home](../../README.md) → [Documentation](../README.md) → Developer Onboarding

# Developer Onboarding Guide

## Welcome to AGOG! 🎉

This guide will get you productive in **3 phases**: Day 1, Week 1, and Month 1.

---

## Day 1: Environment Setup (2-3 hours)

### 1. Clone Repository (5 minutes)

```powershell
git clone https://github.com/toddjhayden/agog.git
cd agog
```

### 2. Install Dependencies (2 minutes)

```powershell
# Install Node.js packages (includes Husky for git hooks)
npm install

# Initialize git hooks (enables automated standards checking)
npm run prepare
```

**What this does:**
- Installs Husky (git hooks manager)
- Sets up pre-commit hook that runs migration linter
- Your commits will now be automatically checked for standards violations

### 3. Test Automation (1 minute)

```powershell
# Run migration linter manually
npm run lint:migrations
```

**Expected output:**
- If migrations exist: May show errors (that's good! It's working)
- If no migrations: `✅ All migrations pass standards checks!`

### 4. Read Core Documentation (30-60 minutes)

**Required reading (in order):**

1. **[Project Index](../../PROJECT_INDEX.md)** (10 min) - Navigation overview
2. **[System Overview](../../Project%20Architecture/SYSTEM_OVERVIEW.md)** (20 min) - Architecture at 10,000 feet
3. **[Business Value](../../Project%20Spirit/BUSINESS_VALUE.md)** (10 min) - Why we're building this
4. **[Database Quick Reference](../DATABASE_QUICK_REFERENCE.md)** (5 min) - Cheat sheet for daily work

**Skim these (reference later):**
- [Standards Overview](../../Standards/README.md)
- [Data Quality Standards](../../Standards/data/data-quality.md)
- [Migration Standards](../../Standards/data/migration-standards.md)

### 5. Understand the Automation (15 minutes)

**What runs automatically when you code:**

#### Pre-Commit Hook (Runs when you `git commit`)
- **What:** Migration linter checks your SQL files
- **Checks for:**
  - ❌ Missing `tenant_id` on new tables
  - ❌ Foreign keys without `ON DELETE` clause
  - ❌ Missing validation constraints
  - ❌ Missing audit triggers on sensitive tables
  - ⚠️ Missing rollback scripts
- **Result:** 
  - ✅ Pass = Commit succeeds
  - ❌ Fail = Commit blocked, must fix
- **Override:** `git commit --no-verify` (emergencies only!)

#### GitHub Actions (Runs on every push/PR)
- Migration linting (same as pre-commit)
- Link validation (checks for broken links in docs)
- PR checklist verification
- **Result:** PR can't merge if checks fail

**Why automation matters:**
- Prevents bad data from reaching production
- Catches mistakes before code review
- Standards enforced consistently
- No manual checking needed

### 6. Understand Documentation Generation (5 minutes)

**What:** Auto-generate API documentation from your code comments

**How it works:**
```typescript
// You write JSDoc comments in your code:
/**
 * @route GET /api/v1/customers
 * @tag Customers
 * Get all customers for a tenant.
 * 
 * @param {string} tenantId - Tenant identifier
 * @param {number} page - Page number (default: 1)
 * @returns {Customer[]} List of customers with pagination
 * 
 * @example
 * GET /api/v1/customers?tenantId=abc123&page=1
 */
export async function getCustomers(tenantId: string, page: number) {
  // implementation
}
```

**Then run:**
```powershell
npm run generate:docs
```

**Result:** Creates formatted markdown docs in `docs/api/generated/` with:
- Tables of parameters
- Return types
- Examples with request/response
- Organized by @tag (Customers, Orders, Jobs, etc.)

**Why this matters:**
- Documentation lives with code (can't get out of sync)
- No manual doc writing needed
- Generated docs are always current
- Professional API reference automatically

**Example output:**
```markdown
### `GET` /api/v1/customers

Get all customers for a tenant.

**Parameters:**
| Name | Type | Description |
|------|------|-------------|
| `tenantId` | `string` | Tenant identifier |
| `page` | `number` | Page number (default: 1) |

**Returns:** `Customer[]` - List of customers with pagination
```

**Your workflow:**
1. Write code with JSDoc comments
2. Run `npm run generate:docs` before committing
3. Commit both code AND generated docs together

### 7. Make Your First Commit (10 minutes)

**Test that everything works:**

```powershell
# Create a test file
echo "# Test" > test.md

# Stage it
git add test.md

# Commit (watch the pre-commit hook run!)
git commit -m "test: Verify automation setup"
```

**What you'll see:**
```
🔍 Running pre-commit checks...

📋 Checking database migrations...
✅ All migrations pass standards checks!

✅ Pre-commit checks passed!

[feature abc123] test: Verify automation setup
```

**Success!** You're ready to code.

---

## Week 1: Core Concepts (Full week, learning as you work)

### Understanding AGOG's Architecture: OLAP → OLTP → API → UX

**Before diving into code, understand the foundational principle:**

**AGOG is built backwards from traditional systems - we start with what we need to measure, then build to support it.**

#### The Flow:

```
1. Business Goals (KPIs - OLAP Layer)
   "We need to calculate OEE"
      ↓ defines requirements for
      
2. Data Storage (Schemas - OLTP Layer)
   "Capture: actual_start_time, quantity_good, speed_actual, etc."
      ↓ exposes through
      
3. API Layer (GraphQL/REST)
   "type ProductionRun { oee: Float! }"
      ↓ consumed by
      
4. User Experience (React)
   "<OEEGauge value={0.87} />"
```

#### Why This Matters for Developers:

**Traditional approach (what DOESN'T work):**
```
Developer: "I'll add these fields that seem useful"
6 months later...
Business: "Can we calculate OEE?"
Developer: "Well... we're missing 3 critical fields"
Result: Expensive database refactoring or "feature not available"
```

**AGOG approach (what DOES work):**
```
Business: "We need to calculate OEE"
KPI Definition: "Requires: actual_start_time, quantity_good, etc."
Schema Validation: "✗ production_run missing quantity_good"
Developer: "I'll add quantity_good to the schema"
Validation: "✓ All fields present, OEE can be calculated"
Result: Dashboard shows real OEE from day 1
```

#### Practical Example: Adding a New Feature

**Task:** "Add equipment utilization tracking"

**Step 1 - Define the KPI (OLAP):**
```yaml
# Project Architecture/data-models/kpis/equipment-kpis.yaml
- id: equipment_utilization_rate
  formula: "(Actual Production Time / Available Time) × 100"
  required_schemas:
    - equipment-status-log.yaml
  required_fields:
    - status
    - duration_minutes
    - is_productive_time
```

**Step 2 - Validate Schema (OLTP):**
```powershell
npm run validate:kpi-schemas
# Output: ✗ equipment-status-log missing 'is_productive_time'
```

**Step 3 - Fix Schema:**
```sql
-- Add missing field
ALTER TABLE equipment_status_log
ADD COLUMN is_productive_time BOOLEAN NOT NULL DEFAULT false;
```

**Step 4 - Re-validate:**
```powershell
npm run validate:kpi-schemas
# Output: ✓ equipment_utilization_rate can be calculated
```

**Step 5 - Build API:**
```typescript
/**
 * @route GET /api/v1/equipment/:id/utilization
 * @tag Equipment
 * Calculate equipment utilization rate
 */
async getEquipmentUtilization(equipmentId: string) {
  const logs = await db.equipmentStatusLog.findMany({
    where: { equipmentId, isProductiveTime: true }
  });
  // Calculate utilization from validated schema fields
  return calculateUtilization(logs);
}
```

**Step 6 - Build UX:**
```tsx
<EquipmentCard>
  <UtilizationGauge 
    value={equipment.utilization} 
    target={0.75} 
  />
</EquipmentCard>
```

#### What You Get:

- ✅ **Confidence**: Validation proves KPI is calculable
- ✅ **Speed**: No guessing what fields are needed
- ✅ **Quality**: Dashboard never shows "N/A" for metrics
- ✅ **Documentation**: KPI definition IS the requirements doc

#### Your Workflow as a Developer:

1. **Check KPIs first**: "What metrics does this feature support?"
2. **Validate schemas**: "Do we have the required fields?"
3. **Fix gaps**: Add missing fields if validation fails
4. **Build confidently**: You know the data is there
5. **Test with real metrics**: Dashboard shows actual business value

**This is why AGOG delivers real-time business intelligence while competitors show "reports coming soon."**

Read more: [Business Value - Architectural Foundation](../../Project%20Spirit/BUSINESS_VALUE.md#architectural-foundation-analytics-driven-development)

---

### Day 2: Multi-Tenancy Deep Dive (2 hours)

**Why multi-tenancy is critical:**
- AGOG is a SaaS platform (multiple customers on one system)
- Every customer's data MUST be isolated
- Every table needs `tenant_id` to separate customers
- Security: Customer A can never see Customer B's data

**Read:**
- [Database Standards - Multi-Tenancy](../../Standards/data/database-standards.md#multi-tenancy)
- [Data Models - Multi-Tenant Patterns](../../Implementation/print-industry-erp/data-models/README.md)

**Exercise: Create Your First Migration**

```sql
-- Practice: Create a simple table
CREATE TABLE practice_table (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,  -- Required!
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Test it:**
```powershell
# Save as: Implementation/print-industry-erp/database/migrations/V999.0.0__practice.sql
npm run lint:migrations
# Should pass! ✅
```

### Day 3: Data Quality & Validation (2 hours)

**Learn the 3-level validation pattern:**

1. **Database Level** (Strongest - can't be bypassed)
   ```sql
   quantity INT NOT NULL,
   CONSTRAINT chk_quantity CHECK (quantity > 0)
   ```

2. **Application Level** (Flexible - better error messages)
   ```typescript
   @IsPositive()
   quantity: number;
   ```

3. **UI Level** (User-friendly - immediate feedback)
   ```typescript
   quantity: z.number().positive()
   ```

**Read:**
- [Data Quality Standards](../../Standards/data/data-quality.md)
- Focus on: Validation Rules section

**Exercise: Add Validation**

Add to your practice table:
```sql
ALTER TABLE practice_table
ADD COLUMN quantity INT NOT NULL DEFAULT 1,
ADD CONSTRAINT chk_quantity CHECK (quantity > 0);
```

### Day 4: Foreign Keys & Relationships (2 hours)

**The ON DELETE Rule Decision Tree:**

```
Is child meaningless without parent?
├─ YES → ON DELETE CASCADE (order → order_lines)
└─ NO → Is reference optional?
    ├─ YES → ON DELETE SET NULL (job → preferred_press)
    └─ NO → ON DELETE RESTRICT (customer → orders)
```

**Read:**
- [Data Quality - Data Integrity](../../Standards/data/data-quality.md#data-integrity)
- [Database Standards - Relationships](../../Standards/data/database-standards.md)

**Exercise: Create Related Tables**

```sql
CREATE TABLE practice_parent (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL
);

CREATE TABLE practice_child (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    parent_id UUID NOT NULL,
    CONSTRAINT fk_parent 
        FOREIGN KEY (parent_id) 
        REFERENCES practice_parent(id) 
        ON DELETE CASCADE  -- Child deleted when parent deleted
);
```

### Day 5: Audit Trails (1 hour)

**Which tables need audit triggers?**
- ✅ Sensitive: customers, orders, jobs, users, payments
- ❌ Not needed: lookup tables, system tables

**Pattern:**
```sql
CREATE TRIGGER audit_table_name
AFTER INSERT OR UPDATE OR DELETE ON table_name
FOR EACH ROW
EXECUTE FUNCTION audit_trigger();
```

**Read:**
- [Data Quality - Audit Trails](../../Standards/data/data-quality.md#audit-trails)

---

## Month 1: Deep Dives (As needed, reference material)

### Architecture Patterns

### Week 2: API Design & Documentation

**Learn:**
- [API Specification](../../Project%20Architecture/api/api-specification.md)
- [GraphQL Standards](../../Standards/api/graphql-standards.md)
- [REST Standards](../../Standards/api/rest-standards.md)

**Practice: Document Your API Functions**

When you write API endpoints, add JSDoc comments:

```typescript
/**
 * @route POST /api/v1/orders
 * @tag Orders
 * Create a new print order with line items.
 * 
 * @param {string} tenantId - Tenant ID (from auth token)
 * @param {string} customerId - Customer placing the order
 * @param {array} lineItems - Order line items with product specs
 * @param {string} dueDate - ISO 8601 date when order is due
 * @returns {Order} Created order with estimated cost and schedule
 * 
 * @example
 * POST /api/v1/orders
 * {
 *   "customer_id": "cust_123",
 *   "line_items": [
 *     {
 *       "product": "business_cards",
 *       "quantity": 1000,
 *       "specs": { "paper": "14pt_gloss", "colors": "4/4" }
 *     }
 *   ],
 *   "due_date": "2025-12-15T00:00:00Z"
 * }
 * 
 * Response:
 * {
 *   "id": "order_789",
 *   "status": "pending",
 *   "estimated_cost": 287.50,
 *   "estimated_completion": "2025-12-14T16:00:00Z"
 * }
 */
export async function createOrder(req: Request, res: Response) {
  // implementation
}
```

**Then generate docs:**
```powershell
npm run generate:docs
```

**Result:** Professional API documentation in `docs/api/generated/`

**Best practices:**
- Write JSDoc comments as you code (not after)
- Include realistic examples with sample data
- Use `@tag` to group related endpoints (Customers, Orders, Jobs, etc.)
- Generate docs before committing
- Commit generated docs with your code changes

**Week 3: Manufacturing Systems**
- [MES System](../../Project%20Architecture/workflows/mes-system.md)
- [Scheduling System](../../Project%20Architecture/workflows/scheduling-system.md)
- [WIP Tracking](../../Project%20Architecture/workflows/wip-tracking.md)

**Week 4: Advanced Data Patterns**
- [Lot Genealogy](../../Project%20Architecture/data-models/lot-genealogy.md)
- [Unified Inventory](../../Project%20Architecture/data-models/unified-inventory.yaml)
- [Cost Accounting](../../Project%20Architecture/data-models/cost-accounting.md)

---

## Daily Workflow Reference

### Creating a Database Migration

**1. Name your migration:**
```
V{MAJOR}.{MINOR}.{PATCH}__{description}.sql

Examples:
V1.2.0__add_customer_ratings.sql
V1.2.1__fix_order_totals.sql
```

**2. Use the template:**
```sql
-- Migration: V1.2.0__add_customer_ratings.sql
-- Description: Add customer ratings and reviews
-- Author: Your Name
-- Date: 2025-11-22

CREATE TABLE customer_ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,  -- ✅ Always include
    customer_id UUID NOT NULL,
    rating INT NOT NULL,
    
    -- ✅ Validation constraint
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5),
    
    -- ✅ Foreign key with ON DELETE
    CONSTRAINT fk_customer 
        FOREIGN KEY (customer_id) 
        REFERENCES customers(id) 
        ON DELETE CASCADE,
    
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**3. Test before committing:**
```powershell
npm run lint:migrations
```

**4. Commit (pre-commit hook runs automatically):**
```powershell
git add database/migrations/V1.2.0__add_customer_ratings.sql
git commit -m "feat(db): Add customer ratings table"
```

### Writing API Code with Documentation

**1. Write function with JSDoc comments:**
```typescript
/**
 * @route POST /api/v1/products
 * @tag Products
 * Create a new product in the catalog.
 * 
 * @param {string} tenantId - Tenant ID (from auth)
 * @param {string} name - Product name
 * @param {string} sku - Stock keeping unit
 * @param {number} price - Unit price in dollars
 * @returns {Product} Created product object
 * 
 * @example
 * POST /api/v1/products
 * { "name": "Business Cards", "sku": "BC-001", "price": 49.99 }
 * 
 * Response:
 * { "id": "prod_123", "name": "Business Cards", "status": "active" }
 */
export async function createProduct(req, res) {
  // implementation
}
```

**2. Generate documentation:**
```powershell
npm run generate:docs
```

**3. Review generated docs:**
```powershell
cat docs/api/generated/products.md
```

**4. Commit code AND docs together:**
```powershell
git add src/api/products.ts docs/api/generated/products.md
git commit -m "feat(api): Add product catalog endpoints"
```

### Updating Documentation

**1. Edit markdown files**

**2. Check for broken links:**
```powershell
npm run check:links
```

**3. Fix any broken links shown**

**4. Commit:**
```powershell
git add docs/
git commit -m "docs: Update architecture overview"
```

### Before Every Commit Checklist-- ✅ Audit trigger for sensitive data
CREATE TRIGGER audit_customer_ratings
AFTER INSERT OR UPDATE OR DELETE ON customer_ratings
FOR EACH ROW
EXECUTE FUNCTION audit_trigger();
```

**3. Create rollback script:**
```sql
-- Rollback: V1.2.0__add_customer_ratings_rollback.sql
DROP TRIGGER IF EXISTS audit_customer_ratings ON customer_ratings;
DROP TABLE IF EXISTS customer_ratings;
```

**4. Test locally:**
```powershell
npm run lint:migrations
# Fix any errors
# Run again until ✅
```

**5. Commit:**
```powershell
git add .
git commit -m "feat(db): Add customer ratings table"
# Pre-commit hook runs automatically
```

---

## Common Issues & Solutions

### "Migration linter failed on commit"

**Problem:** Pre-commit hook found standards violations

**Solution:**
1. Read the error messages carefully (they include hints!)
2. Fix the issues in your migration file
3. Run `npm run lint:migrations` to verify
4. Commit again

**Example:**
```
❌ Table 'my_table' missing tenant_id column
💡 Add: tenant_id UUID NOT NULL
```
→ Add `tenant_id UUID NOT NULL,` to your CREATE TABLE

### "How do I skip the pre-commit hook?"

**Emergency override (use sparingly!):**
```powershell
git commit --no-verify -m "wip: Work in progress"
```

**When to use:**
- Creating WIP commits for backup
- Emergency hotfix (fix in next commit)
- Non-migration changes

**When NOT to use:**
- "I don't want to fix the errors" ❌
- "Standards don't apply to me" ❌

### "I don't understand why a rule exists"

**Every rule has a reason!**

Ask yourself:
1. What problem does this prevent?
2. What happens if I skip it?
3. Is there a specific scenario this protects against?

Then read the standards doc linked in the error message.

**Still confused?** Ask the team! Someone will explain the "why."

---

## Testing Your Knowledge

### Week 1 Quiz

Can you answer these without looking?

1. Why does every table need `tenant_id`?
2. What are the 3 ON DELETE options and when do you use each?
3. What 5 tables are considered "sensitive" and need audit triggers?
4. What's the difference between database validation and application validation?
5. How do you test your migration locally before committing?

**Answers:**
1. Multi-tenancy - isolates customer data in SaaS platform
2. CASCADE (child meaningless), SET NULL (optional), RESTRICT (independent)
3. customers, orders, jobs, users, payments
4. Database = can't bypass, Application = better errors
5. `npm run lint:migrations`

---

## Resources

### Quick References
- [Database Quick Reference](../DATABASE_QUICK_REFERENCE.md) - One-page cheat sheet
- [Standards Automation Setup](../STANDARDS_AUTOMATION_SETUP.md) - How automation works

### Full Standards
- [Data Quality Standards](../../Standards/data/data-quality.md)
- [Migration Standards](../../Standards/data/migration-standards.md)
- [Database Standards](../../Standards/data/database-standards.md)

### Architecture
- [System Overview](../../Project%20Architecture/SYSTEM_OVERVIEW.md)
- [API Specification](../../Project%20Architecture/api/api-specification.md)

### Getting Help
- Read the error message hints
- Check standards docs
- Ask in team chat
- Review existing migrations for examples

---

## Next Steps

After completing Day 1:
- ✅ Environment set up
- ✅ Automation working
- ✅ First commit successful
- ✅ Core docs read

**You're ready to start contributing!**

Start with:
1. Small bug fixes
2. Documentation improvements
3. Simple migrations
4. Work up to complex features

**Welcome to the team!** 🚀

---

[⬆ Back to top](#developer-onboarding-guide) | [🏠 AGOG Home](../../README.md) | [📚 Standards](../../Standards/README.md)
