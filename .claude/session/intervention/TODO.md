# Intervention TODO List

*Last Updated: 2026-01-10 23:30 UTC*

---

## IMMEDIATE - Apply Changes

### 1. Restart Docker Containers
```cmd
docker restart agogsaas-agents-backend
```
This applies:
- Orchestrator concurrency: 5 → **10**

### 2. Restart Host-Agent-Listener
In the listener window:
```cmd
cd D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend
start-listener.bat
```
This applies:
- Agent concurrency: 4 → **6**
- Publish timeout: 5s → **30s** (with 60s retry)
- Log sanitization
- Health heartbeat publishing (every 60s)
- NATS control channel (`agog.control.host_listener`)

---

## COMPLETED ✅

| Fix | Details |
|-----|---------|
| REC conversion loop | REC-1767116143665 marked as done |
| Stuck workflows | 7 workflows reset to pending |
| P0 REQs stalled | 5 P0 REQs reset to backlog |
| Orchestrator concurrency | 5 → 10 |
| Listener concurrency | 4 → 6 |
| Publish timeout | 5s → 30s + 60s retry |
| Hardcoded password | Changed to env var with fallback |
| Log sanitization | 10+ patterns for secrets/PII |
| Health heartbeat | Publishes to SDLC every 60s |
| NATS control channel | restart/status/get_logs commands |

---

## COMPLETED - SDLC Integration ✅

### 1. Control API Endpoint (VPS) ✅
**File:** `sdlc-api.server.ts`
- `POST /infrastructure/control` - Queue command
- `GET /infrastructure/control/pending` - Orchestrator polls
- `POST /infrastructure/control/:id/claim` - Mark executing
- `POST /infrastructure/control/:id/complete` - Report result
- `GET /infrastructure/control/:id` - Get status
- `GET /infrastructure/control/history/:component` - History

### 2. Infrastructure Health Page (GUI) ✅
**File:** `sdlc-gui/src/pages/InfrastructureHealthPage.tsx`
- Component status cards with health indicators
- Expandable details with recent logs
- Action buttons: Status, View Logs, Tail Log, Restart
- Command result display with polling
- Route added: `/infrastructure`

### 3. Database Migration ✅
**File:** `V0.0.33__create_infrastructure_control.sql`
- `infrastructure_control_commands` table
- `claim_control_command()` and `complete_control_command()` functions
- Auto-cleanup of old commands

---

## PENDING - Docker Control Capability

### Docker Control
Mount Docker socket in orchestrator container:
```yaml
# docker-compose.agents.yml
agogsaas-agents-backend:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

Add endpoint to restart containers from GUI.

---

## Files Modified Today

| File | Changes |
|------|---------|
| `strategic-orchestrator.service.ts` | MAX_CONCURRENT_WORKFLOWS: 5 → 10 |
| `host-agent-listener.ts` | maxConcurrent: 4 → 6 |
| `host-agent-listener.ts` | publishDeliverable timeout: 30s + retry |
| `host-agent-listener.ts` | publishFailure timeout: 30s |
| `host-agent-listener.ts` | Log sanitization patterns |
| `host-agent-listener.ts` | startHealthHeartbeat() |
| `host-agent-listener.ts` | subscribeToControlCommands() |
| `host-agent-listener.ts` | getRecentLogs() module function |
| `host-agent-listener.js` | maxConcurrent: 4 → 6 (compiled) |

---

## Quick Verification Commands

```bash
# Check if heartbeats are being received
curl -s "https://api.agog.fyi/api/agent/infrastructure/health" | jq '.'

# Check workflow directive status
curl -s "https://api.agog.fyi/api/agent/workflow/status" | jq '.data.progress'

# Check orchestrator logs
docker logs agogsaas-agents-backend --tail 50

# Check listener connection to NATS
curl -s "http://localhost:8223/connz" | jq '.connections[] | select(.name | contains("listener"))'
```

---

## Summary

**What's Working:**
- Workflow directive active for blocker chain
- TypeScript builds pass
- Docker containers running
- Workflow system ready
- SDLC API control endpoints implemented ✅
- Infrastructure Health GUI page created ✅
- Control command database schema ready ✅

**What Needs Human Action:**
1. Restart orchestrator container
2. Restart host-agent-listener
3. Run V0.0.33 migration on VPS
4. Build and deploy sdlc-gui

**What Needs Development:**
1. ~~SDLC API control endpoint~~ ✅
2. ~~Infrastructure Health GUI page~~ ✅
3. Docker socket mount for container control (future enhancement)
4. Orchestrator polling for control commands (needs implementation)
