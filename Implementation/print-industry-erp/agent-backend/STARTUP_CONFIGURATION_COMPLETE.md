# AGOG Startup Configuration Complete

## Summary

Successfully configured AGOG services to run automatically on Windows login using the Startup folder method (no admin rights required).

## What Was Installed

Three VBS scripts in Windows Startup folder:
- `AGOG-Orchestrator.vbs` - Starts Strategic Orchestrator
- `AGOG-Listener.vbs` - Starts Host Agent Listener
- `AGOG-Daemons.vbs` - Starts all proactive daemons (Recovery, Value Chain, POs, Metrics)

**Location:** `C:\Users\toddj\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`

## How It Works

1. **On Login**: Windows automatically executes all `.vbs` files in the Startup folder
2. **Hidden Execution**: VBS scripts use `WshShell.Run` with window style `0` (hidden)
3. **No Windows**: Services run completely in the background with no visible console windows
4. **Auto-Restart**: Services run every time you log in to Windows

## Services Running

All three batch files are executed hidden:

### 1. start-orchestrator.bat
- Runs: `scripts/start-strategic-orchestrator.ts`
- Port: NATS on localhost:4223
- Purpose: Picks up PENDING workflows and spawns specialist agents

### 2. start-listener.bat
- Runs: `scripts/host-agent-listener.ts`
- Port: NATS on localhost:4223
- Purpose: Receives deliverables from specialist agents, publishes to NATS

### 3. start-daemons.bat
- Runs: `scripts/start-all-services.ts`
- Services started:
  - **Recovery** (runs immediately, then every 5 hours)
  - **Value Chain Expert** (runs after 5 min, then every 5 hours)
  - **Product Owner Daemons** (Sales, Procurement, Warehouse)
  - **Metrics Dashboard** (monitors all deliverables)

## Current Status

✅ **All services running** (verified with `check-processes.ps1`)
✅ **38 Node.js processes** active as of 1:04 PM, Dec 23, 2025
✅ **VBS files installed** in Startup folder (created at 1:16 PM, Dec 23, 2025)
✅ **Hidden execution** - no visible windows
✅ **Auto-start on login** - will run every time you log in

## Recovery Behavior

Recovery daemon runs every 5 hours:
1. Scans for stuck workflows (EXECUTING > 1 hour old)
2. Marks stuck workflows as PENDING
3. Checks orchestrator and listener health
4. Restarts services if needed

**Next Recovery run:** 5 hours from last startup

## Manual Control

### Check Running Processes
```powershell
.\check-processes.ps1
```

### Manually Start Services
```cmd
wscript "C:\Users\toddj\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\AGOG-Orchestrator.vbs"
wscript "C:\Users\toddj\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\AGOG-Listener.vbs"
wscript "C:\Users\toddj\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\AGOG-Daemons.vbs"
```

### Remove from Startup
Delete the VBS files:
```powershell
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\AGOG-*.vbs"
```

## Why Startup Folder Instead of Task Scheduler

**Attempted Task Scheduler first** but got "Access denied" errors:
- Creating scheduled tasks with startup triggers requires Administrator privileges
- Running as user `toddj` without admin rights (`IsAdmin = False`)

**Startup folder solution:**
- ✅ No admin rights required
- ✅ Simple to manage (just delete VBS files to disable)
- ✅ Hidden execution works perfectly
- ✅ Auto-runs on every login
- ⚠️ Only runs when user logs in (not on system boot)
- ⚠️ No automatic restart on failure (but Recovery will restart services every 5 hours)

## Architecture

```
Windows Startup
    ↓
AGOG-Orchestrator.vbs → start-orchestrator.bat → start-strategic-orchestrator.ts
AGOG-Listener.vbs → start-listener.bat → host-agent-listener.ts
AGOG-Daemons.vbs → start-daemons.bat → start-all-services.ts
                                             ↓
                            ┌────────────────┴────────────────┐
                            ↓                                  ↓
                    Recovery (every 5hrs)         Value Chain Expert (every 5hrs)
                    PO Daemons                     Metrics Dashboard
```

## Files Created

### PowerShell Installation Scripts
- `install-startup.ps1` - Installs VBS scripts to Startup folder ✅
- `register-tasks.ps1` - Attempted Task Scheduler (failed - access denied)
- `register-tasks-user.ps1` - Attempted Task Scheduler (failed - access denied)

### Utility Scripts
- `check-processes.ps1` - Lists running Node.js processes
- `list-startup-files.ps1` - Lists AGOG VBS files in Startup folder

### VBS Scripts (in Startup folder)
- `AGOG-Orchestrator.vbs` - 186 bytes
- `AGOG-Listener.vbs` - 182 bytes
- `AGOG-Daemons.vbs` - 181 bytes

### Batch Files (executed by VBS)
- `start-orchestrator.bat` - Sets env vars, runs orchestrator
- `start-listener.bat` - Sets env vars, runs listener
- `start-daemons.bat` - Sets env vars, runs all daemons

## Next Steps

1. **Test on Reboot**: Log out and log back in to verify auto-start
2. **Monitor Recovery**: Check logs after 5 hours to verify Recovery ran
3. **Check Deliverables**: Use Metrics Dashboard to view all agent outputs

## Logs

All service logs are written to:
- `logs/orchestrator.log`
- `logs/listener.log`
- `logs/daemons.log`

Use PowerShell `Get-Content` with `-Tail` and `-Wait` to tail logs:
```powershell
Get-Content logs\daemons.log -Tail 50 -Wait
```
