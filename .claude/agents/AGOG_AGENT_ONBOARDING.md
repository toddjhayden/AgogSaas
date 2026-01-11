# AGOG Agent Onboarding - Critical Standards

**READ THIS FIRST before working on ANY task in the AgogSaaS/AGOG project.**

---

## What is AGOG/AgogSaaS?

**AgogSaaS** is a comprehensive **Packaging Industry ERP system** with 4-layer AI automation.

**Industries Served:**
- Corrugated packaging
- Commercial print
- Label printing
- Shrink film
- Folding cartons
- Flexible packaging

**Core Differentiator:** Material lot genealogy + analytics-driven architecture (OLAP → OLTP → API → UX)

---

## ALWAYS Rules (MUST FOLLOW)

### 1. Database Standards
```sql
-- ✅ ALWAYS use uuid_generate_v7() for primary keys
CREATE TABLE example (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),  -- NOT gen_random_uuid()
    tenant_id UUID NOT NULL,                         -- ALWAYS include
    sales_point_id UUID,                             -- For transactional data
    business_number VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (tenant_id, sales_point_id, business_number)  -- Surrogate + business key
);
```

**NEVER use UUIDv4** (gen_random_uuid) - use UUIDv7 (time-ordered)

### 2. Multi-Tenant Isolation
```sql
-- ✅ ALWAYS filter by tenant_id in queries
SELECT * FROM orders
WHERE tenant_id = $1          -- REQUIRED for security
  AND sales_point_id = $2
  AND order_number = $3;
```

**NEVER skip tenant_id filtering** - security/isolation issue

### 3. Documentation Standards
```markdown
**📍 Navigation Path:** [AGOG Home](../../README.md) → [Parent](../README.md) → Current Page

# Document Title

[Content here]

---

[⬆ Back to top](#document-title) | [🏠 AGOG Home](../../README.md) | [📚 Parent](../README.md)
```

**ALWAYS add Navigation Path** to top and bottom of every markdown file

### 4. Git Commit Standards
```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:** feat, fix, docs, style, refactor, perf, test, chore, ci, build, revert

**Examples:**
```
feat(api): Add customer search with filters
fix(auth): Resolve JWT token expiration issue
docs(standards): Update agent onboarding guide
```

### 5. Logging Standards

**All agent scripts, services, and orchestration code MUST implement file-based logging.**

```typescript
// ✅ ALWAYS use structured file-based logging
import * as fs from 'fs';
import * as path from 'path';

