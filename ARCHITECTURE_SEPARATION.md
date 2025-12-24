# AgogSaaS Architecture: Application vs Agent System Separation

**Date:** 2025-12-21
**Critical Change:** Complete separation of production application from development agent system

---

## The Problem (Before)

Agent orchestration code was **embedded in the application backend**, making it:
- ❌ Not portable (requires NATS, agent dependencies)
- ❌ Cannot deploy to Edge/Cloud standalone
- ❌ Agent development tools mixed with production code
- ❌ Violates separation of concerns

---

## The Solution (After)

**Complete separation into two independent systems:**

### 1. APPLICATION STACK (Portable - Deploy Anywhere)
- **PostgreSQL** - ERP database
- **Backend** - Pure GraphQL API (NO agent code)
- **Frontend** - React ERP UI
- **Ollama** - Optional AI features (embeddings)

### 2. AGENT DEVELOPMENT SYSTEM (Local/CI Only)
- **NATS** - Agent communication
- **Agent Backend** - Orchestration system
- **Strategic Orchestrator** - Workflow automation
- **Mounts application code** - Agents read/write app source

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  AGENT DEVELOPMENT SYSTEM (docker-compose.agents.yml)           │
│  Local/CI Only - NEVER deployed to production                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌────────────────────────────────┐          │
│  │     NATS     │  │     Agent Backend              │          │
│  │  Jetstream   │◄─┤  - Strategic Orchestrator      │          │
│  │              │  │  - Agent Spawner               │          │
│  │  Deliverable │  │  - Workflow Engine             │          │
│  │  Streams     │  │  - NATS Publisher              │          │
│  └──────────────┘  └────────────────────────────────┘          │
│                              │                                   │
│                              │ Mounts & Modifies                 │
│                              ↓                                   │
│                    /workspace/app-backend                        │
│                    /workspace/app-frontend                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ Writes Code
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│  APPLICATION STACK (docker-compose.app.yml)                     │
│  Portable - Deploy to Edge/Cloud/Global                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  ┌──────────────┐  ┌────────────────┐         │
│  │ PostgreSQL │◄─┤   Backend    │◄─┤   Frontend     │         │
│  │  Database  │  │  GraphQL API │  │   React UI     │         │
│  │            │  │              │  │                │         │
│  │  ERP Data  │  │  PURE        │  │  ERP Dashboard │         │
│  │            │  │  Business    │  │                │         │
│  │            │  │  Logic       │  │                │         │
│  └────────────┘  └──────────────┘  └────────────────┘         │
│                                                                  │
│  ✅ NO agent dependencies                                       │
│  ✅ NO NATS                                                     │
│  ✅ NO orchestration code                                       │
│  ✅ Deploy ANYWHERE                                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
D:\GitHub\agogsaas\
├── Implementation/print-industry-erp/
│   │
│   ├── docker-compose.app.yml        ← APPLICATION (portable)
│   ├── docker-compose.agents.yml     ← AGENTS (dev only)
│   │
│   ├── backend/                      ← APPLICATION BACKEND
│   │   ├── src/
│   │   │   ├── index.ts             (NO orchestration code)
│   │   │   ├── modules/             (ERP business logic)
│   │   │   └── graphql/             (API schema)
│   │   └── package.json             (NO nats dependency)
│   │
│   ├── frontend/                     ← APPLICATION FRONTEND
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   └── components/
│   │   └── package.json
│   │
│   └── agent-backend/                ← AGENT SYSTEM (NEW)
│       ├── src/
│       │   ├── index.ts
│       │   ├── orchestration/
│       │   │   ├── orchestrator.service.ts
│       │   │   ├── strategic-orchestrator.service.ts
│       │   │   └── agent-spawner.service.ts
│       │   └── mcp/
│       │       └── mcp-client.service.ts
│       ├── scripts/
│       │   └── start-strategic-orchestrator.ts
│       └── package.json             (HAS nats dependency)
│
└── .claude/
    ├── RUN_APPLICATION.bat          ← Start ERP app
    ├── STOP_APPLICATION.bat         ← Stop ERP app
    ├── RUN_AGENTS.bat               ← Start agent system
    └── STOP_AGENTS.bat              ← Stop agent system
