**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → Decision Log

# Critical Decisions Log

> **Purpose:** Records WHY we made important architectural and design decisions  
> **Format:** Lightweight, scannable, focused on rationale  
> **Difference from ADR:** ADRs are formal, this is quick reference  
> **Update:** Add entry whenever making a significant choice that future developers need to understand

---

## How to Use This Log

### When to Add a Decision
- Chose a specific technology over alternatives
- Established an architectural pattern
- Changed a previous approach
- Made a non-obvious design choice
- Rejected a seemingly good option

### Entry Format
```markdown
### Decision Title
**Date:** YYYY-MM-DD  
**Decider:** Who made this decision  
**Status:** Active | Superseded | Deprecated

**Context:** What situation led to this decision?

**Decision:** What did we decide to do?

**Rationale:** Why did we choose this option?

**Alternatives Considered:**
- Option A: Why rejected
- Option B: Why rejected

**Impact:** What does this affect? What must change?

**Related Decisions:** Links to related entries
```

---

## Recent Decisions (Last 30 Days)

### Clean Repository - Move PoC to Archive
**Date:** 2025-11-02  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
After documenting PoC code misalignment, Todd asked: "Should the deprecated folder and code be moved to a deprecated area?" The PoC code was still at root level (`/print-industry-erp/`) while documented as deprecated.

**Decision:**  
Move entire PoC directory to `.github/archive/poc-code/` for clean repository structure

**Rationale:**
- Clear separation: root = active code, archive = historical reference
- Prevents accidental use of deprecated code
- Cleaner root directory for humans and AI navigation
- Aligns with archive strategy (already have `.github/archive/` structure)
- Makes "Implementation" clearly the active area
- Repository appearance matters for productivity

**Actions Taken:**
1. Deleted `node_modules/` (regeneratable, ~100MB+)
2. Moved `/print-industry-erp/` → `.github/archive/poc-code/`
3. Consolidated documentation (README-ARCHIVE.md)
4. Updated references in GAPS.md, archive/README.md, SESSION_CONTEXT.md

**Alternatives Considered:**
- Leave at root with deprecation notice - Rejected: Still confusing, clutters root
- Delete entirely - Rejected: Loses historical reference and learning opportunity
- Just add warning README - Rejected: Doesn't solve navigation/clutter issue

**Impact:**
- Root directory now clean and focused
- Only active directories visible: Implementation, Standards, Project Architecture, etc.
- PoC still accessible in archive for historical reference
- Easier for new developers (human and AI) to understand structure

**Related Decisions:** Archive PoC Code - Misalignment with Architecture

---

### Archive PoC Code - Misalignment with Architecture
**Date:** 2025-11-02  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Todd raised concern that PoC code quality is questionable and may not align with current project vision. Investigation revealed multiple critical violations of documented constraints.

**Decision:**  
Archive PoC code with comprehensive documentation, preserve in place for reference, do NOT delete

**Rationale:**
- PoC violates 6+ critical constraints (wrong UUID type, hardcoded credentials, no tenant isolation, wrong approach)
- Cannot be used as starting point for implementation
- Preserving shows evolution and validates documentation-first approach
- Historical reference useful for understanding what NOT to do
- Deleting would lose that learning opportunity

**Violations Found:**
1. Wrong UUID type: `gen_random_uuid()` (UUIDv4) instead of `uuid_generate_v7()` (UUIDv7)
2. Wrong approach: TypeORM code-first vs. schema-driven (YAML → SQL migrations)
3. Security: Hardcoded credentials in `data-source.ts`
4. No tenant isolation: Missing tenant_id filtering (data leakage risk)
5. Wrong dependencies: `mongoose` (MongoDB) when PostgreSQL-only
6. Folder confusion: Duplicate `/print-industry-erp/` structure

**Alternatives Considered:**
- Delete PoC entirely - Rejected: Loses historical context and learning
- Try to fix PoC - Rejected: Faster to rebuild correctly from scratch
- Ignore issues - Rejected: Would perpetuate architectural violations

