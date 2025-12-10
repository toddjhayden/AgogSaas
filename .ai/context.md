# AI Assistant Context Guide - AgogSaaS

This file helps AI assistants understand the AgogSaaS project structure and provide better assistance.

## Quick Start for Agents

**Before doing ANYTHING, read these in order:**

1. **[AGOG_AGENT_ONBOARDING.md](../.claude/agents/AGOG_AGENT_ONBOARDING.md)** (5 min) - CRITICAL standards
2. **[CONSTRAINTS.md](../CONSTRAINTS.md)** (2 min) - Hard rules (MUST follow)
3. **[Implementation/README.md](../Implementation/README.md)** (10 min) - 4-layer workflow
4. **This file** (5 min) - Project context

**Total: ~20 minutes to be productive**

---

## Team Structure & Development Approach

### Current Phase: 4-Layer AI Automation
**Team**: 2 collaborators
- Todd (Product Owner/Developer)
- AI Assistant (Partner building everything)

**What We're Building**:
- ✅ Complete Packaging Industry ERP (AgogSaaS)
- ✅ 4-Layer AI automation system
- ✅ Production-ready code, not just documentation
- ✅ 35+ AI agents for automated development

**Critical Design Principle**:
Everything we create must work for:
- ✅ 35+ AI agents collaborating
- ✅ Human developers + their AI assistants
- ✅ Multi-agent orchestration workflows
- ✅ Semantic memory system (agents learning)

---

## 4-Layer AI System (AgogSaaS Differentiator)

### Layer 1: VALIDATION (Pre-Commit Hooks)
**Location**: `.git-hooks/pre-commit`
**Purpose**: Block bad code before it enters repo
**Checks**: Security, linting, type checking, unit tests

### Layer 2: MONITORING (Real-Time Dashboard)
**Location**: `http://localhost:3000/monitoring`
**Purpose**: Visibility into health, errors, agent activity
**Components**: Health checks, error tracking, agent logs

### Layer 3: ORCHESTRATION (Automated Workflows)
**Location**: `Implementation/print-industry-erp/backend/src/orchestration/`
**Purpose**: Multi-agent feature development automation
**Flow**: Cynthia (Research) → Sylvia (Critique) → Roy + Jen → Billy → Priya

**NATS Deliverable Pattern** (95% token savings):
- Agents publish full reports to NATS (10,000+ tokens)
- Return tiny completion notices (~200 tokens)
- Orchestrator only keeps completion notices in context

### Layer 4: MEMORY (Semantic Search)
**Location**: `backend/src/mcp/`, PostgreSQL pgvector
**Purpose**: Agents learn from past work
**Technology**: OpenAI embeddings + pgvector similarity search

**Before starting work:**
```typescript
const memories = await mcpClient.searchMemories({
  query: "multi-tenant customer management patterns",
  agent_id: "cynthia",
  min_relevance: 0.7
});
```

**After completing work:**
```typescript
await mcpClient.storeMemory({
  agent_id: "cynthia",
  memory_type: "research_pattern",
  content: "For customer features: Check data-models/schemas/ first. Use uuid_generate_v7().",
  metadata: { agog_standards: ["uuid_generate_v7", "tenant_id"] }
});
```

---

## AGOG Standards (CRITICAL - MUST FOLLOW)

### Database Standards

```sql
-- ✅ CORRECT (AGOG standard)
CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),  -- Time-ordered, NOT random
    tenant_id UUID NOT NULL,                          -- Multi-tenant REQUIRED
    sales_point_id UUID,                              -- For transactional data
    customer_number VARCHAR(50) NOT NULL,             -- Business identifier
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, sales_point_id, customer_number)  -- Surrogate + business key
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);  -- REQUIRED

-- ❌ WRONG (VIOLATIONS)
CREATE TABLE bad_example (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),  -- ❌ VIOLATION: Use uuid_generate_v7()
    -- Missing tenant_id                            -- ❌ VIOLATION: tenant_id required
    customer_number VARCHAR(50) PRIMARY KEY         -- ❌ VIOLATION: Use surrogate UUID
);
```

### Query Standards

```sql
-- ✅ CORRECT (ALWAYS filter by tenant_id)
SELECT * FROM customers
WHERE tenant_id = $1          -- SECURITY CRITICAL
  AND customer_number = $2;

-- ❌ WRONG (SECURITY VIOLATION - can see other tenants' data!)
SELECT * FROM customers
WHERE customer_number = $1;   -- ❌ Missing tenant_id filter
```

### Documentation Standards

```markdown
**📍 Navigation Path:** [AGOG Home](../README.md) → [Parent](./README.md) → Current Page

# Document Title

[Content]

---

[⬆ Back to top](#document-title) | [🏠 AGOG Home](../README.md) | [📚 Parent](./README.md)
```

**Every markdown file MUST have Navigation Path top and bottom.**

### Git Commit Standards

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples:**
```
feat(api): Add customer search with filters
fix(auth): Resolve JWT token expiration
docs(agents): Update AGOG agent onboarding
```

---

