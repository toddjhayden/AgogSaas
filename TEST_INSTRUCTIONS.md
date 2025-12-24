# Test Instructions - Verify Separation Works

**Last Updated:** 2025-12-21
**Status:** Ready for Testing

---

## Test 1: Application Runs Standalone (NO Agents)

### Start Application
```batch
Double-click: D:\GitHub\agogsaas\.claude\RUN_APPLICATION.bat
```

### Verify Services Started
```bash
cd D:\GitHub\agogsaas\Implementation\print-industry-erp
docker-compose -f docker-compose.app.yml ps
```

**Expected Output:**
```
NAME                      STATUS
agogsaas-app-postgres     Up (healthy)
agogsaas-app-backend      Up
agogsaas-app-frontend     Up
agogsaas-app-ollama       Up (healthy)
```

**Should NOT see:** `agogsaas-nats`, `agogsaas-agents-backend`

### Test Application Works
1. **Frontend:** http://localhost:3000
   - Should load React app
   - No errors in browser console

2. **GraphQL API:** http://localhost:4000/graphql
   - Should load GraphQL Playground
   - Can run queries

3. **Check Backend Logs:**
   ```bash
   docker-compose -f docker-compose.app.yml logs backend
   ```
   **Should see:**
   ```
   🚀 AgogSaaS ERP Application Server Ready
   ✅ Application Services:
     - Database: Connected
     - Health Monitoring: Active
     - GraphQL API: Ready
   ```
   **Should NOT see:** NATS, Orchestrator, Strategic mentions

### Stop Application
```batch
Double-click: D:\GitHub\agogsaas\.claude\STOP_APPLICATION.bat
```

**Result:** ✅ Application works WITHOUT agent system

---

## Test 2: Agent System Runs Standalone

### Start Agent System
```batch
Double-click: D:\GitHub\agogsaas\.claude\RUN_AGENTS.bat
```

### Verify Services Started
```bash
cd D:\GitHub\agogsaas\Implementation\print-industry-erp
docker-compose -f docker-compose.agents.yml ps
```

**Expected Output:**
```
NAME                          STATUS
agogsaas-agents-nats          Up
agogsaas-agents-backend       Up
```

### Test NATS Works
**NATS Monitor:** http://localhost:8223
- Should show NATS monitoring page
- Should show existing streams (agog_features_*)

### Test Orchestrator Works
**Check Logs:**
```bash
docker-compose -f docker-compose.agents.yml logs agent-backend
```

**Should see:**
```
AgogSaaS Agent Orchestration System
DEVELOPMENT ONLY - Not for production deployment
✅ Initialized
✅ Daemon running
Monitoring:
  - OWNER_REQUESTS.md for new feature requests
```

### Stop Agent System
```batch
Double-click: D:\GitHub\agogsaas\.claude\STOP_AGENTS.bat
```

**Result:** ✅ Agent system works independently

---

## Test 3: Both Systems Together

### Start Both Systems
```batch
# Terminal 1
RUN_APPLICATION.bat

# Terminal 2
RUN_AGENTS.bat
```

### Verify Independence
**Check Networks:**
```bash
docker network ls | grep agogsaas
```

**Should see:**
```
agogsaas_app_network
agogsaas_agents_network
```

**Two separate networks = systems are independent ✅**

### Test Workflow Execution
1. **Edit OWNER_REQUESTS.md:**
   ```
   File: project-spirit/owner_requests/OWNER_REQUESTS.md

   Find: REQ-INFRA-DASHBOARD-001
   Change Status to: REJECTED
   Save
   ```

2. **Watch Agent Backend Logs:**
   ```bash
   docker-compose -f docker-compose.agents.yml logs -f agent-backend
   ```

3. **Within 60 seconds, should see:**
   ```
   [StrategicOrchestrator] REJECTED request detected: REQ-INFRA-DASHBOARD-001
   [StrategicOrchestrator] REJECTED status - checking NATS for completed stages...
   [StrategicOrchestrator]   ✓ Stage 1 (cynthia) - deliverable found
   [StrategicOrchestrator]   ✓ Stage 2 (sylvia) - deliverable found
   [StrategicOrchestrator]   ✓ Stage 3 (roy) - deliverable found
   [StrategicOrchestrator]   ✗ Stage 4 (jen) - deliverable missing
   [StrategicOrchestrator]   → Resuming from stage 4
   ```

4. **Verify Smart Resume:**
   - Should NOT restart from Cynthia (stage 1)
   - Should resume from first missing stage (Jen or Billy)
   - Should reuse existing NATS deliverables

### Stop Both Systems
```batch
STOP_APPLICATION.bat
STOP_AGENTS.bat
```

**Result:** ✅ Systems work together but independently

---

## Test 4: Data Persistence

### Check Volumes Exist
```bash
docker volume ls | grep agogsaas
```