// Create logs directory
const logDir = path.resolve(__dirname, '..', 'logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Log file with date-based naming
const logFile = path.join(logDir, `service-name-${new Date().toISOString().split('T')[0]}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Structured log function
function log(level: 'INFO' | 'ERROR' | 'WARN' | 'DEBUG', source: string, message: string) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [${level}] [${source}] ${message}`;
  console.log(logLine);         // Console output
  logStream.write(logLine + '\n');  // File output (REQUIRED)
}

// Convenience functions
function logInfo(source: string, message: string) { log('INFO', source, message); }
function logError(source: string, message: string) { log('ERROR', source, message); }
function logWarn(source: string, message: string) { log('WARN', source, message); }
function logDebug(source: string, message: string) { log('DEBUG', source, message); }
```

**Log Format:**
```
[2025-12-09T10:30:00.000Z] [INFO] [SourceComponent] Message here
[2025-12-09T10:30:01.000Z] [ERROR] [SourceComponent] Error message here
```

**Requirements:**
- **File Location:** `{service}/logs/{service-name}-YYYY-MM-DD.log`
- **Log Levels:** INFO (normal), ERROR (failures), WARN (issues), DEBUG (verbose)
- **Both Outputs:** MUST log to BOTH console AND file
- **Source Identification:** Always include component/function name in source field
- **Error Logging:** Log ALL spawn failures, NATS errors, and process errors

**NEVER use console.log alone** - always write to file as well

### 6. Schema-Driven Development
1. **Design YAML schema first** (structured pseudocode)
2. **Validate schema** against standards
3. **Generate code** (TypeScript interfaces, TypeORM entities, SQL migrations)
4. **Implement business logic** only

**NEVER write database code before YAML schema**

---

## Project Structure

```
agogsaas/
├── Implementation/
│   └── print-industry-erp/
│       ├── backend/                    # GraphQL API + AI layers
│       │   ├── src/                    # Backend implementation
│       │   │   ├── modules/            # Feature modules (monitoring)
│       │   │   ├── orchestration/      # Layer 3: Orchestration
│       │   │   └── mcp/                # Layer 4: Memory system
│       │   ├── database/               # Database schemas
│       │   ├── data-models/            # YAML schema definitions
│       │   ├── migrations/             # SQL migrations
│       │   └── scripts/                # Setup scripts
│       └── frontend/                   # React web application
│           └── src/                    # Frontend implementation
│               ├── pages/              # Pages (MonitoringDashboard)
│               └── components/         # Reusable components
├── .claude/agents/                     # AI agent definitions (YOU ARE HERE)
├── Standards/                          # Development standards (READ THESE)
├── project-architecture/               # System design
├── project-spirit/                     # Vision and business value
├── docs/                               # Documentation
├── .git-hooks/                         # Layer 1: Pre-commit hooks
├── CONSTRAINTS.md                      # Hard rules (MUST FOLLOW)
├── docker-compose.app.yml              # Production application stack
└── docker-compose.agents.yml           # Agent development system
```

---

## 🚨 CRITICAL: Architecture Separation (MUST UNDERSTAND)

**AgogSaaS has TWO separate systems:**

### 1. Application Stack (Production ERP)
**File:** `docker-compose.app.yml`
**Purpose:** Production packaging industry ERP application
**Services:**
- **backend** - GraphQL API server (Node.js + Apollo Server)
- **frontend** - React web application (Vite + Material-UI)
- **postgres** - PostgreSQL database with business data

**Key Points:**
- ✅ Runs independently WITHOUT agent infrastructure
- ✅ NO NATS dependency (agent-only)
- ✅ NO Ollama dependency (agent-only)
- ✅ Backend uses stub services for agent features (returns empty data)
- ✅ Frontend has NO WebSocket/NATS code
- ✅ Deployable to production (edge/cloud/global)

**Start Application:**
```bash
# Windows
RUN_APPLICATION.bat

# Linux/Mac
./run-application.sh
```

### 2. Agent Development System (Dev-Only)
**File:** `docker-compose.agents.yml`
**Purpose:** Agent infrastructure for AI-assisted development
**Services:**
- **agent-backend** - Agent orchestrator + NATS listener
- **agent-postgres** - PostgreSQL with pgvector for agent memory
- **nats** - NATS JetStream for agent communication
- **ollama** - Local LLM for embeddings (FREE, no API costs)

**Key Points:**
- ✅ Used ONLY during development
- ✅ NOT deployed to production
- ✅ Agents read OWNER_REQUESTS.md and spawn workflows
- ✅ NATS stores agent deliverables
- ✅ Ollama generates embeddings for agent memory (nomic-embed-text)

**Start Agents:**
```bash
# Windows
RUN_AGENTS.bat

# Linux/Mac
./run-agents.sh
```

### Why This Separation?

**Problem We Solved:**
- Original design had agents mixed with application code
- NATS/Ollama dependencies leaked into production
- Frontend tried to connect to NATS WebSocket (caused crashes)
- Backend crashed when NATS unavailable

**Solution:**
- **Clean separation** - Application runs WITHOUT agent dependencies
- **Stub services** - Application backend returns empty data for agent features
- **No NATS in frontend** - Removed all WebSocket/NATS code from React app
- **No NATS in backend** - Application backend doesn't import agent services
- **Development-only agents** - NATS/Ollama run separately for development

### What This Means For You

**If you're implementing APPLICATION features (Roy, Jen):**
- ✅ Work in `Implementation/print-industry-erp/backend/` and `frontend/`
- ✅ Use `docker-compose.app.yml` services (backend, frontend, postgres)
- ✅ DO NOT add NATS dependencies to application code
- ✅ DO NOT add Ollama dependencies to application code
- ✅ Frontend should work WITHOUT WebSocket connections
- ✅ Backend should work WITHOUT agent services

**If you're implementing AGENT features (Orchestrator, Strategic Agents):**
- ✅ Work in agent-specific directories
- ✅ Use `docker-compose.agents.yml` services (agent-backend, nats, ollama)
- ✅ NATS is available for agent communication
- ✅ Ollama is available for embeddings
- ✅ Agent code stays separate from application code

**Testing Your Work:**
- **Application features:** Test with `docker-compose.app.yml` running
- **Agent features:** Test with BOTH `docker-compose.app.yml` AND `docker-compose.agents.yml` running
- **Production readiness:** Application should work with ONLY `docker-compose.app.yml`

---

## Critical Files to Read

**Before starting ANY task, read these:**

1. **[CONSTRAINTS.md](../../CONSTRAINTS.md)** - Hard rules that MUST NOT be violated
2. **[Standards/README.md](../../Standards/README.md)** - Development standards overview
3. **[Standards/code/schema-driven-development.md](../../Standards/code/schema-driven-development.md)** - YAML → Code workflow
4. **[Standards/code/git-standards.md](../../Standards/code/git-standards.md)** - Commit format, branch naming
5. **[.github/AI_ONBOARDING.md](../../.github/AI_ONBOARDING.md)** - Complete onboarding guide

**🧪 MANDATORY Testing Documents (ALL AGENTS):**

6. **[TESTING_ADDENDUM.md](./TESTING_ADDENDUM.md)** - Testing requirements for your role
7. **[ORCHESTRATOR_TESTING_ENFORCEMENT.md](./ORCHESTRATOR_TESTING_ENFORCEMENT.md)** - How work is validated

**⚠️ Work submitted without testing evidence WILL BE REJECTED.**

---

## NATS Deliverable Pattern

### How Agent Communication Works

**Problem:** Spawning agents with full context consumes massive tokens
**Solution:** Deliverable pattern - agents publish full reports to NATS, return tiny completion notices

### 🚨 CRITICAL: Deliverables are stored in DATABASE, NOT files

**DO NOT write deliverable `.md` files to disk!**

The HostListener captures your completion JSON and stores everything in the `nats_deliverable_cache` table in the `agent_memory` database (port 5434). This is the **source of truth** for all agent deliverables.

**Why?**
- Files clutter the repository (we had 300+ orphaned deliverable files)
- Database allows querying by REQ number, agent, stage
- Automatic tracking of when deliverables were created
- No need for file cleanup or archival

**What you SHOULD do:**
- Return your completion notice JSON to stdout
- The HostListener automatically stores it in the database
- Berry can query `nats_deliverable_cache` to review all deliverables for a REQ

**What you should NOT do:**
- ❌ Write files to `$AGENT_OUTPUT_DIR/deliverables/`
- ❌ Write files like `AGENT_NAME_DELIVERABLE_REQ-XXX.md`
- ❌ Create deliverable files in `backend/` or `frontend/` directories

### Your Deliverable (TWO outputs)

#### Output 1: Completion Notice (Returned to caller)

**Small JSON (~200 tokens):**

```json
{
  "status": "complete",
  "agent": "[your-agent-name]",
  "task": "[feature-name]",
  "nats_channel": "agog.deliverables.[agent].[task-type].[feature-name]",
  "summary": "Brief 1-sentence summary of what you did",
  "complexity": "Simple|Medium|Complex",
  "blockers": "None or [list blockers]",
  "ready_for_next_stage": true,
  "completion_time": "2025-12-09T14:30:00Z"
}
```

#### Output 2: Full Report (Published to NATS)

**Large markdown document (~5,000-15,000 tokens):**

```markdown
# [Agent Name] Report: [Feature Name]

**Feature:** [Feature Name]
**Agent:** [Your Agent Name]
**Date:** 2025-12-09
**Complexity:** Simple / Medium / Complex
**NATS Channel:** agog.deliverables.[agent].[task-type].[feature-name]

---

## Executive Summary

[2-3 sentence summary]

## [Section 1: Your primary deliverable content]

[Detailed analysis, code, specifications, etc.]

## [Section 2: Supporting information]

## Files Modified

- `path/to/file1.ts` - Added X functionality
- `path/to/file2.sql` - Created migration for Y

## Next Steps

- [ ] Task for next agent
- [ ] Task for next agent

---

**Navigation Path:** [AGOG Home](../../README.md) → [Agent Reports](./reports/) → [Your Report]
```

**Publish to NATS:**
```bash
# Your orchestrator will handle this, but conceptually:
nats pub agog.deliverables.cynthia.research.customer-search "$(cat CYNTHIA_RESEARCH_CUSTOMER_SEARCH.md)"
```

---

## Tech Stack

- **Database:** PostgreSQL 15+ (RLS, JSONB, UUIDv7, logical replication, partitioning)
- **Backend:** Node.js + TypeScript + Apollo Server (GraphQL)
- **Frontend:** React + Vite + Material-UI
- **Data Modeling:** YAML schemas as structured pseudocode
- **Deployment:** Docker Compose (blue-green with database replication)
- **IDs:** UUIDv7 (time-ordered) for ALL primary keys
- **Multi-Tenant:** tenant_id + sales_point_id + business_identifier
- **Messaging:** NATS Jetstream for durable agent deliverables

---

## Specific Standards by Agent Type

### For Backend Developers (Roy, Bob, Heather, Jill, Kyle)

**Read:**
- `Standards/data/database-standards.md` - PostgreSQL patterns
- `Standards/data/modeling-standards.md` - Schema design
- `Standards/api/graphql-standards.md` - API patterns
- `Implementation/print-industry-erp/backend/database/` - Existing schemas
- `Implementation/print-industry-erp/backend/data-models/` - YAML schemas

**Generate:**
1. YAML schema first (`Implementation/print-industry-erp/backend/data-models/`)
2. TypeScript interfaces (`Implementation/print-industry-erp/backend/src/types/`)
3. GraphQL schema (`Implementation/print-industry-erp/backend/src/modules/*/schema/*.graphql`)
4. Resolvers (`Implementation/print-industry-erp/backend/src/modules/*/resolvers/`)
5. Migrations (`Implementation/print-industry-erp/backend/migrations/V*.sql`)

**Always:**
- Use `uuid_generate_v7()` not `gen_random_uuid()`
- Include `tenant_id` on ALL tables
- Add indexes for `tenant_id` and common queries
- Use surrogate UUID + unique constraint on business identifier

### For Frontend Developers (Jen, Gill, Kurt, Lana, Cory)

**Read:**
- `Standards/ui/README.md` - UI/UX standards
- `Implementation/print-industry-erp/frontend/src/` - Existing components

**Generate:**
1. TypeScript types from GraphQL schema (`Implementation/print-industry-erp/frontend/src/types/`)
2. React components (`Implementation/print-industry-erp/frontend/src/components/`)
3. Pages (`Implementation/print-industry-erp/frontend/src/pages/`)
4. GraphQL queries (`Implementation/print-industry-erp/frontend/src/graphql/`)

**Always:**
- TypeScript strict mode
- Material-UI `sx` prop for styling
- Loading/error/empty states for async
- Accessibility (semantic HTML, ARIA, keyboard nav)

### For Documentation Agents

**Read:**
- `Standards/documentation/README.md` - Documentation standards
- `.github/NAVIGATION_PATH_STANDARD.md` - Navigation requirements

**Generate:**
- Markdown with Navigation Path (top and bottom)
- Version control section
- Related documentation links
- Table of contents for long docs

**Always:**
- Add Navigation Path to EVERY markdown file
- Use relative links
- Include version number and last updated date

### For QA Agents (Billy, Liz)

**Read:**
- `Standards/testing/README.md` - Testing standards
- `Standards/data/data-quality-implementation.md` - Data validation

**Test:**
- Multi-tenant isolation (can't access other tenant's data)
- Input validation (SQL injection, XSS)
- Business rule enforcement
- Edge cases and error handling

### For Research Agents (Cynthia)

**Research:**
- Existing patterns in codebase
- Similar implementations
- Schema definitions in `Implementation/print-industry-erp/backend/data-models/`
- API contracts in `Implementation/print-industry-erp/backend/src/modules/*/schema/`

**Document:**
- Requirements analysis
- Codebase context
- Technical constraints
- Edge cases and risks
- Implementation recommendations

---

## Common Gotchas

### ⚠️ PostgreSQL 15+ Specific

We use PostgreSQL 15+ features:
- `uuid_generate_v7()` - Time-ordered UUIDs (better than v4)
- Row-level security (RLS) for multi-tenant isolation
- JSONB for flexible metadata
- Partitioning for high-volume tables

**Don't use generic SQL** - we're PostgreSQL-specific

### ⚠️ Multi-Tenant Everywhere

**Every table** (except system tables like `tenants` itself):
```sql
tenant_id UUID NOT NULL REFERENCES tenants(id)
```

**Every query:**
```sql
WHERE tenant_id = $1  -- ALWAYS
```

**Why:** Security isolation - tenants NEVER see each other's data

### ⚠️ Surrogate Keys + Business Identifiers

**Pattern:**
```sql
id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),        -- Surrogate key
order_number VARCHAR(50) NOT NULL,                     -- Business identifier
UNIQUE (tenant_id, sales_point_id, order_number)       -- Uniqueness constraint
```

**Why:**
- Users see/use business identifiers (order_number)
- System uses UUIDs for relationships
- Tenant isolation enforced at constraint level

---

## Working with Other Agents

### Agent Workflow

```
REQ → Cynthia (Research)
    → Sylvia (Critique/Gate)
    → Roy (Backend)
    → Jen (Frontend)
    → Billy (Backend QA)
    → Liz (Frontend QA)
    → [Todd] (Performance - if needed)
    → [Vic] (Security - if needed)
    → Priya (Statistics)
    → Berry (DevOps - commit/deploy)
    → Tim (Documentation - update docs)
    → DONE
```

**QA Team (4 agents):**
| Agent | Focus | Conditional |
|-------|-------|-------------|
| Billy | Backend QA (API, GraphQL, database, RLS) | Always |
| Liz | Frontend QA (Playwright, UI, accessibility) | Always |
| Todd | Performance (load testing, N+1 queries) | If `needs_todd: true` |
| Vic | Security (penetration, vulnerabilities) | If `needs_vic: true` |

**Tim (Documentation):** After Berry commits, Tim updates:
- CHANGELOG.md (always)
- API.md (if endpoints changed)
- README.md (if setup changed)
- User guides (if UI changed)

### Communication Protocol

1. **Receive task** via spawn with context
2. **Read deliverables** from previous agents via NATS channel
3. **Do your work**
4. **Publish full report** to NATS (`agog.deliverables.[you].[type].[feature]`)
5. **Return completion notice** (tiny JSON)
6. **Next agent** gets spawned with YOUR completion notice + NATS channel

### What You Receive

**From orchestrator:**
```json
{
  "task": "Implement customer search",
  "previous_agent": "cynthia",
  "previous_deliverable_channel": "agog.deliverables.cynthia.research.customer-search",
  "context": {
    "feature": "Customer search with filters",
    "priority": "high"
  }
}
```

### What You Return

**Tiny completion notice:**
```json
{
  "status": "complete",
  "agent": "roy",
  "nats_channel": "agog.deliverables.roy.backend.customer-search",
  "summary": "Implemented GraphQL API with filters for name, email, phone. Added RLS policy.",
  "files_modified": 5,
  "ready_for_frontend": true
}
```

**Full report published to NATS separately (not in return value)**

---

## 6. Code Registry (MANDATORY - HARD BLOCK)

### ALL FILE OPERATIONS REQUIRE REGISTRY APPROVAL

The Code Registry tracks every file in the codebase with full lineage (which REQ created/modified it, which agent, when). This prevents chaos from agents creating duplicate files, orphaned code, or making changes without traceability.

**Registry Location:** `.claude/registry/`
**Helper CLI:** `npx tsx .claude/registry/registry-helper.ts`

### Before Creating ANY File (code, config, docs, scripts - EVERYTHING):

1. **Check for similar files first:**
   ```bash
   cd .claude/registry && npx tsx registry-helper.ts find-similar "your purpose here"
   ```

2. **If similar file exists:** MODIFY that file, DO NOT create new one

3. **If no similar file, register BEFORE creating:**
   ```bash
   cd .claude/registry && npx tsx registry-helper.ts register \
     "path/to/new/file.ts" "service" "Purpose description" "REQ-XXX" "your-agent-name"
   ```

4. **Only AFTER successful registration**, use Write tool to create file

### After ANY File Modification:
```bash
cd .claude/registry && npx tsx registry-helper.ts change \
  "path/to/file.ts" "REQ-XXX" "your-agent-name" "modified" "Brief summary of changes"
```

### Before Deleting ANY File:
```bash
cd .claude/registry && npx tsx registry-helper.ts deactivate \
  "path/to/file.ts" "REQ-XXX" "your-agent-name" "Reason for deletion"
```

### Registry Helper Commands

| Command | Purpose |
|---------|---------|
| `check <path>` | Check if file exists in registry |
| `find-similar <purpose>` | Find files with similar purpose (REQUIRED before new files) |
| `register <path> <type> <purpose> <req> <agent>` | Register new file |
| `change <path> <req> <agent> <type> <summary>` | Log modification |
| `deactivate <path> <req> <agent> <reason>` | Mark file inactive before deletion |
| `list-by-req <req>` | List all files touched by a REQ |
| `list-by-agent <agent>` | List all files touched by an agent |
| `orphans` | List files not in registry |

### File Types for Registration

`service`, `controller`, `resolver`, `component`, `page`, `dto`, `interface`, `module`, `guard`, `middleware`, `config`, `util`, `migration`, `script`, `doc`, `schema`, `test`

### HARD BLOCKED ACTIONS (Sam Audits Will Catch):

- Creating ANY new file without registry pre-registration
- Deleting files without marking inactive in registry
- Moving/renaming files without updating registry
- Modifying files without logging the change

### ENFORCEMENT:

Sam's audit includes inventory verification. Unregistered files = P0 violation requiring immediate fix.

---

## Before You Start ANY Task

### Checklist

- [ ] Read this entire document (you just did!)
- [ ] Read [CONSTRAINTS.md](../../CONSTRAINTS.md)
- [ ] Read relevant Standards/ docs for your role
- [ ] Understand NATS deliverable pattern
- [ ] Know how to add Navigation Path to docs
- [ ] Know git commit format
- [ ] Understand multi-tenant requirements
- [ ] Know uuid_generate_v7() requirement

### If You're Confused

1. Check `CONSTRAINTS.md` - is there a hard rule?
2. Check `Standards/` - is there a standard pattern?
3. Check `.github/AI_ONBOARDING.md` - complete context
4. Ask the orchestrator for clarification

### If You Find an Issue

- **Security issue:** Stop immediately, flag to orchestrator
- **Standards violation:** Stop, flag to orchestrator
- **Documentation gap:** Note it, continue with task
- **Blocker:** Document in your completion notice

---

## Success Metrics

✅ **You're doing great if:**
- Following uuid_generate_v7() for all primary keys
- Including tenant_id filtering in all queries
- Adding Navigation Path to all documentation
- Using git commit format correctly
- Publishing full reports to NATS
- Returning tiny completion notices
- Following schema-driven development

❌ **Warning signs:**
- Using gen_random_uuid() anywhere
- Skipping tenant_id filtering
- Creating docs without Navigation Path
- Making commits without type/scope format
- Returning full reports in spawn response
- Writing database code before YAML schema

---

## Ready to Work?

You're now ready to contribute to AgogSaaS!

**Remember:**
- YAML schemas first, then code
- uuid_generate_v7() for all IDs
- tenant_id everywhere
- Navigation Path on all docs
- Publish to NATS, return tiny notice
- Follow the standards in `Standards/`

**Good luck! 🚀**

---

[⬆ Back to top](#agog-agent-onboarding---critical-standards) | [🏠 AGOG Home](../../README.md) | [👥 Agent Directory](./)
