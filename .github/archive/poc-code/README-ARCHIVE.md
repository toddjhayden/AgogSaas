# PoC Code - Deprecated

**Date Archived:** 2025-11-02  
**Reason:** Misalignment with current architecture and constraints  
**Decision:** Archive and rebuild following documented standards

---

## Why This Code Was Archived

The initial Proof of Concept (PoC) code in `/print-industry-erp/` was deprecated due to multiple critical misalignments with the project's documented architecture and constraints.

### Critical Issues Identified

#### 1. **Wrong UUID Type** ❌
- **Found:** `gen_random_uuid()` (UUIDv4) in all tables
- **Required:** `uuid_generate_v7()` (UUIDv7)
- **Impact:** Wrong index performance, violates CONSTRAINTS.md
- **Files:** `database/schema.sql`

```sql
-- ❌ WRONG (PoC code)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ...
);

-- ✅ CORRECT (per CONSTRAINTS.md)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    ...
);
```

#### 2. **Wrong Development Approach** ❌
- **Found:** TypeORM with code-first decorators
- **Required:** Schema-driven development (YAML → SQL migrations)
- **Rationale:** See DECISION_LOG.md - "Schema-Driven Development (YAML as Pseudocode)"
- **Files:** `src/models/*.ts`, `package.json` (TypeORM dependency)

#### 3. **Security Vulnerabilities** ❌
- **Found:** Hardcoded database credentials in `data-source.ts`
- **Required:** Environment variables, no credentials in code
- **Impact:** Critical security risk

```typescript
// ❌ WRONG (PoC code)
export const AppDataSource = new DataSource({
    username: 'king',
    password: '5ome5trongP@55word',  // NEVER hardcode!
    ...
});

// ✅ CORRECT
export const AppDataSource = new DataSource({
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ...
});
```

#### 4. **Missing Multi-Tenant Isolation** ❌
- **Found:** No tenant_id filtering in queries
- **Required:** ALL queries MUST filter by tenant_id (CONSTRAINTS.md)
- **Impact:** Data leakage risk in multi-tenant system
- **Files:** `src/controllers/*.ts`, `src/services/*.ts`

#### 5. **Wrong Dependencies** ❌
- **Found:** `mongoose` (MongoDB driver) in `package.json`
- **Required:** PostgreSQL only (CONSTRAINTS.md)
- **Impact:** Confusion, unnecessary dependencies

#### 6. **Folder Structure Confusion** ❌
- **Found:** `/print-industry-erp/` at root level
- **Expected:** `/Implementation/print-industry-erp/` (per PROJECT_INDEX.md)
- **Impact:** Duplicate folder structure, unclear organization

---

## What Was Salvaged

### Useful Elements (If Any)
- Folder structure ideas (src/controllers, src/services, src/routes)
- Basic Express.js setup pattern
- TypeScript configuration baseline

### Not Salvaged
- Database schema (wrong UUID type)
- ORM approach (using migrations instead)
- Hardcoded credentials
- Model definitions (will use YAML schemas)

---

## Path Forward

### Correct Implementation Approach

1. **Schema-Driven Development**
   - Define entities in YAML (`Implementation/print-industry-erp/data-models/schemas/`)
   - Generate SQL migrations from YAML
   - Use PostgreSQL 15+ with uuid_generate_v7()

2. **Multi-Tenant Pattern**
   - Every table includes tenant_id
   - Every query filters by tenant_id
   - Use surrogate UUID id + business key pattern

3. **Security**
   - All credentials in environment variables
   - No secrets in code
   - Follow security standards (when created)

4. **Dependencies**
   - PostgreSQL driver (pg)
   - Migration tool (dbmate or similar)
   - No ORM for entity definitions
   - No MongoDB dependencies

### Next Steps (When Starting Implementation)

1. Review `CONSTRAINTS.md` - all hard rules
2. Review `DECISION_LOG.md` - why we chose this approach
3. Review `.github/AI_ONBOARDING.md` - project context
4. Follow schema-driven pattern from `Standards/data/modeling-standards.md`
5. Use correct UUID type: `uuid_generate_v7()`

---

## Archive Contents

The following files/folders from `/print-industry-erp/` should be considered deprecated:

- `src/models/*.ts` - Wrong approach (code-first vs. schema-driven)
- `src/data-source.ts` - Hardcoded credentials
- `database/schema.sql` - Wrong UUID type
- `package.json` - Wrong dependencies (mongoose, TypeORM)

**Note:** The `/print-industry-erp/` folder remains in place for reference but should not be used as a starting point for implementation.

---

## References

- **[CONSTRAINTS.md](../../CONSTRAINTS.md)** - Hard rules that must never be violated
- **[DECISION_LOG.md](../.github/DECISION_LOG.md)** - Why we made key decisions
- **[Standards/data/modeling-standards.md](../../Standards/data/modeling-standards.md)** - Schema-driven approach
- **[GAPS.md](../../GAPS.md)** - Gap #15: PoC Code Misalignment

---

**📍 Navigation Path:** [AGOG Home](../../README.md) → [Archive](./../README.md) → PoC Code Deprecated

[⬆ Back to top](#poc-code---deprecated) | [🏠 AGOG Home](../../README.md) | [📁 Archive Index](./../README.md)
