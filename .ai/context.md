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
**Location Backend**: `Implementation/print-industry-erp/backend/src/modules/monitoring/`
**Location Frontend**: `Implementation/print-industry-erp/frontend/src/pages/MonitoringDashboard.tsx`
**Dashboard URL**: `http://localhost:3000/monitoring`
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
**Location**: `Implementation/print-industry-erp/backend/src/mcp/mcp-client.service.ts`
**Database**: PostgreSQL with pgvector extension
**Purpose**: Agents learn from past work
**Technology**: Ollama (nomic-embed-text) embeddings + pgvector similarity search

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

## 🌐 3-Tier Edge-to-Cloud Architecture (CRITICAL)

**AgogSaaS operates across 3 database tiers globally** - agents MUST understand this:

### Tier 1: Edge Databases (Manufacturing Facilities)
**Location**: PostgreSQL at EACH facility (LA, Frankfurt, Shanghai, etc.)
**Purpose**: Offline-capable manufacturing operations
**Key Properties**:
- Workers create orders/update inventory even when internet DOWN
- Changes buffered locally, sync to cloud every 5 seconds (when online)
- **Edge Priority**: When edge reconnects, edge data overwrites cloud (physical reality wins)

**Example Facilities:**
- Foo Inc LA: Edge database → syncs to US-EAST cloud
- Foo Inc Frankfurt: Edge database → syncs to EU-CENTRAL cloud
- Foo Inc Shanghai: Edge database → syncs to APAC cloud

### Tier 2: Regional Cloud (US-EAST, EU-CENTRAL, APAC)
**Location**: AWS/GCP Kubernetes clusters (3 regions)
**Purpose**: Aggregate facilities, serve remote workers
**Key Properties**:
- **Blue + Green environments** in EACH region (6 total databases globally)
- Receives edge syncs (5-second lag normal)
- Serves remote workers (Philippines → US-EAST, Poland → EU-CENTRAL)
- **Data sovereignty**: EU data stays EU-CENTRAL (GDPR), China stays APAC (sovereignty laws)

### Tier 3: Global Analytics
**Location**: Global aggregation database
**Purpose**: Executive dashboards (CEO in Dubai queries LA + Frankfurt + Shanghai)
**Key Properties**:
- **GraphQL Federation** queries all regions real-time
- Pre-aggregated KPIs (hourly/daily rollups)
- Read-only (no write operations)

### Agent Coding Requirements

#### 1. Backward-Compatible Migrations (Blue-Green Deployment)
**Context**: Green database runs NEW code + NEW schema, Blue runs OLD code + OLD schema for 24-48 hours.

**Safe Migrations:**
```sql
-- ✅ SAFE: Add nullable column (old code ignores, new code uses)
ALTER TABLE orders ADD COLUMN priority VARCHAR(20) NULL;

-- ✅ SAFE: Add new table (old code doesn't use)
CREATE TABLE order_priorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    name VARCHAR(20) NOT NULL
);

-- ✅ SAFE: Add index (old code benefits too)
CREATE INDEX idx_orders_priority ON orders(priority);
```

**UNSAFE Migrations (BREAKS ROLLBACK):**
```sql
-- ❌ UNSAFE: Rename column (old code breaks)
ALTER TABLE orders RENAME COLUMN status TO order_status;

-- ❌ UNSAFE: Drop column (old code breaks)
ALTER TABLE orders DROP COLUMN customer_id;

-- ❌ UNSAFE: Change type (old code may break)
ALTER TABLE orders ALTER COLUMN quantity TYPE DECIMAL(10,2);
```

#### 2. Edge Dual-Write (During Deployment)
**Context**: During blue-green deployment, edge agents write to BOTH Blue and Green simultaneously.

**Your resolver pattern:**
```typescript
async createOrder(args, context) {
  const { tenant_id } = context.user;

  // Check if dual-write mode enabled
  const dualWriteEnabled = process.env.DUAL_WRITE_ENABLED === 'true';

  if (dualWriteEnabled) {
    // Write to Blue
    await bluePool.query('INSERT INTO orders ...', [tenant_id, ...]);

    // Write to Green
    await greenPool.query('INSERT INTO orders ...', [tenant_id, ...]);
  } else {
    // Normal single-write mode
    await pool.query('INSERT INTO orders ...', [tenant_id, ...]);
  }
}
```

#### 3. Conflict Resolution (Edge Priority)
**Rule**: If edge offline, cloud users CANNOT edit edge-owned records.

**Your query pattern:**
```typescript
async updateOrder(args, context) {
  const { tenant_id, user_location } = context.user;

  // Check if edge facility is online
  const edgeStatus = await getEdgeFacilityStatus(args.facilityId);

  if (!edgeStatus.online && user_location === 'cloud') {
    throw new Error('Cannot edit order - facility offline. Edge has priority when reconnects.');
  }

  // Proceed with update
  return await pool.query('UPDATE orders ... WHERE tenant_id = $1', [tenant_id, ...]);
}
```

### Architecture References

- **[ADR 003: 3-Tier Database](../project-spirit/adr/003-3-tier-database-offline-resilience.md)** - Edge offline resilience
- **[ADR 004: Disaster Recovery](../project-spirit/adr/004-disaster-recovery-plan.md)** - Tested DR procedures
- **[Conflict Resolution Strategy](../docs/CONFLICT_RESOLUTION_STRATEGY.md)** - Edge-priority patterns
- **[Blue-Green Deployment Guide](../README_BLUE_GREEN_DEPLOYMENT.md)** - Deployment procedures

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
4. **Search** `Implementation/print-industry-erp/backend/` for existing backend code
5. **Search** `Implementation/print-industry-erp/frontend/` for existing frontend code
6. **Query** Layer 4 memories for past learnings

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
│       │   ├── src/                    # Backend implementation code
│       │   │   ├── index.ts            # Main entry point
│       │   │   ├── modules/            # Feature modules (monitoring, etc.)
│       │   │   ├── orchestration/      # Layer 3: Agent orchestration
│       │   │   └── mcp/                # Layer 4: Memory system
│       │   ├── database/               # Database schemas
│       │   ├── data-models/            # YAML schema definitions
│       │   ├── migrations/             # SQL migrations
│       │   ├── scripts/                # Setup scripts (NATS, etc.)
│       │   ├── Dockerfile
│       │   ├── package.json
│       │   └── tsconfig.json
│       └── frontend/                   # React web application
│           ├── src/                    # Frontend implementation code
│           │   ├── App.tsx             # Main app component
│           │   ├── main.tsx            # Entry point
│           │   ├── pages/              # Page components (MonitoringDashboard, etc.)
│           │   ├── components/         # Reusable components
│           │   └── graphql/            # GraphQL queries
│           ├── Dockerfile
│           ├── package.json
│           └── index.html
├── Standards/                          # Development standards
│   ├── code/                           # Coding standards
│   ├── data/                           # Database standards
│   ├── api/                            # API standards
│   └── documentation/                  # Documentation standards
├── project-architecture/               # System design
├── project-spirit/                     # Vision & decisions
├── docs/                               # Documentation
│   ├── PHASE4_COMPLETE.md              # Phase 4 completion report
│   └── PHASE4_MEMORY_SYSTEM.md         # Phase 4 documentation
├── .git-hooks/                         # Layer 1: Pre-commit validation
│   └── pre-commit                      # Git hooks for validation
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
