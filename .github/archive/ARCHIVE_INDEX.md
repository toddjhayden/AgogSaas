# AgogSaaS Archive Index

This directory contains historical files that are no longer actively used but preserved for reference.

## Archived Files (2025-12-21)

### Session Summaries (`session-summaries-2025-12/`)
Session completion reports and progress summaries from December 2025 development work:
- ARCHITECTURE_IMPLEMENTATION_SUMMARY.md
- CI_CD_SETUP_COMPLETE.md
- DEPLOYMENT_COMPLETE.md
- MIGRATION_V1.0.11_SUMMARY.md
- NATS_IMPLEMENTATION_COMPLETE.md
- NATS_SETUP_SUMMARY.md
- ORCHESTRATOR_TOKEN_BURN_FIXES.md
- PHASE4_COMPLETE.md (from docs/)
- REFACTORING_COMPLETE.md
- SESSION_COMPLETE_2025-12-16.md
- SESSION_SUMMARY_2025-12-10_AGOG_INTEGRATION.md (from docs/)
- SESSION_SUMMARY_2025-12-10_MODULE_ARCHITECTURE.md (from docs/)
- SESSION_SUMMARY_2025-12-16_FULL_BUILD.md (from docs/)
- STRATEGIC_AGENT_LAYER_COMPLETE.md

**Superseded By:**
- SEPARATION_COMPLETE.md (current state as of Dec 21)
- ARCHITECTURE_SEPARATION.md (current architecture)

### Old Docker Compose Files (`old-docker-compose/`)
Legacy Docker Compose configurations before architecture separation:
- `docker-compose.yml` - Monolithic all-in-one stack (postgres, nats, ollama, backend, frontend)
- `docker-compose.blue-green.yml` - Blue-green deployment simulation

**Replaced By:**
- `Implementation/print-industry-erp/docker-compose.app.yml` - Application stack (production)
- `Implementation/print-industry-erp/docker-compose.agents.yml` - Agent development system

### Old Scripts (`old-scripts/`)
Legacy startup and test scripts:
- `smoke-test-new.bat` - Old smoke test
- `quick-start.bat.old` - Old quickstart
- `quick-start.sh.old` - Old quickstart
- `smoke-test.bat.old` - Old smoke test
- `smoke-test.sh.old` - Old smoke test

**Replaced By:**
- `.claude/RUN_APPLICATION.bat` - Start application stack
- `.claude/RUN_AGENTS.bat` - Start agent system
- `tests/smoke/smoke-test.bat` - Current smoke tests

## Current Active Files (Not Archived)

**Root Documentation:**
- `README.md` - Main project README
- `SEPARATION_COMPLETE.md` - Current architecture state (Dec 21)
- `ARCHITECTURE_SEPARATION.md` - Current architecture explanation (Dec 21)
- `TEST_INSTRUCTIONS.md` - Current testing guide (Dec 21)
- `TODO.md` - Working task list
- `CONSTRAINTS.md` - Hard rules

**Scripts:**
- `.claude/RUN_APPLICATION.bat` - Start application
- `.claude/RUN_AGENTS.bat` - Start agents
- `start-agent.bat` - Launch individual agent

**Docker Compose:**
- `Implementation/print-industry-erp/docker-compose.app.yml` - Application
- `Implementation/print-industry-erp/docker-compose.agents.yml` - Agents

---

**Archive Date:** 2025-12-21
**Reason:** Architecture separation completed - outdated files preserved for historical reference
