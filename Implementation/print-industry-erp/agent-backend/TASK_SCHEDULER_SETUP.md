# Windows Task Scheduler Setup

## Overview
Use Windows Task Scheduler to run services in the background without visible windows. Recovery will restart them if they stop.

## Option 1: Run All Daemons Together (Recommended)

**Task Name:** `AGOG - Proactive Daemons`

1. Open Task Scheduler (`taskschd.msc`)
2. Create Basic Task
   - Name: `AGOG - Proactive Daemons`
   - Description: `Runs Recovery, Value Chain Expert, Product Owners, Metrics`
3. Trigger: **At system startup**
4. Action: **Start a program**
   - Program: `D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-daemons.bat`
5. Settings:
   - ✅ Run whether user is logged on or not
   - ✅ Run with highest privileges
   - ✅ If task fails, restart every: **1 minute** (attempts: 3)
   - ⬜ Stop task if runs longer than: (unchecked - runs continuously)

**What it does:**
- Starts all proactive daemons (Recovery, Value Chain, POs, Metrics)
- Recovery runs every 5 hours and restarts orchestrator/listener if stopped
- No visible windows

## Option 2: Run Services Separately

### Task 1: Strategic Orchestrator

1. Create Task: `AGOG - Orchestrator`
2. Trigger: **At system startup**
3. Action: `D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-orchestrator.bat`
4. Settings: Same as above

### Task 2: Host Agent Listener

1. Create Task: `AGOG - Listener`
2. Trigger: **At system startup**
3. Action: `D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-listener.bat`
4. Settings: Same as above

### Task 3: Proactive Daemons

1. Create Task: `AGOG - Daemons`
2. Trigger: **At system startup**
3. Action: `D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\start-daemons.bat`
4. Settings: Same as above

## Testing

After setup, test immediately:
```powershell
# Run the task manually
schtasks /Run /TN "AGOG - Proactive Daemons"

# Check if running
tasklist | findstr "node"

# View logs
tail -f D:\GitHub\agogsaas\Implementation\print-industry-erp\agent-backend\logs\daemons.log
```

## Recovery Behavior

With Task Scheduler:
- **Every 5 hours:** Recovery checks health, marks stuck workflows PENDING
- **If orchestrator/listener crash:** Task Scheduler auto-restarts them (1 min delay, 3 attempts)
- **If Recovery daemon crashes:** Task Scheduler restarts all daemons

## Removing Recovery's Process Spawning

Since Task Scheduler handles keeping services running, Recovery doesn't need to spawn processes anymore. It just:
1. Scans for stuck workflows
2. Marks them PENDING
3. Checks health status
