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

```bash
# Windows
RUN_APPLICATION.bat

# Linux/Mac
./run-application.sh
```

This starts:
- PostgreSQL (business database)
- Backend (GraphQL API)
- Frontend (React UI)

Access:
- **App:** http://localhost:3000
- **Monitoring:** http://localhost:3000/monitoring
- **GraphQL API:** http://localhost:4000/graphql

### 2. Start the Agent Development System (Optional - For AI Development)

```bash
# Windows
RUN_AGENTS.bat

# Linux/Mac
./run-agents.sh
```

This starts:
- PostgreSQL with pgvector (agent memory)
- NATS JetStream (agent communication)
- Agent Backend (orchestrator)
- Ollama (local AI embeddings)

**Note:** The application works WITHOUT agents. Only start agents if you're doing AI-assisted development.

### Manual Setup (Advanced):

```bash
# 1. Configure environment
cp .env.example .env
# Edit .env: Add DB_PASSWORD (OPENAI_API_KEY optional)

# 2. Start application stack
cd Implementation/print-industry-erp
docker-compose -f docker-compose.app.yml up -d

# 3. (Optional) Start agent system
docker-compose -f docker-compose.agents.yml up -d

# Access:
# - App: http://localhost:3000
# - Monitoring: http://localhost:3000/monitoring
# - API: http://localhost:4000/graphql
```

## Project Structure

```
agogsaas/
├── Implementation/
│   └── print-industry-erp/
│       ├── docker-compose.app.yml      # Application stack (production)
│       ├── docker-compose.agents.yml   # Agent system (dev only)
│       ├── backend/                    # GraphQL API
│       ├── frontend/                   # React web application
│       ├── database/                   # Database schemas & migrations
│       └── data-models/                # YAML schema definitions
├── project-architecture/               # System design
├── project-spirit/                     # Vision and business value
├── Standards/                          # Development standards
├── docs/                               # Documentation
├── .claude/
│   ├── agents/                         # AI agent definitions
│   ├── RUN_APPLICATION.bat             # Start application stack
│   └── RUN_AGENTS.bat                  # Start agent system
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
- **Quick Start**: `quick-start.sh` / `quick-start.bat`
- **Database Guide**: `docs/DATABASE_QUICK_REFERENCE.md`
- **Architecture**: `project-architecture/SYSTEM_OVERVIEW.md`
- **Standards**: `Standards/README.md`
- **AI Agents**: `.github/AI_ONBOARDING.md`

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
