# Host-Side NATS Agent Listener - Quick Start

## Overview

The Host-Side Agent Listener bridges the gap between:
- **Strategic Orchestrator** (running in Docker)
- **Claude CLI agents** (running on your Windows host)

It subscribes to NATS workflow events and spawns Claude agents on your local machine when workflows need specialist work.

## Architecture

```
┌─────────────────────────────────┐
│   Docker Container (Backend)    │
│                                 │
│  Strategic Orchestrator         │
│  ├─ Detects requests            │
│  ├─ Routes to workflows         │
│  └─ Publishes stage events ───┐ │
│                                │ │
└────────────────────────────────┘ │
                                   │
                 NATS (localhost:4223)
                                   │
┌──────────────────────────────────▼─┐
│   Windows Host                     │
│                                    │
│  Host Agent Listener               │
│  ├─ Subscribes to events           │
│  ├─ Spawns claude --agent          │
│  ├─ Captures output                │
│  └─ Publishes results back ────┐   │
│                                 │   │
│  Claude CLI Agents              │   │
│  ├─ Cynthia (Research)         ◄┘   │
│  ├─ Sylvia (Critique)               │
│  ├─ Roy (Backend)                   │
│  ├─ Jen (Frontend)                  │
│  ├─ Billy (QA)                      │
│  ├─ Priya (Statistics)              │
│  └─ Miki (DevOps)                   │
│                                     │
└─────────────────────────────────────┘
```

## Prerequisites

1. **Claude CLI installed** and available in PATH
   ```bash
   claude --version
   ```

2. **NATS running** via Docker Compose
   ```bash
   docker ps | grep nats
   # Should show: agogsaas-nats running on 4223:4222
   ```

3. **Backend service running** with Strategic Orchestrator
   ```bash
   docker ps | grep backend
   # Should show: agogsaas-backend running
   ```

4. **Node.js dependencies installed**
   ```bash
   cd Implementation/print-industry-erp/backend
   npm install
   ```

## Quick Start

### Option 1: Using npm script (Recommended)

```bash
# From the backend directory
cd Implementation/print-industry-erp/backend

# Start the listener
npm run host:listener
```

### Option 2: Direct execution

```bash
# From the backend directory
cd Implementation/print-industry-erp/backend

# Run with ts-node
npx ts-node scripts/host-agent-listener.ts
```

## What You'll See

When the listener starts successfully:

```
[HostListener] Starting host-side NATS agent listener...
[HostListener] Connecting to NATS at localhost:4223
[HostListener] ✅ Connected to NATS
[HostListener] Subscribing to orchestration events...
[HostListener] ✅ Consumer created/verified
[HostListener] 🤖 Listener is running
[HostListener] Waiting for workflow stage events...
[HostListener] Max concurrent agents: 2
```

When a workflow stage event arrives:

```
[HostListener] 📨 Received event: REQ-INFRA-DASHBOARD-001 - Research (cynthia)
[HostListener] 🚀 Spawning cynthia for REQ-INFRA-DASHBOARD-001 (1/2 active)
[HostListener] ✅ cynthia completed for REQ-INFRA-DASHBOARD-001
[HostListener] 📤 Published deliverable to agog.features.research.REQ-INFRA-DASHBOARD-001
```

## How It Works

1. **Listens for stage events** from Strategic Orchestrator
   - Subject: `agog.orchestration.events.stage.started`
   - Contains: reqNumber, stage name, agentId, contextData

2. **Spawns Claude agents** when stage starts
   ```bash
   claude --agent .claude/agents/cynthia-research-new.md --print
   ```

3. **Passes context via stdin** (JSON format)
   ```json
   {
     "reqNumber": "REQ-INFRA-DASHBOARD-001",
     "agentId": "cynthia",
     "featureTitle": "Fix Monitoring Dashboard",
     "assignedTo": "marcus"
   }
   ```

4. **Captures agent output** and parses completion notice
   - Looks for JSON like: `{"agent": "cynthia", "req_number": "...", ...}`

5. **Publishes results** back to NATS
   - Subject: `agog.features.{stream}.{reqNumber}`
   - Example: `agog.features.research.REQ-INFRA-DASHBOARD-001`

6. **Handles errors** gracefully
   - Retries failed agents
   - Publishes failure events to orchestrator
   - Respects concurrent agent limits

## Configuration

Edit `scripts/host-agent-listener.ts` to customize:

- **Max concurrent agents**: Change `maxConcurrent` (default: 2)
- **NATS URL**: Change connection string (default: `nats://localhost:4223`)
- **Agent file paths**: Update `getAgentFilePath()` method

## Troubleshooting

### "Failed to connect to NATS"

**Cause**: NATS not running or not exposed on port 4223

**Fix**:
```bash
# Check NATS is running
docker logs agogsaas-nats

# Restart if needed
docker-compose restart nats
```

### "claude: command not found"

**Cause**: Claude CLI not in PATH

**Fix**:
```bash
# Windows: Add Claude to PATH or use full path
# Edit scripts/host-agent-listener.ts line with spawn()
# Change 'claude' to 'C:\\Users\\YourName\\AppData\\Local\\...\\claude.exe'
```

### "Agent did not return valid completion notice"

**Cause**: Agent output doesn't contain required JSON

**Fix**: Check agent definition includes completion notice format:
```json
{
  "agent": "cynthia",
  "req_number": "REQ-XXX",
  "status": "COMPLETE",
  ...
}
```

### No events received

**Cause**: Strategic Orchestrator not publishing events

**Fix**:
```bash
# Check backend logs
docker logs agogsaas-backend | grep "StrategicOrchestrator"

# Verify OWNER_REQUESTS.md has PENDING requests
cat project-spirit/owner_requests/OWNER_REQUESTS.md
```

## Monitoring

Watch the listener logs in real-time to see:
- Which requests are detected
- Which agents are spawned
- Agent completion status
- NATS publishing activity

## Stopping the Listener

Press `Ctrl+C` to gracefully shutdown:

```
[HostListener] Shutting down gracefully...
[HostListener] Waiting for 1 active agents to finish...
[HostListener] ✅ Shutdown complete
```

The listener will:
1. Stop accepting new events
2. Wait for active agents to finish (30 second timeout)
3. Close NATS connection cleanly
4. Exit

## Next Steps

Once the listener is running:

1. **Monitor logs** to verify agents spawn correctly
2. **Check NATS streams** for deliverables
   ```bash
   docker exec agogsaas-backend nats stream ls
   docker exec agogsaas-backend nats stream view agog_features_research
   ```

3. **View workflow progress** in backend logs
   ```bash
   docker logs -f agogsaas-backend | grep "REQ-INFRA-DASHBOARD-001"
   ```

4. **Test with a new request** - add to OWNER_REQUESTS.md and watch the workflow execute!

## Integration with Autonomous System

The full autonomous loop:

1. **User** adds request to `OWNER_REQUESTS.md`
2. **Strategic Orchestrator** (Docker) detects it within 60 seconds
3. **Routes** to Marcus/Sarah/Alex strategic agent
4. **Starts** specialist workflow (Cynthia → Sylvia → Roy → Jen → Billy → Priya)
5. **Publishes** stage.started events to NATS
6. **Host Listener** (this script) receives events
7. **Spawns** Claude agents on Windows host
8. **Agents** do work, publish results to NATS
9. **Orchestrator** (Docker) receives results, advances workflow
10. **Memory** stores learnings after completion

With this listener running, the system is fully autonomous!

---

**Deliverable by:** Miki (DevOps/Infrastructure Engineer)
**Date:** 2025-12-20
**Status:** COMPLETE