```

---

## Usage Guide

### For Production Use (Actual ERP Application)

**Start Application:**
```batch
Double-click: .claude\RUN_APPLICATION.bat
```

**Access Application:**
- Frontend: http://localhost:3000
- GraphQL API: http://localhost:4000/graphql
- Monitoring: http://localhost:3000/monitoring

**Stop Application:**
```batch
Double-click: .claude\STOP_APPLICATION.bat
```

**Deploy to Production:**
```bash
# Application is portable - deploy anywhere
docker-compose -f docker-compose.app.yml up -d

# Edge deployment
scp docker-compose.app.yml edge-server:/opt/agogsaas/
ssh edge-server "cd /opt/agogsaas && docker-compose -f docker-compose.app.yml up -d"

# Cloud deployment (Ionos, Google, Alibaba)
# Same docker-compose.app.yml works everywhere
```

---

### For Development (Agent-Driven Feature Development)

**Start Agent System:**
```batch
Double-click: .claude\RUN_AGENTS.bat
```

**Submit Feature Request:**
1. Edit: `project-spirit/owner_requests/OWNER_REQUESTS.md`
2. Add request with `Status: NEW`
3. Save file
4. Within 60 seconds, orchestrator spawns workflow:
   - Cynthia (Research)
   - Sylvia (Critique)
   - Roy (Backend Implementation)
   - Jen (Frontend Implementation)
   - Billy (QA Testing with Playwright MCP)
   - Priya (Statistics)

**Check Progress:**
- NATS Monitor: http://localhost:8223
- Deliverables: `backend/agent-output/deliverables/`
- Logs: `docker-compose -f docker-compose.agents.yml logs -f agent-backend`

**Stop Agent System:**
```batch
Double-click: .claude\STOP_AGENTS.bat
```

---

## Key Principles

### ✅ Application Stack
- **ZERO agent dependencies**
- **Portable** - runs on Edge/Cloud/Global
- **Production-ready** - deploy anywhere anytime
- **Self-contained** - PostgreSQL + Backend + Frontend
- **Stateless backend** - pure GraphQL API
- **Data in volumes** - survives container restarts

### ✅ Agent Development Stack
- **Development ONLY** - never deployed
- **Local/CI environments** - for feature development
- **Mounts application code** - agents modify source
- **NATS for communication** - agent deliverables
- **Workflow orchestration** - automated development
- **Separate from production** - cannot break live system

---

## Deployment Scenarios

### Phase 1: Local Testing (Current)
```
[Your Machine]
  ├── Application (docker-compose.app.yml)
  └── Agents (docker-compose.agents.yml)
```

### Phase 2: Edge + Cloud (Ionos)
```
[Edge Device]                    [Ionos Cloud]
  └── Application                  └── Application
      (docker-compose.app.yml)         (docker-compose.app.yml)
                                       (Sync via API)

[Your Machine]
  └── Agents (development only)
      (docker-compose.agents.yml)
```

### Phase 3: Global Deployment (Google Kafka)
```
[Edge Devices Worldwide]         [Google Cloud]
  └── Application                  └── Kafka + Application
                                       (Global sync)

[Alibaba Cloud - China]
  └── Application (same stack)

[Your Machine]
  └── Agents (development only)
```

### Final Phase: Multi-Cloud Global
```
[100+ Edge Devices]
  └── Application (identical everywhere)

[Google Cloud - US/EU]
  └── Kafka + Application

[Alibaba Cloud - China]
  └── Kafka + Application

[Development Team]
  └── Agents (CI/CD pipeline)
      └── Code → Git → Auto-deploy