## Schema-Driven Development (AGOG Workflow)

**YAML First, Then Code**

```
1. Design YAML schema (data-models/schemas/)
2. Validate against AGOG standards
3. Generate TypeScript interfaces
4. Generate SQL migrations (with uuid_generate_v7)
5. Generate GraphQL types
6. Implement business logic only
```

**See**: `Standards/code/schema-driven-development.md`

---

## Agent Workflow

### 1. Agent Receives Task
```typescript
{
  task: "customer-search",
  previous_deliverable_channel: "agog.deliverables.cynthia.research.customer-search",
  context: { ... }
}
```

### 2. Agent Reads Standards
- `.claude/agents/AGOG_AGENT_ONBOARDING.md` - CRITICAL standards
- `CONSTRAINTS.md` - Hard rules
- `Standards/` - Specific standards for role

### 3. Agent Queries Memories (Layer 4)
```typescript
const memories = await mcpClient.searchMemories({
  query: "customer search multi-tenant patterns",
  agent_id: "cynthia"
});
```

### 4. Agent Does Work
Following AGOG standards:
- uuid_generate_v7() for PKs
- tenant_id on all tables and queries
- Navigation Path on docs
- Schema-driven development

### 5. Agent Publishes Full Report to NATS
```typescript
await nats.publish(
  'agog.deliverables.cynthia.research.customer-search',
  fullResearchReport  // 10,000+ tokens
);
```

### 6. Agent Returns Tiny Completion Notice
```json
{
  "status": "complete",
  "agent": "cynthia",
  "nats_channel": "agog.deliverables.cynthia.research.customer-search",
  "summary": "Found 5 similar features. Complexity: Medium. Ready for Sylvia."
}
```

Only ~200 tokens returned - **95% context savings!**

### 7. Agent Stores Learnings (Layer 4)
```typescript
await mcpClient.storeMemory({
  agent_id: "cynthia",
  memory_type: "research_pattern",
  content: "Customer features: Check core-entities.yaml, use uuid_generate_v7().",
  metadata: { agog_standards: ["uuid_generate_v7", "tenant_id"] }
});
```

---

## Critical Context for AI Agents

### 1. Domain Knowledge Required
Packaging industry terminology:
- Corrugated, commercial print, labels, shrink film, folding cartons, flexible packaging
- JDF/JMF protocols for equipment communication
- Manufacturing strategies (8 types: MTS, MTO, CTO, ETO, ATO, Forecast, Postponement, Mass Customization)
- Material lot genealogy (end-to-end traceability)
- Quality control (color management, registration)

### 2. Always Check First
Before suggesting or creating:
1. **Search** `.claude/agents/AGOG_AGENT_ONBOARDING.md` for standards
2. **Check** `CONSTRAINTS.md` for hard rules
3. **Review** `Standards/` for patterns
4. **Search** `Implementation/` for existing code
5. **Query** Layer 4 memories for past learnings

### 3. AGOG-Specific Patterns

**Multi-Tenancy is Mandatory**:
```yaml
properties:
  id: uuid          # uuid_generate_v7() in SQL
  tenantId: uuid    # ALWAYS include
  salesPointId: uuid  # For transactional data
  # ... other properties
  createdAt: datetime
  updatedAt: datetime
```

**Packaging Industry Focus**:
- Real-time equipment integration (JDF/JMF)
- Material lot genealogy (full traceability)
- Multi-tenant SaaS architecture
- 8 manufacturing strategies support
- Quality measurements and tolerances

### 4. NATS Channels

**Format**: `agog.deliverables.[agent].[task-type].[feature-name]`

**Examples**:
- `agog.deliverables.cynthia.research.customer-search`
- `agog.deliverables.sylvia.critique.customer-search`
- `agog.deliverables.roy.backend.customer-search`
- `agog.deliverables.jen.frontend.customer-search`
- `agog.deliverables.billy.qa.customer-search`

**Agent Streams**:
- `agog_features_research` - Cynthia's deliverables
- `agog_features_critique` - Sylvia's reviews
- `agog_features_backend` - Roy's implementations
- `agog_features_frontend` - Jen's UI components
- `agog_features_qa` - Billy's test results
- `agog_features_statistics` - Priya's metrics

---

## Project Structure

```
agogsaas/
├── .ai/context.md                      # YOU ARE HERE
├── .claude/agents/                     # 35+ agent definitions
│   └── AGOG_AGENT_ONBOARDING.md        # CRITICAL standards
├── Implementation/
│   ├── README.md                       # 4-layer workflow guide
│   └── print-industry-erp/
│       ├── backend/                    # GraphQL API + 4 layers
│       ├── frontend/                   # React + monitoring dashboard
│       ├── database/                   # Schemas & migrations
│       ├── data-models/                # YAML schemas
│       └── src/                        # Implementation code
├── Standards/                          # Development standards
│   ├── code/                           # Coding standards
│   ├── data/                           # Database standards
│   ├── api/                            # API standards
│   └── documentation/                  # Documentation standards
├── project-architecture/               # System design
├── project-spirit/                     # Vision & decisions
├── docs/                               # Documentation
├── CONSTRAINTS.md                      # Hard rules (MUST follow)
├── TODO.md                             # Current tasks
├── README.md                           # Project overview
└── docker-compose.yml                  # All services
```

