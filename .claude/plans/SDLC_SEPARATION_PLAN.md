# SDLC Separation Plan

**Created:** 2026-01-11
**Status:** IN PROGRESS
**Branch:** `feature/sdlc-separation` (CREATED 2026-01-12)
**Decision:** Option A - Same container renamed (sdlc-postgres), separate tables for indexes
**Goal:** Separate SDLC (the product) from AGOG (the print ERP application)

---

## Context

SDLC will become a standalone product that customers install to manage their own codebases. Currently, SDLC components are mixed with AGOG application code in the same repository.

**SDLC = The Platform**
- Agent orchestration
- Codebase indexing & search
- Workflow management
- Infrastructure (NATS, Ollama, pgvector)

**AGOG = An Application Managed by SDLC**
- Print industry ERP
- Backend (NestJS/GraphQL)
- Frontend (React)
- Business logic

---

## Current Structure

```
agogsaas/
├── .claude/
│   ├── agents/              # SDLC component
│   ├── plans/               # SDLC component
│   ├── registry/            # SDLC component
│   └── WORKFLOW_RULES.md    # SDLC component
│
├── Implementation/
│   └── print-industry-erp/
│       ├── agent-backend/   # SDLC component (misplaced)
│       ├── backend/         # AGOG application
│       └── frontend/        # AGOG application
│
├── docker-compose.yml       # Mixed SDLC + AGOG
└── docker-compose.agents.yml # SDLC component
```

**Problem:** SDLC components are scattered and intertwined with AGOG.

---

## Target Structure (Phase 1: Soft Separation)

```
agogsaas/
├── sdlc/                           # SDLC PRODUCT
│   ├── core/
│   │   ├── orchestration/          # Strategic orchestrator
│   │   ├── indexer/                # Codebase indexer (NEW)
│   │   ├── search/                 # Codebase search service (NEW)
│   │   ├── api/                    # SDLC REST API
│   │   └── monitoring/             # Health checks, validators
│   │
│   ├── agents/
│   │   ├── personas/               # Agent .md files (generic)
│   │   ├── onboarding/             # AGOG_AGENT_ONBOARDING.md → SDLC_AGENT_ONBOARDING.md
│   │   └── host-listener/          # Host-side agent spawner
│   │
│   ├── proactive/
│   │   ├── senior-auditor.daemon/  # Sam
│   │   ├── recommendation.daemon/  # Strategic recommendations
│   │   └── ui-testing.daemon/      # UI test generator
│   │
│   ├── infrastructure/
│   │   ├── nats/                   # NATS config
│   │   ├── ollama/                 # Ollama config + models
│   │   └── postgres/               # pgvector setup
│   │
│   ├── migrations/                 # SDLC database migrations
│   ├── scripts/                    # SDLC scripts
│   ├── docker-compose.yml          # SDLC-only stack
│   ├── package.json                # SDLC dependencies
│   └── sdlc.config.schema.json     # Config schema for managed projects
│
├── projects/                       # MANAGED PROJECTS
│   └── print-industry-erp/         # AGOG (one of potentially many)
│       ├── backend/
│       ├── frontend/
│       ├── docker-compose.yml      # AGOG-only stack
│       └── sdlc.config.json        # Points SDLC at this project
│
├── .claude/                        # Symlink to sdlc/agents/ OR remove
├── docker-compose.yml              # Orchestrates SDLC + projects
└── README.md
```

---

## Target Structure (Phase 2: Repo Split)

**Repo 1: `sdlc`** (the product)
```
sdlc/
├── core/
├── agents/
├── proactive/
├── infrastructure/
├── migrations/
├── docker-compose.yml
└── package.json
```

**Repo 2: `agogsaas`** (the print ERP)
```
agogsaas/
├── backend/
├── frontend/
├── docker-compose.yml
├── sdlc.config.json      # Config for SDLC to manage this project
└── package.json
```

SDLC installed separately, AGOG references it.

---

## Migration Plan

### Pre-requisites
- [ ] Fix current issues (Ollama 500s, agent crashes)
- [ ] Clean up tmpclaude files
- [ ] Ensure all tests pass

### Phase 1: Soft Separation (same repo)

**Step 1.1: Create branch**
```bash
git checkout -b feature/sdlc-separation
```

**Step 1.2: Create SDLC directory structure**
```bash
mkdir -p sdlc/{core,agents,proactive,infrastructure,migrations,scripts}
mkdir -p sdlc/core/{orchestration,indexer,search,api,monitoring}
mkdir -p sdlc/agents/{personas,onboarding,host-listener}
mkdir -p sdlc/proactive/{senior-auditor.daemon,recommendation.daemon,ui-testing.daemon}
mkdir -p sdlc/infrastructure/{nats,ollama,postgres}
```