```

---

## Migration Notes

### What Changed

**Removed from Application Backend:**
- ❌ `src/orchestration/` (moved to agent-backend)
- ❌ `src/nats/` (moved to agent-backend)
- ❌ `src/mcp/` (moved to agent-backend)
- ❌ NATS dependency from package.json
- ❌ Orchestration code from index.ts
- ❌ Agent activity tracking

**Added to Agent Backend:**
- ✅ `agent-backend/src/orchestration/`
- ✅ `agent-backend/src/mcp/`
- ✅ `agent-backend/src/index.ts` (orchestrator main)
- ✅ Separate package.json with NATS
- ✅ Separate Dockerfile
- ✅ Volume mounts for app code access

### Breaking Changes

**Old (BROKEN):**
```bash
docker-compose up -d          # Started everything mixed
START_AGOGSAAS.bat           # Started agents + app
```

**New (CORRECT):**
```bash
# Application
docker-compose -f docker-compose.app.yml up -d
RUN_APPLICATION.bat

# Agents (separate)
docker-compose -f docker-compose.agents.yml up -d
RUN_AGENTS.bat
```

---

## Benefits

### For Business
1. **Deploy anywhere** - Edge/Cloud/Global identical
2. **Scale independently** - app vs agents
3. **Production isolation** - agents can't break prod
4. **Cost optimization** - run agents only when developing

### For Development
1. **Clean separation** - production code vs dev tools
2. **Portable application** - test deployment scenarios
3. **Agent experimentation** - modify without affecting app
4. **CI/CD friendly** - agents in pipeline, app deploys

### For Architecture
1. **Microservices ready** - services properly separated
2. **Container orchestration** - K8s/Docker Swarm compatible
3. **Cloud-native** - follows 12-factor principles
4. **Scalable** - horizontal scaling for app, vertical for agents

---

## Verification Checklist

### ✅ Application Independence
- [ ] Backend has NO orchestration code
- [ ] Backend has NO NATS dependency
- [ ] Backend package.json clean
- [ ] Frontend unchanged (no agent dependencies)
- [ ] Application runs without agent system
- [ ] Can deploy docker-compose.app.yml standalone

### ✅ Agent System Functionality
- [ ] Agent backend has orchestration code
- [ ] NATS runs in agent system
- [ ] Orchestrator can spawn workflows
- [ ] Agents can modify application code (via mounts)
- [ ] OWNER_REQUESTS.md monitoring works
- [ ] Deliverables publish to NATS

### ✅ Separation Verification
- [ ] Application and agents run independently
- [ ] Stopping agents doesn't affect app
- [ ] Stopping app doesn't affect agents
- [ ] Different docker networks
- [ ] Different volumes
- [ ] No shared dependencies

---

## Troubleshooting

### Application Won't Start
```bash
# Check logs
docker-compose -f docker-compose.app.yml logs

# Verify database
docker-compose -f docker-compose.app.yml exec postgres psql -U agogsaas_user -d agogsaas

# Check health
curl http://localhost:4000/graphql
```

### Agent System Won't Start
```bash
# Check logs
docker-compose -f docker-compose.agents.yml logs

# Verify NATS
curl http://localhost:8223/

# Check orchestrator
docker-compose -f docker-compose.agents.yml logs agent-backend
```

### Agents Not Modifying Code
```bash
# Verify volume mounts
docker-compose -f docker-compose.agents.yml exec agent-backend ls -la /workspace/app-backend

# Check permissions
docker-compose -f docker-compose.agents.yml exec agent-backend ls -la /workspace
```

---

## Future Work

### Phase 2: Ionos Deployment
- [ ] Set up Ionos cloud instance
- [ ] Deploy docker-compose.app.yml
- [ ] Configure edge sync
- [ ] Test global access

### Phase 3: Google Kafka Integration
- [ ] Set up Kafka cluster
- [ ] Implement event sourcing
- [ ] Multi-region sync
- [ ] Edge-to-cloud replication

### Phase 4: Alibaba Cloud (China)
- [ ] Deploy to Alibaba Cloud
- [ ] Configure China-specific compliance
- [ ] Cross-cloud sync via Kafka
- [ ] Performance optimization

---

**Status:** ✅ Complete
**Last Updated:** 2025-12-21
**Version:** 2.0 (Separated Architecture)