**Should see:**
```
agogsaas_app_postgres_data          (Application database)
agogsaas_app_backend_node_modules   (Application dependencies)
agogsaas_app_frontend_node_modules  (Application dependencies)
agogsaas_agents_nats_data           (Agent deliverables)
```

### Verify NATS History Preserved
```bash
docker run --rm -v agogsaas_agents_nats_data:/volume alpine ls -la /volume/jetstream/jetstream/\$G/streams
```

**Should see:**
```
agog_features_research    (Cynthia deliverables)
agog_features_critique    (Sylvia deliverables)
agog_features_backend     (Roy deliverables)
agog_features_frontend    (Jen deliverables - may be empty)
agog_features_qa          (Billy deliverables - may be empty)
agog_features_statistics  (Priya deliverables - may be empty)
```

**Result:** ✅ Data persists across container restarts

---

## Test 5: Deployment Simulation

### Package Application for Deployment
```bash
cd D:\GitHub\agogsaas\Implementation\print-industry-erp

# Create deployment archive
tar -czf agogsaas-app-deploy.tar.gz docker-compose.app.yml backend/ frontend/

# Verify size
ls -lh agogsaas-app-deploy.tar.gz
```

### Simulate Edge Deployment
```bash
# Extract in different directory (simulate remote server)
mkdir C:\temp\agogsaas-edge-test
cd C:\temp\agogsaas-edge-test

# Copy deployment files
cp D:\GitHub\agogsaas\Implementation\print-industry-erp\docker-compose.app.yml .

# Start application
docker-compose -f docker-compose.app.yml up -d

# Verify works
curl http://localhost:4000/graphql
# Should return GraphQL playground

# Cleanup
docker-compose -f docker-compose.app.yml down
cd D:\
rmdir /s /q C:\temp\agogsaas-edge-test
```

**Result:** ✅ Application deploys without agent dependencies

---

## Success Criteria

### ✅ Application Tests
- [ ] Application starts without agent system
- [ ] Frontend accessible (http://localhost:3000)
- [ ] GraphQL API works (http://localhost:4000/graphql)
- [ ] No NATS errors in backend logs
- [ ] No orchestration code runs
- [ ] Database connects properly

### ✅ Agent Tests
- [ ] Agent system starts independently
- [ ] NATS accessible (http://localhost:8223)
- [ ] Orchestrator daemon running
- [ ] OWNER_REQUESTS.md monitored
- [ ] Existing deliverables in NATS
- [ ] Can spawn workflows

### ✅ Separation Tests
- [ ] Different docker networks
- [ ] Different volumes
- [ ] Can run independently
- [ ] Stopping one doesn't affect other
- [ ] Application has NO NATS dependency
- [ ] Backend has NO orchestration code

### ✅ Workflow Tests
- [ ] REJECTED status detected
- [ ] NATS deliverables checked
- [ ] Resumes from correct stage
- [ ] Doesn't restart from beginning
- [ ] Smart resume works
- [ ] Deliverables publish to NATS

---

## Troubleshooting

### "Port 4000 already in use"
**Cause:** Old monolithic system still running

**Fix:**
```bash
docker-compose down  # Stop old system
RUN_APPLICATION.bat  # Start new system
```

### "Cannot find module 'nats'" in application
**Cause:** This is EXPECTED - application shouldn't have NATS

**Fix:** None needed - this proves separation works!

### "OWNER_REQUESTS.md not found" in agent logs
**Cause:** Volume mount issue

**Fix:**
```bash
docker-compose -f docker-compose.agents.yml exec agent-backend ls -la /workspace/project-spirit/owner_requests/
# Should show OWNER_REQUESTS.md
```

### "NATS connection failed" in agent backend
**Cause:** NATS not running

**Fix:**
```bash
docker-compose -f docker-compose.agents.yml up -d nats
docker-compose -f docker-compose.agents.yml logs nats
# Wait for "Server is ready"
```

---

## Quick Command Reference

### Application
```bash
# Start
RUN_APPLICATION.bat
docker-compose -f docker-compose.app.yml up -d

# Logs
docker-compose -f docker-compose.app.yml logs -f

# Status
docker-compose -f docker-compose.app.yml ps

# Stop
STOP_APPLICATION.bat
docker-compose -f docker-compose.app.yml stop
```

### Agents
```bash
# Start
RUN_AGENTS.bat
docker-compose -f docker-compose.agents.yml up -d

# Logs
docker-compose -f docker-compose.agents.yml logs -f agent-backend

# Status
docker-compose -f docker-compose.agents.yml ps

# Stop
STOP_AGENTS.bat
docker-compose -f docker-compose.agents.yml stop
```

---

**Status:** Ready for Testing
**Estimated Time:** 15-20 minutes to complete all tests
**Next Step:** Run Test 1 (Application Standalone)
