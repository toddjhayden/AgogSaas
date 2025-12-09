# AgogSaaS - Packaging Industry ERP with AI Automation

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

```bash
# Copy environment file
cp .env.example .env
# Edit .env with your configuration

# Start all services
docker-compose up -d

# Access
# - App: http://localhost:3000
# - Monitoring: http://localhost:3000/monitoring
# - API: http://localhost:4000/graphql
```

## Project Structure

```
agogsaas/
├── Implementation/
│   └── print-industry-erp/
│       ├── backend/          # GraphQL API + AI layers
│       ├── frontend/         # React web application
│       ├── database/         # Database schemas & migrations
│       ├── data-models/      # YAML schema definitions
│       └── src/              # Implementation code
├── project-architecture/     # System design
├── project-spirit/           # Vision and business value
├── Standards/                # Development standards
├── docs/                     # Documentation
├── .claude/agents/           # AI agent definitions
└── CONSTRAINTS.md            # Hard rules (must follow)
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

- **Getting Started**: `docs/DATABASE_QUICK_REFERENCE.md`
- **Architecture**: `project-architecture/SYSTEM_OVERVIEW.md`
- **Standards**: `Standards/README.md`
- **AI Agents**: `.github/AI_ONBOARDING.md`

## Status

🚧 Under Active Development

---

**License**: Proprietary - All rights reserved
