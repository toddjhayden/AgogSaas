# AgogSaaS System Startup Guide

## Quick Start

### Starting the System

**Double-click:** `START_AGENTS.bat`

This will:
1. ✅ Start Docker services (NATS, PostgreSQL, Backend, Frontend)
2. ✅ Start Strategic Orchestrator daemon (monitors OWNER_REQUESTS.md)
3. ✅ Open monitoring window for workflow execution

### Stopping the System

**Double-click:** `STOP_AGENTS.bat`

This will:
1. ✅ Stop Strategic Orchestrator daemon
2. ✅ Stop all Docker services

---

## What Happens When You Start

### 1. Docker Services Start
- **NATS Jetstream** (localhost:4223) - Message broker for agent communication
- **PostgreSQL** (localhost:5433) - Database
- **Backend** (localhost:4000) - GraphQL API
- **Frontend** (localhost:3000) - React dashboard

### 2. Strategic Orchestrator Daemon Starts
The daemon runs continuously and:
- **Monitors** `project-spirit/owner_requests/OWNER_REQUESTS.md` every 60 seconds
- **Detects** NEW requests from Marcus/Sarah/Alex
- **Spawns** specialist workflows automatically:
  1. **Cynthia** (Research) - Researches requirements
  2. **Sylvia** (Critique) - Reviews research quality
  3. **Roy** (Backend) - Implements GraphQL API
  4. **Jen** (Frontend) - Implements React UI
  5. **Billy** (QA) - **MANDATORY Playwright MCP testing**
  6. **Priya** (Statistics) - Generates metrics
  7. **Berry** (DevOps) - **MANDATORY Git commit + Push to GitHub**

### 3. Quality Gates Enforced
- ✅ Billy MUST test with Playwright MCP before COMPLETE
- ✅ Berry MUST commit and push to GitHub before COMPLETE
- ✅ Chuck (Senior Review) checks code quality
- ✅ Workflows CANNOT skip stages
- ✅ No "fake complete" - actual testing and deployment required
- ✅ All work MUST appear on GitHub (no local-only commits)

---

## Monitoring the System

### NATS Monitoring UI
**URL:** http://localhost:8223

View:
- Stream status (deliverables, orchestration events)
- Message counts
- Consumer activity

### GraphQL Playground
**URL:** http://localhost:4000/graphql

Query:
- System health
- Active workflows
- Agent activity

### Frontend Dashboard
**URL:** http://localhost:3000/monitoring

View:
- System health metrics
- Error tracking
- Agent activity logs

### Workflow Deliverables
**Location:** `Implementation/print-industry-erp/backend/agent-output/deliverables/`

Files:
- `cynthia-research-REQ-XXX-YYY.md`
- `sylvia-critique-REQ-XXX-YYY.md`
- `roy-backend-REQ-XXX-YYY.md`
- `jen-frontend-REQ-XXX-YYY.md`
- `billy-qa-REQ-XXX-YYY.md`
- `priya-statistics-REQ-XXX-YYY.md`
- `berry-devops-REQ-XXX-YYY.md`

---

## How to Submit Requests

### Product Owners: Marcus, Sarah, Alex

1. **Open** `project-spirit/owner_requests/OWNER_REQUESTS.md`

2. **Add your request:**
   ```markdown
   ### REQ-DOMAIN-NNN: Feature Title
   **Status**: NEW
   **Owner**: marcus|sarah|alex
   **Priority**: P0|P1|P2|P3
   **Business Value**: Brief description

   **Requirements**:
   - Requirement 1
   - Requirement 2
   ```

3. **Save the file**

4. **Within 60 seconds**, the Strategic Orchestrator will:
   - Detect your NEW request
   - Update status to IN_PROGRESS
   - Spawn Cynthia to start research
   - Execute full 7-stage workflow (ending with Berry pushing to GitHub)

5. **Check progress:**
   - Watch `agent-output/deliverables/` for reports
   - Check OWNER_REQUESTS.md for status updates
   - View NATS monitoring UI for real-time activity

---

## Troubleshooting

### Daemon Not Starting
**Symptom:** Strategic Orchestrator window closes immediately

**Solutions:**
1. Check NATS is running: `docker ps | grep nats`
2. Verify `.env` has `NATS_URL=nats://localhost:4223` (no credentials)
3. Check `project-spirit/owner_requests/OWNER_REQUESTS.md` exists

### Workflows Not Running
**Symptom:** NEW requests stay NEW, never change to IN_PROGRESS

**Solutions:**
1. Check Strategic Orchestrator window for errors
2. Verify daemon is actually running (window should stay open)
3. Check NATS streams: http://localhost:8223

### Billy Not Testing
**Symptom:** REQ marked COMPLETE but no Playwright tests run

**Solutions:**
1. Check `agent-output/deliverables/billy-qa-REQ-XXX-YYY.md` exists
2. Verify workflow reached stage 5 (Billy)
3. Check orchestrator logs for stage progression

### Docker Services Not Starting
**Symptom:** `docker-compose up -d` fails

**Solutions:**
1. Ensure Docker Desktop is running
2. Check port conflicts (4223, 5433, 4000, 3000)
3. Run `docker-compose logs` for error details

---

## System Architecture

```
OWNER_REQUESTS.md (NEW request added)
         ↓
Strategic Orchestrator (detects every 60s)
         ↓
Specialist Orchestrator (spawns workflow)
         ↓
Stage 1: Cynthia (Research)
         ↓ publishes to NATS
Stage 2: Sylvia (Critique)
         ↓ publishes to NATS
Stage 3: Roy (Backend)
         ↓ publishes to NATS
Stage 4: Jen (Frontend)
         ↓ publishes to NATS
Stage 5: Billy (QA - MANDATORY PLAYWRIGHT TESTING)
         ↓ publishes to NATS
Stage 6: Priya (Statistics)
         ↓ publishes to NATS
Stage 7: Berry (DevOps - MANDATORY GIT PUSH)
         ↓ commits + pushes to GitHub
Workflow COMPLETE → Memory Storage → Code on GitHub
```

---

## Environment Configuration

### Backend .env
```bash
NATS_URL=nats://localhost:4223
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/agogsaas
GRAPHQL_PORT=4000
```

### Docker Compose Ports
- NATS: 4223 (client), 8223 (monitoring)
- PostgreSQL: 5433
- Backend: 4000
- Frontend: 3000

---

## Daily Operations

### Morning Startup
1. Double-click `START_AGENTS.bat`
2. Wait for "AgogSaaS System Started Successfully!"
3. Verify services at http://localhost:8223
4. Check for any overnight escalations

### Adding Requests
1. Marcus/Sarah/Alex edit OWNER_REQUESTS.md
2. Set Status: NEW
3. Save file
4. Orchestrator picks up within 60 seconds

### End of Day
1. Let workflows complete (don't interrupt mid-stage)
2. Double-click `STOP_AGENTS.bat`
3. Review completed deliverables

---

## Support

**Location:** D:\GitHub\agogsaas\.claude\

**Files:**
- `START_AGENTS.bat` - Start agent system
- `STOP_AGENTS.bat` - Stop agent system
- `README_STARTUP.md` - This file

**Logs:**
- Strategic Orchestrator: Window output
- Docker services: `docker-compose logs -f`
- Agent outputs: `backend/agent-output/`

---

**Last Updated:** 2026-01-11
**Version:** 1.1
