**📍 Navigation Path:** [AGOG Home](../README.md) → Project Utilities → AI Onboarding

# 🤖 AI Assistant Onboarding Guide

> **🎯 Purpose:** Get a new AI session up to speed in <5 minutes  
> **📅 Last Updated:** 2025-10-31  
> **👋 Read this FIRST** before working on any AGOG tasks

---

## What is AGOG? (60 seconds)

**AGOG** is a comprehensive **Packaging Industry ERP system** with AI-powered optimization and real-time monitoring.

**The Challenge:** Packaging companies (corrugated, commercial print, labels, shrink film, folding cartons, flexible packaging) struggle with disconnected systems, manual processes, inventory waste, and inability to track materials from raw stock to finished product. Generic ERPs don't understand packaging manufacturing (8 different manufacturing strategies, complex quality control, equipment integration, substrate tracking).

**The Solution:** AGOG provides end-to-end packaging industry ERP with:
- **Multi-tenant SaaS** architecture (Tenant → Sales Point → Records isolation)
- **8 Manufacturing Strategies** (Make-to-Stock, Make-to-Order, Configure-to-Order, Engineer-to-Order, Assemble-to-Order, Make-to-Forecast, Postponement, Mass Customization)
- **Material Lot Genealogy** - End-to-end traceability from raw materials through production to finished goods
- **AI-Powered Optimization** - Predictive scheduling, quality control, inventory optimization
- **JDF/JMF Integration** - Native print equipment connectivity
- **Real-time Dashboards** - 10+ specialized dashboards for all business units

**The Architectural Foundation: OLAP → OLTP → API → UX**

AGOG is built on a unique principle: **Analytics drive everything.**

```
Business Goals (KPIs - OLAP Layer)
  "We need to calculate OEE"
    ↓ defines requirements for
Data Storage (Schemas - OLTP Layer)
  "Capture: actual_start_time, quantity_good, speed_actual"
    ↓ exposes through
API Layer (GraphQL/REST)
  "type ProductionRun { oee: Float! }"
    ↓ consumed by
User Experience (React)
  "<OEEGauge value={0.87} />"
```

**Why this matters for AI development:**
- Every database field has a purpose (supports a KPI calculation)
- Validation ensures dashboards never show "N/A" for metrics
- You can trust that if a KPI exists, the data to calculate it exists
- When adding features, check KPIs first to understand requirements

**The Differentiator:** Material lot genealogy + analytics-driven architecture. Not just "what happened" but "why did it happen" with complete traceability and validated metrics.

---

## Who's Building It? (30 seconds)

**Team:** 2 people
- **Todd (Human):** Project owner, architect, developer
- **AI Assistant (You!):** Co-developer, documentation specialist, code generator

**Approach:** Documentation-heavy development
- Write comprehensive specs and standards first
- AI generates code from structured schemas (YAML → TypeScript/SQL)
- Human reviews and refines
- Production-quality from day one

**Philosophy:** Build for future teams (human + AI). Everything must be discoverable and usable by developers working with AI assistants.

---

## What's the Current Status? (60 seconds)

**Phase:** Documentation & Architecture (pre-implementation)

