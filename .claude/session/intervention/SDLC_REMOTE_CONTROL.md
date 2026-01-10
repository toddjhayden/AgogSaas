# SDLC Remote Control Architecture

## What Was Added (2026-01-10)

### 1. Log Sanitization
**File:** `host-agent-listener.ts`

Patterns sanitized before logs are sent to SDLC:
- API keys (`sk-xxx`)
- Bearer tokens
- Passwords (any `password=xxx` pattern)
- PostgreSQL connection strings with credentials
- Windows/Linux home paths
- Internal IP addresses (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
- Email addresses

### 2. Heartbeat Publishing
**Frequency:** Every 60 seconds

Data sent to SDLC `agent_infrastructure_health` table:
```json
{
  "component": "host_listener",
  "status": "healthy|degraded",
  "details": {
    "activeAgents": 3,
    "maxConcurrent": 6,
    "natsConnected": true,
    "sdlcConnected": true,
    "ollamaConnected": true,
    "uptime": 3600,
    "pid": 12345,
    "recentLogs": [...last 30 sanitized logs...]
  }
}
```

### 3. NATS Control Channel
**Subject:** `agog.control.host_listener`

Commands available:
| Command | Description | Response |
|---------|-------------|----------|
| `{"action": "status"}` | Get current status | Status + in-memory logs |
| `{"action": "restart"}` | Graceful restart | Exits, bat script restarts |
| `{"action": "get_logs", "count": 50}` | Get recent in-memory logs | Last N sanitized entries |
| `{"action": "get_log_files"}` | List all log files | File names, sizes, dates |
| `{"action": "read_log_file", "filename": "host-listener-2026-01-10.log", "lines": 200}` | Read specific log file | Sanitized content with pagination |
| `{"action": "tail_log_file", "lines": 100}` | Tail current day's log | Last N lines, sanitized |

### 4. Publish Timeout Fix
- Deliverable publish: 30s timeout + 60s retry
- Failure publish: 30s timeout

### 5. Concurrency Increase
- Orchestrator: 5 → **10**
- Host-agent-listener: 4 → **6**

---

## What's Still Needed for SDLC GUI

### 1. Infrastructure Health Page
Display `agent_infrastructure_health` data with:
- Component status cards (green/yellow/red)
- Last heartbeat timestamp
- Staleness warning (if > 2 minutes)
- Recent logs viewer (expandable)

### 2. Control Actions Buttons
For each component that supports control:

**Host Listener:**
- [Restart] → Publishes `{"action": "restart"}` to `agog.control.host_listener`
- [Get Logs] → Publishes `{"action": "get_logs"}` and displays result
- [Status] → Publishes `{"action": "status"}` and displays result

**Docker Containers (via orchestrator):**
- [Restart Orchestrator] → Docker API via backend
- [Restart NATS] → Docker API
- [Restart Ollama] → Docker API

### 3. Log Viewer Component
```tsx
<LogViewer
  logs={recentLogs}
  maxHeight={400}
  autoScroll={true}
  filter={['INFO', 'ERROR', 'WARN']}
/>
```

### 4. API Endpoints Needed

**Already Exists:**
- `GET /api/agent/infrastructure/health` - Get all component statuses
- `POST /api/agent/infrastructure/health` - Update component status

**Needed:**
```typescript
// Send control command via NATS
POST /api/agent/infrastructure/control
Body: { component: 'host_listener', action: 'restart' }

// Get logs for component
GET /api/agent/infrastructure/:component/logs?count=50

// Restart Docker container (orchestrator must be healthy)
POST /api/agent/infrastructure/docker/restart
Body: { container: 'agogsaas-agents-nats' }
```

---

## How Control Commands Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          SDLC GUI                                   │
│  [Restart Host Listener]                                           │
│        │                                                            │
│        ▼                                                            │
│  POST /api/agent/infrastructure/control                            │
│        │                                                            │
└────────┼────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        VPS SDLC API                                 │
│  Receives request, publishes to NATS:                              │
│    Subject: agog.control.host_listener                             │
│    Data: {"action": "restart"}                                     │
│        │                                                            │
└────────┼────────────────────────────────────────────────────────────┘
         │ NATS (via docker: agogsaas-agents-nats)
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    HOST-AGENT-LISTENER                              │
│  Subscribed to: agog.control.host_listener                         │
│  Receives command, executes:                                       │
│    - restart → process.exit(0), bat script restarts               │
│    - status → respond with current status                         │
│    - get_logs → respond with sanitized logs                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## For Docker Container Control

The orchestrator (running in Docker) can control other containers via Docker socket:

```typescript
// In strategic-orchestrator.service.ts
import Docker from 'dockerode';

const docker = new Docker({ socketPath: '/var/run/docker.sock' });

async restartContainer(containerName: string) {
  const container = docker.getContainer(containerName);
  await container.restart();
}
```

Requires `docker-compose.yml` volume mount:
```yaml
agogsaas-agents-backend:
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock
```

---

## Security Considerations

1. **Log Sanitization** - All sensitive data redacted before leaving host
2. **NATS Authentication** - Control commands require valid NATS credentials
3. **No Direct Shell Access** - Only predefined commands supported
4. **Audit Trail** - All control commands logged locally and in SDLC

---

## Implementation Order

### Phase 1: Backend (Done ✅)
- [x] Log sanitization patterns
- [x] Heartbeat publishing to SDLC
- [x] NATS control channel subscription
- [x] Restart/status/get_logs commands

### Phase 2: API Bridge (Needed)
- [ ] Add `/api/agent/infrastructure/control` endpoint to VPS API
- [ ] Add NATS request-reply wrapper
- [ ] Add `/api/agent/infrastructure/:component/logs` endpoint

### Phase 3: GUI (Needed)
- [ ] Infrastructure Health page
- [ ] Component status cards
- [ ] Control action buttons
- [ ] Log viewer component

### Phase 4: Docker Control (Needed)
- [ ] Mount Docker socket in orchestrator container
- [ ] Add Docker control service
- [ ] Add restart container endpoint

---

*Created: 2026-01-10*
