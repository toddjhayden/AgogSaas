# AgogSaaS Implementation

**Packaging Industry ERP with 4-Layer AI Automation**

---

## Quick Start

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env: Set DB_PASSWORD and OPENAI_API_KEY

# 2. Start all services (PostgreSQL, NATS, backend, frontend)
docker-compose up -d

# 3. Setup NATS Jetstream streams
docker-compose exec backend node scripts/setup-nats-streams.js

# 4. Access the system
# - Frontend: http://localhost:3000
# - Monitoring Dashboard: http://localhost:3000/monitoring
# - GraphQL API: http://localhost:4000/graphql
# - NATS Monitoring: http://localhost:8222
```

---

## 4-Layer AI Automation System

AgogSaaS features a unique 4-layer AI system that automates feature development, monitoring, and continuous improvement.

### Layer 1: Validation (Pre-Commit Hooks)

**Purpose:** Prevent bad code from entering the repository

**Location:** `.git-hooks/pre-commit`

**Checks:**
1. Security scanning (no secrets committed)
2. Code linting (ESLint/Prettier)
3. TypeScript type checking
4. Unit tests

**Setup:**
```bash
# Link git hooks (one-time setup)
git config core.hooksPath .git-hooks
```

### Layer 2: Monitoring (Real-Time Dashboard)

**Purpose:** Visibility into system health, errors, and agent activity

**Location:** `http://localhost:3000/monitoring`

**Features:**
- System health status (Database, NATS, Backend, Frontend)
- Error tracking and resolution workflow
- Agent activity monitoring
- Active fixes in progress

**Components:**
- `backend/src/modules/monitoring/` - Health checks, error tracking, agent activity services
- `frontend/src/pages/MonitoringDashboard.tsx` - Real-time dashboard UI
- `backend/migrations/V1.0.0__create_monitoring_tables.sql` - Database tables

### Layer 3: Orchestration (Automated Agent Workflows)

**Purpose:** Multi-agent feature development automation

**How It Works:**

```
Feature Request
    ↓
[Orchestrator spawns agents in sequence]
    ↓
Cynthia (Research) → Analyzes requirements, searches codebase
    ↓
Sylvia (Critique) → Reviews design, gates implementation
    ↓ (if APPROVED)
Roy (Backend) + Jen (Frontend) → Implement in parallel
    ↓
Billy (QA) → Tests multi-tenant security, accessibility
    ↓
Priya (Statistics) → Gathers metrics, updates dashboards
    ↓
COMPLETE ✅
```

**Key Innovation: Deliverable Pattern**

**Problem:** Passing full context between agents consumes massive tokens

**Solution:** Agents publish full reports to NATS, return tiny completion notices

**Example Flow:**

1. **Orchestrator spawns Cynthia**:
```typescript
const result = await orchestrator.spawnAgent({
  agentId: 'cynthia',
  task: 'customer-search',
  context: { requirements: '...' }
});

// result = { status: "complete", nats_channel: "agog.deliverables.cynthia.research.customer-search" }
// Only ~200 tokens returned!
```

2. **Cynthia publishes full report**:
```typescript
// Cynthia writes 10,000 token research report
await nats.publish(
  'agog.deliverables.cynthia.research.customer-search',
  fullResearchReport  // 10,000+ tokens
);

// Returns tiny completion notice to orchestrator
return {
  status: "complete",
  nats_channel: "agog.deliverables.cynthia.research.customer-search",
  summary: "Found 5 similar features, 8 files to modify. Complexity: Medium."
};
```

3. **Orchestrator spawns Sylvia**:
```typescript
// Orchestrator only keeps ~200 token completion notice in context
// Sylvia reads full report from NATS
const cynthiaReport = await nats.getMessage('agog.deliverables.cynthia.research.customer-search');
```

**Token Savings:** 95%+ reduction in context size

**Components:**
- `backend/src/orchestration/orchestrator.service.ts` - Workflow engine
- `backend/src/orchestration/agent-spawner.service.ts` - Agent process spawner
- `.claude/agents/` - 35+ agent definitions
- `scripts/setup-nats-streams.js` - NATS Jetstream setup

### Layer 4: Memory (Semantic Search & Learning)

**Purpose:** Agents learn from past work, improve over time

**How It Works:**

```typescript
// Before starting work: Query memories
const memories = await mcpClient.searchMemories({
  query: "customer management multi-tenant RLS patterns",
  agent_id: "cynthia",
  min_relevance: 0.7,
  limit: 5
});

// After completing work: Store learnings
await mcpClient.storeMemory({
  agent_id: "cynthia",
  memory_type: "research_pattern",
  content: "For customer features: Always check data-models/schemas/core-entities.yaml first. Use uuid_generate_v7() for PKs. tenant_id required.",
  metadata: {
    feature_type: "customer_management",
    agog_standards: ["uuid_generate_v7", "tenant_id"]
  }
});
```

**Technology:** pgvector extension for semantic similarity search

**Components:**
- `backend/migrations/V1.0.0__create_monitoring_tables.sql` - memories table with vector column
- `backend/src/mcp/mcp-client.service.ts` - Memory storage & retrieval
- OpenAI Embeddings (text-embedding-3-small) for vector generation

---

## Agent System

### Agent Definitions

**Location:** `.claude/agents/`

**Core Agents:**
- **Cynthia** (Research) - Requirements analysis, codebase research
- **Sylvia** (Critique) - Architecture review, quality gate
- **Roy** (Backend) - GraphQL API, database schemas
- **Jen** (Frontend) - React components, Material-UI
- **Billy** (QA) - Testing, multi-tenant security validation
- **Priya** (Statistics) - Metrics, dashboards

**35+ specialized agents** for specific tasks

### Agent Standards

