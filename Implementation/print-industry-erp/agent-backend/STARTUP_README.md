# AGOG Agentic System - Startup Guide

## Architecture Changes (2025-12-28)

**All orchestrator daemons now run in Docker** for better reliability and deployment.

### Components

#### 🐳 Docker (agogsaas-agents-backend)
- Strategic Orchestrator (scans OWNER_REQUESTS.md every 60s)
- Progress Monitor (checks IN_PROGRESS every 30s)
- Heartbeat Monitor (checks workflows every 2 min)
- State Reconciliation (syncs NATS/file every 5 min)
- Agent Error Monitor (handles agent failures)
- Berry Auto-Deploy (auto-deploys on Billy PASS)
- Deployment Executor (runs deployments)
- Health Monitor (system health checks)

#### 💻 Windows Host (host-agent-listener)
- Listens for NATS stage.started events
- Spawns Claude CLI agents (Cynthia, Sylvia, Roy, Jen, Billy, Priya, Berry)
- Publishes agent deliverables back to NATS

**Why separate?** Claude CLI requires Windows host to spawn. Everything else runs in Docker for consistency.

---

## Quick Start

### Option 1: Master Script (Recommended)

```bash
# Start everything
START_SYSTEM.bat

# Stop everything
STOP_SYSTEM.bat
```

### Option 2: Manual Steps

```bash
# 1. Start Docker containers
cd D:\GitHub\agogsaas\Implementation\print-industry-erp
docker-compose -f docker-compose.agents.yml up -d

# 2. Start Windows Host Listener
cd agent-backend
start-listener.bat
```

---

## Windows Task Scheduler Setup

### Task 1: Docker Containers (Startup)

**Name:** AGOG Docker Containers
**Trigger:** At system startup
**Action:** Run `docker-compose.yml up -d`
**Path:** `D:\GitHub\agogsaas\Implementation\print-industry-erp`

```
Program: docker-compose
Arguments: -f docker-compose.agents.yml up -d
Start in: D:\GitHub\agogsaas\Implementation\print-industry-erp
```

### Task 2: Host Listener (After Docker)

**Name:** AGOG Host Listener
**Trigger:** At system startup (delay 30 seconds)
**Action:** Run `start-listener.bat`
**Path:** `D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend`
**Settings:**
- ✅ Restart on failure (3 times, every 1 minute)
- ✅ Run whether user is logged on or not

---

## Monitoring & Logs

### Docker Logs

```bash
# All services
docker logs -f agogsaas-agents-backend

# Just errors
docker logs agogsaas-agents-backend 2>&1 | grep -i error

# Gap fixes verification
docker logs agogsaas-agents-backend 2>&1 | grep -E "Gap Fix|Daemon running"
```

### Host Listener Logs

```
D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\logs\listener.log
```

### Check Running Services

```bash
# Docker status
docker ps

# Should show:
# - agogsaas-agents-backend
# - agogsaas-agents-nats
# - agogsaas-agents-postgres

# Host Listener status
tasklist | findstr node.exe
```

---

## Deprecated Bat Files (DO NOT USE)

These bat files have been updated to inform you they're deprecated:

- ❌ `test-recovery-and-value-chain.bat` → Use Docker instead
- ⚠️ `start-orchestrator.bat` → Just starts Docker (orchestrator is inside)
- ⚠️ `start-daemons.bat` → Just starts Docker (all daemons are inside)

**Only use:**
- ✅ `START_SYSTEM.bat` - Master startup
- ✅ `STOP_SYSTEM.bat` - Master shutdown
- ✅ `start-listener.bat` - Windows host listener (if running manually)

---

## 16 Deployed Gap Fixes (Verified Running)

1. ✅ Timeout reductions (45min-1hr, not 2-4hrs)
2. ✅ IN_PROGRESS recovery on restart
3. ✅ Max workflow duration (8 hours)
4. ✅ Orchestrator startup recovery
5. ✅ Heartbeat monitoring (every 2 min, 30 min timeout)
6. ✅ Escalation mechanism (OWNER_REQUESTS.md, NATS, .claude/escalations/)
7. ✅ Parent resumption error handling
8. ✅ Sub-requirement monitoring recovery
9. ✅ Agent error monitoring (subscribes to agog.errors.agent.>)
10. ✅ Billy retry limit (max 3 failures, then escalate)
11. ✅ Priya bypass (Berry Auto-Deploy handles)
12. ✅ Concurrency limiting (max 5 concurrent workflows)
13. ✅ State reconciliation (NATS = source of truth, every 5 min)
17. ✅ Workflow completion polling
18. ✅ Deliverable validation (schema checking)
21. ✅ Recursion prevention (max depth: 3 levels)

**Result:** Workflows cannot get permanently stuck. All critical gaps are fixed.

---

## Troubleshooting

### Docker won't start

```bash
# Check Docker Desktop is running
docker ps

# Restart Docker Desktop
# Right-click tray icon → Restart
```

### Host Listener won't connect to NATS

```bash
# Check NATS is running
docker ps | findstr nats

# Check NATS logs
docker logs agogsaas-agents-nats

# Verify NATS credentials - must be set as environment variable:
# NATS_USER=agents
# NATS_PASSWORD=<set via environment variable or .env file>
```

### Strategic Orchestrator not scanning OWNER_REQUESTS.md

```bash
# Check orchestrator is running
docker logs agogsaas-agents-backend | grep "Daemon running"

# Check scan cycle
docker logs agogsaas-agents-backend | grep "Total requests found"

# Verify OWNER_REQUESTS_PATH in Docker
# Should be: /app/project-spirit/owner_requests/OWNER_REQUESTS.md
# Volume mounted in docker-compose.agents.yml
```

---

## Files Modified (2025-12-28)

- ✅ `START_SYSTEM.bat` (NEW) - Master startup script
- ✅ `STOP_SYSTEM.bat` (NEW) - Master shutdown script
- ✅ `start-orchestrator.bat` - Updated to start Docker
- ✅ `start-daemons.bat` - Updated to start Docker
- ✅ `start-listener.bat` - Updated with better output
- ✅ `test-recovery-and-value-chain.bat` - Marked deprecated
- ✅ `STARTUP_README.md` (NEW) - This file

---

**Last Updated:** 2025-12-28 17:35
**Status:** All 16 critical gap fixes deployed and running
**Next Steps:** Set up Windows Task Scheduler for automatic startup