**Step 1.3: Move agent-backend → sdlc/core**
| From | To |
|------|-----|
| `agent-backend/src/orchestration/` | `sdlc/core/orchestration/` |
| `agent-backend/src/api/` | `sdlc/core/api/` |
| `agent-backend/src/monitoring/` | `sdlc/core/monitoring/` |
| `agent-backend/src/proactive/` | `sdlc/proactive/` |
| `agent-backend/scripts/host-agent-listener.ts` | `sdlc/agents/host-listener/` |

**Step 1.4: Move .claude/agents → sdlc/agents/personas**
| From | To |
|------|-----|
| `.claude/agents/*.md` | `sdlc/agents/personas/` |
| `.claude/agents/AGOG_AGENT_ONBOARDING.md` | `sdlc/agents/onboarding/SDLC_AGENT_ONBOARDING.md` |

**Step 1.5: Move infrastructure configs**
| From | To |
|------|-----|
| `docker-compose.agents.yml` | `sdlc/docker-compose.yml` |
| NATS configs | `sdlc/infrastructure/nats/` |
| Ollama configs | `sdlc/infrastructure/ollama/` |

**Step 1.6: Rename print-industry-erp**
```bash
mv Implementation/print-industry-erp projects/print-industry-erp
```

**Step 1.7: Create sdlc.config.json for AGOG**
```json
{
  "$schema": "../sdlc/sdlc.config.schema.json",
  "project": {
    "name": "print-industry-erp",
    "displayName": "AGOG Print Industry ERP",
    "type": "fullstack"
  },
  "codebase": {
    "rootPath": ".",
    "includePaths": ["backend/src", "frontend/src"],
    "excludePaths": ["node_modules", "dist", "coverage"],
    "includeExtensions": [".ts", ".tsx", ".graphql", ".sql"]
  },
  "agents": {
    "backend": "roy",
    "frontend": "jen",
    "qa": "billy",
    "research": "cynthia"
  }
}
```

**Step 1.8: Update imports and paths**
- All relative paths need updating
- Docker volume mounts need updating
- Agent file references need updating

**Step 1.9: Create compatibility symlinks (temporary)**
```bash
# So existing scripts still work during transition
ln -s sdlc/agents/personas .claude/agents
ln -s projects/print-industry-erp Implementation/print-industry-erp
```

**Step 1.10: Verify everything works**
- [ ] Host listener starts
- [ ] Orchestrator starts
- [ ] Agents spawn correctly
- [ ] NATS messaging works
- [ ] API endpoints work

### Phase 2: Repo Split (future)

Only after Phase 1 is stable:
1. Create new `sdlc` repo
2. Use `git filter-branch` to extract sdlc/ history
3. Update AGOG to reference SDLC as external dependency
4. Publish SDLC as installable package/docker images

---

## Files to Update

### Path Updates Required
| File | Changes Needed |
|------|----------------|
| `host-agent-listener.ts` | Agent file paths, project root |
| `strategic-orchestrator.service.ts` | Database paths |
| `docker-compose*.yml` | Volume mounts, service names |
| All agent `.md` files | Path references |
| `package.json` | Scripts, paths |
| `tsconfig.json` | Paths, includes |

### New Files to Create
| File | Purpose |
|------|---------|
| `sdlc/package.json` | SDLC dependencies |
| `sdlc/tsconfig.json` | SDLC TypeScript config |
| `sdlc/docker-compose.yml` | SDLC stack |
| `sdlc/sdlc.config.schema.json` | Schema for project configs |
| `projects/print-industry-erp/sdlc.config.json` | AGOG project config |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking existing workflows | Create compatibility symlinks |
| Path confusion during transition | Document all path changes |
| Docker volume mount issues | Test each service individually |
| Agent spawn failures | Keep old paths working via symlinks until verified |
| Lost git history | Use `git mv` not `mv` |

---

## Success Criteria

1. **SDLC standalone** - Can run SDLC without AGOG code
2. **AGOG managed** - SDLC correctly indexes and manages AGOG via sdlc.config.json
3. **No regressions** - All current functionality works
4. **Clean separation** - No AGOG-specific code in SDLC
5. **Customer-ready structure** - Another project could be added to `projects/`

---

## Dependencies

- **CODEBASE_EMBEDDING_SEARCH_PLAN.md** - Build indexer after separation
- Fix Ollama 500 errors first
- Clean up tmpclaude files first

---

## Timeline Estimate

| Phase | Work |
|-------|------|
| Pre-requisites | Fix current issues |
| Step 1.1-1.2 | Create structure (1 hour) |
| Step 1.3-1.5 | Move files (2-3 hours) |
| Step 1.6-1.7 | Project config (1 hour) |
| Step 1.8 | Update paths (4-6 hours) |
| Step 1.9-1.10 | Verify & fix (2-4 hours) |
| **Total Phase 1** | **~1-2 days** |
| Phase 2 (repo split) | Future, after Phase 1 stable |
