# AgogSaaS - Packaging Industry ERP with AI Automation

[![CI Status](https://github.com/toddjhayden/AgogSaas/workflows/Continuous%20Integration/badge.svg)](https://github.com/toddjhayden/AgogSaas/actions/workflows/ci.yml)
[![Security Scan](https://github.com/toddjhayden/AgogSaas/workflows/Security%20Scanning/badge.svg)](https://github.com/toddjhayden/AgogSaas/actions/workflows/security-scan.yml)
[![Staging Deployment](https://github.com/toddjhayden/AgogSaas/workflows/Deploy%20to%20Staging/badge.svg)](https://github.com/toddjhayden/AgogSaas/actions/workflows/deploy-staging.yml)

AI-powered Enterprise Resource Planning system for the packaging industry with 4-layer intelligent automation.

## What is AgogSaaS?

**AgogSaaS** combines a comprehensive Packaging Industry ERP (AGOG) with a 4-layer AI development platform that automates feature development, monitoring, and continuous improvement.

**Industries Served:**
- Corrugated packaging
- Commercial print
- Label printing  
- Shrink film
- Folding cartons
- Flexible packaging

## Quick Start

**AgogSaaS has TWO separate systems:**

### 1. Start the Application Stack (Production ERP)

```batch
.claude\RUN_APPLICATION.bat
```

This starts:
- PostgreSQL (business database)
- Backend (GraphQL API)
- Frontend (React UI)

Access:
- **App:** http://localhost:3000
- **Monitoring:** http://localhost:3000/monitoring
- **GraphQL API:** http://localhost:4000/graphql

### 2. Start the Agent Development System (AI-Assisted Development)

```batch
cd Implementation\print-industry-erp\agent-backend
START_SYSTEM.bat
```

This starts:
- PostgreSQL with pgvector (agent memory - port 5434)
- PostgreSQL for SDLC Control (entity graph - port 5435)
- NATS JetStream (agent communication)
- Agent Backend (orchestrator)
- Ollama (local AI embeddings)
- **SDLC Control daemon** (REST API on port 3010)
- **SDLC Control GUI** (http://localhost:3020)
- Host Listener (spawns Claude CLI agents)

Access:
- **SDLC Control GUI:** http://localhost:3020 (Kanban, Requests, Approvals)
- **SDLC REST API:** http://localhost:3010/api/agent/health
- **NATS Monitoring:** http://localhost:8223

### Stop Systems

```batch
# Stop agent system (from .claude folder)
.claude\STOP_AGENTS.bat

# Stop application
.claude\STOP_APPLICATION.bat
```

### First-Time Setup

```batch
# 1. Configure environment
copy .env.example .env
# Edit .env: Add NATS_PASSWORD, DB_PASSWORD

# 2. Fresh database initialization (removes old data)
cd Implementation\print-industry-erp
docker-compose -f docker-compose.agents.yml down -v
START_SYSTEM.bat
```

## Project Structure

```
agogsaas/
├── Implementation/
│   └── print-industry-erp/
│       ├── docker-compose.app.yml      # Application stack (production)
│       ├── docker-compose.agents.yml   # Agent system (dev only)
│       ├── backend/                    # GraphQL API (NestJS)
│       ├── frontend/                   # React web application
│       ├── agent-backend/              # Agent orchestration & SDLC Control
│       │   ├── src/sdlc-control/       # SDLC daemon services
│       │   ├── src/api/                # REST API for agents
│       │   ├── migrations/             # Database migrations
│       │   │   ├── agent-memory/       # Agent workflow tables
│       │   │   └── sdlc-control/       # Entity graph, Kanban, governance
│       │   └── START_SYSTEM.bat        # Master startup script
│       ├── sdlc-gui/                   # SDLC Control GUI (React)
│       └── data-models/                # YAML schema definitions
├── project-architecture/               # System design
├── project-spirit/                     # Vision and business value
├── Standards/                          # Development standards
├── docs/                               # Documentation
├── .claude/
│   ├── agents/                         # AI agent definitions
│   ├── exports/                        # SDLC data synced to Git
│   ├── STOP_AGENTS.bat                 # Stop agent system
│   └── STOP_APPLICATION.bat            # Stop application
└── CONSTRAINTS.md                      # Hard rules (must follow)
```

## 4-Layer AI System

**Layer 1: VALIDATION** - Pre-commit hooks prevent bad code  
**Layer 2: MONITORING** - Real-time dashboard at `/monitoring`  
**Layer 3: ORCHESTRATION** - Automated agent workflows  
**Layer 4: MEMORY** - Agents learn and improve

## Key Constraints

- PostgreSQL 15+ (UUIDv7 required)
- Multi-tenant architecture (tenant_id everywhere)
- Schema-driven development (YAML → code generation)
- End-to-end lot genealogy (material tracking)

See `CONSTRAINTS.md` for complete list.

## Documentation

### Getting Started
- **Quick Start**: See [Quick Start](#quick-start) above
- **Database Guide**: [docs/DATABASE_QUICK_REFERENCE.md](docs/DATABASE_QUICK_REFERENCE.md)
- **Architecture**: `project-architecture/SYSTEM_OVERVIEW.md`
- **Standards**: `Standards/README.md`
- **AI Agents**: `.claude/agents/AGOG_AGENT_ONBOARDING.md`

### SDLC Control System
- **Overview**: [docs/SDLC_CONTROL_SYSTEM.md](docs/SDLC_CONTROL_SYSTEM.md)
- **Entity Dependency Graph**: Topological ordering of database entities
- **Kanban Workflow**: Request lifecycle management
- **Column Semantic Governance**: Prevent column name overloading
- **Impact Analysis**: Cross-BU dependency tracking

### CI/CD Pipeline
- **GitHub Setup**: [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md)
- **Pipeline Architecture**: [docs/CI_CD_PIPELINE.md](docs/CI_CD_PIPELINE.md)
- **Deployment Runbook**: [docs/DEPLOYMENT_RUNBOOK.md](docs/DEPLOYMENT_RUNBOOK.md)
- **Rollback Procedures**: [docs/ROLLBACK_PROCEDURES.md](docs/ROLLBACK_PROCEDURES.md)
- **Troubleshooting**: [docs/GITHUB_ACTIONS_TROUBLESHOOTING.md](docs/GITHUB_ACTIONS_TROUBLESHOOTING.md)

## Deployment Status

| Environment | Status | URL |
|-------------|--------|-----|
| **Production** | ![Production](https://img.shields.io/badge/status-blue--green-success) | https://agogsaas.com |
| **Staging** | ![Staging](https://img.shields.io/badge/auto--deploy-enabled-blue) | https://staging.agogsaas.com |
| **CI/CD** | ![CI](https://img.shields.io/badge/pipeline-automated-brightgreen) | [View Workflows](https://github.com/toddjhayden/AgogSaas/actions) |

## Development Status

🚧 Under Active Development

**Latest Release**: Check [Releases](https://github.com/toddjhayden/AgogSaas/releases) for version history

---

**License**: Proprietary - All rights reserved