---

## When User Asks...

**"Is there an easy start for agents?"**
→ Yes! Read `.claude/agents/AGOG_AGENT_ONBOARDING.md` (5 min comprehensive guide)

**"Where do I find agent standards?"**
→ `.claude/agents/AGOG_AGENT_ONBOARDING.md` - All critical standards in one place

**"How do agents communicate?"**
→ NATS deliverable pattern - publish full reports to NATS, return tiny notices

**"How do agents learn?"**
→ Layer 4 memory system - query past memories before starting, store learnings after

**"How should I implement X?"**
1. Check `CONSTRAINTS.md` for hard rules
2. Check `Standards/code/` for coding standards
3. Check `Standards/data/` for database patterns
4. Query Layer 4 memories for past similar work
5. Look for existing implementations in `Implementation/`

**"Where does X belong?"**
```
Standards/               - How to do things
Implementation/          - Actual code
.claude/agents/          - Agent definitions
project-architecture/    - System design
project-spirit/          - Vision & decisions
```

---

## Common Traps to Avoid

❌ **Don't**: Use `gen_random_uuid()` for primary keys
✅ **Do**: Use `uuid_generate_v7()` (time-ordered, better performance)

❌ **Don't**: Skip `tenant_id` filtering in queries
✅ **Do**: ALWAYS filter by `tenant_id` (security critical)

❌ **Don't**: Create documentation without Navigation Path
✅ **Do**: Add Navigation Path top and bottom on ALL markdown files

❌ **Don't**: Write code before YAML schema
✅ **Do**: Design YAML schema first, then generate code

❌ **Don't**: Return full reports in spawn response
✅ **Do**: Publish to NATS, return tiny completion notice

❌ **Don't**: Forget to query/store memories
✅ **Do**: Query Layer 4 before work, store learnings after

---

## Technology Stack

**Primary Stack**:
- Backend: TypeScript/Node.js + Apollo Server (GraphQL)
- Frontend: React + Vite + Material-UI
- Database: PostgreSQL 15+ (pgvector extension)
- Messaging: NATS Jetstream (agent deliverables)
- API: GraphQL (internal), REST (external integrations)
- Deployment: Docker Compose (blue-green)
- IDs: UUIDv7 (time-ordered, NOT random)

**AI/ML Components**:
- Layer 4: pgvector + OpenAI embeddings (semantic search)
- Layer 3: Multi-agent orchestration (NATS)
- Layer 2: Real-time monitoring dashboard
- Layer 1: Pre-commit validation hooks

---

## Decision Tree for Agents

```
New Task Received
├─ Read AGOG_AGENT_ONBOARDING.md?
│  ├─ No → STOP, read it first
│  └─ Yes → Continue
├─ Check CONSTRAINTS.md for hard rules?
│  ├─ No → STOP, check it first
│  └─ Yes → Continue
├─ Query Layer 4 memories for similar work?
│  ├─ No → Query now
│  └─ Yes → Continue
├─ Does it affect data model?
│  ├─ Yes → YAML schema first, uuid_generate_v7(), tenant_id
│  └─ No → Continue
├─ Does it affect API?
│  ├─ Yes → GraphQL (internal) or REST (external)?
│  └─ No → Continue
├─ Multi-tenant security?
│  ├─ Yes → tenant_id filtering REQUIRED
│  └─ No → Continue
├─ Do work following AGOG standards
├─ Publish full report to NATS
├─ Return tiny completion notice
└─ Store learnings in Layer 4 memory
```

---

## Quick Reference

**Most Important Files**:
1. `.claude/agents/AGOG_AGENT_ONBOARDING.md` - Start here (CRITICAL)
2. `CONSTRAINTS.md` - Hard rules
3. `Implementation/README.md` - 4-layer workflow
4. `Standards/code/schema-driven-development.md` - YAML → Code

**Most Important Rules**:
1. `uuid_generate_v7()` for ALL primary keys
2. `tenant_id` on ALL tables, in ALL queries
3. Navigation Path on ALL markdown files
4. YAML schema BEFORE code
5. Publish to NATS, return tiny notice
6. Query/store Layer 4 memories

**Most Important Patterns**:
- Multi-tenant: `tenant_id UUID NOT NULL`
- Surrogate key: `id UUID PRIMARY KEY DEFAULT uuid_generate_v7()`
- Business key: `UNIQUE (tenant_id, sales_point_id, business_identifier)`
- NATS channel: `agog.deliverables.[agent].[type].[feature]`

---

## Update History
- 2025-12-09: Created for AgogSaaS with 4-layer AI system context
- Based on original agog .ai/context.md
- Added Layer 1-4 system information
- Added NATS deliverable pattern
- Added agent workflow and memory system
- Added AGOG standards (uuid_generate_v7, tenant_id, Navigation Path)