**Recent Work:**
- ✅ Core Architectural Triad complete (BUSINESS_VALUE, SYSTEM_OVERVIEW, database-standards)
- ✅ Schema-driven development standard formalized
- ✅ Blue-green deployment strategy with database replication
- ✅ PostgreSQL 15+ standards (UUIDv7, multi-tenant patterns)
- ✅ Gap tracking system (GAPS.md)
- ✅ Navigation Path system (in progress - Phase 1)
- ✅ Session recovery system (you're reading it!)

**Current Focus:** Navigation Path rollout (adding navigation to all documentation files)

**Code Status:**
- Database schemas: Defined in YAML, not yet implemented
- TypeScript code: Structure defined, not yet implemented
- APIs: Standards written, not yet implemented

**Next Up:**
- Complete Navigation Path rollout
- Create migration standards
- Create API specification
- Start schema → code generation

---

## Critical Files to Read (2 minutes)

**Read these IN ORDER before starting work:**

1. **[SESSION_CONTEXT.md](./SESSION_CONTEXT.md)** (3 min read)
   - What are we working on RIGHT NOW?
   - Recent changes
   - Next planned actions
   - Current blockers

2. **[CONSTRAINTS.md](../CONSTRAINTS.md)** (2 min read)
   - Hard rules that MUST NOT be violated
   - PostgreSQL patterns
   - Multi-tenant requirements
   - ID strategies

3. **[DECISION_LOG.md](./DECISION_LOG.md)** (5 min scan)
   - WHY we made key technical decisions
   - UUIDv7 vs UUIDv4
   - Multi-tenant patterns
   - Navigation Path terminology
   - Blue-green deployment choices

4. **[PROJECT_INDEX.md](../PROJECT_INDEX.md)** (3 min scan)
   - Overall project structure
   - Where to find things
   - Quick navigation matrix

5. **[GAPS.md](../GAPS.md)** (3 min scan)
   - What's incomplete or needs work
   - Documentation gaps
   - Priorities and target dates

**After these 5 files:** You'll understand the project well enough to contribute effectively.

---

## Tech Stack Quick Reference (30 seconds)

- **Database:** PostgreSQL 15+ (RLS, JSONB, UUIDv7, logical replication, partitioning)
- **Backend:** Node.js + TypeScript
- **Frontend:** React (planned)
- **API:** REST (GraphQL considered for future)
- **Data Modeling:** YAML schemas as structured pseudocode
- **Deployment:** Blue-green with database replication
- **IDs:** UUIDv7 (time-ordered) for all primary keys
- **Multi-Tenant:** tenant_id + sales_point_id + business_identifier

---

## Common Gotchas & Important Patterns (90 seconds)

### ⚠️ ALWAYS Rules (see CONSTRAINTS.md for full list)

1. **ALWAYS use `uuid_generate_v7()`** for primary keys (NOT `gen_random_uuid()`)
2. **ALWAYS filter by `tenant_id`** in queries (multi-tenant isolation)
3. **ALWAYS include sales_point_id** for transactional data
4. **ALWAYS use surrogate UUID id + unique constraint** on (tenant_id, sales_point_id, business_identifier)
5. **ALWAYS add Navigation Path** to top and bottom of documentation files

### ⚠️ NEVER Rules

1. **NEVER use UUIDv4** (random UUIDs) - use UUIDv7 (time-ordered)
2. **NEVER skip tenant_id filtering** in queries (security/isolation issue)
3. **NEVER use generic SQL** - we're PostgreSQL 15+ specific
4. **NEVER create documentation without Navigation Path**
5. **NEVER make architectural changes without updating DECISION_LOG.md**

### 📋 Common Patterns

**Multi-Tenant Table Pattern:**
```sql
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    sales_point_id UUID REFERENCES sales_points(id),
    business_number VARCHAR(50) NOT NULL,
    -- ... other fields ...
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, sales_point_id, business_number)
);
```

**Query Pattern:**
```sql
-- ALWAYS filter by tenant_id
SELECT * FROM orders 
WHERE tenant_id = $1 
  AND sales_point_id = $2 
  AND order_number = $3;
```

**Navigation Path Pattern:**
```markdown
**📍 Navigation Path:** [AGOG Home](../README.md) → Parent → Current

# Document Title

[content]

---

[⬆ Back to top](#anchor) | [🏠 AGOG Home](../README.md) | [Parent](../README.md)
```

---

## Where to Find Things (60 seconds)

**"How does X work?"**
→ `Project Architecture/` (system design, workflows, integrations)

**"What are the standards for X?"**
→ `Standards/{category}/README.md` then specific standards docs

**"Where is X implemented?"**
→ `Implementation/print-industry-erp/` (schemas, database, src code)

**"What needs to be done?"**
→ `TODO.md` (tasks), `GAPS.md` (documentation quality)

**"Why was X designed this way?"**
→ `.github/DECISION_LOG.md` (quick) or `Project Spirit/adr/` (formal)

**"What's the business value of X?"**
→ `Project Spirit/BUSINESS_VALUE.md`

**"What's the complete architecture?"**
→ `Project Architecture/SYSTEM_OVERVIEW.md` (~14K words)

**"What are the database patterns?"**
→ `Standards/data/database-standards.md` (~11K words)

---

## How Todd + AI Work Together (60 seconds)

### Communication Style
- **Direct and technical** - No fluff, get to the point
- **Questions assumptions** - Todd challenges unvalidated claims
- **Values credibility** - No unvalidated percentages or marketing speak
- **International-friendly** - Clear terminology (e.g., "Navigation Path" not "breadcrumbs")

### Workflow Pattern
1. **Todd provides direction** - "We need X" or "This doesn't work"
2. **AI proposes solution** - With rationale and alternatives
3. **Todd reviews/refines** - Often asks "why?" or "what about Y?"
4. **AI implements** - Creates/updates files
5. **Both iterate** - Until solution is right

### Decision Making
- **Technical decisions:** AI proposes, Todd validates/refines
- **Architectural decisions:** Discussed, documented in DECISION_LOG.md
- **Documentation:** AI drafts, Todd reviews for accuracy/tone
- **Code (future):** AI generates from schemas, Todd reviews/refines

### What Todd Values
- **Production quality** - Do it right the first time
- **Comprehensive docs** - Future teams should understand everything
- **AI-friendly structure** - Clear patterns, good navigation, structured data
- **Honest gaps tracking** - Better to document what's missing than pretend it's done

---

## Current Work Focus (What to work on) (30 seconds)

**Read SESSION_CONTEXT.md for current state**, but as of 2025-10-31:

**Active Task:** Navigation Path rollout (Phase 1)
- Add navigation to Project Architecture/README.md and Project Spirit/README.md
- Then continue with Phase 2 (deep documentation files)

**Next Tasks:**
- Create Migration Standards (Standards/data/migration-standards.md)
- Create API Specification (Project Architecture/api/api-specification.md)
- Expand Database Standards README

**See GAPS.md for prioritized queue of documentation work.**

---

## Quick Health Checks (Before starting work)

### Before Making Changes
- [ ] Read SESSION_CONTEXT.md (what are we working on?)
- [ ] Check GAPS.md (is this a known gap?)
- [ ] Check CONSTRAINTS.md (any rules I must follow?)
- [ ] Check relevant standards in Standards/ (what's the pattern?)

### Before Committing Changes
- [ ] Updated SESSION_CONTEXT.md? (if significant work)
- [ ] Added to DECISION_LOG.md? (if made architectural choice)
- [ ] Updated GAPS.md? (if closed a gap or found new ones)
- [ ] Updated TODO.md? (if completed tasks)
- [ ] Added Navigation Path? (if created/updated documentation)

### If Something Seems Wrong
1. **Check DECISION_LOG.md** - Was this intentional?
2. **Check CONSTRAINTS.md** - Is there a hard rule about this?
3. **Ask Todd** - "I notice X, should we Y?"

---

## Emergency Reference (30 seconds)

### If Session Ends Suddenly
- **Don't panic** - This system is designed for session recovery
- **Update SESSION_CONTEXT.md** - Quick note of current state
- **Commit changes** - Even incomplete work (with note in commit message)

### If You're Confused
1. Re-read SESSION_CONTEXT.md
2. Search PROJECT_INDEX.md for the topic
3. Check GAPS.md (might be a known incomplete area)
4. Ask Todd for clarification

### If You Find a Gap/Issue
1. Note it immediately
2. Add to GAPS.md using .github/GAP_TEMPLATE.md
3. Continue with current task (unless critical)

---

## Success Metrics (How to know you're doing well)

✅ **You're doing great if:**
- Can find any documentation in <30 seconds
- Understand WHY decisions were made (not just WHAT)
- Follow established patterns without being told
- Update session recovery files when appropriate
- Ask clarifying questions when assumptions unclear

❌ **Warning signs:**
- Violating rules in CONSTRAINTS.md
- Making architectural changes without documenting
- Creating documentation without Navigation Path
- Not updating SESSION_CONTEXT.md after significant work
- Reinventing patterns that already exist in Standards/

---

## The Big Picture (Why this matters)

**We're building for the future:**
- This project will grow beyond Todd + 1 AI
- Future developers (human + AI) will join
- They need to understand everything we've built
- Documentation is investment in future velocity

**Your role:**
- Be Todd's force multiplier
- Generate high-quality code from structured specs
- Maintain comprehensive documentation
- Follow established patterns
- Ask good questions

**Together:** 2-person team building production-quality packaging industry ERP that will serve real packaging companies (corrugated, commercial print, labels, shrink film, folding cartons, flexible packaging) with real compliance requirements and real business impact.

---

## Ready to Start? (Checklist)

- [ ] Read this entire document (you just did!)
- [ ] Read [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) - What's happening now?
- [ ] Read [CONSTRAINTS.md](../CONSTRAINTS.md) - What are the hard rules?
- [ ] Scan [DECISION_LOG.md](./DECISION_LOG.md) - Why we made key choices
- [ ] Scan [PROJECT_INDEX.md](../PROJECT_INDEX.md) - Where things are
- [ ] Scan [GAPS.md](../GAPS.md) - What needs work

**Estimated time:** 15-20 minutes for all 6 documents

**After reading these:** You're ready to contribute effectively! 🚀

---

## Quick Command Reference

**Find something:**
```bash
# Search for text in all files
grep -r "search term" .

# Find files by name
find . -name "*pattern*"
```

**Common file locations:**
- Documentation: Root + `Project Architecture/` + `Project Spirit/`
- Standards: `Standards/{code|data|api}/`
- Implementation: `Implementation/print-industry-erp/`
- Utilities: `.github/`
- Tracking: `GAPS.md`, `TODO.md`, `SESSION_CONTEXT.md`

---

## Related Documentation

- [SESSION_CONTEXT.md](./SESSION_CONTEXT.md) - Current project state (READ NEXT)
- [DECISION_LOG.md](./DECISION_LOG.md) - Why we made key decisions
- [CONSTRAINTS.md](../CONSTRAINTS.md) - Hard rules that must not be violated
- [MAINTENANCE_ROUTINE.md](./MAINTENANCE_ROUTINE.md) - Keep systems healthy
- [PROJECT_INDEX.md](../PROJECT_INDEX.md) - Project navigation hub
- [GAPS.md](../GAPS.md) - Documentation quality tracking

---

**Welcome to the AGOG project! Let's build something great together.** 🎉

---

[⬆ Back to top](#-ai-assistant-onboarding-guide) | [🏠 AGOG Home](../README.md) | [📋 Session Context](./SESSION_CONTEXT.md) | [🚫 Constraints](../CONSTRAINTS.md)