**ALL agents must read:**
- `.claude/agents/AGOG_AGENT_ONBOARDING.md` - Critical AGOG standards

**Key Requirements:**
```sql
-- ✅ ALWAYS use uuid_generate_v7() for primary keys
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,  -- ALWAYS include
    ...
);

-- ❌ NEVER use gen_random_uuid()
CREATE TABLE bad (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid()  -- VIOLATION!
);
```

### Agent Workflow

1. **Agent receives task** via spawn
2. **Reads AGOG standards** (AGOG_AGENT_ONBOARDING.md, CONSTRAINTS.md)
3. **Queries past memories** (Layer 4) for similar work
4. **Does work** following AGOG patterns
5. **Publishes full report** to NATS (10,000+ tokens)
6. **Returns tiny completion notice** (~200 tokens)
7. **Stores new learnings** in memory

### NATS Channels

**Format:** `agog.deliverables.[agent].[task-type].[feature-name]`

**Examples:**
- `agog.deliverables.cynthia.research.customer-search`
- `agog.deliverables.roy.backend.customer-search`
- `agog.deliverables.jen.frontend.customer-search`
- `agog.deliverables.billy.qa.customer-search`

---

## Development Workflow

### 1. Schema-Driven Development

**YAML First, Then Code**

```
1. Design YAML schema (data-models/schemas/)
2. Validate against AGOG standards
3. Generate TypeScript interfaces
4. Generate SQL migrations
5. Generate GraphQL types
6. Implement business logic only
```

**Example:**
```yaml
# data-models/schemas/customer.yaml
Customer:
  properties:
    id: uuid  # Will generate uuid_generate_v7()
    tenantId: uuid  # Multi-tenant required
    customerNumber: string
    name: string
  indexes:
    - fields: [tenantId, customerNumber]
      unique: true
```

**See:** `Standards/code/schema-driven-development.md`

### 2. Multi-Tenant Patterns

**Every table:**
```sql
tenant_id UUID NOT NULL REFERENCES tenants(id)
```

**Every query:**
```sql
WHERE tenant_id = $1  -- SECURITY CRITICAL
```

**See:** `CONSTRAINTS.md`, `.claude/agents/AGOG_AGENT_ONBOARDING.md`

### 3. Git Workflow

**Commit Format:**
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Examples:**
```
feat(api): Add customer search with filters
fix(auth): Resolve JWT token expiration
docs(agents): Add AGOG agent onboarding guide
```

**See:** `Standards/code/git-standards.md`

---

## Testing

### Multi-Tenant Security (CRITICAL)

```typescript
// Test tenant isolation
test('should not return data from other tenants', async () => {
  const tenantA = 'uuid-a';
  const tenantB = 'uuid-b';

  const resultA = await query(GET_CUSTOMERS, { tenant_id: tenantA });
  const resultB = await query(GET_CUSTOMERS, { tenant_id: tenantB });

  // Verify no overlap
  expect(resultA.every(c => c.tenant_id === tenantA)).toBe(true);
  expect(resultB.every(c => c.tenant_id === tenantB)).toBe(true);
});
```

### Running Tests

```bash
# Backend unit tests
cd Implementation/print-industry-erp/backend
npm test

# Frontend component tests
cd Implementation/print-industry-erp/frontend
npm test

# E2E tests
cd Implementation/print-industry-erp/frontend
npm run test:e2e
```

---

## Docker Services

### PostgreSQL (pgvector)

**Image:** `pgvector/pgvector:pg16`
**Port:** 5432
**Features:**
- pgvector extension for Layer 4 semantic search
- uuid_generate_v7() function for time-ordered UUIDs
- Row-level security (RLS) for multi-tenant isolation

### NATS Jetstream

**Image:** `nats:latest`
**Ports:**
- 4222 (client connections)
- 8222 (monitoring dashboard)

**Features:**
- Durable message streams
- Agent deliverable storage
- 30-day retention

### Backend

**Build:** `Implementation/print-industry-erp/backend`
**Port:** 4000
**Features:**
- GraphQL API (Apollo Server)
- Layer 2 monitoring services
- Layer 3 orchestration
- Layer 4 memory integration

### Frontend

**Build:** `Implementation/print-industry-erp/frontend`
**Port:** 3000
**Features:**
- React + Vite + Material-UI
- Monitoring Dashboard
- Apollo Client (GraphQL)

---

## Troubleshooting

### NATS Streams Not Created

```bash
# Run setup script
docker-compose exec backend node scripts/setup-nats-streams.js

# Verify streams
curl http://localhost:8222/streaming/channelsz
```

### Database Migration Issues

```bash
# Run migrations manually
docker-compose exec postgres psql -U agogsaas_user -d agogsaas -f /docker-entrypoint-initdb.d/V1.0.0__create_monitoring_tables.sql
```

### Agent Spawn Failures

Check agent file exists:
```bash
ls .claude/agents/[agent-name].md
```

Check AGOG_AGENT_ONBOARDING.md is present:
```bash
ls .claude/agents/AGOG_AGENT_ONBOARDING.md
```

---

## Documentation

- **AGOG Standards:** `CONSTRAINTS.md`
- **Agent Onboarding:** `.claude/agents/AGOG_AGENT_ONBOARDING.md`
- **Standards:** `Standards/`
- **Architecture:** `project-architecture/`
- **Business Value:** `project-spirit/BUSINESS_VALUE.md`

---

## Support

For issues or questions:
1. Check `CONSTRAINTS.md` for hard rules
2. Check `.claude/agents/AGOG_AGENT_ONBOARDING.md` for agent standards
3. Check `Standards/` for development patterns
4. Review monitoring dashboard for system health

---

**AgogSaaS - AI-Powered Packaging Industry ERP**