**Impact:**
- Created `.github/archive/poc-code-deprecated/README.md` with full analysis
- Added Critical gap to GAPS.md (#15)
- Updated SESSION_CONTEXT.md with discovery
- Continue documentation-first approach
- Build proper implementation when ready (following CONSTRAINTS.md)
- Validates schema-driven development decision

**Related Decisions:** Schema-Driven Development, PostgreSQL 15+ Requirement, UUIDv7 Adoption

---

### Navigation Path Terminology (Not "Breadcrumbs")
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Created navigation system using term "breadcrumbs" initially. Todd suggested this might not be internationally clear (breadcrumbs = Hansel and Gretel reference, may not translate).

**Decision:**  
Use "Navigation Path" terminology throughout, not "breadcrumbs"

**Rationale:**
- More explicit/literal (better for international teams)
- Describes function directly
- No cultural references to translate
- Professional technical term

**Alternatives Considered:**
- "Breadcrumbs" - Rejected: Cultural reference, may not translate
- "Location Path" - Rejected: Could be confused with file paths
- "Document Path" - Rejected: Less intuitive than "Navigation Path"

**Impact:**
- Updated NAVIGATION_PATH_STANDARD.md
- Renamed file: BREADCRUMB_STANDARD.md → NAVIGATION_PATH_STANDARD.md
- Updated all documentation references
- Updated GAPS.md

**Related Decisions:** Navigation Path System Creation

---

### Navigation Path System Creation
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active (rollout in progress)

**Context:**  
Todd reported getting lost in deeply nested documentation. No consistent navigation pattern across files. Users had to use browser back button or manually navigate file tree.

**Decision:**  
Implement standardized navigation system with:
- Top: **📍 Navigation Path:** Home → Parent → Current
- Bottom: [⬆ Back to top] | [🏠 Home] | [Parent]
- Horizontal rule separator (---) before bottom nav
- Remove redundant [← Back] links

**Rationale:**
- Provides context (where am I in the hierarchy?)
- Enables quick navigation (jump to parent or home)
- Consistent pattern across all documentation
- Top + bottom prevents scrolling to find navigation
- Visual separator makes bottom nav scannable

**Alternatives Considered:**
- Sidebar navigation - Rejected: Not available in markdown viewers
- Only top navigation - Rejected: Requires scrolling to top on long docs
- Only [← Back] links - Rejected: Doesn't show full context
- Table of contents - Rejected: Solves different problem (in-page navigation)

**Impact:**
- All documentation files get navigation (50+ files)
- Created NAVIGATION_PATH_STANDARD.md
- Phased rollout (4 phases planned)
- Old [← Back] links being removed
- Better user experience, less getting lost

**Related Decisions:** Navigation Path Terminology

---

### Remove Unvalidated Percentages from Documentation
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Documentation contained specific performance improvement percentages (60-70% reduction, 90% faster, etc.) without source citations. These appeared as proven AGOG results when they were actually industry targets or estimates.

**Decision:**
- Remove percentages from SYSTEM_OVERVIEW.md (technical doc)
- Qualify percentages in BUSINESS_VALUE.md as "target outcomes"
- Add disclaimer that these are goals based on industry research
- Use qualitative language where specific numbers not essential

**Rationale:**
- Unvalidated claims hurt credibility
- Misleading to present targets as proven results
- Professional documentation requires attribution
- Better to under-promise, over-deliver
- Credibility more important than impressive-sounding numbers

**Alternatives Considered:**
- Source the percentages - Rejected: Time-consuming, may not find sources
- Keep percentages, add disclaimer - Partially adopted: Used in BUSINESS_VALUE.md
- Remove all quantitative claims - Rejected: Too extreme, some are valid

**Impact:**
- SYSTEM_OVERVIEW.md: Removed performance percentages
- BUSINESS_VALUE.md: Labeled as "Target Outcomes" with disclaimer
- More credible documentation
- Balanced professional tone

**Related Decisions:** Material Tracking Strategic Positioning

---

### Material Tracking as Architectural Foundation
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
SYSTEM_OVERVIEW.md mentioned material tracking but didn't emphasize it as strategic differentiator. Could be read as generic ERP feature rather than core competitive advantage.

**Decision:**  
Position material lot genealogy as architectural foundation:
- Added dedicated "Architectural Foundation" section
- Created comprehensive 5-step traceability example
- Expanded Inventory Service description
- Emphasized business impact of end-to-end tracking

**Rationale:**
- Material tracking IS a competitive differentiator
- Print industry requires lot genealogy for quality/compliance
- Not a bolt-on feature, it's architectural
- Customer complaints about raw materials → finished goods traceability
- Sets AGOG apart from generic ERPs

**Alternatives Considered:**
- Leave as-is - Rejected: Undersells strategic importance
- Add promotional language - Rejected: Unprofessional tone
- Create separate document - Rejected: Should be in system overview

**Impact:**
- SYSTEM_OVERVIEW.md enhanced
- Clear value proposition
- Architectural clarity
- Better positioning vs. competitors

**Related Decisions:** Remove Unvalidated Percentages

---

### GAPS.md Documentation Quality Tracking
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Standards/data/README.md listed topics not fully covered in actual documents. No systematic way to track documentation gaps, inconsistencies, or incomplete sections. Risk of documentation rot over time.

**Decision:**  
Create GAPS.md as "technical debt register" for documentation:
- Track gaps by priority (Critical, High, Medium, Low)
- Include resolution options and target dates
- Track inconsistencies and quality issues
- Move resolved items to "Resolved" section
- Include gap management process
- Track metrics (counts by priority)

**Rationale:**
- Prevents documentation from becoming unreliable
- Makes quality measurable
- Provides prioritized work queue
- Prevents rediscovering same issues
- Honest about what's documented vs. what's planned

**Alternatives Considered:**
- Use TODO.md - Rejected: Different purpose (tasks vs. quality issues)
- Use GitHub Issues - Rejected: Want everything in repo, version controlled
- Don't track gaps - Rejected: Documentation will rot

**Impact:**
- Created GAPS.md (15 gaps tracked initially)
- Created .github/GAP_TEMPLATE.md
- Added to MAINTENANCE_ROUTINE.md
- Weekly/monthly review process
- Documentation quality now measurable

**Related Decisions:** MAINTENANCE_ROUTINE.md Creation

---

### MAINTENANCE_ROUTINE.md - Overhead System Maintenance
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Created overhead systems (GAPS.md, TODO.md, session recovery) but no process to keep them healthy. Risk of overhead systems themselves becoming stale or burdensome.

**Decision:**  
Create lightweight maintenance routine:
- Daily: ~5 minutes (update TODO.md, GAPS.md if changed)
- Weekly: ~15 minutes (review Critical/High priority items)
- Monthly: ~30 minutes (full review, archive old items)
- Include "when to skip" guidance
- Include red flags for emergency maintenance

**Rationale:**
- Overhead systems need maintenance too
- Small regular investment prevents large cleanup later
- Lightweight = sustainable
- Calendar reminders make it happen
- Prevents documentation rot

**Alternatives Considered:**
- No formal routine - Rejected: Systems will decay
- Daily full review - Rejected: Too burdensome
- Only when problems noticed - Rejected: Reactive, not proactive

**Impact:**
- Created .github/MAINTENANCE_ROUTINE.md
- Daily/weekly/monthly checklists
- Sustainable overhead (~20 min/week)
- Prevents system decay

**Related Decisions:** GAPS.md Creation, Session Recovery System

---

### PostgreSQL 15+ Specification (Not Generic SQL)
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Original database-standards.md was generic, could apply to any SQL database. Didn't specify PostgreSQL version. Unclear which features we could rely on.

**Decision:**  
Explicitly specify PostgreSQL 15+ as minimum version:
- Document PostgreSQL-specific features we use
- Update all examples to PostgreSQL syntax
- Specify required extensions (uuid-ossp for v7 UUIDs)
- Use PostgreSQL 15+ features (MERGE, etc.)

**Rationale:**
- We ARE using PostgreSQL (not generic SQL)
- PostgreSQL 15+ has features we need (uuid_generate_v7)
- Clear requirements for deployment
- Can use modern PostgreSQL features
- Prevents "will this work on MySQL?" questions

**Alternatives Considered:**
- Stay generic - Rejected: Losing valuable features
- PostgreSQL 14 - Rejected: Missing some features we want
- PostgreSQL 16+ - Rejected: Too new, limits deployment options

**Impact:**
- Updated database-standards.md
- All SQL examples PostgreSQL-specific
- Clear deployment requirements
- Can use advanced PostgreSQL features

**Related Decisions:** UUIDv7 Adoption, Multi-Tenant ID Strategy

---

### UUIDv7 Adoption (Not UUIDv4)
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Original database-standards.md used gen_random_uuid() which generates UUIDv4 (random). UUIDs provide no temporal ordering, hurt index performance, make debugging harder.

**Decision:**  
Use uuid_generate_v7() for all primary keys:
- Time-ordered (first 48 bits = timestamp)
- Better index performance
- Debuggable (can see creation order)
- Still globally unique
- Available in PostgreSQL 15+ via uuid-ossp extension

**Rationale:**
- UUIDv7 combines benefits of UUID (global uniqueness) with timestamp ordering
- Better B-tree index performance than random UUIDs
- Easier debugging (can see record creation order)
- Industry best practice (IETF draft standard)
- No downside vs. UUIDv4

**Alternatives Considered:**
- UUIDv4 (random) - Rejected: No time ordering, worse performance
- SERIAL/BIGSERIAL - Rejected: Not globally unique, multi-tenant issues
- ULID - Rejected: Not native PostgreSQL support
- Snowflake IDs - Rejected: More complex, unnecessary

**Impact:**
- All examples changed: gen_random_uuid() → uuid_generate_v7()
- Requires uuid-ossp extension
- Better query performance
- Easier debugging
- Database standards updated throughout

**Related Decisions:** PostgreSQL 15+ Specification

---

### Multi-Tenant ID Strategy: Surrogate + Business Key
**Date:** 2025-10-31  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Multi-tenant system requires isolation but also business-friendly identifiers. Single ID column can't serve both purposes. Sales points add additional isolation level.

**Decision:**  
Use dual ID strategy:
1. **Surrogate Key:** `id UUID PRIMARY KEY DEFAULT uuid_generate_v7()`
   - For maintenance, ORMs, foreign keys
   - Internal system use
2. **Business Key:** `UNIQUE (tenant_id, sales_point_id, {business_identifier})`
   - Human-readable (customer_number, order_number, etc.)
   - Business-friendly
   - Enforces uniqueness within tenant/sales point

**Query Pattern:** ALWAYS filter by tenant_id (and sales_point_id for transactional data)

**Rationale:**
- Surrogate UUID: ORMs expect single PK, system needs globally unique IDs
- Business key: Humans need recognizable identifiers
- Unique constraint: Prevents duplicates within tenant scope
- Separate concerns: System IDs vs. business IDs
- Sales point isolation: Transactional data scoped to sales point

**Alternatives Considered:**
- Only business key - Rejected: ORMs need single-column PK
- Only UUID - Rejected: Not human-friendly
- Composite PK (tenant_id, business_id) - Rejected: ORMs struggle with composite PKs
- No sales point isolation - Rejected: Multi-location tenants need this

**Impact:**
- All tables get both ID types
- All queries must filter by tenant_id
- Business logic uses business identifiers
- System/ORM uses UUID
- Updated database-standards.md with examples

**Related Decisions:** UUIDv7 Adoption, PostgreSQL 15+ Specification

---

### Blue-Green Deployment with Database Replication
**Date:** 2025-10-30  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
Need zero-downtime deployments but also zero-loss rollback capability. Standard blue-green doesn't handle database migrations well. Database is single point of failure.

**Decision:**  
Implement blue-green deployment with bidirectional database replication:
- Blue (prod) and Green (new) environments
- Bidirectional logical replication during transition
- 48-96 hour stabilization window
- Can rollback database by pointing to Blue
- Cutover only when confident

**Rationale:**
- Zero-downtime: Users stay on Blue until Green proven
- Zero-loss rollback: Blue database stays current via replication
- Safety: 48-96 hours to find issues before committing
- Confidence: Can rollback without data loss
- Production-ready from day one

**Alternatives Considered:**
- Standard blue-green (no DB replication) - Rejected: Rollback loses data
- Database migrations only - Rejected: No rollback path
- Active-active - Rejected: Too complex for initial deployment
- Canary deployments - Rejected: Doesn't solve database rollback

**Impact:**
- Created Standards/code/blue-green-deployment.md (~15K words)
- Requires logical replication setup
- More complex deployment but safer
- Enables confident releases

**Related Decisions:** Schema-Driven Development

---

### Schema-Driven Development (YAML as Pseudocode)
**Date:** 2025-10-30  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
2-person team (Todd + AI) needs to generate lots of code. AI code generation works best with structured input. Need single source of truth for data models.

**Decision:**  
Use YAML schemas as structured pseudocode:
- Define entities in YAML (structured, validated)
- AI generates TypeScript types, SQL DDL, API endpoints
- Human reviews and refines generated code
- YAML becomes documentation + specification + pseudocode

**Rationale:**
- Structured input → higher quality AI generation
- YAML is human-readable and machine-parseable
- Single source of truth (DRY principle)
- AI excels at structured → code transformation
- Enables 2-person team to move faster
- Self-documenting

**Alternatives Considered:**
- Write everything by hand - Rejected: Too slow for 2-person team
- Use existing ORM schema - Rejected: Not flexible enough
- Use JSON Schema - Considered: YAML more readable
- Use protobuf - Rejected: Overkill, less readable

**Impact:**
- Created Standards/code/schema-driven-development.md (~8K words)
- Workflow: YAML → AI generation → human review → commit
- Print industry patterns documented
- Faster development cycle

**Related Decisions:** Blue-Green Deployment

---

### Core Architectural Triad Documents
**Date:** 2025-10-29  
**Decider:** Todd + AI Assistant  
**Status:** Active

**Context:**  
New team members (human or AI) need quick understanding of system. Information scattered. No clear "start here" documents.

**Decision:**  
Create three foundational documents that every person must read:
1. **BUSINESS_VALUE.md** - WHY we're building this (business case)
2. **SYSTEM_OVERVIEW.md** - WHAT we're building (architecture)
3. **database-standards.md** - HOW we're building data layer (technical standards)

**Rationale:**
- WHY/WHAT/HOW covers all angles
- Together they provide complete context
- Each stands alone but references others
- Prevents information scatter
- Essential reading for onboarding

**Alternatives Considered:**
- Single mega-document - Rejected: Too long, harder to maintain
- More than 3 docs - Rejected: Onboarding burden
- README.md only - Rejected: Not deep enough

**Impact:**
- Created 3 core documents (~34K words total)
- PROJECT_INDEX.md references them
- AI_ONBOARDING.md will reference them
- Clear onboarding path

**Related Decisions:** Schema-Driven Development, Multi-Tenant Strategy

---

## Older Decisions (Archive)

### 48-96 Hour Stabilization Window
**Date:** 2025-10-30  
**Decider:** Todd + AI Assistant  
**Status:** Active (part of Blue-Green deployment)

**Context:**  
How long to run Blue and Green in parallel before committing to Green?

**Decision:** 48-96 hours minimum stabilization period

**Rationale:**
- 48 hours catches most issues (2 full business days)
- 96 hours for major releases (covers weekend)
- Gives time to monitor metrics
- Users don't see issues (still on Blue)
- Can rollback without data loss

**Alternatives Considered:**
- 24 hours - Rejected: Not enough monitoring time
- 1 week - Rejected: Too long, infrastructure cost
- No stabilization - Rejected: Unsafe

**Impact:** Part of blue-green deployment strategy

---

## Decision Templates

### Technology Choice Template
```markdown
### [Technology Name] Adoption
**Date:** YYYY-MM-DD  
**Decider:** Name  
**Status:** Active | Superseded

**Context:** What problem were we solving?

**Decision:** We chose [Technology X]

**Rationale:**
- Reason 1
- Reason 2
- Reason 3

**Alternatives Considered:**
- Alternative A: Why rejected
- Alternative B: Why rejected

**Impact:**
- What changes
- What stays same
- Migration path if any

**Related Decisions:** Links
```

### Pattern/Architecture Template
```markdown
### [Pattern Name] Pattern
**Date:** YYYY-MM-DD  
**Decider:** Name  
**Status:** Active | Superseded

**Context:** What problem does this solve?

**Decision:** Use [Pattern Name]

**Rationale:**
- Solves problem X
- Better than alternatives because Y
- Enables Z

**Alternatives Considered:**
- Alternative A: Why rejected
- Alternative B: Why rejected

**Impact:**
- All [components] must use this pattern
- [Other impact]

**Related Decisions:** Links
```

---

## Related Documentation

- [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) - Current project state
- [AI_ONBOARDING.md](./AI_ONBOARDING.md) - Quick start for new AI sessions
- [CONSTRAINTS.md](../CONSTRAINTS.md) - Hard rules (outcomes of decisions)
- [Project Spirit/adr/](../Project%20Spirit/adr/) - Formal Architecture Decision Records

---

[⬆ Back to top](#critical-decisions-log) | [🏠 AGOG Home](../README.md) | [📋 Session Context](./SESSION_CONTEXT.md)
